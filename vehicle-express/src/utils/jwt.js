const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: Math.floor(parseInt(process.env.JWT_EXPIRATION_MS || '86400000') / 1000) + 's' }
  );
};

module.exports = { generateToken };
