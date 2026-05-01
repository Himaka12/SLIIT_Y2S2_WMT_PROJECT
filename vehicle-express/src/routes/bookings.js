const express = require('express');
const router = express.Router();
const RentalBooking = require('../models/RentalBooking');
const Refund = require('../models/Refund');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { uploadSlip } = require('../utils/upload');
const { isDeletedUser } = require('../utils/accountDeletion');
const {
  REFUND_ELIGIBLE_BOOKING_STATUSES,
  REFUND_WINDOW_MS,
  getRefundAvailabilityMeta,
} = require('../utils/refundHelpers');

const ACTIVE_BOOKING_STATUSES = ['Pending', 'Approved'];
const PREMIUM_RENT_DISCOUNT_PERCENTAGE = 10;

function getTodayDateString() {
  const today = new Date();
  const offsetMs = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - offsetMs).toISOString().split('T')[0];
}

function validateBookingSlot({ startDate, startTime, endDate, endTime }) {
  if (!startDate || !startTime || !endDate || !endTime) {
    throw new Error('Start date, start time, end date, and end time are required');
  }

  if (startDate < getTodayDateString()) {
    throw new Error('Start date cannot be earlier than today');
  }

  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid booking date or time');
  }

  if (end < start) {
    throw new Error('End date and time must be after the start date and time');
  }
}

function buildBookingSlotRange(startDate, startTime, endDate, endTime) {
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return { start, end };
}

function rangesOverlap(left, right) {
  return left.start < right.end && left.end > right.start;
}

function getBookingDurationDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid booking date');
  }

  return Math.max(
    0,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
}

function getPremiumRentDiscountedPrice(price) {
  return Math.round(Number(price || 0) * (1 - (PREMIUM_RENT_DISCOUNT_PERCENTAGE / 100)));
}

function calculateBookingPricing({ user, vehicle, startDate, endDate, requestedUnits }) {
  const originalUnitPrice = Number(vehicle?.price || 0);
  const premiumEligible = Boolean(user?.isPremium) && String(vehicle?.listingType || '').toLowerCase() === 'rent';
  const unitPrice = premiumEligible ? getPremiumRentDiscountedPrice(originalUnitPrice) : originalUnitPrice;
  const totalDays = getBookingDurationDays(startDate, endDate);
  const totalAmount = totalDays * unitPrice * requestedUnits;

  return {
    unitPrice,
    totalAmount,
    totalDays,
    premiumApplied: premiumEligible,
  };
}

function normalizeRequestedUnits(value) {
  const parsed = Number.parseInt(String(value ?? '1'), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('Requested quantity must be at least 1');
  }

  return parsed;
}

async function getSlotAvailability(vehicleId, startDate, startTime, endDate, endTime, requestedUnits = 1, excludeId = null) {
  validateBookingSlot({ startDate, startTime, endDate, endTime });
  const normalizedRequestedUnits = normalizeRequestedUnits(requestedUnits);
  const requestedRange = buildBookingSlotRange(startDate, startTime, endDate, endTime);

  const vehicle = await Vehicle.findOne({ _id: vehicleId, isDeleted: { $ne: true } }).select('_id quantity status listingType');
  if (!vehicle) {
    throw new Error('Vehicle not found');
  }

  if (String(vehicle.listingType || '').toLowerCase() !== 'rent') {
    throw new Error('Bookings are only available for rental vehicles');
  }

  const quantity = Math.max(0, Number(vehicle.quantity || 0));
  if (quantity === 0) {
    return {
      available: false,
      availabilityStatus: 'out_of_stock',
      totalQuantity: quantity,
      bookedCount: 0,
      bookedUnits: 0,
      remainingQuantity: 0,
      quantity,
      activeBookings: 0,
      remainingUnits: 0,
      requestedUnits: normalizedRequestedUnits,
      requestedQuantity: normalizedRequestedUnits,
      projectedRemainingQuantity: 0,
      reason: 'out_of_stock',
    };
  }

  if (normalizedRequestedUnits > quantity) {
    return {
      available: false,
      availabilityStatus: 'requested_units_exceed_stock',
      totalQuantity: quantity,
      bookedCount: 0,
      bookedUnits: 0,
      remainingQuantity: quantity,
      quantity,
      activeBookings: 0,
      remainingUnits: quantity,
      requestedUnits: normalizedRequestedUnits,
      requestedQuantity: normalizedRequestedUnits,
      projectedRemainingQuantity: quantity,
      reason: 'requested_units_exceed_stock',
    };
  }

  const query = {
    vehicle: vehicleId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const activeVehicleBookings = await RentalBooking.find(query).select('requestedUnits startDate startTime endDate endTime');
  const matchingBookings = activeVehicleBookings.filter((booking) => {
    const bookingRange = buildBookingSlotRange(
      booking.startDate,
      booking.startTime,
      booking.endDate,
      booking.endTime,
    );

    // If an existing active booking has invalid stored dates, fail safe and
    // treat it as blocking so we don't overbook inventory.
    if (!bookingRange || !requestedRange) {
      return true;
    }

    return rangesOverlap(requestedRange, bookingRange);
  });
  const activeBookings = matchingBookings.length;
  const bookedUnits = matchingBookings.reduce((sum, booking) => sum + Math.max(1, Number(booking.requestedUnits || 1)), 0);
  const remainingUnits = Math.max(quantity - bookedUnits, 0);
  const projectedRemainingQuantity = Math.max(remainingUnits - normalizedRequestedUnits, 0);
  const available = bookedUnits + normalizedRequestedUnits <= quantity;

  return {
    available,
    availabilityStatus: available ? 'available' : 'fully_booked',
    totalQuantity: quantity,
    bookedCount: activeBookings,
    bookedUnits,
    remainingQuantity: remainingUnits,
    quantity,
    activeBookings,
    remainingUnits,
    requestedUnits: normalizedRequestedUnits,
    requestedQuantity: normalizedRequestedUnits,
    projectedRemainingQuantity,
    reason: available ? 'available' : 'slot_full',
  };
}

async function enrichBookingsWithRefunds(bookings) {
  const bookingIds = bookings.map((booking) => booking?._id).filter(Boolean);
  if (!bookingIds.length) {
    return bookings;
  }

  const refunds = await Refund.find({ booking: { $in: bookingIds } }).sort({ createdAt: -1 });
  const refundMap = new Map(
    refunds.map((refund) => [String(refund.booking), refund.toObject()])
  );

  return bookings.map((bookingDocument) => {
    const booking = typeof bookingDocument.toObject === 'function'
      ? bookingDocument.toObject()
      : bookingDocument;
    const refund = refundMap.get(String(booking._id)) || null;

    return {
      ...booking,
      refund,
      refundMeta: getRefundAvailabilityMeta(booking, refund),
    };
  });
}

// GET /api/bookings/check-availability
router.get('/check-availability', async (req, res) => {
  try {
    const { vehicleId, startDate, endDate, startTime, endTime, requestedUnits, excludeBookingId } = req.query;
    const availability = await getSlotAvailability(vehicleId, startDate, startTime, endDate, endTime, requestedUnits, excludeBookingId);
    return res.json(availability);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/bookings/rent
router.post('/rent', authenticate, uploadSlip.single('paymentSlip'), async (req, res) => {
  try {
    const { vehicleId, startDate, endDate, startTime, endTime, requestedUnits } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Payment slip is required' });

    const normalizedRequestedUnits = normalizeRequestedUnits(requestedUnits);
    const availability = await getSlotAvailability(vehicleId, startDate, startTime, endDate, endTime, normalizedRequestedUnits);
    if (!availability.available) {
      const message = availability.reason === 'out_of_stock'
        ? 'This vehicle is currently unavailable.'
        : availability.reason === 'requested_units_exceed_stock'
          ? 'Requested quantity exceeds the total available vehicle quantity.'
        : 'This slot is already fully booked for the selected vehicle.';
      return res.status(400).json({ message, availability });
    }

    const paymentSlipUrl = `/uploads/slips/${req.file.filename}`;
    const vehicle = await Vehicle.findOne({ _id: vehicleId, isDeleted: { $ne: true } }).select('_id price listingType');
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const pricing = calculateBookingPricing({
      user: req.user,
      vehicle,
      startDate,
      endDate,
      requestedUnits: normalizedRequestedUnits,
    });
    const booking = await RentalBooking.create({
      user: req.user._id,
      vehicle: vehicleId,
      startDate, startTime, endDate, endTime,
      requestedUnits: normalizedRequestedUnits,
      unitPrice: pricing.unitPrice,
      totalAmount: pricing.totalAmount,
      paymentSlipUrl,
    });

    await booking.populate(['user', 'vehicle']);
    return res.json(booking);
  } catch (err) {
    return res.status(400).json({ message: 'Booking Failed: ' + err.message });
  }
});

// PUT /api/bookings/update/:id
router.put('/update/:id', authenticate, uploadSlip.single('paymentSlip'), async (req, res) => {
  try {
    const booking = await RentalBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });

    const { startDate, endDate, startTime, endTime, requestedUnits } = req.body;
    const normalizedRequestedUnits = normalizeRequestedUnits(requestedUnits);
    const availability = await getSlotAvailability(booking.vehicle, startDate, startTime, endDate, endTime, normalizedRequestedUnits, booking._id);
    if (!availability.available) {
      const message = availability.reason === 'out_of_stock'
        ? 'This vehicle is currently unavailable.'
        : availability.reason === 'requested_units_exceed_stock'
          ? 'Requested quantity exceeds the total available vehicle quantity.'
        : 'This slot is already fully booked for the selected vehicle.';
      return res.status(400).json({ message, availability });
    }

    const vehicle = await Vehicle.findOne({ _id: booking.vehicle, isDeleted: { $ne: true } }).select('_id price listingType');
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const pricing = calculateBookingPricing({
      user: req.user,
      vehicle,
      startDate,
      endDate,
      requestedUnits: normalizedRequestedUnits,
    });

    booking.startDate = startDate;
    booking.endDate   = endDate;
    booking.startTime = startTime;
    booking.endTime   = endTime;
    booking.requestedUnits = normalizedRequestedUnits;
    booking.unitPrice = pricing.unitPrice;
    booking.totalAmount = pricing.totalAmount;
    if (req.file) booking.paymentSlipUrl = `/uploads/slips/${req.file.filename}`;
    await booking.save();

    await booking.populate(['user', 'vehicle']);
    return res.json(booking);
  } catch (err) {
    return res.status(400).json({ message: 'Update Failed: ' + err.message });
  }
});

// DELETE /api/bookings/delete/:id  (customer cancel)
router.delete('/delete/:id', authenticate, async (req, res) => {
  try {
    const booking = await RentalBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    if (!['Pending', 'Approved'].includes(booking.status))
      return res.status(400).json({ message: 'Cannot cancel a booking with status: ' + booking.status });

    booking.status = 'Cancelled';
    await booking.save();
    return res.json({ message: 'Booking cancelled successfully.' });
  } catch (err) {
    return res.status(400).json({ message: 'Cancellation Failed: ' + err.message });
  }
});

// GET /api/bookings/my-bookings
router.get('/my-bookings', authenticate, async (req, res) => {
  const bookings = await RentalBooking.find({ user: req.user._id }).populate('vehicle').sort({ createdAt: -1 });
  return res.json(await enrichBookingsWithRefunds(bookings));
});

// GET /api/bookings/all  (Admin)
router.get('/all', authenticate, requireAdmin, async (req, res) => {
  const bookings = await RentalBooking.find().populate(['user', 'vehicle']).sort({ createdAt: -1 });
  return res.json(await enrichBookingsWithRefunds(bookings));
});

// PUT /api/bookings/status/:id  (Admin)
router.put('/status/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await RentalBooking.findById(req.params.id).populate('user');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!['Approved', 'Rejected', 'Cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid booking status update.' });
    }

    if (!booking.user || isDeletedUser(booking.user)) {
      return res.status(400).json({
        message: 'This booking belongs to a deleted customer account and is view-only for approval/rejection actions.',
      });
    }

    if (['Approved', 'Rejected'].includes(status) && !booking.paymentSlipViewedAt) {
      return res.status(400).json({ message: 'Please view the customer payment slip before approving or rejecting this booking.' });
    }

    booking.status = status;

    if (REFUND_ELIGIBLE_BOOKING_STATUSES.includes(status)) {
      const decisionAt = new Date();
      booking.paymentReviewedAt = decisionAt;
      booking.refundEligibleUntil = new Date(decisionAt.getTime() + REFUND_WINDOW_MS);
    } else {
      booking.paymentReviewedAt = undefined;
      booking.refundEligibleUntil = undefined;
    }

    await booking.save();
    await booking.populate('vehicle');

    const refund = await Refund.findOne({ booking: booking._id });
    const bookingObject = booking.toObject();

    return res.json({
      ...bookingObject,
      refund,
      refundMeta: getRefundAvailabilityMeta(bookingObject, refund),
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// POST /api/bookings/:id/view-slip  (Admin)
router.post('/:id/view-slip', authenticate, requireAdmin, async (req, res) => {
  try {
    const booking = await RentalBooking.findById(req.params.id).populate(['user', 'vehicle']);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (!booking.paymentSlipUrl) {
      return res.status(400).json({ message: 'This booking does not have a payment slip.' });
    }

    booking.paymentSlipViewedAt = booking.paymentSlipViewedAt || new Date();
    await booking.save();

    const refund = await Refund.findOne({ booking: booking._id });
    const bookingObject = booking.toObject();

    return res.json({
      ...bookingObject,
      refund,
      refundMeta: getRefundAvailabilityMeta(bookingObject, refund),
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// DELETE /api/bookings/admin-delete/:id  (Admin hard delete)
router.delete('/admin-delete/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const booking = await RentalBooking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    const refundsResult = await Refund.deleteMany({ booking: booking._id });

    return res.json({
      message: 'Booking and linked refund records were permanently erased from the database.',
      deleted: {
        refunds: refundsResult.deletedCount || 0,
      },
    });
  } catch (err) {
    return res.status(400).json({ message: 'Delete Failed: ' + err.message });
  }
});

module.exports = router;
