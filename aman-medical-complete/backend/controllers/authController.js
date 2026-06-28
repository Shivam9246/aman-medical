// controllers/authController.js — Register, Login, Admin Login

const jwt           = require('jsonwebtoken');
const User          = require('../models/User');
const { createError } = require('../middleware/errorHandler');

// ── Helper: sign JWT ──────────────────────────────────────────
const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── Helper: send token response ───────────────────────────────
const sendToken = (res, statusCode, user) => {
  const token = signToken({ id: user._id, role: user.role });

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id:       user._id,
      name:     user.name,
      email:    user.email,
      role:     user.role,
      wishlist: user.wishlist,
    },
  });
};

// ────────────────────────────────────────────────────────────
// POST /api/auth/register
// ────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return next(createError('An account with this email already exists.', 409));
    }

    const user = await User.create({ name, email, password });
    sendToken(res, 201, user);
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(createError('Email and password are required.', 400));
    }

    // +password because field is select:false in schema
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return next(createError('Incorrect email or password.', 401));
    }

    sendToken(res, 200, user);
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// POST /api/auth/admin-login
// Admin credentials live in .env — not in MongoDB
// ────────────────────────────────────────────────────────────
exports.adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (
      email    !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return next(createError('Invalid admin credentials.', 401));
    }

    const token = signToken({ role: 'admin', email });

    res.status(200).json({
      success: true,
      token,
      user: { role: 'admin', email },
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ────────────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.json({ success: true, user: req.user });
    }

    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      user: {
        id:       user._id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        wishlist: user.wishlist,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// PUT /api/auth/wishlist  (protected — customer)
// Body: { productId }  — toggles wishlist
// ────────────────────────────────────────────────────────────
exports.toggleWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!productId) return next(createError('productId is required.', 400));

    const user = await User.findById(req.user._id);
    const idx  = user.wishlist.indexOf(productId);

    if (idx >= 0) {
      user.wishlist.splice(idx, 1);
    } else {
      user.wishlist.push(productId);
    }

    await user.save();
    res.json({ success: true, wishlist: user.wishlist });
  } catch (err) {
    next(err);
  }
};
