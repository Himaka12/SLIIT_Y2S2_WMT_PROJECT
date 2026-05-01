const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { runDbOperation } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  ACCOUNT_DELETION_CANCELLED_STATUS,
  anonymizeCustomerAccount,
  buildAccountDeletionAssessment,
  getUserCascadeSummary,
  hardDeleteCustomerAccount,
} = require('../utils/accountDeletion');
const ACTIVE_USER_FILTER = { isDeleted: { $ne: true } };
const ADMIN_VISIBLE_USER_FILTER = {
  $or: [
    { isDeleted: { $ne: true } },
    { role: 'CUSTOMER', isDeleted: true },
  ],
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, contactNumber } = req.body;
    if (!fullName || !email || !password)
      return res.status(400).json({ message: 'fullName, email and password are required' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await runDbOperation(
      () => User.findOne({ email: normalizedEmail, ...ACTIVE_USER_FILTER }).exec(),
      { errorMessage: 'Registration is temporarily unavailable because the database is not responding.' },
    );
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    await runDbOperation(
      () => User.create({ fullName, email: normalizedEmail, password: hashed, contactNumber, role: 'CUSTOMER' }),
      { errorMessage: 'Registration is temporarily unavailable because the database is not responding.' },
    );
    return res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await runDbOperation(
      () => User.findOne({ email: normalizedEmail }).exec(),
      { errorMessage: 'Login is temporarily unavailable because the database is not responding.' },
    );
    if (!user || !user.isActive || user.isDeleted)
      return res.status(401).json({ message: 'Invalid credentials or inactive account' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user);
    return res.json({
      token,
      userId: user._id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      isPremium: user.isPremium,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
});

router.post('/verify-admin-password', authenticate, requireAdmin, async (req, res) => {
  try {
    const { password } = req.body || {};

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const admin = await User.findById(req.user._id);
    if (!admin || admin.role !== 'ADMIN' || admin.isDeleted || !admin.isActive) {
      return res.status(404).json({ message: 'Admin account not found' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Admin password is incorrect' });
    }

    return res.json({ message: 'Password verified successfully' });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// POST /api/auth/add-subadmin  (Admin only)
router.post('/add-subadmin', authenticate, requireAdmin, async (req, res) => {
  try {
    const { fullName, email, password, contactNumber } = req.body;
    if (!fullName || !email || !password)
      return res.status(400).json({ message: 'fullName, email and password are required' });

    const existing = await User.findOne({ email: email.toLowerCase(), ...ACTIVE_USER_FILTER });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ fullName, email: email.toLowerCase(), password: hashed, contactNumber, role: 'MARKETING_MANAGER' });
    return res.status(201).json({ message: 'Sub-Admin created successfully' });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// GET /api/auth/subadmins
router.get('/subadmins', authenticate, requireAdmin, async (req, res) => {
  const subs = await User.find({ role: 'MARKETING_MANAGER', ...ACTIVE_USER_FILTER }).select('-password');
  return res.json(subs);
});

// DELETE /api/auth/delete-subadmin/:id
router.delete('/delete-subadmin/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'MARKETING_MANAGER', ...ACTIVE_USER_FILTER });
    if (!user)
      return res.status(400).json({ message: 'Sub-Admin not found' });
    await user.deleteOne();
    return res.json({ message: 'Sub-Admin deleted successfully!' });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// GET /api/auth/users
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  const users = await User.find(ADMIN_VISIBLE_USER_FILTER).select('-password -securityAnswer');
  return res.json(users);
});

// DELETE /api/auth/delete-user/:id
router.get('/delete-user-preview/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'CUSTOMER' });
    if (!user) return res.status(400).json({ message: 'User not found' });
    if (user.isDeleted || !user.isActive) {
      return res.json({
        userId: user._id,
        allowed: false,
        alreadyDeleted: true,
        message: 'This customer account is already deleted and anonymized.',
        counts: { bookings: 0, refunds: 0, reviews: 0, inquiries: 0 },
      });
    }

    const counts = await getUserCascadeSummary(user);
    const assessment = await buildAccountDeletionAssessment(user);
    return res.json({
      userId: user._id,
      ...assessment,
      pendingAction: assessment.counts.pendingBookings > 0
        ? `${assessment.counts.pendingBookings} pending booking${assessment.counts.pendingBookings === 1 ? '' : 's'} will be marked as ${ACCOUNT_DELETION_CANCELLED_STATUS}.`
        : null,
      counts: {
        ...assessment.counts,
        bookings: counts.bookings,
        refunds: counts.refunds,
        reviews: counts.reviews,
        inquiries: counts.inquiries,
        payments: counts.payments,
      },
      preservedRecords: {
        bookings: true,
        payments: true,
        refunds: true,
        reviews: true,
        inquiries: true,
      },
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

router.delete('/delete-user/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'CUSTOMER' });
    if (!user) return res.status(400).json({ message: 'User not found' });
    if (user.isDeleted || !user.isActive) {
      return res.status(400).json({ message: 'This customer account is already deleted.' });
    }

    const assessment = await buildAccountDeletionAssessment(user);
    const { counts } = await anonymizeCustomerAccount(user, { assessment });

    return res.json({
      message: 'User deleted successfully. Access was disabled, personal details were anonymized, and related records were preserved.',
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
    return res.status(err.status || 400).json({ message: err.message, assessment: err.assessment });
  }
});

router.delete('/hard-delete-user/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'CUSTOMER' });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const counts = await getUserCascadeSummary(user);
    await hardDeleteCustomerAccount(user, counts);

    return res.json({
      message: 'Customer account and linked records were permanently deleted.',
      deleted: {
        bookings: counts.bookings,
        refunds: counts.refunds,
        reviews: counts.reviews,
        inquiries: counts.inquiries,
        wishlist: counts.wishlist,
        payments: counts.payments,
      },
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// PUT /api/auth/update-subadmin/:id
router.put('/update-subadmin/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { fullName, email, contactNumber, password, isActive } = req.body;
    const user = await User.findOne({ _id: req.params.id, role: 'MARKETING_MANAGER', ...ACTIVE_USER_FILTER });
    if (!user)
      return res.status(400).json({ message: 'Sub-Admin not found' });

    if (fullName) user.fullName = fullName;
    if (email) {
      const normalizedEmail = email.toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id }, ...ACTIVE_USER_FILTER });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = normalizedEmail;
    }
    if (contactNumber !== undefined) user.contactNumber = contactNumber;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    await user.save();
    return res.json({ message: 'Sub-Admin updated successfully.' });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;
