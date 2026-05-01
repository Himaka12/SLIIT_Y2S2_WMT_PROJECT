const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  user:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  booking:            { type: mongoose.Schema.Types.ObjectId, ref: 'RentalBooking', required: true, unique: true },
  amount:             { type: Number, default: 0 },
  bankName:           { type: String },
  branchName:         { type: String },
  accountNumber:      { type: String },
  accountHolderName:  { type: String },
  status:             {
    type: String,
    default: 'Refund Requested',
    enum: ['Refund Requested', 'Refund Processing', 'Refunded', 'Refund Rejected'],
  },
  refundProofUrl:     { type: String },
  requestedAt:        { type: Date, default: Date.now },
  adminViewedAt:      { type: Date },
  userViewedAt:       { type: Date },
  processingStartedAt:{ type: Date },
  rejectedAt:         { type: Date },
  createdAt:          { type: Date, default: Date.now },
  processedAt:        { type: Date },
});

module.exports = mongoose.model('Refund', refundSchema);
