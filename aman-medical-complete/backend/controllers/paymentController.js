// controllers/paymentController.js — Razorpay order creation & verification

const crypto   = require('crypto');
const Razorpay = require('razorpay');
const Order    = require('../models/Order');
const Product  = require('../models/Product');
const { createError } = require('../middleware/errorHandler');

let razorpay = null;

function getRazorpay() {
  if (razorpay) return razorpay;

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }

  razorpay = new Razorpay({
    key_id:    process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  return razorpay;
}

// ────────────────────────────────────────────────────────────
// POST /api/payment/create-order
// Creates a Razorpay order for the given cart, BEFORE the real
// Order document is created. Amount is recalculated server-side
// from live product prices — never trust a client-sent amount.
// Body: { items: [{ productId, qty }] }
// ────────────────────────────────────────────────────────────
exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return next(createError('Cart is empty.', 400));
    }

    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, isActive: true });

      if (!product) {
        return next(createError(`Product not found: ${item.productId}`, 404));
      }
      if (product.stock < item.qty) {
        return next(
          createError(`Insufficient stock for "${product.name}". Available: ${product.stock}`, 400)
        );
      }

      subtotal += product.price * item.qty;
    }

    const delivery = subtotal >= 499 ? 0 : 49;
    const total    = subtotal + delivery;

    const rzp = getRazorpay();
    if (!rzp) {
      return next(createError('Online payments are not configured yet. Please use Cash on Delivery.', 503));
    }

    // Razorpay expects amount in the smallest currency unit (paise for INR)
    const razorpayOrder = await rzp.orders.create({
      amount:   Math.round(total * 100),
      currency: 'INR',
      receipt:  `rcpt_${Date.now()}`,
    });

    res.json({
      success:  true,
      orderId:  razorpayOrder.id,
      amount:   razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
      subtotal,
      delivery,
      total,
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// POST /api/payment/verify
// Verifies the Razorpay payment signature, then creates the
// real Order in our DB with payment.status = 'paid'.
// Body: {
//   razorpay_order_id, razorpay_payment_id, razorpay_signature,
//   customerName, customerPhone, customerEmail, address,
//   paymentMethod,   // 'UPI' | 'Credit / Debit Card'
//   items,           // [{ productId, qty }]
// }
// ────────────────────────────────────────────────────────────
exports.verifyAndPlaceOrder = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customerName,
      customerPhone,
      customerEmail,
      address,
      paymentMethod,
      items,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return next(createError('Missing payment verification fields.', 400));
    }

    // ── Verify signature using our key secret ───────────────
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return next(createError('Payment verification failed. Signature mismatch.', 400));
    }

    // ── Signature is valid — now build & save the real order ─
    if (!items || items.length === 0) {
      return next(createError('Order must contain at least one item.', 400));
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, isActive: true });

      if (!product) {
        return next(createError(`Product not found: ${item.productId}`, 404));
      }
      if (product.stock < item.qty) {
        return next(
          createError(`Insufficient stock for "${product.name}". Available: ${product.stock}`, 400)
        );
      }

      const itemSubtotal = product.price * item.qty;
      subtotal += itemSubtotal;

      orderItems.push({
        product:  product._id,
        name:     product.name,
        emoji:    product.emoji,
        price:    product.price,
        qty:      item.qty,
        subtotal: itemSubtotal,
      });
    }

    const delivery = subtotal >= 499 ? 0 : 49;
    const total    = subtotal + delivery;

    const order = await Order.create({
      customer:      req.user ? req.user._id : null,
      customerName,
      customerPhone,
      customerEmail: customerEmail || (req.user ? req.user.email : null),
      address,
      payment: {
        method: paymentMethod || 'UPI',
        status: 'paid',
        razorpayOrderId:   razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      },
      items: orderItems,
      subtotal,
      delivery,
      total,
    });

    // ── Deduct stock AFTER order is saved ────────────────────
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.qty } });
    }

    res.status(201).json({
      success: true,
      orderId: order.orderId,
      total,
      delivery,
      message: 'Payment verified and order placed successfully!',
    });
  } catch (err) {
    next(err);
  }
};
