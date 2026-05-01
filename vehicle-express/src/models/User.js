const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName:      { type: String, required: true },
  firstName:     { type: String, trim: true },
  lastName:      { type: String, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  password:      { type: String, required: true },
  role:          { type: String, required: true, enum: ['CUSTOMER', 'ADMIN', 'MARKETING_MANAGER'], default: 'CUSTOMER' },
  contactNumber: { type: String },
  phone:         { type: String, trim: true },
  secondaryPhone:{ type: String, trim: true },
  profileImage:  { type: String, trim: true },
  address: {
    houseNo:    { type: String, trim: true, default: '' },
    lane:       { type: String, trim: true, default: '' },
    city:       { type: String, trim: true, default: '' },
    district:   { type: String, trim: true, default: '' },
    province:   { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
  },
  securityQuestion: { type: String, trim: true },
  securityAnswer:   { type: String, select: false },
  isActive:      { type: Boolean, default: true },
  isPremium:     { type: Boolean, default: false },
  cardNumber:    { type: String },
  isDeleted:     { type: Boolean, default: false },
  deletedAt:     { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
