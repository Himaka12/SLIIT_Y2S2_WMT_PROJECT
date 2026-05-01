const mongoose = require('mongoose');

const rentalBookingSchema = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle:        { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  startDate:      { type: String, required: true },   // ISO date string YYYY-MM-DD
  startTime:      { type: String, required: true },   // HH:mm
  endDate:        { type: String, required: true },
  endTime:        { type: String, required: true },
  requestedUnits: { type: Number, default: 1, min: 1 },
  unitPrice:      { type: Number, default: 0 },
  totalAmount:    { type: Number, default: 0 },
  status:         { type: String, default: 'Pending', enum: ['Pending', 'Approved', 'Rejected', 'Cancelled', 'Cancelled - Account Deleted'] },
  paymentSlipUrl: { type: String },
  paymentSlipViewedAt: { type: Date },
  paymentReviewedAt: { type: Date },
  refundEligibleUntil: { type: Date },
  adminViewedAt: { type: Date, default: null },
  userViewedAt: { type: Date, default: null },
  createdAt:      { type: Date, default: Date.now },
});

module.exports = mongoose.model('RentalBooking', rentalBookingSchema);
