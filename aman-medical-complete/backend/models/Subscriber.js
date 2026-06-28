// models/Subscriber.js — Newsletter subscribers

const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    isActive: {
      type: Boolean,
      default: true, // set to false if someone unsubscribes later
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Subscriber', subscriberSchema);
