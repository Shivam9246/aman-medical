// controllers/reviewController.js — Product reviews from verified purchasers

const mongoose = require('mongoose');
const Review   = require('../models/Review');
const Order    = require('../models/Order');
const Product  = require('../models/Product');
const { createError } = require('../middleware/errorHandler');

// ────────────────────────────────────────────────────────────
// Helper: recompute and store a product's average rating
// ────────────────────────────────────────────────────────────
async function recalculateProductRating(productId) {
  const objectId = new mongoose.Types.ObjectId(productId);
  const stats = await Review.aggregate([
    { $match: { product: objectId } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const avg = stats.length > 0 ? Math.round(stats[0].avg * 10) / 10 : 4.5; // fallback default
  await Product.findByIdAndUpdate(productId, { rating: avg });
  return { avg, count: stats.length > 0 ? stats[0].count : 0 };
}

// ────────────────────────────────────────────────────────────
// GET /api/reviews/:productId  — public, list reviews for a product
// ────────────────────────────────────────────────────────────
exports.getProductReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .sort({ createdAt: -1 })
      .select('userName rating comment createdAt');

    const ratingStats = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(req.params.productId) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      reviews,
      average: ratingStats.length > 0 ? Math.round(ratingStats[0].avg * 10) / 10 : null,
      count: ratingStats.length > 0 ? ratingStats[0].count : 0,
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/reviews/:productId/can-review — is the logged-in user
// eligible to review this product? (must have a delivered order
// containing it, and not have already reviewed that order's purchase)
// ────────────────────────────────────────────────────────────
exports.canReview = async (req, res, next) => {
  try {
    const userId    = req.user._id;
    const productId = req.params.productId;

    // Find delivered orders by this user containing this product
    const eligibleOrders = await Order.find({
      customer: userId,
      status: 'delivered',
      'items.product': productId,
    }).select('_id orderId');

    if (eligibleOrders.length === 0) {
      return res.json({ success: true, canReview: false, reason: 'no_delivered_order' });
    }

    // Exclude orders already reviewed by this user for this product
    const alreadyReviewed = await Review.find({
      user: userId,
      product: productId,
      order: { $in: eligibleOrders.map((o) => o._id) },
    }).select('order');

    const reviewedOrderIds = new Set(alreadyReviewed.map((r) => r.order.toString()));
    const availableOrder   = eligibleOrders.find((o) => !reviewedOrderIds.has(o._id.toString()));

    if (!availableOrder) {
      return res.json({ success: true, canReview: false, reason: 'already_reviewed' });
    }

    res.json({ success: true, canReview: true, orderId: availableOrder._id });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// POST /api/reviews — create a review (requires login + proof of purchase)
// Body: { productId, orderId, rating, comment }
// ────────────────────────────────────────────────────────────
exports.createReview = async (req, res, next) => {
  try {
    const { productId, orderId, rating, comment } = req.body;
    const userId = req.user._id;

    if (!productId || !orderId || !rating) {
      return next(createError('productId, orderId and rating are required.', 400));
    }
    if (rating < 1 || rating > 5) {
      return next(createError('Rating must be between 1 and 5.', 400));
    }

    // Verify the order belongs to this user, is delivered, and contains the product
    const order = await Order.findOne({
      _id: orderId,
      customer: userId,
      status: 'delivered',
      'items.product': productId,
    });

    if (!order) {
      return next(createError('You can only review products from your own delivered orders.', 403));
    }

    const review = await Review.create({
      product: productId,
      user: userId,
      order: orderId,
      userName: req.user.name,
      rating,
      comment: comment || '',
    });

    const { avg, count } = await recalculateProductRating(productId);

    res.status(201).json({
      success: true,
      review,
      productRating: avg,
      reviewCount: count,
      message: 'Review submitted — thanks for your feedback!',
    });
  } catch (err) {
    if (err.code === 11000) {
      return next(createError('You have already reviewed this purchase.', 400));
    }
    next(err);
  }
};
