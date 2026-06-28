// config/db.js — MongoDB connection via Mongoose

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 8+ has these on by default but explicit is fine
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Graceful disconnect on process exit
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed on app exit');
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
