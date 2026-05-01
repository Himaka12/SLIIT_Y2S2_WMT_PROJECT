const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    const rawEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const rawPassword = String(process.env.ADMIN_PASSWORD || '').trim();

    if (!rawEmail || !rawPassword) {
      console.warn('Admin seeding skipped: ADMIN_EMAIL and ADMIN_PASSWORD must be set explicitly.');
      return;
    }

    const email = rawEmail;
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Admin account already exists, skipping seed.');
      return;
    }

    const password = await bcrypt.hash(rawPassword, 10);
    await User.create({
      fullName:      process.env.ADMIN_FULL_NAME || 'Admin User',
      email,
      password,
      role:          'ADMIN',
      contactNumber: process.env.ADMIN_CONTACT_NUMBER || '0700000000',
      isActive:      true,
    });
    console.log(`Admin account seeded: ${email}`);
  } catch (err) {
    console.error('Admin seeding failed:', err.message);
  }
};

module.exports = seedAdmin;
