const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  addedDate: { type: Date, default: Date.now },
});

wishlistSchema.index({ user: 1, vehicle: 1 }, { unique: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);
