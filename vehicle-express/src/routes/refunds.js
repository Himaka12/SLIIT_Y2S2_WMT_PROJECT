const express = require('express');

const router = express.Router();
const Refund = require('../models/Refund');
const RentalBooking = require('../models/RentalBooking');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { uploadSlip } = require('../utils/upload');
const { getRefundAvailabilityMeta, isBookingRefundEligible } = require('../utils/refundHelpers');

const REQUESTED_STATUS = 'Refund Requested';
const PROCESSING_STATUS = 'Refund Processing';
const REFUNDED_STATUS = 'Refunded';
const REJECTED_STATUS = 'Refund Rejected';

function trimValue(value) {
  return String(value || '').trim();
}

function getFallbackBookingTotal(booking) {
  const unitPrice = Number(booking?.unitPrice || booking?.vehicle?.price || 0);
  const requestedUnits = Math.max(1, Number(booking?.requestedUnits || 1));
  const start = new Date(`${booking?.startDate}T00:00:00`);
  const end = new Date(`${booking?.endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return unitPrice * requestedUnits;
  }

  const totalDays = Math.max(
    0,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );

  return totalDays * unitPrice * requestedUnits;
}

function resolveRefundAmount(booking) {
  const storedTotal = Number(booking?.totalAmount);
  if (Number.isFinite(storedTotal) && storedTotal > 0) {
    return storedTotal;
  }

  return getFallbackBookingTotal(booking);
}

function validateBankDetails({ bankName, branchName, accountNumber, accountHolderName }) {
  const errors = {};

  if (!trimValue(accountHolderName)) {
    errors.accountHolderName = 'Account holder name is required.';
  }

  if (!trimValue(bankName)) {
    errors.bankName = 'Bank name is required.';
  }

  if (!trimValue(branchName)) {
    errors.branchName = 'Branch is required.';
  }

  if (!/^\d{6,20}$/.test(trimValue(accountNumber))) {
    errors.accountNumber = 'Account number must be 6 to 20 digits.';
  }

  return errors;
}

async function populateRefund(refundId) {
  return Refund.findById(refundId)
    .populate('user')
    .populate({
      path: 'booking',
      populate: { path: 'vehicle' },
    });
}

function serializeRefund(refund) {
  if (!refund) {
    return null;
  }

  const refundObject = typeof refund.toObject === 'function' ? refund.toObject() : refund;
  return {
    ...refundObject,
    refundMeta: getRefundAvailabilityMeta(refundObject.booking, refundObject),
  };
}

// POST /api/refunds/claim/:bookingId
router.post('/claim/:bookingId', authenticate, async (req, res) => {
  try {
    const booking = await RentalBooking.findById(req.params.bookingId).populate('vehicle');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const existing = await Refund.findOne({ booking: booking._id });
    if (existing) {
      return res.status(400).json({ message: 'Refund already requested for this booking.' });
    }

    if (!isBookingRefundEligible(booking)) {
      return res.status(400).json({
        message: 'Refund is only available within 24 hours after admin approval or rejection.',
        refundMeta: getRefundAvailabilityMeta(booking),
      });
    }

    const bankDetails = {
      bankName: trimValue(req.body.bankName),
      branchName: trimValue(req.body.branchName),
      accountNumber: trimValue(req.body.accountNumber),
      accountHolderName: trimValue(req.body.accountHolderName),
    };
    const validationErrors = validateBankDetails(bankDetails);
    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        message: 'Please complete the required bank details.',
        errors: validationErrors,
      });
    }

    const refund = await Refund.create({
      user: req.user._id,
      booking: booking._id,
      amount: resolveRefundAmount(booking),
      ...bankDetails,
      status: REQUESTED_STATUS,
      requestedAt: new Date(),
    });

    const populatedRefund = await populateRefund(refund._id);
    return res.json(serializeRefund(populatedRefund));
  } catch (err) {
    return res.status(400).json({ message: `Failed to submit refund claim: ${err.message}` });
  }
});

// POST /api/refunds/process/:refundId
router.post('/process/:refundId', authenticate, requireAdmin, uploadSlip.single('refundProof'), async (req, res) => {
  try {
    const nextStatus = trimValue(req.body.status) || PROCESSING_STATUS;
    if (![PROCESSING_STATUS, REFUNDED_STATUS, REJECTED_STATUS].includes(nextStatus)) {
      return res.status(400).json({ message: 'Invalid refund status update.' });
    }

    const refund = await Refund.findById(req.params.refundId).populate('booking');
    if (!refund) return res.status(404).json({ message: 'Refund not found' });

    if (nextStatus === REFUNDED_STATUS && !req.file && !refund.refundProofUrl) {
      return res.status(400).json({ message: 'Refund slip image is required before marking as refunded.' });
    }

    refund.adminViewedAt = refund.adminViewedAt || new Date();

    if (nextStatus === PROCESSING_STATUS) {
      refund.status = PROCESSING_STATUS;
      refund.processingStartedAt = refund.processingStartedAt || new Date();
    }

    if (nextStatus === REJECTED_STATUS) {
      refund.status = REJECTED_STATUS;
      refund.rejectedAt = new Date();
      refund.processedAt = new Date();
    }

    if (nextStatus === REFUNDED_STATUS) {
      if (req.file) {
        refund.refundProofUrl = `/uploads/slips/${req.file.filename}`;
      }
      refund.status = REFUNDED_STATUS;
      refund.processingStartedAt = refund.processingStartedAt || new Date();
      refund.processedAt = new Date();

      if (refund.booking && refund.booking.status === 'Approved') {
        refund.booking.status = 'Cancelled';
        refund.booking.refundEligibleUntil = undefined;
        await refund.booking.save();
      }
    }

    await refund.save();

    const populatedRefund = await populateRefund(refund._id);
    return res.json(serializeRefund(populatedRefund));
  } catch (err) {
    return res.status(400).json({ message: `Failed to process refund: ${err.message}` });
  }
});

// POST /api/refunds/mark-viewed
router.post('/mark-viewed', authenticate, requireAdmin, async (req, res) => {
  const viewedAt = new Date();
  const result = await Refund.updateMany(
    {
      status: REQUESTED_STATUS,
      $or: [
        { adminViewedAt: { $exists: false } },
        { adminViewedAt: null },
      ],
    },
    { $set: { adminViewedAt: viewedAt } },
  );

  return res.json({
    viewedAt,
    updatedCount: result.modifiedCount || 0,
  });
});

// GET /api/refunds/my
router.get('/my', authenticate, async (req, res) => {
  const refunds = await Refund.find({ user: req.user._id })
    .populate({
      path: 'booking',
      populate: { path: 'vehicle' },
    })
    .sort({ createdAt: -1 });

  return res.json(refunds.map((refund) => serializeRefund(refund)));
});

// GET /api/refunds/pending
router.get('/pending', authenticate, requireAdmin, async (req, res) => {
  const refunds = await Refund.find({ status: REQUESTED_STATUS })
    .populate('user')
    .populate({
      path: 'booking',
      populate: { path: 'vehicle' },
    })
    .sort({ createdAt: -1 });

  return res.json(refunds.map((refund) => serializeRefund(refund)));
});

// GET /api/refunds/all
router.get('/all', authenticate, requireAdmin, async (req, res) => {
  const refunds = await Refund.find()
    .populate('user')
    .populate({
      path: 'booking',
      populate: { path: 'vehicle' },
    })
    .sort({ createdAt: -1 });

  return res.json(refunds.map((refund) => serializeRefund(refund)));
});

// DELETE /api/refunds/admin-delete/:id
router.delete('/admin-delete/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const refund = await Refund.findByIdAndDelete(req.params.id);
    if (!refund) return res.status(404).json({ message: 'Refund not found' });
    return res.json({ message: 'Refund permanently erased from the database.' });
  } catch (err) {
    return res.status(400).json({ message: 'Delete Failed: ' + err.message });
  }
});

module.exports = router;
