// middleware/auth.js — JWT & admin auth middleware

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── Verify JWT token (customer or admin) ──────────────────────
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Not authorised — no token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.',
      });
    }

    // Admin token — no DB lookup needed
    if (decoded.role === 'admin') {
      req.user = { id: 'admin', role: 'admin', email: decoded.email };
      return next();
    }

    // Customer token — look up from DB
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// ── Admin-only guard (must come after protect) ────────────────
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({
    success: false,
    message: 'Access denied — admins only.',
  });
};

// ── Optional auth — attaches user if token present but doesn't block ──
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'admin') {
      req.user = { id: 'admin', role: 'admin' };
    } else {
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch {
    // Invalid token — just continue without user
  }
  next();
};

module.exports = { protect, adminOnly, optionalAuth };
