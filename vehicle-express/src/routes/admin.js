const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const SalesInquiry = require('../models/SalesInquiry');
const RentalBooking = require('../models/RentalBooking');
const Refund = require('../models/Refund');
const Review = require('../models/Review');
const Payment = require('../models/Payment');
const Promotion = require('../models/Promotion');
const Wishlist = require('../models/Wishlist');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  buildAdminReviewQuery,
  buildReviewSort,
  normalizeReviewMessage,
} = require('../utils/reviewHelpers');
const { DELETED_USER_DISPLAY_NAME, getSafeUserDisplayName, isDeletedUser } = require('../utils/accountDeletion');

const isTestingRouteEnabled = () => String(process.env.ENABLE_ADMIN_TESTING_ROUTES || '').trim().toLowerCase() === 'true';

const requireTestingRouteEnabled = (req, res, next) => {
  if (!isTestingRouteEnabled()) {
    return res.status(404).json({ message: 'Not found' });
  }

  return next();
};

const isUnread = {
  $or: [
    { adminViewedAt: { $exists: false } },
    { adminViewedAt: null },
  ],
};

const buildAssetPath = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return value.startsWith('/') ? value : `/${value}`;
};

const splitName = (user) => {
  if (!user || isDeletedUser(user)) {
    return DELETED_USER_DISPLAY_NAME;
  }

  return getSafeUserDisplayName(user, 'Wheelzy User');
};

const formatVehicleName = (vehicle) => {
  if (!vehicle) {
    return 'Vehicle';
  }

  return [vehicle.brand, vehicle.model].filter(Boolean).join(' ').trim() || vehicle.name || 'Vehicle';
};

const buildNotification = ({
  type,
  entityId,
  title,
  message,
  actorName,
  createdAt,
  targetTab,
  image,
  premium = false,
  tone = 'neutral',
}) => ({
  id: `${type}:${entityId}`,
  type,
  entityId: String(entityId),
  title,
  message,
  actorName,
  createdAt,
  targetTab,
  image: buildAssetPath(image),
  premium,
  tone,
});

const reviewPopulate = [
  { path: 'vehicleId', select: 'brand model listingType manufactureYear category image1 image2 image3 image4 image5 price status' },
  { path: 'userId', select: 'fullName firstName lastName email profileImage isPremium isActive isDeleted deletedAt' },
  { path: 'bookingId', select: 'startDate startTime endDate endTime status requestedUnits createdAt' },
];

// GET /api/admin/stats
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  const [totalUsers, totalVehicles, pendingInquiries, pendingRentals, pendingRefunds, newRefundRequests] = await Promise.all([
    User.countDocuments({ isDeleted: { $ne: true } }),
    Vehicle.countDocuments({ isDeleted: { $ne: true } }),
    SalesInquiry.countDocuments({ status: 'Pending' }),
    RentalBooking.countDocuments({ status: 'Pending' }),
    Refund.countDocuments({ status: { $in: ['Refund Requested', 'Refund Processing'] } }),
    Refund.countDocuments({
      status: 'Refund Requested',
      $or: [
        { adminViewedAt: { $exists: false } },
        { adminViewedAt: null },
      ],
    }),
  ]);
  return res.json({
    totalUsers,
    totalVehicles,
    pendingInquiries,
    pendingRentals,
    pendingRefunds,
    newRefundRequests,
  });
});

// GET /api/admin/notifications
router.get('/notifications', authenticate, requireAdmin, async (req, res) => {
  const [refunds, bookings, inquiries, reviews, payments, promotions] = await Promise.all([
    Refund.find({
      status: 'Refund Requested',
      ...isUnread,
    })
      .populate({
        path: 'booking',
        populate: [
          { path: 'vehicle' },
          { path: 'user' },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(12),
    RentalBooking.find({
      status: 'Pending',
      ...isUnread,
    })
      .populate(['vehicle', 'user'])
      .sort({ createdAt: -1 })
      .limit(12),
    SalesInquiry.find({
      status: 'Pending',
      ...isUnread,
    })
      .populate('vehicleId')
      .sort({ createdAt: -1 })
      .limit(12),
    Review.find({
      adminDeleted: false,
      ...isUnread,
    })
      .populate(['vehicleId', 'userId'])
      .sort({ createdAt: -1 })
      .limit(12),
    Payment.find({
      paymentType: 'premium_upgrade',
      status: 'approved',
      ...isUnread,
    })
      .populate('userId')
      .sort({ createdAt: -1 })
      .limit(12),
    Promotion.find({
      ...isUnread,
    })
      .populate('createdByUserId', 'fullName firstName lastName email profileImage role')
      .sort({ createdAt: -1 })
      .limit(12),
  ]);

  const notifications = [
    ...refunds.map((refund) => {
      const booking = refund.booking;
      const vehicle = booking?.vehicle;
      const user = booking?.user;

      return buildNotification({
        type: 'refund',
        entityId: refund._id,
        title: 'Refund request received',
        message: `${splitName(user)} requested a refund for ${formatVehicleName(vehicle)}.`,
        actorName: splitName(user),
        createdAt: refund.createdAt,
        targetTab: 'Refunds',
        image: vehicle?.image1 || user?.profileImage,
        premium: Boolean(user?.isPremium),
        tone: 'critical',
      });
    }),
    ...bookings.map((booking) => buildNotification({
      type: 'booking',
      entityId: booking._id,
      title: 'New rental booking',
      message: `${splitName(booking.user)} booked ${formatVehicleName(booking.vehicle)} and is waiting for approval.`,
      actorName: splitName(booking.user),
      createdAt: booking.createdAt,
      targetTab: 'Bookings',
      image: booking.vehicle?.image1 || booking.user?.profileImage,
      premium: Boolean(booking.user?.isPremium),
      tone: 'info',
    })),
    ...inquiries.map((inquiry) => buildNotification({
      type: 'inquiry',
      entityId: inquiry._id,
      title: 'New sales inquiry',
      message: `${inquiry.customerName || 'A customer'} sent an inquiry for ${formatVehicleName(inquiry.vehicleId)}.`,
      actorName: inquiry.customerName || 'Wheelzy User',
      createdAt: inquiry.createdAt,
      targetTab: 'Inquiries',
      image: inquiry.vehicleId?.image1,
      tone: 'neutral',
    })),
    ...reviews.map((review) => {
      const action = review?.lastCustomerAction || 'created';
      const createdAt = review?.updatedAt || review?.createdAt;
      const title = action === 'updated'
        ? 'Review updated'
        : action === 'deleted'
          ? 'Review deleted by customer'
          : review?.requiresAdminAttention && review?.adminAttentionStatus === 'Pending'
            ? 'Review needs attention'
            : 'New customer review';
      const message = action === 'updated'
        ? `${splitName(review.userId)} updated a review on ${formatVehicleName(review.vehicleId)}.`
        : action === 'deleted'
          ? `${splitName(review.userId)} deleted a review on ${formatVehicleName(review.vehicleId)}.`
          : review?.requiresAdminAttention && review?.adminAttentionStatus === 'Pending'
            ? `${splitName(review.userId)} left a flagged review on ${formatVehicleName(review.vehicleId)}.`
            : `${splitName(review.userId)} left a review on ${formatVehicleName(review.vehicleId)}.`;
      const tone = review?.requiresAdminAttention && review?.adminAttentionStatus === 'Pending'
        ? 'warning'
        : action === 'deleted'
          ? 'critical'
          : 'info';

      return buildNotification({
        type: 'review',
        entityId: review._id,
        title,
        message,
        actorName: splitName(review.userId),
        createdAt,
        targetTab: 'Reviews',
        image: review.vehicleId?.image1 || review.userId?.profileImage,
        premium: Boolean(review.userId?.isPremium),
        tone,
      });
    }),
    ...payments.map((payment) => buildNotification({
      type: 'premium',
      entityId: payment._id,
      title: 'Premium membership activated',
      message: `${splitName(payment.userId)} upgraded to Wheelzy Premium.`,
      actorName: splitName(payment.userId),
      createdAt: payment.createdAt,
      targetTab: 'Users',
      image: payment.userId?.profileImage,
      premium: true,
      tone: 'premium',
    })),
    ...promotions.map((promotion) => buildNotification({
      type: 'promotion',
      entityId: promotion._id,
      title: 'New promotion created',
      message: `${splitName(promotion.createdByUserId)} created "${promotion.title || 'Promotion'}".`,
      actorName: splitName(promotion.createdByUserId),
      createdAt: promotion.createdAt,
      targetTab: 'Promotions',
      image: promotion.imageUrl || promotion.createdByUserId?.profileImage,
      premium: false,
      tone: 'warning',
    })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 30);

  return res.json(notifications);
});

// POST /api/admin/notifications/mark-viewed
router.post('/notifications/mark-viewed', authenticate, requireAdmin, async (req, res) => {
  const { type, entityId } = req.body || {};

  if (!type || !entityId) {
    return res.status(400).json({ message: 'type and entityId are required' });
  }

  const viewedAt = new Date();
  const update = { adminViewedAt: viewedAt };

  let updated = null;

  if (type === 'refund') {
    updated = await Refund.findByIdAndUpdate(entityId, update, { new: true });
  } else if (type === 'booking') {
    updated = await RentalBooking.findByIdAndUpdate(entityId, update, { new: true });
  } else if (type === 'inquiry') {
    updated = await SalesInquiry.findByIdAndUpdate(entityId, update, { new: true });
  } else if (type === 'review') {
    updated = await Review.findByIdAndUpdate(entityId, update, { new: true });
  } else if (type === 'premium') {
    updated = await Payment.findByIdAndUpdate(entityId, update, { new: true });
  } else if (type === 'promotion') {
    updated = await Promotion.findByIdAndUpdate(entityId, update, { new: true });
  } else {
    return res.status(400).json({ message: 'Unsupported notification type' });
  }

  if (!updated) {
    return res.status(404).json({ message: 'Notification target not found' });
  }

  return res.json({ success: true, adminViewedAt: viewedAt.toISOString() });
});

// GET /api/admin/reviews
router.get('/reviews', authenticate, requireAdmin, async (req, res) => {
  try {
    const reviews = await Review.find(buildAdminReviewQuery({
      vehicleId: req.query?.vehicleId,
      status: req.query?.status,
    }))
      .populate(reviewPopulate)
      .sort(buildReviewSort(req.query?.sort));

    return res.json(reviews);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to load reviews.' });
  }
});

// PATCH /api/admin/reviews/:reviewId/hide
router.patch('/reviews/:reviewId/hide', authenticate, requireAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.isVisible = false;
    review.hiddenByAdminAt = new Date();
    review.userViewedAt = null;
    review.lastModerationAction = 'hidden';
    await review.save();
    await review.populate(reviewPopulate);

    return res.json(review);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to hide review.' });
  }
});

// PATCH /api/admin/reviews/:reviewId/show
router.patch('/reviews/:reviewId/show', authenticate, requireAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.adminDeleted) {
      return res.status(400).json({ message: 'Deleted reviews cannot be made visible again.' });
    }

    review.isVisible = true;
    review.lastModerationAction = 'visible';
    await review.save();
    await review.populate(reviewPopulate);

    return res.json(review);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to make review visible.' });
  }
});

// DELETE /api/admin/reviews/:reviewId
router.delete('/reviews/:reviewId', authenticate, requireAdmin, async (req, res) => {
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
    review.adminRemovalReason = reason;
    review.adminDeletedAt = new Date();
    review.adminRemovalDate = review.adminDeletedAt.toISOString().split('T')[0];
    review.userViewedAt = null;
    review.lastModerationAction = 'deleted';
    await review.save();
    await review.populate(reviewPopulate);

    return res.json({
      message: 'Review deleted successfully.',
      review,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to delete review.' });
  }
});

// POST /api/admin/testing/delete-all-users
router.post('/testing/delete-all-users', authenticate, requireAdmin, requireTestingRouteEnabled, async (req, res) => {
  const customers = await User.find({ role: 'CUSTOMER' }).select('_id email');
  const customerIds = customers.map((item) => item._id);
  const customerEmails = customers.map((item) => item.email).filter(Boolean);
  const bookings = await RentalBooking.find({ user: { $in: customerIds } }).select('_id');
  const bookingIds = bookings.map((item) => item._id);

  const [
    refundsResult,
    bookingsResult,
    reviewsResult,
    inquiriesResult,
    wishlistsResult,
    paymentsResult,
    usersResult,
  ] = await Promise.all([
    Refund.deleteMany({
      $or: [
        { user: { $in: customerIds } },
        { booking: { $in: bookingIds } },
      ],
    }),
    RentalBooking.deleteMany({ user: { $in: customerIds } }),
    Review.deleteMany({ userId: { $in: customerIds } }),
    SalesInquiry.deleteMany({ email: { $in: customerEmails } }),
    Wishlist.deleteMany({ user: { $in: customerIds } }),
    Payment.deleteMany({ userId: { $in: customerIds } }),
    User.deleteMany({ role: 'CUSTOMER' }),
  ]);

  return res.json({
    message: 'All customer user records deleted successfully',
    deleted: {
      users: usersResult.deletedCount || 0,
      bookings: bookingsResult.deletedCount || 0,
      refunds: refundsResult.deletedCount || 0,
      reviews: reviewsResult.deletedCount || 0,
      inquiries: inquiriesResult.deletedCount || 0,
      wishlists: wishlistsResult.deletedCount || 0,
      payments: paymentsResult.deletedCount || 0,
    },
  });
});

// POST /api/admin/testing/delete-all-bookings
router.post('/testing/delete-all-bookings', authenticate, requireAdmin, requireTestingRouteEnabled, async (req, res) => {
  const bookings = await RentalBooking.find({}).select('_id');
  const bookingIds = bookings.map((item) => item._id);
  const [refundsResult, bookingsResult] = await Promise.all([
    Refund.deleteMany({ booking: { $in: bookingIds } }),
    RentalBooking.deleteMany({}),
  ]);

  return res.json({
    message: 'All booking records deleted successfully',
    deleted: {
      bookings: bookingsResult.deletedCount || 0,
      linkedRefunds: refundsResult.deletedCount || 0,
    },
  });
});

// POST /api/admin/testing/delete-all-inquiries
router.post('/testing/delete-all-inquiries', authenticate, requireAdmin, requireTestingRouteEnabled, async (_req, res) => {
  const result = await SalesInquiry.deleteMany({});
  return res.json({
    message: 'All inquiry records deleted successfully',
    deleted: { inquiries: result.deletedCount || 0 },
  });
});

// POST /api/admin/testing/delete-all-refunds
router.post('/testing/delete-all-refunds', authenticate, requireAdmin, requireTestingRouteEnabled, async (_req, res) => {
  const result = await Refund.deleteMany({});
  return res.json({
    message: 'All refund records deleted successfully',
    deleted: { refunds: result.deletedCount || 0 },
  });
});

// POST /api/admin/testing/delete-all-reviews
router.post('/testing/delete-all-reviews', authenticate, requireAdmin, requireTestingRouteEnabled, async (_req, res) => {
  const result = await Review.deleteMany({});
  return res.json({
    message: 'All review records deleted successfully',
    deleted: { reviews: result.deletedCount || 0 },
  });
});

module.exports = router;
