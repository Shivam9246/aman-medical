// controllers/newsletterController.js — Newsletter signups

const Subscriber = require('../models/Subscriber');
const { sendWelcomeEmail } = require('../utils/mailer');
const { createError } = require('../middleware/errorHandler');

// ────────────────────────────────────────────────────────────
// POST /api/newsletter/subscribe
// Body: { email }
// ────────────────────────────────────────────────────────────
exports.subscribe = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return next(createError('Please provide a valid email address.', 400));
    }

    const normalizedEmail = email.toLowerCase().trim();

    // findOneAndUpdate with upsert: re-subscribing an old/inactive email
    // just reactivates it instead of throwing a duplicate-key error.
    await Subscriber.findOneAndUpdate(
      { email: normalizedEmail },
      { email: normalizedEmail, isActive: true },
      { upsert: true, new: true, runValidators: true }
    );

    // Try to send the welcome email, but don't fail the request if email sending
    // breaks (e.g. missing credentials) — the subscription itself still succeeded.
    try {
      await sendWelcomeEmail(normalizedEmail);
    } catch (mailErr) {
      console.error('⚠️  Could not send welcome email:', mailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Subscribed successfully! Check your inbox for a welcome email.',
    });
  } catch (err) {
    next(err);
  }
};
