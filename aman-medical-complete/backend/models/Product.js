// models/Product.js — Medical product catalog

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Medicines', 'Devices', 'Wellness', 'Safety', 'Personal Care'],
    },
    emoji: {
      type: String,
      default: '💊',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    oldPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 15,
      min: 0,
    },
    rx: {
      type: Boolean,
      default: false,  // true = prescription required
    },
    tag: {
      type: String,
      enum: ['sale', 'new', null],
      default: null,
    },
    bg: {
      type: String,
      default: '#E9F0FB',
    },
    rating: {
      type: Number,
      default: 4.5,
      min: 0,
      max: 5,
    },
    desc: {
      type: String,
      default: '',
      maxlength: [1000, 'Description too long'],
    },
    unit: {
      type: String,
      default: '1 unit',
    },
    mfg: {
      type: String,
      default: '',
      maxlength: [100, 'Manufacturer name too long'],
    },
    isActive: {
      type: Boolean,
      default: true,  // soft delete — false hides from catalog
    },
  },
  {
    timestamps: true,
  }
);

// ── Virtual: stock status ─────────────────────────────────────
productSchema.virtual('stockStatus').get(function () {
  if (this.stock <= 0) return 'out';
  if (this.stock <= this.lowStockThreshold) return 'low';
  return 'in';
});

// ── Ensure virtuals appear in JSON ────────────────────────────
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// ── Index for fast category + search queries ──────────────────
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: 'text', desc: 'text' });  // full-text search

module.exports = mongoose.model('Product', productSchema);
