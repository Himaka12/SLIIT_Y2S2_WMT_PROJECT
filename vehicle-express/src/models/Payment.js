const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
    default: 'LKR',
    trim: true,
  },
  paymentType: {
    type: String,
    required: true,
    enum: ['premium_upgrade'],
    default: 'premium_upgrade',
  },
  status: {
    type: String,
    required: true,
    enum: ['approved'],
    default: 'approved',
  },
  purchaseId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['card'],
    default: 'card',
  },
  cardLast4: {
    type: String,
    required: true,
    trim: true,
  },
  cardBrand: {
    type: String,
    required: true,
    enum: ['visa', 'mastercard', 'unionpay'],
    trim: true,
  },
  premiumPlan: {
    type: String,
    trim: true,
    default: 'wheelzy_premium_demo',
  },
  upgradeType: {
    type: String,
    trim: true,
    default: 'premium_profile',
  },
  adminViewedAt: {
    type: Date,
    default: null,
  },
  userViewedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
