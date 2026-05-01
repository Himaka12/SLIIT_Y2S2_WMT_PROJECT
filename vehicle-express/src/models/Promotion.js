const mongoose = require('mongoose');

const promotionScopeSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['all', 'vehicle', 'brand', 'model', 'category'],
    default: 'all',
  },
  vehicleIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  }],
  brands: [{ type: String }],
  models: [{ type: String }],
  categories: [{ type: String }],
}, { _id: false });

const promotionCustomerViewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  viewedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const promotionSchema = new mongoose.Schema({
  title:                  { type: String, required: true, trim: true },
  description:            { type: String, maxlength: 1000 },
  promotionType:          { type: String, default: 'Seasonal', trim: true },
  discountType:           { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
  discountPercentage:     { type: Number },
  discountAmount:         { type: Number },
  imageUrl:               { type: String },
  startDate:              { type: String },
  endDate:                { type: String },
  status:                 { type: String, default: 'Active', enum: ['Active', 'Inactive', 'Expired', 'Disabled'] },
  appliesToAllVehicles:   { type: Boolean, default: false },
  targetScope:            { type: promotionScopeSchema, default: () => ({ kind: 'all' }) },
  targetVehicleIds:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }],
  targetBrand:            { type: String },
  targetModel:            { type: String },
  targetListingType:      { type: String },
  targetFuelType:         { type: String },
  targetVehicleCondition: { type: String },
  targetCategory:         { type: String },
  priority:               { type: Number, default: 0 },
  showOnInventoryBanner:  { type: Boolean, default: true },
  showOnVehicleCard:      { type: Boolean, default: true },
  showOnVehicleDetails:   { type: Boolean, default: true },
  highlightLabel:         { type: String },
  createdByUserId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByUserId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminViewedAt:          { type: Date, default: null },
  customerViewedBy:       { type: [promotionCustomerViewSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Promotion', promotionSchema);
