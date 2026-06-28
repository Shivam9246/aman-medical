// routes/orders.js

const express = require('express');
const router  = express.Router();

const {
  placeOrder,
  getMyOrders,
  getAllOrders,
  getOrder,
  updateOrderStatus,
  downloadInvoice,
} = require('../controllers/orderController');

const { protect, adminOnly, optionalAuth } = require('../middleware/auth');

// ── Customer routes ───────────────────────────────────────────
// optionalAuth: attaches user if logged in, but guest checkout works too
router.post('/',      optionalAuth, placeOrder);   // POST /api/orders
router.get( '/my',   protect,      getMyOrders);   // GET  /api/orders/my
router.get( '/:id/invoice', protect, downloadInvoice); // GET /api/orders/:id/invoice

// ── Admin routes ──────────────────────────────────────────────
router.get(   '/',    protect, adminOnly, getAllOrders);          // GET   /api/orders
router.get(   '/:id', protect, adminOnly, getOrder);             // GET   /api/orders/:id
router.patch( '/:id/status', protect, adminOnly, updateOrderStatus); // PATCH /api/orders/:id/status

module.exports = router;
