const mongoose = require('mongoose');

const salesInquirySchema = new mongoose.Schema({
  vehicleId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  customerId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName:         { type: String, required: true },
  email:                { type: String, required: true },
  phone:                { type: String, required: true },
  contactMethod:        { type: String, enum: ['Call', 'WhatsApp', 'Email'] },
  inquiryType:          { type: String, enum: ['Price Negotiation', 'Vehicle Availability', 'Finance / Installment', 'Vehicle Condition', 'Inspection Appointment'] },
  customMessage:        { type: String, trim: true },
  vehicleTitle:         { type: String },
  vehiclePrice:         { type: Number },
  preferredContactTime: { type: String },
  message:              { type: String },
  status:               { type: String, default: 'Pending', enum: ['Pending', 'Resolved', 'Rejected'] },
  inquiryDate:          { type: String, required: true },
  submittedAt:          { type: Date, default: Date.now },
  adminViewedAt:        { type: Date, default: null },
  userViewedAt:         { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SalesInquiry', salesInquirySchema);
