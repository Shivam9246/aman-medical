// server.js — AMAN MEDICAL Express + MongoDB API

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const connectDB  = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');

// ── Routes ────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const productRoutes   = require('./routes/products');
const orderRoutes     = require('./routes/orders');
const paymentRoutes   = require('./routes/payment');
const newsletterRoutes = require('./routes/newsletter');
const reviewRoutes    = require('./routes/reviews');

// ── Connect to MongoDB ────────────────────────────────────────
connectDB();

const app = express();

// ── Security headers ──────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  'http://localhost:5500',      // Live Server default
  'http://127.0.0.1:5500',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// ── Body parser ───────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request logger (dev only) ─────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Rate limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      100,               // max 100 requests per IP per window
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,                // stricter for auth routes
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use('/api', limiter);
app.use('/api/auth/login',       authLimiter);
app.use('/api/auth/admin-login', authLimiter);

// ── Mount API routes ──────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/payment',   paymentRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/reviews',   reviewRoutes);

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    service: 'AMAN MEDICAL API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── Root ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AMAN MEDICAL API is running 🏥',
    version: '1.0.0',
    docs: {
      auth:     '/api/auth',
      products: '/api/products',
      orders:   '/api/orders',
    },
  });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ── Global error handler (must be last) ───────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 AMAN MEDICAL API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 http://localhost:${PORT}`);
});

module.exports = app;
