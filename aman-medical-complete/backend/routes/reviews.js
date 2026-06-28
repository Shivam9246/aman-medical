// routes/reviews.js

const express = require('express');
const router  = express.Router();

const { getProductReviews, canReview, createReview } = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

// Public — anyone can see a product's reviews
router.get('/:productId', getProductReviews);

// Logged-in only — check eligibility & submit a review
router.get('/:productId/can-review', protect, canReview);
router.post('/', protect, createReview);

module.exports = router;
