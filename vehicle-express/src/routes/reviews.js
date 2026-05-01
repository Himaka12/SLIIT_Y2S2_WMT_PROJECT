const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const { authenticate, requireAdmin, requireAdminOrMarketing } = require('../middleware/auth');
const { uploadReviewImages } = require('../utils/upload');
const {
  buildAdminReviewQuery,
  buildOwnerReviewState,
  buildPublicReviewQuery,
  buildReviewSort,
  extractReviewImagePaths,
  getReviewEligibility,
  isCustomerEditableReview,
  isCustomerManageableReview,
  isRentalVehicle,
  normalizeReviewMessage,
  parseExistingImages,
} = require('../utils/reviewHelpers');
const { isDeletedUser } = require('../utils/accountDeletion');

const router = express.Router();

const reviewPopulate = [
  { path: 'vehicleId', select: 'brand model listingType manufactureYear category image1 image2 image3 image4 image5 price status' },
  { path: 'userId', select: 'fullName firstName lastName email profileImage isPremium isActive isDeleted deletedAt' },
  { path: 'bookingId', select: 'startDate startTime endDate endTime status requestedUnits createdAt' },
];

const serializeReview = (reviewDocument, { includePrivate = false } = {}) => {
  if (!reviewDocument) {
    return null;
  }

  const review = typeof reviewDocument.toObject === 'function'
    ? reviewDocument.toObject()
    : { ...reviewDocument };

  const ownerState = buildOwnerReviewState(review);

  return {
    ...review,
    message: review.message || review.comment || '',
    comment: review.message || review.comment || '',
    images: Array.isArray(review.images) ? review.images : [],
    ownerState,
    canEdit: includePrivate ? Boolean(ownerState.canEdit) : false,
    canDelete: includePrivate ? Boolean(ownerState.canDelete) : false,
  };
};

const analyzeReviewWithAI = async (message, rating) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_API_MODEL || 'gemini-1.5-flash';

    if (!apiKey) {
      return {
        sentiment: 'Neutral',
        reason: 'AI analysis unavailable',
        requiresAdminAttention: false,
        adminAttentionReason: null,
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const prompt = `Analyze this vehicle rental review. Rating: ${rating}/5. Message: "${message}".
Respond ONLY with a JSON object (no markdown) with these fields:
- sentiment: "Positive", "Negative", or "Neutral"
- reason: brief one-sentence explanation (max 100 chars)
- requiresAdminAttention: true if review contains serious complaints or threats, false otherwise
- adminAttentionReason: brief reason if requiresAdminAttention is true, else null`;

    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      sentiment: parsed?.sentiment || 'Neutral',
      reason: parsed?.reason || 'AI analysis unavailable',
      requiresAdminAttention: Boolean(parsed?.requiresAdminAttention),
      adminAttentionReason: parsed?.adminAttentionReason || null,
    };
  } catch (_) {
    return {
      sentiment: 'Neutral',
      reason: 'AI analysis unavailable',
      requiresAdminAttention: false,
      adminAttentionReason: null,
    };
  }
};

const buildEligibilityResponse = (eligibility) => {
  const existingReview = eligibility?.existingReview ? serializeReview(eligibility.existingReview, { includePrivate: true }) : null;

  return {
    eligible: Boolean(eligibility?.eligible),
    reason: eligibility?.reason || 'ineligible',
    hasCompletedBooking: Boolean(eligibility?.hasCompletedBooking),
    alreadyReviewed: Boolean(eligibility?.alreadyReviewed),
    bookingId: eligibility?.booking?._id || existingReview?.bookingId?._id || existingReview?.bookingId || null,
    vehicle: eligibility?.vehicle || null,
    existingReview,
  };
};

const validateVehicleId = (vehicleId) => {
  if (!mongoose.Types.ObjectId.isValid(String(vehicleId || ''))) {
    throw new Error('Invalid vehicle id');
  }
};

const validateReviewPayload = ({ rating, message, images }) => {
  const normalizedRating = Number(rating);
  if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const normalizedMessage = normalizeReviewMessage(message);
  if (normalizedMessage.length < 8) {
    throw new Error('Review message must be at least 8 characters long');
  }

  if (normalizedMessage.length > 1200) {
    throw new Error('Review message must be 1200 characters or fewer');
  }

  if (Array.isArray(images) && images.length > 5) {
    throw new Error('You can upload up to 5 review images');
  }

  return {
    rating: normalizedRating,
    message: normalizedMessage,
  };
};

const fetchPublicVehicleReviews = async (vehicleId) => {
  const reviews = await Review.find(buildPublicReviewQuery(vehicleId))
    .populate(reviewPopulate)
    .sort({ createdAt: -1 });

  return reviews.map((review) => serializeReview(review));
};

const listAdminReviews = async ({ vehicleId, status, sort }) => {
  const reviews = await Review.find(buildAdminReviewQuery({ vehicleId, status }))
    .populate(reviewPopulate)
    .sort(buildReviewSort(sort));

  return reviews.map((review) => serializeReview(review, { includePrivate: true }));
};

const createReview = async (req, res) => {
  try {
    const vehicleId = req.body?.vehicleId;
    const bookingId = req.body?.bookingId || null;
    validateVehicleId(vehicleId);
    if (bookingId) {
      validateVehicleId(bookingId);
    }

    const eligibility = await getReviewEligibility({ userId: req.user._id, vehicleId, bookingId });
    if (!eligibility.vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (!eligibility.eligible) {
      const message = eligibility.reason === 'vehicle_not_rental'
        ? 'Reviews are only available for rental vehicles.'
        : eligibility.reason === 'booking_required'
          ? 'You can only review rental vehicles you have successfully booked.'
          : 'You have already reviewed this rental vehicle.';
      return res.status(400).json({ message, eligibility: buildEligibilityResponse(eligibility) });
    }

    const images = extractReviewImagePaths(req.files);
    const payload = validateReviewPayload({
      rating: req.body?.rating,
      message: req.body?.message || req.body?.comment,
      images,
    });
    const aiResult = await analyzeReviewWithAI(payload.message, payload.rating);

      const review = await Review.create({
      vehicleId,
      userId: req.user._id,
      bookingId: eligibility.booking?._id || bookingId || null,
      customerName: req.user.fullName,
      rating: payload.rating,
      message: payload.message,
      comment: payload.message,
      images,
      isVisible: true,
      adminDeleted: false,
      customerDeleted: false,
      adminViewedAt: null,
      lastCustomerAction: 'created',
      reviewDate: new Date().toISOString().split('T')[0],
      reviewStatus: 'Active',
      aiSentiment: aiResult.sentiment,
      aiReason: aiResult.reason,
      requiresAdminAttention: aiResult.requiresAdminAttention,
      adminAttentionStatus: aiResult.requiresAdminAttention ? 'Pending' : null,
      adminAttentionReason: aiResult.adminAttentionReason,
    });

    await review.populate(reviewPopulate);
    return res.status(201).json(serializeReview(review, { includePrivate: true }));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'You have already reviewed this rental vehicle.' });
    }

    return res.status(400).json({ message: error.message || 'Failed to create review.' });
  }
};

const updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId).populate(reviewPopulate);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (String(review.userId?._id || review.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to update this review.' });
    }

    if (!isCustomerEditableReview(review)) {
      return res.status(400).json({ message: 'This review can no longer be edited.' });
    }

    const existingImages = parseExistingImages(req.body?.existingImages);
    const uploadedImages = extractReviewImagePaths(req.files);
    const nextImages = [...existingImages, ...uploadedImages].slice(0, 5);
    const payload = validateReviewPayload({
      rating: req.body?.rating ?? review.rating,
      message: req.body?.message || req.body?.comment || review.message || review.comment,
      images: nextImages,
    });
    const aiResult = await analyzeReviewWithAI(payload.message, payload.rating);

    review.rating = payload.rating;
    review.message = payload.message;
    review.comment = payload.message;
    review.images = nextImages;
    review.reviewDate = new Date().toISOString().split('T')[0];
    review.adminViewedAt = null;
    review.lastCustomerAction = 'updated';
    review.aiSentiment = aiResult.sentiment;
    review.aiReason = aiResult.reason;
    review.requiresAdminAttention = aiResult.requiresAdminAttention;
    review.adminAttentionStatus = aiResult.requiresAdminAttention ? 'Pending' : null;
    review.adminAttentionReason = aiResult.adminAttentionReason;
    await review.save();
    await review.populate(reviewPopulate);

    return res.json(serializeReview(review, { includePrivate: true }));
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to update review.' });
  }
};

const deleteOwnReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (String(review.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to delete this review.' });
    }

    if (!isCustomerManageableReview(review)) {
      return res.status(400).json({ message: 'This review can no longer be deleted.' });
    }

    await Review.deleteOne({ _id: review._id });

    return res.json({ message: 'Review deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to delete review.' });
  }
};

const legacyCanReview = async (req, res) => {
  try {
    const eligibility = await getReviewEligibility({ userId: req.user._id, vehicleId: req.params.vehicleId });
    return res.json(Boolean(eligibility.eligible));
  } catch (_) {
    return res.json(false);
  }
};

const getEligibility = async (req, res) => {
  try {
    validateVehicleId(req.params.vehicleId);
    const eligibility = await getReviewEligibility({ userId: req.user._id, vehicleId: req.params.vehicleId });
    return res.json(buildEligibilityResponse(eligibility));
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to evaluate review eligibility.' });
  }
};

const getVehicleReviews = async (req, res) => {
  try {
    validateVehicleId(req.params.vehicleId);
    const reviews = await fetchPublicVehicleReviews(req.params.vehicleId);
    return res.json(reviews);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to load vehicle reviews.' });
  }
};

const getAllVisibleReviews = async (_req, res) => {
  try {
    const reviews = await Review.find(buildPublicReviewQuery())
      .populate(reviewPopulate)
      .sort({ createdAt: -1 });

    return res.json(reviews.map((review) => serializeReview(review)));
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to load reviews.' });
  }
};

const getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      userId: req.user._id,
      customerDeleted: { $ne: true },
    })
      .populate(reviewPopulate)
      .sort({ updatedAt: -1, createdAt: -1 });

    return res.json(reviews.map((review) => serializeReview(review, { includePrivate: true })));
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to load your reviews.' });
  }
};

const adminSoftDeleteReview = async (req, res) => {
  try {
    const reason = normalizeReviewMessage(req.body?.reason || req.body?.adminDeleteReason || req.body?.adminRemovalReason);
    if (!reason) {
      return res.status(400).json({ message: 'Delete reason is required.' });
    }

    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.adminDeleted = true;
    review.isVisible = false;
    review.adminDeleteReason = reason;
    review.adminDeletedAt = new Date();
    review.adminRemovalReason = reason;
    review.adminRemovalDate = review.adminDeletedAt.toISOString().split('T')[0];
    review.userViewedAt = null;
    review.lastModerationAction = 'deleted';
    await review.save();

    await review.populate(reviewPopulate);
    return res.json({
      message: 'Review deleted successfully.',
      review: serializeReview(review, { includePrivate: true }),
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to delete review.' });
  }
};

const adminPurgeReview = async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.reviewId);
    return res.json({ message: 'Review permanently deleted from the database.' });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to permanently delete review.' });
  }
};

const adminRespondToReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId).populate('userId', 'fullName firstName lastName email isActive isDeleted deletedAt');
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.adminDeleted) {
      return res.status(400).json({ message: 'Deleted reviews cannot receive an admin response.' });
    }

    if (review.customerDeleted) {
      return res.status(400).json({ message: 'Customer deleted reviews cannot receive an admin response.' });
    }

    if (!review.userId || isDeletedUser(review.userId)) {
      return res.status(400).json({ message: 'Reviews from deleted customer accounts are view-only and cannot receive an admin response.' });
    }

    if (String(review.businessReply || '').trim()) {
      return res.status(400).json({ message: 'This review already has an admin response.' });
    }

    const normalizedReply = normalizeReviewMessage(req.body?.businessReply);
    if (!normalizedReply) {
      return res.status(400).json({ message: 'Response message is required.' });
    }

    review.businessReply = normalizedReply;
    review.replySource = 'Admin';
    review.businessReplyDate = new Date().toISOString().split('T')[0];
    review.adminAttentionStatus = req.body?.adminAttentionStatus || 'Resolved';
    review.adminResponseDate = new Date().toISOString().split('T')[0];
    review.adminResponderName = req.user.fullName;
    review.userViewedAt = null;
    await review.save();
    await review.populate(reviewPopulate);

    return res.json(serializeReview(review, { includePrivate: true }));
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to respond to review.' });
  }
};

const listReviewsForAdmin = async (req, res) => {
  try {
    const reviews = await listAdminReviews({
      vehicleId: req.query?.vehicleId,
      status: req.query?.status,
      sort: req.query?.sort,
    });

    return res.json(reviews);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to load admin reviews.' });
  }
};

router.get('/all', getAllVisibleReviews);
router.get('/vehicle/:vehicleId', getVehicleReviews);
router.get('/eligibility/:vehicleId', authenticate, getEligibility);
router.get('/can-review/:vehicleId', authenticate, legacyCanReview);
router.get('/my', authenticate, getMyReviews);
router.get('/my-reviews', authenticate, getMyReviews);

router.post('/', authenticate, uploadReviewImages.array('images', 5), createReview);
router.post('/add', authenticate, uploadReviewImages.array('images', 5), createReview);

router.put('/:reviewId', authenticate, uploadReviewImages.array('images', 5), updateReview);
router.put('/update/:reviewId', authenticate, uploadReviewImages.array('images', 5), updateReview);

router.delete('/:reviewId', authenticate, deleteOwnReview);
router.delete('/delete/:reviewId', authenticate, deleteOwnReview);

// Legacy admin-compatible review endpoints kept to avoid breaking older screens while
// new admin flows use /api/admin/reviews.
router.get('/all-admin', authenticate, requireAdminOrMarketing, listReviewsForAdmin);
router.get('/legacy-admin-list', authenticate, requireAdminOrMarketing, listReviewsForAdmin);
router.get('/admin/all', authenticate, requireAdminOrMarketing, listReviewsForAdmin);
router.get('/all-management', authenticate, requireAdminOrMarketing, listReviewsForAdmin);
router.get('/moderation', authenticate, requireAdminOrMarketing, listReviewsForAdmin);
router.get('/all-private', authenticate, requireAdminOrMarketing, listReviewsForAdmin);
router.get('/all-dashboard', authenticate, requireAdminOrMarketing, listReviewsForAdmin);
router.get('/admin', authenticate, requireAdminOrMarketing, listReviewsForAdmin);

router.put('/admin-delete/:reviewId', authenticate, requireAdmin, adminSoftDeleteReview);
router.delete('/admin-purge/:reviewId', authenticate, requireAdmin, adminPurgeReview);
router.put('/admin-respond/:reviewId', authenticate, requireAdmin, adminRespondToReview);

module.exports = router;
module.exports.listReviewsForAdmin = listReviewsForAdmin;
module.exports.adminSoftDeleteReview = adminSoftDeleteReview;
module.exports.adminRespondToReview = adminRespondToReview;
module.exports.adminPurgeReview = adminPurgeReview;
