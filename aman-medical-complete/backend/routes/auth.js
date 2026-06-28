// routes/auth.js

const express = require('express');
const { body  } = require('express-validator');
const router  = express.Router();

const {
  register,
  login,
  adminLogin,
  getMe,
  toggleWishlist,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

// Input validation helpers
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Validation middleware ─────────────────────────────────────
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors:  errors.array(),
    });
  }
  next();
};

// ── Routes ────────────────────────────────────────────────────
router.post('/register',    registerRules,  validate, register);
router.post('/login',       loginRules,     validate, login);
router.post('/admin-login', adminLogin);
router.get( '/me',          protect,        getMe);
router.put( '/wishlist',    protect,        toggleWishlist);

module.exports = router;
