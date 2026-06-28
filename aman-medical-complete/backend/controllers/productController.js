// controllers/productController.js — Product CRUD & stock management

const Product = require('../models/Product');
const { createError } = require('../middleware/errorHandler');

// ────────────────────────────────────────────────────────────
// GET /api/products
// Public — supports ?category=Medicines&search=para&page=1&limit=20
// ────────────────────────────────────────────────────────────
exports.getProducts = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 50 } = req.query;

    const filter = { isActive: true };

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (search) {
      // Full-text search on name + desc (requires text index)
      filter.$text = { $search: search };
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page:    Number(page),
      pages:   Math.ceil(total / Number(limit)),
      products,
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/products/:id
// Public
// ────────────────────────────────────────────────────────────
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isActive: true });
    if (!product) return next(createError('Product not found.', 404));
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// POST /api/products  (admin only)
// ────────────────────────────────────────────────────────────
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name, category, emoji, price, oldPrice, stock,
      lowStockThreshold, rx, tag, bg, rating, desc, unit, mfg,
    } = req.body;

    const product = await Product.create({
      name, category, emoji, price,
      oldPrice: oldPrice || null,
      stock:    stock    || 0,
      lowStockThreshold: lowStockThreshold || Math.max(5, Math.round((stock || 0) * 0.2)),
      rx:    rx    || false,
      tag:   tag   || null,
      bg:    bg    || '#E9F0FB',
      rating: rating || 4.5,
      desc:  desc  || '',
      unit:  unit  || '1 unit',
      mfg:   mfg   || '',
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// PUT /api/products/:id  (admin only)
// ────────────────────────────────────────────────────────────
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) return next(createError('Product not found.', 404));
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// PATCH /api/products/:id/stock  (admin only)
// Body: { stock } — fast stock-only update
// ────────────────────────────────────────────────────────────
exports.updateStock = async (req, res, next) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) {
      return next(createError('Valid stock value is required.', 400));
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock: Number(stock) },
      { new: true, runValidators: true }
    );

    if (!product) return next(createError('Product not found.', 404));
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// DELETE /api/products/:id  (admin only — soft delete)
// ────────────────────────────────────────────────────────────
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) return next(createError('Product not found.', 404));
    res.json({ success: true, message: 'Product removed from catalog.' });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/products/admin/all  (admin only — includes inactive)
// ────────────────────────────────────────────────────────────
exports.getAllProductsAdmin = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    const stats = {
      total:    products.length,
      active:   products.filter(p => p.isActive).length,
      lowStock: products.filter(p => p.isActive && p.stock > 0 && p.stock <= p.lowStockThreshold).length,
      outStock: products.filter(p => p.isActive && p.stock === 0).length,
    };

    res.json({ success: true, stats, products });
  } catch (err) {
    next(err);
  }
};
