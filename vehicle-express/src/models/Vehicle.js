const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  listingType:       { type: String, required: true },   // Rent, Sale
  vehicleCondition:  { type: String, required: true },   // New, Used
  brand:             { type: String, required: true },
  model:             { type: String, required: true },
  category:          { type: String },
  manufactureYear:   { type: Number, required: true },
  color:             { type: String, required: true },
  listedDate:        { type: String, required: true },
  quantity:          { type: Number, required: true, default: 1 },
  mileage:           { type: Number, required: true },
  seatCount:         { type: Number, required: true },
  engineCapacity:    { type: String, required: true },
  fuelType:          { type: String, required: true },
  transmission:      { type: String, required: true },
  description:       { type: String },
  price:             { type: Number, required: true },
  status:            { type: String, default: 'Available' },
  image1:            { type: String },
  image2:            { type: String },
  image3:            { type: String },
  image4:            { type: String },
  image5:            { type: String },
  isDeleted:         { type: Boolean, default: false },
  deletedAt:         { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
