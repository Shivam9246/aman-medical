// routes/products.js

const express = require('express');
const router  = express.Router();

const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  updateStock,
  deleteProduct,
  getAllProductsAdmin,
} = require('../controllers/productController');

const { protect, adminOnly } = require('../middleware/auth');

// ── Public routes ─────────────────────────────────────────────
router.get('/',    getProducts);   // GET /api/products
router.get('/:id', getProduct);   // GET /api/products/:id

// ── Admin-only routes ─────────────────────────────────────────
router.use(protect, adminOnly);

router.get(   '/admin/all',      getAllProductsAdmin);   // GET  /api/products/admin/all
router.post(  '/',               createProduct);         // POST /api/products
router.put(   '/:id',            updateProduct);         // PUT  /api/products/:id
router.patch( '/:id/stock',      updateStock);           // PATCH /api/products/:id/stock
router.delete('/:id',            deleteProduct);         // DELETE /api/products/:id (soft)

module.exports = router;
