const bcrypt = require('bcryptjs');
const Payment = require('../models/Payment');
const RentalBooking = require('../models/RentalBooking');
const Refund = require('../models/Refund');
const Review = require('../models/Review');
const SalesInquiry = require('../models/SalesInquiry');
const Wishlist = require('../models/Wishlist');

const DELETED_USER_DISPLAY_NAME = 'Deleted User';
const ACCOUNT_DELETION_CANCELLED_STATUS = 'Cancelled - Account Deleted';
const ACCOUNT_DELETION_PENDING_BOOKING_STATUS = 'Pending';
const ACCOUNT_DELETION_BLOCKING_BOOKING_STATUSES = ['Approved'];
const ACCOUNT_DELETION_ACTIVE_REFUND_STATUSES = ['Refund Requested', 'Refund Processing'];

const buildDeletedUserEmail = (user) => `deleted-user-${user._id}@deleted.local`;

const isDeletedUser = (user) => Boolean(
  user?.isDeleted
  || String(user?.email || '').toLowerCase().endsWith('@deleted.local')
  || String(user?.fullName || '').trim() === DELETED_USER_DISPLAY_NAME
);

const getSafeUserDisplayName = (user, fallback = DELETED_USER_DISPLAY_NAME) => {
  if (!user || isDeletedUser(user)) {
    return fallback;
  }

  const composed = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return composed || user.fullName || user.email || fallback;
};

async function getUserCascadeSummary(user) {
  const bookings = await RentalBooking.find({ user: user._id }).select('_id');
  const bookingIds = bookings.map((booking) => booking._id);

  const [refunds, reviews, inquiries, wishlistCount, paymentCount] = await Promise.all([
    Refund.countDocuments({
      $or: [
        { user: user._id },
        ...(bookingIds.length ? [{ booking: { $in: bookingIds } }] : []),
      ],
    }),
    Review.countDocuments({ userId: user._id }),
    SalesInquiry.countDocuments({
      $or: [
        { customerId: user._id },
        { email: user.email },
      ],
    }),
    Wishlist.countDocuments({ user: user._id }),
    Payment.countDocuments({ userId: user._id }),
  ]);

  return {
    bookings: bookings.length,
    refunds,
    reviews,
    inquiries,
    wishlist: wishlistCount,
    payments: paymentCount,
    bookingIds,
  };
}

async function buildAccountDeletionAssessment(user, { audience = 'admin' } = {}) {
  const bookings = await RentalBooking.find({ user: user._id }).select('_id status');
  const bookingIds = bookings.map((booking) => booking._id);
  const pendingBookings = bookings.filter((booking) => booking.status === ACCOUNT_DELETION_PENDING_BOOKING_STATUS);
  const blockingBookings = bookings.filter((booking) => ACCOUNT_DELETION_BLOCKING_BOOKING_STATUSES.includes(booking.status));
  const activeRefunds = await Refund.countDocuments({
    status: { $in: ACCOUNT_DELETION_ACTIVE_REFUND_STATUSES },
    $or: [
      { user: user._id },
      ...(bookingIds.length ? [{ booking: { $in: bookingIds } }] : []),
    ],
  });

  const allowed = blockingBookings.length === 0 && activeRefunds === 0;
  const isCustomerAudience = audience === 'customer';
  const message = blockingBookings.length
    ? isCustomerAudience
      ? 'You have an active approved booking. Complete it, cancel it, or finish any required refund process before deleting your account.'
      : 'This customer has an active approved booking. Complete it, cancel it, or finish any required refund process before deleting this account.'
    : activeRefunds
      ? isCustomerAudience
        ? 'You have an active refund request. Please finish the refund process before deleting your account.'
        : 'This customer has an active refund request. Finish the refund process before deleting this account.'
      : pendingBookings.length
        ? `${pendingBookings.length} pending booking${pendingBookings.length === 1 ? '' : 's'} will be cancelled before ${isCustomerAudience ? 'your' : 'this'} account is deleted.`
        : `${isCustomerAudience ? 'Your' : 'This'} account can be deleted. Booking, payment, and refund history will stay saved for business records.`;

  return {
    allowed,
    message,
    counts: {
      totalBookings: bookings.length,
      pendingBookings: pendingBookings.length,
      blockingBookings: blockingBookings.length,
      activeRefunds,
    },
    bookingIds,
  };
}

async function anonymizeCustomerAccount(user, { assessment = null, counts = null } = {}) {
  const deletionDate = new Date();
  const finalAssessment = assessment || await buildAccountDeletionAssessment(user);

  if (!finalAssessment.allowed) {
    const error = new Error(finalAssessment.message);
    error.status = 409;
    error.assessment = finalAssessment;
    throw error;
  }

  const finalCounts = counts || await getUserCascadeSummary(user);
  const originalEmail = user.email;
  const maskedEmail = buildDeletedUserEmail(user);

  await RentalBooking.updateMany(
    { user: user._id, status: ACCOUNT_DELETION_PENDING_BOOKING_STATUS },
    { $set: { status: ACCOUNT_DELETION_CANCELLED_STATUS } },
  );

  await Promise.all([
    Review.updateMany(
      { userId: user._id },
      {
        $set: {
          customerName: DELETED_USER_DISPLAY_NAME,
          userViewedAt: deletionDate,
        },
      },
    ),
    SalesInquiry.updateMany(
      {
        $or: [
          { customerId: user._id },
          { email: originalEmail },
        ],
      },
      {
        $set: {
          customerName: DELETED_USER_DISPLAY_NAME,
          email: maskedEmail,
          phone: 'Deleted',
          userViewedAt: deletionDate,
        },
      },
    ),
    Refund.updateMany(
      {
        $or: [
          { user: user._id },
          ...(finalCounts.bookingIds.length ? [{ booking: { $in: finalCounts.bookingIds } }] : []),
        ],
      },
      {
        $set: {
          accountHolderName: DELETED_USER_DISPLAY_NAME,
        },
      },
    ),
    Wishlist.deleteMany({ user: user._id }),
  ]);

  user.fullName = DELETED_USER_DISPLAY_NAME;
  user.firstName = 'Deleted';
  user.lastName = 'User';
  user.email = maskedEmail;
  user.contactNumber = '';
  user.phone = '';
  user.secondaryPhone = '';
  user.profileImage = '';
  user.cardNumber = undefined;
  user.securityQuestion = undefined;
  user.securityAnswer = undefined;
  user.address = {
    houseNo: '',
    lane: '',
    city: '',
    district: '',
    province: '',
    postalCode: '',
  };
  user.isPremium = false;
  user.isActive = false;
  user.isDeleted = true;
  user.deletedAt = deletionDate;
  user.password = await bcrypt.hash(`deleted-${user._id}-${deletionDate.getTime()}`, 10);
  await user.save();

  return {
    assessment: finalAssessment,
    counts: finalCounts,
    deletedAt: deletionDate,
    maskedEmail,
  };
}

async function hardDeleteCustomerAccount(user, counts = null) {
  const finalCounts = counts || await getUserCascadeSummary(user);

  await Promise.all([
    Refund.deleteMany({
      $or: [
        { user: user._id },
        ...(finalCounts.bookingIds.length ? [{ booking: { $in: finalCounts.bookingIds } }] : []),
      ],
    }),
    RentalBooking.deleteMany({ user: user._id }),
    Review.deleteMany({ userId: user._id }),
    SalesInquiry.deleteMany({
      $or: [
        { customerId: user._id },
        { email: user.email },
      ],
    }),
    Wishlist.deleteMany({ user: user._id }),
    Payment.deleteMany({ userId: user._id }),
    user.deleteOne(),
  ]);

  return finalCounts;
}

module.exports = {
  DELETED_USER_DISPLAY_NAME,
  ACCOUNT_DELETION_CANCELLED_STATUS,
  ACCOUNT_DELETION_BLOCKING_BOOKING_STATUSES,
  ACCOUNT_DELETION_ACTIVE_REFUND_STATUSES,
  buildDeletedUserEmail,
  isDeletedUser,
  getSafeUserDisplayName,
  getUserCascadeSummary,
  buildAccountDeletionAssessment,
  anonymizeCustomerAccount,
  hardDeleteCustomerAccount,
};
