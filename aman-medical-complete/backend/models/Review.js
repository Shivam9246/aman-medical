// models/Review.js — Product reviews from verified purchasers

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true, // proof of purchase — only delivered orders can leave a review
    },
    userName: {
      type: String,
      required: true, // snapshot, in case the user later changes their name
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: '',
      maxlength: [600, 'Review cannot exceed 600 characters'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// One review per user per product per order — prevents spamming multiple
// reviews for the same purchase, but still allows a fresh review on a
// separate re-order of the same product.
reviewSchema.index({ product: 1, user: 1, order: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
