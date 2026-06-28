// routes/newsletter.js

const express = require('express');
const router  = express.Router();

const { subscribe } = require('../controllers/newsletterController');

// POST /api/newsletter/subscribe — public, no auth required
router.post('/subscribe', subscribe);

module.exports = router;
