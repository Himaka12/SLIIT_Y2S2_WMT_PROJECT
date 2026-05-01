const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;
const REFUND_ELIGIBLE_BOOKING_STATUSES = ['Approved', 'Rejected'];
const REFUND_ACTIVE_STATUSES = ['Refund Requested', 'Refund Processing', 'Refunded', 'Refund Rejected'];

function asDate(value) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveRefundWindow(booking) {
  const decisionAt = asDate(booking?.paymentReviewedAt)
    || (REFUND_ELIGIBLE_BOOKING_STATUSES.includes(booking?.status)
      ? asDate(booking?.createdAt)
      : null);
  const refundEligibleUntil = asDate(booking?.refundEligibleUntil)
    || (decisionAt ? new Date(decisionAt.getTime() + REFUND_WINDOW_MS) : null);

  return {
    decisionAt,
    refundEligibleUntil,
  };
}

function isBookingRefundEligible(booking, now = new Date()) {
  if (!booking || !REFUND_ELIGIBLE_BOOKING_STATUSES.includes(booking.status)) {
    return false;
  }

  const { decisionAt, refundEligibleUntil } = resolveRefundWindow(booking);
  if (!decisionAt || !refundEligibleUntil) {
    return false;
  }

  return refundEligibleUntil.getTime() >= now.getTime();
}

function getRefundAvailabilityMeta(booking, refund = null, now = new Date()) {
  const { decisionAt, refundEligibleUntil } = resolveRefundWindow(booking);
  const bookingStatus = booking?.status || 'Pending';
  const eligibleByStatus = REFUND_ELIGIBLE_BOOKING_STATUSES.includes(bookingStatus);
  const canRequestRefund = !refund && eligibleByStatus && isBookingRefundEligible(booking, now);

  let status = 'Refund Not Available';
  let reason = 'booking_not_eligible';

  if (refund) {
    status = refund.status || 'Refund Requested';
    reason = 'refund_exists';
  } else if (canRequestRefund) {
    status = 'Refund Available';
    reason = 'available';
  } else if (eligibleByStatus && decisionAt && refundEligibleUntil && refundEligibleUntil.getTime() < now.getTime()) {
    reason = 'window_expired';
  }

  return {
    status,
    reason,
    canRequestRefund,
    bookingStatus,
    decisionAt,
    refundEligibleUntil,
    refundRequestedAt: refund?.requestedAt || refund?.createdAt || null,
    refundProcessedAt: refund?.processedAt || null,
    refundSlipUrl: refund?.refundProofUrl || refund?.refundSlipUrl || null,
    hasRefundRequest: Boolean(refund),
  };
}

module.exports = {
  REFUND_ACTIVE_STATUSES,
  REFUND_ELIGIBLE_BOOKING_STATUSES,
  REFUND_WINDOW_MS,
  getRefundAvailabilityMeta,
  isBookingRefundEligible,
  resolveRefundWindow,
};
