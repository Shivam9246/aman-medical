// models/Order.js — Customer orders

const mongoose = require('mongoose');

// ── Embedded schema: each line item in an order ───────────────
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name:     { type: String, required: true },   // snapshot at time of order
    emoji:    { type: String, default: '💊' },
    price:    { type: Number, required: true },   // snapshot price
    qty:      { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

// ── Main order schema ─────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,  // null = guest checkout
    },
    customerName:  { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerEmail: { type: String, default: null, lowercase: true },
    address:       { type: String, required: true },
    payment: {
      method: {
        type: String,
        enum: ['Cash on Delivery', 'UPI', 'Credit / Debit Card'],
        default: 'Cash on Delivery',
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      razorpayOrderId:   { type: String, default: null },
      razorpayPaymentId: { type: String, default: null },
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [v => v.length > 0, 'Order must have at least one item'],
    },
    subtotal: { type: Number, required: true },
    delivery: { type: Number, default: 0 },
    total:    { type: Number, required: true },
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'packed', 'dispatched', 'delivered', 'cancelled'],
      default: 'placed',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// ── Auto-generate orderId before saving ───────────────────────
orderSchema.pre('save', function (next) {
  if (!this.orderId) {
    this.orderId = 'AM' + Math.floor(100000 + Math.random() * 899999);
  }
  next();
});

// ── Index for quick customer lookups ─────────────────────────
// Note: orderId already has unique:true which creates its own index
orderSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
