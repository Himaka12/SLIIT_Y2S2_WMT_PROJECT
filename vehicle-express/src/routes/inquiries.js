const express = require('express');
const router = express.Router();
const SalesInquiry = require('../models/SalesInquiry');
const Vehicle = require('../models/Vehicle');
const { authenticate, requireAdmin, requireAdminOrMarketing } = require('../middleware/auth');

const CONTACT_METHODS = ['Call', 'WhatsApp', 'Email'];
const INQUIRY_TYPES = [
  'Price Negotiation',
  'Vehicle Availability',
  'Finance / Installment',
  'Vehicle Condition',
  'Inspection Appointment',
];
const INQUIRY_STATUSES = ['Pending', 'Resolved', 'Rejected'];

// POST /api/inquiries/add
router.post('/add', authenticate, async (req, res) => {
  try {
    const {
      vehicleId,
      customerName,
      email,
      phone,
      preferredContactTime,
      contactMethod,
      inquiryType,
      customMessage,
      vehicleTitle,
      vehiclePrice,
    } = req.body;
    const resolvedCustomerName = customerName || req.user.fullName;
    const resolvedEmail = email || req.user.email;

    if (!vehicleId || !resolvedCustomerName || !resolvedEmail || !phone)
      return res.status(400).json({ message: 'vehicleId, customerName, email, and phone are required' });

    const vehicle = await Vehicle.findOne({ _id: vehicleId, isDeleted: { $ne: true } });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }

    if (String(vehicle.listingType || '').toLowerCase() !== 'sale') {
      return res.status(400).json({ message: 'Sales inquiries are only available for sale vehicles.' });
    }

    const normalizedPhone = String(phone || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(normalizedPhone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
    }

    if (!CONTACT_METHODS.includes(contactMethod)) {
      return res.status(400).json({ message: 'Please select a valid contact method.' });
    }

    const normalizedInquiryType = INQUIRY_TYPES.includes(inquiryType) ? inquiryType : '';
    const normalizedCustomMessage = String(customMessage || '').trim();

    if (!normalizedInquiryType && !normalizedCustomMessage) {
      return res.status(400).json({ message: 'Please select an inquiry type or enter a custom message.' });
    }

    if (normalizedInquiryType && normalizedCustomMessage) {
      return res.status(400).json({ message: 'Use either an inquiry type or a custom message, not both.' });
    }

    const existingInquiry = await SalesInquiry.findOne({
      vehicleId,
      email: resolvedEmail,
    });

    if (existingInquiry) {
      return res.status(409).json({ message: 'You already sent an inquiry for this vehicle.' });
    }

    const inquiry = await SalesInquiry.create({
      vehicleId,
      customerId: req.user._id,
      customerName: resolvedCustomerName,
      email: resolvedEmail,
      phone: normalizedPhone,
      contactMethod,
      inquiryType: normalizedInquiryType || undefined,
      customMessage: normalizedCustomMessage || undefined,
      vehicleTitle: vehicleTitle || `${vehicle.brand} ${vehicle.model}`.trim(),
      vehiclePrice: Number(vehiclePrice || vehicle.price || 0),
      preferredContactTime,
      message: normalizedInquiryType || normalizedCustomMessage,
      status: 'Pending',
      inquiryDate: new Date().toISOString().split('T')[0],
      submittedAt: new Date(),
    });
    return res.json(inquiry);
  } catch (err) {
    return res.status(400).json({ message: 'Error submitting inquiry: ' + err.message });
  }
});

// GET /api/inquiries/all  (Admin / Marketing)
router.get('/all', authenticate, requireAdminOrMarketing, async (req, res) => {
  const inquiries = await SalesInquiry.find().populate('vehicleId').sort({ createdAt: -1 });
  return res.json(inquiries);
});

// PUT /api/inquiries/update-status/:id
router.put('/update-status/:id', authenticate, requireAdminOrMarketing, async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    if (!INQUIRY_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Status must be Pending, Resolved, or Rejected.' });
    }

    const inquiry = await SalesInquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' });
    return res.json(inquiry);
  } catch (err) {
    return res.status(400).json({ message: 'Error updating status: ' + err.message });
  }
});

// GET /api/inquiries/my-inquiries
router.get('/my-inquiries', authenticate, async (req, res) => {
  const inquiries = await SalesInquiry.find({ email: req.user.email })
    .populate('vehicleId').sort({ createdAt: -1 });
  return res.json(inquiries);
});

// GET /api/inquiries/check/:vehicleId
router.get('/check/:vehicleId', authenticate, async (req, res) => {
  const exists = await SalesInquiry.exists({ vehicleId: req.params.vehicleId, email: req.user.email });
  return res.json(!!exists);
});

// DELETE /api/inquiries/admin-delete/:id
router.delete('/admin-delete/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const inquiry = await SalesInquiry.findByIdAndDelete(req.params.id);
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' });
    return res.json({ message: 'Inquiry permanently erased from the database.' });
  } catch (err) {
    return res.status(400).json({ message: 'Delete Failed: ' + err.message });
  }
});

module.exports = router;
