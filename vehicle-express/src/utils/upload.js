const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const makeStorage = (dest) => multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WEBP allowed.`), false);
  }
};

const uploadSlip = multer({
  storage: makeStorage('uploads/slips'),
  limits: { fileSize: MAX_SIZE },
  fileFilter,
});

const uploadVehicleImages = multer({
  storage: makeStorage('uploads/vehicles'),
  limits: { fileSize: MAX_SIZE, files: 5 },
  fileFilter,
});

const uploadPromoImage = multer({
  storage: makeStorage('uploads/promotions'),
  limits: { fileSize: MAX_SIZE },
  fileFilter,
});

const uploadProfileImage = multer({
  storage: makeStorage('uploads/profile-images'),
  limits: { fileSize: MAX_SIZE },
  fileFilter,
});

const uploadReviewImages = multer({
  storage: makeStorage('uploads/reviews'),
  limits: { fileSize: MAX_SIZE, files: 5 },
  fileFilter,
});

module.exports = {
  uploadSlip,
  uploadVehicleImages,
  uploadPromoImage,
  uploadProfileImage,
  uploadReviewImages,
};
