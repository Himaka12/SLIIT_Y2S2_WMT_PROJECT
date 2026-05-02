const express = require('express');
const router = express.Router();
const path = require('path');
const Vehicle = require('../models/Vehicle');
const RentalBooking = require('../models/RentalBooking');
const Refund = require('../models/Refund');
const Review = require('../models/Review');
const SalesInquiry = require('../models/SalesInquiry');
const Wishlist = require('../models/Wishlist');
const Promotion = require('../models/Promotion');
const { authenticate, requireAdmin, requireAdminOrMarketing } = require('../middleware/auth');
const { getUploadedFileUrl, uploadVehicleImages } = require('../utils/upload');

// Helper: build image URL from uploaded file
const fileUrl = (file) => getUploadedFileUrl(file, 'vehicles');
const VALID_TRANSMISSIONS = ['Manual', 'Automatic', 'Semi-Automatic'];
const VALID_STATUSES = ['Available', 'Coming Soon', 'Sold'];
const VALID_CONDITIONS = ['New', 'Used'];
const ACTIVE_VEHICLE_FILTER = { isDeleted: { $ne: true } };

function parseWholeNumber(value, fieldLabel) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldLabel} is required`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${fieldLabel} must be a whole number`);
  }

  return parsed;
}

function normalizeVehiclePayload(body, fileCount, options = {}) {
  const { allowSold = false, existingVehicle = null } = options;
  if (fileCount > 5) {
    throw new Error('You can upload up to 5 images only');
  }

  const data = { ...body };
  const currentYear = new Date().getFullYear();
  data.brand = String(body.brand || '').trim();
  data.model = String(body.model || '').trim();
  data.color = String(body.color || '').trim();
  data.description = String(body.description || '').trim();

  if (!data.brand) {
    throw new Error('Brand is required');
  }

  if (!data.model) {
    throw new Error('Model is required');
  }

  if (!data.color) {
    throw new Error('Color is required');
  }

  if (!VALID_CONDITIONS.includes(body.vehicleCondition)) {
    throw new Error('Vehicle condition is invalid');
  }

  if (
    existingVehicle
    && existingVehicle.vehicleCondition === 'Used'
    && body.vehicleCondition === 'New'
  ) {
    throw new Error('A used vehicle cannot be changed back to new');
  }

  if (!VALID_TRANSMISSIONS.includes(body.transmission)) {
    throw new Error('Transmission is invalid');
  }

  data.manufactureYear = parseWholeNumber(body.manufactureYear, 'Manufacture year');
  data.quantity = parseWholeNumber(body.quantity, 'Quantity');
  data.mileage = parseWholeNumber(body.mileage, 'Mileage');
  data.seatCount = parseWholeNumber(body.seatCount, 'Seat count');
  data.engineCapacity = String(parseWholeNumber(body.engineCapacity, 'Engine capacity'));
  data.price = parseWholeNumber(body.price, 'Price');

  if (data.manufactureYear < 1900) {
    throw new Error('Manufacture year is out of range');
  }

  if (data.quantity < 0) {
    throw new Error('Quantity cannot be negative');
  }

  if (data.mileage < 0) {
    throw new Error('Mileage cannot be negative');
  }

  if (data.seatCount <= 0) {
    throw new Error('Seat count must be greater than 0');
  }

  if (Number(data.engineCapacity) <= 0) {
    throw new Error('Engine capacity must be greater than 0');
  }

  if (data.price <= 0) {
    throw new Error('Price must be greater than 0');
  }

  if (body.vehicleCondition === 'New') {
    data.mileage = 0;
  }

  let normalizedStatus = VALID_STATUSES.includes(body.status) ? body.status : 'Available';

  if (normalizedStatus === 'Sold' && !allowSold) {
    normalizedStatus = 'Available';
  }

  if (normalizedStatus !== 'Sold' && data.quantity === 0) {
    normalizedStatus = 'Coming Soon';
  }

  if (normalizedStatus === 'Coming Soon' && data.quantity !== 0) {
    throw new Error('Coming Soon vehicles must have quantity 0');
  }

  if (normalizedStatus === 'Sold' && data.quantity !== 0) {
    throw new Error('Sold vehicles must have quantity 0');
  }

  if (normalizedStatus === 'Available' && data.quantity === 0) {
    throw new Error('Available vehicles must have quantity greater than 0');
  }

  if (normalizedStatus === 'Available' && data.manufactureYear > currentYear) {
    throw new Error('Available vehicles cannot use a future year');
  }

  if (normalizedStatus === 'Coming Soon' && data.manufactureYear > currentYear + 1) {
    throw new Error('Coming Soon vehicles can only be up to next year');
  }

  data.status = normalizedStatus;

  return data;
}

async function getVehicleCascadeSummary(vehicleId) {
  const bookings = await RentalBooking.find({ vehicle: vehicleId }).select('_id');
  const bookingIds = bookings.map((booking) => booking._id);

  const [refunds, reviews, inquiries] = await Promise.all([
    bookingIds.length ? Refund.countDocuments({ booking: { $in: bookingIds } }) : 0,
    Review.countDocuments({ vehicleId }),
    SalesInquiry.countDocuments({ vehicleId }),
  ]);

  return {
    bookings: bookings.length,
    refunds,
    reviews,
    inquiries,
    bookingIds,
  };
}

async function attachVehiclePopularity(vehicles) {
  return Promise.all(
    vehicles.map(async (vehicle) => {
      const vehicleId = vehicle._id;
      const [bookingCount, inquiryCount, wishlistCount] = await Promise.all([
        RentalBooking.countDocuments({ vehicle: vehicleId }),
        SalesInquiry.countDocuments({ vehicleId }),
        Wishlist.countDocuments({ vehicle: vehicleId }),
      ]);

      const vehicleObject = vehicle.toObject ? vehicle.toObject() : vehicle;

      return {
        ...vehicleObject,
        popularityCount: bookingCount + inquiryCount + wishlistCount,
        popularityBreakdown: {
          bookings: bookingCount,
          inquiries: inquiryCount,
          wishlists: wishlistCount,
        },
      };
    }),
  );
}

async function removeVehicleFromPromotions(vehicleId) {
  const linkedPromotions = await Promotion.find({
    $or: [
      { targetVehicleIds: vehicleId },
      { 'targetScope.vehicleIds': vehicleId },
    ],
  });

  await Promise.all(
    linkedPromotions.map(async (promotion) => {
      const targetVehicleIds = (promotion.targetVehicleIds || []).filter(
        (id) => String(id) !== String(vehicleId),
      );
      const scopedVehicleIds = (promotion.targetScope?.vehicleIds || []).filter(
        (id) => String(id) !== String(vehicleId),
      );
      const usesVehicleScope = promotion.targetScope?.kind === 'vehicle';

      if (usesVehicleScope && targetVehicleIds.length === 0 && scopedVehicleIds.length === 0) {
        await promotion.deleteOne();
        return;
      }

      promotion.targetVehicleIds = targetVehicleIds;
      if (promotion.targetScope) {
        promotion.targetScope.vehicleIds = scopedVehicleIds;
      }

      await promotion.save();
    }),
  );
}

// POST /api/vehicles/add
router.post('/add', authenticate, requireAdmin, uploadVehicleImages.array('images', 5), async (req, res) => {
  try {
    const data = normalizeVehiclePayload(req.body, (req.files || []).length);
    // Attach uploaded images
    const files = req.files || [];
    if (files[0]) data.image1 = fileUrl(files[0]);
    if (files[1]) data.image2 = fileUrl(files[1]);
    if (files[2]) data.image3 = fileUrl(files[2]);
    if (files[3]) data.image4 = fileUrl(files[3]);
    if (files[4]) data.image5 = fileUrl(files[4]);

    // Handle retained image URLs (sent as strings when not replacing)
    ['image1','image2','image3','image4','image5'].forEach((key) => {
      if (req.body[key] && !data[key]) data[key] = req.body[key];
    });

    const vehicle = await Vehicle.create(data);
    return res.status(201).json(vehicle);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// PUT /api/vehicles/update/:id
router.put('/update/:id', authenticate, requireAdmin, uploadVehicleImages.array('images', 5), async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...ACTIVE_VEHICLE_FILTER });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    const data = normalizeVehiclePayload(req.body, (req.files || []).length, {
      allowSold: true,
      existingVehicle: vehicle,
    });
    const files = req.files || [];
    if (files[0]) data.image1 = fileUrl(files[0]);
    if (files[1]) data.image2 = fileUrl(files[1]);
    if (files[2]) data.image3 = fileUrl(files[2]);
    if (files[3]) data.image4 = fileUrl(files[3]);
    if (files[4]) data.image5 = fileUrl(files[4]);

    Object.assign(vehicle, data);
    await vehicle.save();
    return res.json(vehicle);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// GET /api/vehicles/all
router.get('/all', async (req, res) => {
  const vehicles = await Vehicle.find(ACTIVE_VEHICLE_FILTER);
  const vehiclesWithPopularity = await attachVehiclePopularity(vehicles);
  return res.json(vehiclesWithPopularity);
});

// GET /api/vehicles/:id
router.get('/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...ACTIVE_VEHICLE_FILTER });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    return res.json(vehicle);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// DELETE /api/vehicles/delete/:id
router.get('/delete-preview/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...ACTIVE_VEHICLE_FILTER });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    const counts = await getVehicleCascadeSummary(vehicle._id);
    return res.json({ vehicleId: vehicle._id, counts: { bookings: counts.bookings, refunds: counts.refunds, reviews: counts.reviews, inquiries: counts.inquiries } });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

router.delete('/delete/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...ACTIVE_VEHICLE_FILTER });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    vehicle.isDeleted = true;
    vehicle.deletedAt = new Date();
    vehicle.status = 'Sold';
    vehicle.quantity = 0;
    await vehicle.save();

    return res.json({
      message: 'Vehicle deleted successfully. Related records were kept.',
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

router.delete('/hard-delete/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...ACTIVE_VEHICLE_FILTER });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    const bookings = await RentalBooking.find({ vehicle: vehicle._id }).select('_id');
    const bookingIds = bookings.map((booking) => booking._id);

    const [refundCount, reviewCount, inquiryCount, wishlistCount] = await Promise.all([
      bookingIds.length ? Refund.countDocuments({ booking: { $in: bookingIds } }) : 0,
      Review.countDocuments({ vehicleId: vehicle._id }),
      SalesInquiry.countDocuments({ vehicleId: vehicle._id }),
      Wishlist.countDocuments({ vehicle: vehicle._id }),
    ]);

    await Promise.all([
      bookingIds.length ? Refund.deleteMany({ booking: { $in: bookingIds } }) : Promise.resolve(),
      RentalBooking.deleteMany({ vehicle: vehicle._id }),
      Review.deleteMany({ vehicleId: vehicle._id }),
      SalesInquiry.deleteMany({ vehicleId: vehicle._id }),
      Wishlist.deleteMany({ vehicle: vehicle._id }),
      removeVehicleFromPromotions(vehicle._id),
      vehicle.deleteOne(),
    ]);

    return res.json({
      message: 'Vehicle and linked records were permanently deleted.',
      deleted: {
        bookings: bookings.length,
        refunds: refundCount,
        reviews: reviewCount,
        inquiries: inquiryCount,
        wishlists: wishlistCount,
      },
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;
