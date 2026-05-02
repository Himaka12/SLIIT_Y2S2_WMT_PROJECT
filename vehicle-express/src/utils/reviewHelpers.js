const Review = require('../models/Review');
const RentalBooking = require('../models/RentalBooking');
const Vehicle = require('../models/Vehicle');
const { getUploadedFileUrl } = require('./upload');

const BOOKING_STATUS_ENUM = RentalBooking.schema.path('status')?.enumValues || [];
const REVIEW_ELIGIBLE_BOOKING_STATUSES = ['Approved'].filter((status) => BOOKING_STATUS_ENUM.includes(status));

const normalizeReviewMessage = (value) => String(value ?? '').trim();

const isRentalVehicle = (vehicle) => String(vehicle?.listingType || '').toLowerCase() === 'rent';

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

const syncReviewLifecycleFields = (review) => {
  const message = normalizeReviewMessage(review?.message || review?.comment);

  review.message = message;
  review.comment = message;
  review.images = (Array.isArray(review.images) ? review.images : []).filter(Boolean).slice(0, 5);

  if (review.adminDeleted) {
    review.isVisible = false;
  }

  review.reviewStatus = buildReviewStatus(review);

  if (!review.reviewDate) {
    review.reviewDate = new Date().toISOString().split('T')[0];
  }

  return review;
};

const extractReviewImagePaths = (files = []) => (
  (Array.isArray(files) ? files : [])
    .filter(Boolean)
    .map((file) => getUploadedFileUrl(file, 'reviews'))
    .filter(Boolean)
    .slice(0, 5)
);

const parseExistingImages = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).slice(0, 5);
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 5) : [];
  } catch (_) {
    return [];
  }
};

const isCustomerManageableReview = (review) => Boolean(
  review
  && !review.adminDeleted
  && !review.customerDeleted
);

const isCustomerEditableReview = (review) => Boolean(
  isCustomerManageableReview(review)
  && !normalizeReviewMessage(review?.businessReply)
);

const buildOwnerReviewState = (review) => {
  if (review?.adminDeleted) {
    return {
      key: 'deleted',
      label: 'Deleted by Admin',
      reason: review.adminDeleteReason || '',
      manageable: false,
      canEdit: false,
      canDelete: false,
    };
  }

  if (review?.customerDeleted) {
    return {
      key: 'deleted',
      label: 'Deleted',
      reason: '',
      manageable: false,
      canEdit: false,
      canDelete: false,
    };
  }

  if (review?.isVisible === false) {
    return {
      key: 'hidden',
      label: 'Hidden by Admin',
      reason: '',
      manageable: true,
      canEdit: !normalizeReviewMessage(review?.businessReply),
      canDelete: true,
    };
  }

  return {
    key: 'visible',
    label: 'Visible',
    reason: '',
    manageable: true,
    canEdit: !normalizeReviewMessage(review?.businessReply),
    canDelete: true,
  };
};

const buildPublicReviewQuery = (vehicleId = null) => {
  const query = {
    isVisible: true,
    adminDeleted: false,
    customerDeleted: { $ne: true },
  };

  if (vehicleId) {
    query.vehicleId = vehicleId;
  }

  return query;
};

const buildAdminReviewQuery = ({ vehicleId, status }) => {
  const query = {};

  if (vehicleId) {
    query.vehicleId = vehicleId;
  }

  if (status === 'visible') {
    query.adminDeleted = false;
    query.customerDeleted = { $ne: true };
    query.isVisible = true;
  } else if (status === 'hidden') {
    query.adminDeleted = false;
    query.customerDeleted = { $ne: true };
    query.isVisible = false;
  } else if (status === 'deleted') {
    query.adminDeleted = true;
  }

  return query;
};

const buildReviewSort = (sortKey = 'latest') => (
  sortKey === 'oldest'
    ? { createdAt: 1 }
    : { createdAt: -1 }
);

const getReviewEligibility = async ({ userId, vehicleId, bookingId = null }) => {
  const vehicle = await Vehicle.findOne({ _id: vehicleId, isDeleted: { $ne: true } }).select('listingType brand model image1');

  if (!vehicle) {
    return {
      eligible: false,
      reason: 'vehicle_not_found',
      hasCompletedBooking: false,
      alreadyReviewed: false,
      vehicle: null,
      booking: null,
      existingReview: null,
    };
  }

  if (!isRentalVehicle(vehicle)) {
    return {
      eligible: false,
      reason: 'vehicle_not_rental',
      hasCompletedBooking: false,
      alreadyReviewed: false,
      vehicle,
      booking: null,
      existingReview: null,
    };
  }

  const [approvedBookings, existingReviews] = await Promise.all([
    RentalBooking.find({
      user: userId,
      vehicle: vehicleId,
      status: { $in: REVIEW_ELIGIBLE_BOOKING_STATUSES },
    })
      .sort({ createdAt: -1 }),
    Review.find({
      userId,
      vehicleId,
      customerDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .populate('vehicleId bookingId'),
  ]);

  const normalizedBookingId = bookingId ? String(bookingId) : null;
  const existingReview = existingReviews[0] || null;
  const reviewedBookingIds = new Set(
    existingReviews
      .map((review) => String(review?.bookingId?._id || review?.bookingId || ''))
      .filter(Boolean),
  );
  const hasCompletedBooking = approvedBookings.length > 0;

  const requestedBooking = normalizedBookingId
    ? approvedBookings.find((item) => String(item?._id) === normalizedBookingId) || null
    : null;

  const eligibleBooking = normalizedBookingId
    ? (requestedBooking && !reviewedBookingIds.has(normalizedBookingId) ? requestedBooking : null)
    : approvedBookings.find((item) => !reviewedBookingIds.has(String(item?._id))) || null;

  const alreadyReviewed = normalizedBookingId
    ? Boolean(requestedBooking && reviewedBookingIds.has(normalizedBookingId))
    : Boolean(hasCompletedBooking && !eligibleBooking && existingReview);

  return {
    eligible: Boolean(eligibleBooking),
    reason: !hasCompletedBooking
      ? 'booking_required'
      : alreadyReviewed
        ? 'already_reviewed'
        : 'eligible',
    hasCompletedBooking,
    alreadyReviewed,
    vehicle,
    booking: eligibleBooking,
    existingReview,
  };
};

module.exports = {
  REVIEW_ELIGIBLE_BOOKING_STATUSES,
  normalizeReviewMessage,
  isRentalVehicle,
  buildReviewStatus,
  syncReviewLifecycleFields,
  extractReviewImagePaths,
  parseExistingImages,
  isCustomerManageableReview,
  isCustomerEditableReview,
  buildOwnerReviewState,
  buildPublicReviewQuery,
  buildAdminReviewQuery,
  buildReviewSort,
  getReviewEligibility,
};
