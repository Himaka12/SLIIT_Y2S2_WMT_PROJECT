const mongoose = require('mongoose');

const normalizeReviewMessage = (value) => String(value ?? '').trim();

const buildReviewStatus = (review) => {
  if (review?.adminDeleted) {
    return 'Removed';
  }

  if (review?.customerDeleted) {
    return 'Deleted';
  }

  if (review?.isVisible === false) {
    return 'Hidden';
  }

  return 'Active';
};

const reviewSchema = new mongoose.Schema({
  vehicleId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  userId:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId:            { type: mongoose.Schema.Types.ObjectId, ref: 'RentalBooking' },
  customerName:         { type: String },
  rating:               { type: Number, min: 1, max: 5, required: true },
  message:              { type: String, required: true, trim: true, minlength: 8, maxlength: 1200 },
  comment:              { type: String, maxlength: 1200 },
  images:               {
    type: [String],
    default: [],
    validate: {
      validator: (value) => Array.isArray(value) && value.length <= 5,
      message: 'A review can contain up to 5 images.',
    },
  },
  isVisible:            { type: Boolean, default: true },
  adminDeleted:         { type: Boolean, default: false },
  customerDeleted:      { type: Boolean, default: false },
  adminDeleteReason:    { type: String, maxlength: 1000, trim: true },
  adminDeletedAt:       { type: Date, default: null },
  hiddenByAdminAt:      { type: Date, default: null },
  customerDeletedAt:    { type: Date, default: null },
  lastModerationAction: { type: String, maxlength: 30, trim: true },
  lastCustomerAction:   { type: String, maxlength: 30, trim: true, default: 'created' },
  reviewDate:           { type: String },
  reviewStatus:         { type: String, maxlength: 40, default: 'Active' },
  adminRemovalReason:   { type: String, maxlength: 1000, trim: true },
  adminRemovalDate:     { type: String },
  aiSentiment:          { type: String, maxlength: 30 },
  aiReason:             { type: String, maxlength: 500 },
  replySource:          { type: String, maxlength: 30 },
  businessReply:        { type: String, maxlength: 1500 },
  businessReplyDate:    { type: String },
  requiresAdminAttention: { type: Boolean },
  adminAttentionStatus: { type: String, maxlength: 30 },
  adminAttentionReason: { type: String, maxlength: 500 },
  adminResponseDate:    { type: String },
  adminResponderName:   { type: String, maxlength: 150 },
  adminViewedAt:        { type: Date, default: null },
  userViewedAt:         { type: Date, default: null },
}, { timestamps: true });

reviewSchema.index({ bookingId: 1 }, { unique: true, sparse: true });
reviewSchema.index({ vehicleId: 1, isVisible: 1, adminDeleted: 1, customerDeleted: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ adminDeleted: 1, isVisible: 1, createdAt: -1 });

reviewSchema.pre('validate', function reviewPreValidate(next) {
  const message = normalizeReviewMessage(this.message || this.comment);

  this.message = message;
  this.comment = message;
  this.reviewStatus = buildReviewStatus(this);
  this.images = (Array.isArray(this.images) ? this.images : []).filter(Boolean).slice(0, 5);

  if (this.adminDeleted) {
    this.isVisible = false;
  }

  if (!this.reviewDate) {
    this.reviewDate = new Date().toISOString().split('T')[0];
  }

  if (this.adminDeleteReason && !this.adminRemovalReason) {
    this.adminRemovalReason = this.adminDeleteReason;
  }

  if (this.adminDeletedAt && !this.adminRemovalDate) {
    this.adminRemovalDate = new Date(this.adminDeletedAt).toISOString().split('T')[0];
  }

  next();
});

const Review = mongoose.model('Review', reviewSchema);

async function ensureReviewIndexes() {
  try {
    await Review.collection.dropIndex('userId_1_vehicleId_1');
  } catch (error) {
    const isMissingIndex = error?.codeName === 'IndexNotFound'
      || /index not found/i.test(String(error?.message || ''));

    if (!isMissingIndex) {
      console.warn('Review index cleanup failed:', error.message || error);
    }
  }

  try {
    await Review.createIndexes();
  } catch (error) {
    console.warn('Review index creation failed:', error.message || error);
  }
}

if (mongoose.connection.readyState === 1) {
  ensureReviewIndexes();
} else {
  mongoose.connection.once('connected', ensureReviewIndexes);
}

module.exports = Review;
