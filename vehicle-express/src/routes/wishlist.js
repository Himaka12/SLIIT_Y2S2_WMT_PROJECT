const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const { authenticate } = require('../middleware/auth');

// POST /api/wishlist/toggle/:vehicleId
router.post('/toggle/:vehicleId', authenticate, async (req, res) => {
  try {
    const existing = await Wishlist.findOne({ user: req.user._id, vehicle: req.params.vehicleId });
    if (existing) {
      await existing.deleteOne();
      return res.json({ message: 'Removed from wishlist', added: false });
    }
    await Wishlist.create({ user: req.user._id, vehicle: req.params.vehicleId });
    return res.json({ message: 'Added to wishlist', added: true });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// GET /api/wishlist/my-wishlist
router.get('/my-wishlist', authenticate, async (req, res) => {
  const items = await Wishlist.find({ user: req.user._id }).populate('vehicle').sort({ addedDate: -1 });
  return res.json(items);
});

// GET /api/wishlist/my-wishlist-ids
router.get('/my-wishlist-ids', authenticate, async (req, res) => {
  const items = await Wishlist.find({ user: req.user._id }).select('vehicle');
  return res.json(items.map(i => i.vehicle.toString()));
});

module.exports = router;
