const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Promotion = require('../models/Promotion');
const RentalBooking = require('../models/RentalBooking');
const Refund = require('../models/Refund');
const Review = require('../models/Review');
const SalesInquiry = require('../models/SalesInquiry');
const { authenticate } = require('../middleware/auth');
const { getUploadedFileUrl, uploadProfileImage } = require('../utils/upload');
const { getComputedPromotionStatus } = require('../utils/promotionHelpers');
const {
  ACCOUNT_DELETION_CANCELLED_STATUS,
  anonymizeCustomerAccount,
  buildAccountDeletionAssessment,
} = require('../utils/accountDeletion');

const SECURITY_QUESTIONS = [
  "What is your mother's name?",
  "What is your father's name?",
  'What is your school name?',
  "What is your best friend's name?",
];

const normalizeSecurityAnswer = (value) => String(value || '').trim().toLowerCase();
const normalizeOptionalText = (value) => String(value ?? '').trim();
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const PREMIUM_UPGRADE_AMOUNT = 10000;
const PREMIUM_UPGRADE_CURRENCY = 'LKR';
const LEGACY_PREMIUM_CARD_ENDPOINT_MESSAGE = 'This legacy card endpoint is disabled. Use /api/customer/premium-upgrade instead.';

const buildAssetPath = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return value.startsWith('/') ? value : `/${value}`;
};

const formatVehicleName = (vehicle) => {
  if (!vehicle) {
    return 'Vehicle';
  }

  return [vehicle.brand, vehicle.model].filter(Boolean).join(' ').trim() || 'Vehicle';
};

const buildCustomerNotification = ({
  type,
  entityId,
  title,
  message,
  createdAt,
  targetScreen,
  image,
  tone = 'neutral',
}) => ({
  id: `${type}:${entityId}`,
  type,
  entityId: String(entityId),
  title,
  message,
  createdAt,
  targetScreen,
  image: buildAssetPath(image),
  tone,
});

const splitFullName = (value) => {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
};

const isValidExpiry = (expiry) => {
  const value = String(expiry || '').trim();
  if (!/^\d{2}\/\d{2}$/.test(value)) {
    return false;
  }

  const [monthRaw, yearRaw] = value.split('/');
  const month = Number(monthRaw);
  const year = Number(`20${yearRaw}`);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (year < currentYear) {
    return false;
  }

  if (year === currentYear && month < currentMonth) {
    return false;
  }

  return true;
};

const generatePurchaseId = () => {
  const timestamp = Date.now().toString().slice(-10);
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `WHLZY-${timestamp}${randomPart}`;
};

const validateAccountDeletionCredentials = async (req) => {
  const { currentPassword, securityAnswer } = req.body || {};

  if (!currentPassword || !securityAnswer) {
    const error = new Error('currentPassword and securityAnswer are required');
    error.status = 400;
    throw error;
  }

  const user = await User.findById(req.user._id).select('+securityAnswer');
  if (!user || user.isDeleted || !user.isActive) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (!user.securityQuestion || !user.securityAnswer) {
    const error = new Error('Please save a security question before deleting your account');
    error.status = 400;
    throw error;
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatch) {
    const error = new Error('Current password is incorrect');
    error.status = 400;
    throw error;
  }

  const answerMatch = await bcrypt.compare(
    normalizeSecurityAnswer(securityAnswer),
    user.securityAnswer,
  );
  if (!answerMatch) {
    const error = new Error('Security answer is incorrect');
    error.status = 400;
    throw error;
  }

  return user;
};

const serializeUser = (userDocument) => {
  const user = userDocument.toObject ? userDocument.toObject() : { ...userDocument };
  const derivedName = splitFullName(user.fullName);
  const firstName = normalizeOptionalText(user.firstName) || derivedName.firstName;
  const lastName = normalizeOptionalText(user.lastName) || derivedName.lastName;

  return {
    ...user,
    firstName,
    lastName,
    phone: normalizeOptionalText(user.phone) || normalizeOptionalText(user.contactNumber),
    secondaryPhone: normalizeOptionalText(user.secondaryPhone),
    profileImage: normalizeOptionalText(user.profileImage),
    address: {
      houseNo: normalizeOptionalText(user.address?.houseNo),
      lane: normalizeOptionalText(user.address?.lane),
      city: normalizeOptionalText(user.address?.city),
      district: normalizeOptionalText(user.address?.district),
      province: normalizeOptionalText(user.address?.province),
      postalCode: normalizeOptionalText(user.address?.postalCode),
    },
  };
};

// GET /api/customer/profile
router.get('/profile', authenticate, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password -securityAnswer');
  return res.json(serializeUser(user));
});

// PUT /api/customer/update
router.put('/update', authenticate, uploadProfileImage.single('profileImage'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const body = req.body || {};
    const derivedName = splitFullName(user.fullName);
    const firstName = hasOwn(body, 'firstName')
      ? normalizeOptionalText(body.firstName)
      : (normalizeOptionalText(user.firstName) || derivedName.firstName);
    const lastName = hasOwn(body, 'lastName')
      ? normalizeOptionalText(body.lastName)
      : (normalizeOptionalText(user.lastName) || derivedName.lastName);

    if (!firstName) {
      return res.status(400).json({ message: 'First name is required' });
    }

    if (hasOwn(body, 'firstName')) user.firstName = firstName;
    if (hasOwn(body, 'lastName')) user.lastName = lastName;

    user.fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

    if (hasOwn(body, 'phone')) {
      user.phone = normalizeOptionalText(body.phone);
      user.contactNumber = normalizeOptionalText(body.phone);
    }

    if (hasOwn(body, 'contactNumber') && !hasOwn(body, 'phone')) {
      user.phone = normalizeOptionalText(body.contactNumber);
      user.contactNumber = normalizeOptionalText(body.contactNumber);
    }

    if (hasOwn(body, 'secondaryPhone')) {
      user.secondaryPhone = normalizeOptionalText(body.secondaryPhone);
    }

    user.address = user.address || {};
    ['houseNo', 'lane', 'city', 'district', 'province', 'postalCode'].forEach((key) => {
      if (hasOwn(body, key)) {
        user.address[key] = normalizeOptionalText(body[key]);
      }
    });

    if (req.file) {
      user.profileImage = getUploadedFileUrl(req.file, 'profile-images');
    }

    await user.save();
    const updated = serializeUser(user);
    delete updated.password;
    delete updated.securityAnswer;
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// PUT /api/customer/security-question
router.put('/security-question', authenticate, async (req, res) => {
  try {
    const { securityQuestion, securityAnswer } = req.body;

    if (!securityQuestion || !securityAnswer) {
      return res.status(400).json({ message: 'securityQuestion and securityAnswer are required' });
    }

    if (!SECURITY_QUESTIONS.includes(securityQuestion)) {
      return res.status(400).json({ message: 'Selected security question is invalid' });
    }

    const normalizedAnswer = normalizeSecurityAnswer(securityAnswer);
    if (normalizedAnswer.length < 2) {
      return res.status(400).json({ message: 'Security answer is too short' });
    }

    const user = await User.findById(req.user._id).select('+securityAnswer');
    user.securityQuestion = securityQuestion;
    user.securityAnswer = await bcrypt.hash(normalizedAnswer, 10);
    await user.save();

    return res.json({
      message: 'Security question saved successfully',
      securityQuestion: user.securityQuestion,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// PUT /api/customer/change-password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, currentPassword, newPassword, securityAnswer } = req.body;
    const activePassword = currentPassword || oldPassword;

    if (!activePassword || !newPassword || !securityAnswer) {
      return res.status(400).json({
        message: 'currentPassword, newPassword and securityAnswer are required',
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    const user = await User.findById(req.user._id).select('+securityAnswer');
    const passwordMatch = await bcrypt.compare(activePassword, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const samePassword = await bcrypt.compare(newPassword, user.password);
    if (samePassword) {
      return res.status(400).json({ message: 'New password cannot be the same as your current password' });
    }

    if (!user.securityQuestion || !user.securityAnswer) {
      return res.status(400).json({ message: 'Please save a security question before changing password' });
    }

    const answerMatch = await bcrypt.compare(
      normalizeSecurityAnswer(securityAnswer),
      user.securityAnswer,
    );
    if (!answerMatch) {
      return res.status(400).json({ message: 'Security answer is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ message: 'Password updated successfully!' });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// POST /api/customer/premium-upgrade
router.post('/premium-upgrade', authenticate, async (req, res) => {
  try {
    const {
      nameOnCard,
      cardNumber,
      expiry,
      cvv,
      paymentMethod,
      cardBrand,
      premiumPlan,
      upgradeType,
    } = req.body || {};

    const trimmedName = normalizeOptionalText(nameOnCard);
    const digitsOnlyCard = String(cardNumber || '').replace(/\D/g, '');
    const digitsOnlyCvv = String(cvv || '').replace(/\D/g, '');
    const normalizedMethod = normalizeOptionalText(paymentMethod || 'card').toLowerCase();
    const normalizedCardBrand = normalizeOptionalText(cardBrand).toLowerCase();

    if (!trimmedName) {
      return res.status(400).json({ message: 'Name on card is required' });
    }

    if (normalizedMethod !== 'card') {
      return res.status(400).json({ message: 'Only credit or debit card payments are supported in this demo' });
    }

    if (!['visa', 'mastercard', 'unionpay'].includes(normalizedCardBrand)) {
      return res.status(400).json({ message: 'Please select a supported card brand' });
    }

    if (!/^\d{16}$/.test(digitsOnlyCard)) {
      return res.status(400).json({ message: 'Card number must contain exactly 16 digits' });
    }

    if (!/^\d{3,4}$/.test(digitsOnlyCvv)) {
      return res.status(400).json({ message: 'CVV must contain 3 or 4 digits' });
    }

    if (!isValidExpiry(expiry)) {
      return res.status(400).json({ message: 'Card expiry is invalid or already expired' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const purchaseId = generatePurchaseId();
    const cardLast4 = digitsOnlyCard.slice(-4);

    const payment = await Payment.create({
      userId: user._id,
      amount: PREMIUM_UPGRADE_AMOUNT,
      currency: PREMIUM_UPGRADE_CURRENCY,
      paymentType: 'premium_upgrade',
      status: 'approved',
      purchaseId,
      paymentMethod: 'card',
      cardLast4,
      cardBrand: normalizedCardBrand,
      premiumPlan: normalizeOptionalText(premiumPlan) || 'wheelzy_premium_demo',
      upgradeType: normalizeOptionalText(upgradeType) || 'premium_profile',
    });

    user.cardNumber = `**** **** **** ${cardLast4}`;
    user.isPremium = true;
    await user.save();

    return res.json({
      message: 'Premium upgrade approved',
      purchaseId: payment.purchaseId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      cardLast4: payment.cardLast4,
      cardBrand: payment.cardBrand,
      createdAt: payment.createdAt,
      isPremium: true,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// GET /api/customer/notifications
router.get('/notifications', authenticate, async (req, res) => {
  const [bookings, refunds, inquiries, payments, reviews, promotionCandidates] = await Promise.all([
    RentalBooking.find({
      user: req.user._id,
      status: { $in: ['Approved', 'Rejected'] },
      $or: [
        { userViewedAt: { $exists: false } },
        { userViewedAt: null },
      ],
    })
      .populate('vehicle')
      .sort({ paymentReviewedAt: -1, createdAt: -1 })
      .limit(12),
    Refund.find({
      user: req.user._id,
      status: { $in: ['Refund Processing', 'Refunded', 'Refund Rejected'] },
      $or: [
        { userViewedAt: { $exists: false } },
        { userViewedAt: null },
      ],
    })
      .populate({
        path: 'booking',
        populate: { path: 'vehicle' },
      })
      .sort({ processedAt: -1, createdAt: -1 })
      .limit(12),
    SalesInquiry.find({
      email: req.user.email,
      status: { $in: ['Resolved', 'Rejected'] },
      $or: [
        { userViewedAt: { $exists: false } },
        { userViewedAt: null },
      ],
    })
      .populate('vehicleId')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(12),
    Payment.find({
      userId: req.user._id,
      paymentType: 'premium_upgrade',
      status: 'approved',
      $or: [
        { userViewedAt: { $exists: false } },
        { userViewedAt: null },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(6),
    Review.find({
      userId: req.user._id,
      customerDeleted: { $ne: true },
      $or: [
        {
          adminDeleted: true,
          userViewedAt: { $in: [null, undefined] },
        },
        {
          adminDeleted: false,
          isVisible: false,
          userViewedAt: { $in: [null, undefined] },
        },
        {
          adminDeleted: false,
          businessReply: { $exists: true, $nin: [null, ''] },
          userViewedAt: { $in: [null, undefined] },
        },
      ],
    })
      .populate('vehicleId')
      .sort({ adminDeletedAt: -1, hiddenByAdminAt: -1, updatedAt: -1 })
      .limit(12),
    Promotion.find({
      showOnInventoryBanner: true,
      $or: [
        { customerViewedBy: { $exists: false } },
        { customerViewedBy: { $size: 0 } },
        { 'customerViewedBy.userId': { $ne: req.user._id } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(36),
  ]);

  const promotions = promotionCandidates
    .filter((promotion) => getComputedPromotionStatus(promotion) === 'Active')
    .slice(0, 12);

  const notifications = [
    ...bookings.map((booking) => buildCustomerNotification({
      type: 'booking',
      entityId: booking._id,
      title: booking.status === 'Approved' ? 'Booking approved' : 'Booking rejected',
      message: `${formatVehicleName(booking.vehicle)} booking was ${String(booking.status || '').toLowerCase()}.`,
      createdAt: booking.paymentReviewedAt || booking.createdAt,
      targetScreen: 'CustomerBookingsMain',
      image: booking.vehicle?.image1,
      tone: booking.status === 'Approved' ? 'success' : 'critical',
    })),
    ...refunds.map((refund) => buildCustomerNotification({
      type: 'refund',
      entityId: refund._id,
      title:
        refund.status === 'Refunded'
          ? 'Refund completed'
          : refund.status === 'Refund Processing'
            ? 'Refund processing'
            : 'Refund rejected',
      message: `${formatVehicleName(refund.booking?.vehicle)} refund status is now ${refund.status}.`,
      createdAt: refund.processedAt || refund.processingStartedAt || refund.rejectedAt || refund.createdAt,
      targetScreen: 'CustomerBookingsMain',
      image: refund.booking?.vehicle?.image1,
      tone: refund.status === 'Refunded' ? 'success' : refund.status === 'Refund Processing' ? 'warning' : 'critical',
    })),
    ...inquiries.map((inquiry) => buildCustomerNotification({
      type: 'inquiry',
      entityId: inquiry._id,
      title: inquiry.status === 'Resolved' ? 'Inquiry resolved' : 'Inquiry rejected',
      message: `${formatVehicleName(inquiry.vehicleId)} inquiry was ${String(inquiry.status || '').toLowerCase()}.`,
      createdAt: inquiry.updatedAt || inquiry.createdAt,
      targetScreen: 'CustomerInquiriesMain',
      image: inquiry.vehicleId?.image1,
      tone: inquiry.status === 'Resolved' ? 'success' : 'critical',
    })),
    ...payments.map((payment) => buildCustomerNotification({
      type: 'premium',
      entityId: payment._id,
      title: 'Premium activated',
      message: 'Your Wheelzy Premium membership is now active.',
      createdAt: payment.createdAt,
      targetScreen: 'PremiumUpgradeMain',
      image: req.user.profileImage,
      tone: 'premium',
    })),
    ...reviews.map((review) => buildCustomerNotification({
      type: 'review',
      entityId: review._id,
      title: review.adminDeleted ? 'Review deleted' : review.isVisible === false ? 'Review hidden' : 'Review response received',
      message: review.adminDeleted
        ? `Your review for ${formatVehicleName(review.vehicleId)} was deleted. Reason: ${review.adminDeleteReason || 'Removed by admin'}.`
        : review.isVisible === false
          ? `Your review for ${formatVehicleName(review.vehicleId)} is hidden from public view right now.`
          : `Wheelzy replied to your review for ${formatVehicleName(review.vehicleId)}.`,
      createdAt: review.adminDeletedAt || review.hiddenByAdminAt || review.adminResponseDate || review.updatedAt || review.createdAt,
      targetScreen: 'CustomerReviewsMain',
      image: review.vehicleId?.image1,
      tone: review.adminDeleted ? 'critical' : review.isVisible === false ? 'warning' : 'success',
    })),
    ...promotions.map((promotion) => buildCustomerNotification({
      type: 'promotion',
      entityId: promotion._id,
      title: 'New promotion available',
      message: `${promotion.title || 'A new promotion'} is now live for eligible vehicles.`,
      createdAt: promotion.createdAt,
      targetScreen: 'CustomerPromotionsMain',
      image: promotion.imageUrl,
      tone: 'warning',
    })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 30);

  return res.json(notifications);
});

// POST /api/customer/notifications/mark-viewed
router.post('/notifications/mark-viewed', authenticate, async (req, res) => {
  const { type, entityId } = req.body || {};

  if (!type || !entityId) {
    return res.status(400).json({ message: 'type and entityId are required' });
  }

  const viewedAt = new Date();
  const update = { userViewedAt: viewedAt };
  let updated = null;

  if (type === 'booking') {
    updated = await RentalBooking.findOneAndUpdate({ _id: entityId, user: req.user._id }, update, { new: true });
  } else if (type === 'refund') {
    updated = await Refund.findOneAndUpdate({ _id: entityId, user: req.user._id }, update, { new: true });
  } else if (type === 'inquiry') {
    updated = await SalesInquiry.findOneAndUpdate({ _id: entityId, email: req.user.email }, update, { new: true });
  } else if (type === 'premium') {
    updated = await Payment.findOneAndUpdate({ _id: entityId, userId: req.user._id }, update, { new: true });
  } else if (type === 'review') {
    updated = await Review.findOneAndUpdate({ _id: entityId, userId: req.user._id }, update, { new: true });
  } else if (type === 'promotion') {
    updated = await Promotion.findByIdAndUpdate(
      entityId,
      {
        $pull: { customerViewedBy: { userId: req.user._id } },
      },
      { new: true },
    );

    if (updated) {
      updated = await Promotion.findByIdAndUpdate(
        entityId,
        {
          $push: { customerViewedBy: { userId: req.user._id, viewedAt } },
        },
        { new: true },
      );
    }
  } else {
    return res.status(400).json({ message: 'Unsupported notification type' });
  }

  if (!updated) {
    return res.status(404).json({ message: 'Notification target not found' });
  }

  return res.json({ success: true, userViewedAt: viewedAt.toISOString() });
});

// POST /api/customer/add-card
router.post('/add-card', authenticate, async (req, res) => {
  return res.status(410).json({ message: LEGACY_PREMIUM_CARD_ENDPOINT_MESSAGE });
});

// DELETE /api/customer/remove-card
router.delete('/remove-card', authenticate, async (req, res) => {
  return res.status(410).json({ message: LEGACY_PREMIUM_CARD_ENDPOINT_MESSAGE });
});

// POST /api/customer/delete-preview
router.post('/delete-preview', authenticate, async (req, res) => {
  try {
    const user = await validateAccountDeletionCredentials(req);
    const assessment = await buildAccountDeletionAssessment(user, { audience: 'customer' });

    return res.json({
      ...assessment,
      pendingAction: assessment.counts.pendingBookings > 0
        ? `${assessment.counts.pendingBookings} pending booking${assessment.counts.pendingBookings === 1 ? '' : 's'} will be marked as ${ACCOUNT_DELETION_CANCELLED_STATUS}.`
        : null,
      preservedRecords: {
        bookings: true,
        payments: true,
        refunds: true,
        reviews: true,
        inquiries: true,
      },
    });
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.message });
  }
});

// DELETE /api/customer/delete
router.delete('/delete', authenticate, async (req, res) => {
  try {
    const user = await validateAccountDeletionCredentials(req);
    const assessment = await buildAccountDeletionAssessment(user, { audience: 'customer' });
    if (!assessment.allowed) {
      return res.status(409).json({
        message: assessment.message,
        assessment,
      });
    }

    const { counts } = await anonymizeCustomerAccount(user, { assessment });

    return res.json({
      message: 'Account deleted successfully. Your access has been disabled and personal details were anonymized.',
      updated: {
        pendingBookingsCancelled: assessment.counts.pendingBookings,
        wishlistRemoved: counts.wishlist,
      },
      preserved: {
        bookings: counts.bookings,
        refunds: counts.refunds,
        reviews: counts.reviews,
        inquiries: counts.inquiries,
        payments: counts.payments,
      },
    });
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.message });
  }
});

module.exports = router;
