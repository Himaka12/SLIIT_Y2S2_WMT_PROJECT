const express = require('express');
const router = express.Router();
const Promotion = require('../models/Promotion');
const { authenticate, requireAdminOrMarketing } = require('../middleware/auth');
const { uploadPromoImage } = require('../utils/upload');
const {
  ACTIVE_STATUS,
  INACTIVE_STATUS,
  buildPromotionPayload,
  getToday,
  serializePromotion,
  validatePromotionPayload,
} = require('../utils/promotionHelpers');

const ACTIVE_PROMOTION_FILTER = {
  status: { $nin: [INACTIVE_STATUS, 'Disabled', 'Expired'] },
};

// POST /api/promotions/add
router.post('/add', authenticate, requireAdminOrMarketing, uploadPromoImage.single('image'), async (req, res) => {
  try {
    const payload = buildPromotionPayload(req.body);
    const validationMessage = validatePromotionPayload(payload);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const promo = await Promotion.create({
      ...payload,
      ...(req.file ? { imageUrl: `/uploads/promotions/${req.file.filename}` } : {}),
      createdByUserId: req.user._id,
      updatedByUserId: req.user._id,
    });

    return res.json(serializePromotion(promo));
  } catch (err) {
    return res.status(400).json({ message: 'Failed to create promotion: ' + err.message });
  }
});

// GET /api/promotions/all
router.get('/all', authenticate, requireAdminOrMarketing, async (req, res) => {
  const promos = await Promotion.find().sort({ createdAt: -1 });
  return res.json(promos.map(serializePromotion));
});

// GET /api/promotions/active
router.get('/active', async (req, res) => {
  const today = getToday();
  const promos = await Promotion.find({
    ...ACTIVE_PROMOTION_FILTER,
    startDate: { $lte: today },
    endDate: { $gte: today },
  }).sort({ priority: -1 });
  return res.json(promos.map(serializePromotion));
});

// GET /api/promotions/showcase  (banner promotions for public homepage)
router.get('/showcase', async (req, res) => {
  const today = getToday();
  const promos = await Promotion.find({
    ...ACTIVE_PROMOTION_FILTER,
    showOnInventoryBanner: true,
    startDate: { $lte: today },
    endDate: { $gte: today },
  }).sort({ priority: -1 }).limit(5);
  return res.json(promos.map(serializePromotion));
});

// PUT /api/promotions/status/:id
router.put('/status/:id', authenticate, requireAdminOrMarketing, async (req, res) => {
  const requestedStatus = String(req.body.status || '').trim();
  if (![ACTIVE_STATUS, INACTIVE_STATUS, 'Disabled'].includes(requestedStatus)) {
    return res.status(400).json({ message: 'Status must be Active or Inactive.' });
  }

  const promo = await Promotion.findByIdAndUpdate(
    req.params.id,
    {
      status: requestedStatus === 'Disabled' ? INACTIVE_STATUS : requestedStatus,
      updatedByUserId: req.user._id,
    },
    { new: true }
  );
  if (!promo) {
    return res.status(404).json({ message: 'Promotion not found' });
  }

  return res.json(serializePromotion(promo));
});

// DELETE /api/promotions/:id
router.delete('/:id', authenticate, requireAdminOrMarketing, async (req, res) => {
  await Promotion.findByIdAndDelete(req.params.id);
  return res.json({ message: 'Promotion deleted successfully.' });
});

// PUT /api/promotions/update/:id
router.put('/update/:id', authenticate, requireAdminOrMarketing, uploadPromoImage.single('image'), async (req, res) => {
  try {
    const existingPromotion = await Promotion.findById(req.params.id);
    if (!existingPromotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    const payload = buildPromotionPayload(req.body, existingPromotion.toObject());
    const validationMessage = validatePromotionPayload(payload);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const promo = await Promotion.findByIdAndUpdate(
      req.params.id,
      {
        ...payload,
        ...(req.file ? { imageUrl: `/uploads/promotions/${req.file.filename}` } : {}),
        updatedByUserId: req.user._id,
      },
      { new: true },
    );

    return res.json(serializePromotion(promo));
  } catch (err) {
    return res.status(400).json({ message: 'Failed to update promotion: ' + err.message });
  }
});

module.exports = router;
