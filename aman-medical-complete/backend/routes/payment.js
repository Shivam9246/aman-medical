// routes/payment.js

const express = require('express');
const router  = express.Router();

const { createRazorpayOrder, verifyAndPlaceOrder } = require('../controllers/paymentController');
const { optionalAuth } = require('../middleware/auth');

// POST /api/payment/create-order — create a Razorpay order for the cart
router.post('/create-order', optionalAuth, createRazorpayOrder);

// POST /api/payment/verify — verify signature & save the real Order
router.post('/verify', optionalAuth, verifyAndPlaceOrder);

module.exports = router;
