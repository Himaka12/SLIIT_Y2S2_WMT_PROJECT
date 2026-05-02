const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_CLOUDINARY_CLOUD_NAME = 'du2ms5uzh';
const CLOUDINARY_ROOT_FOLDER = process.env.CLOUDINARY_ROOT_FOLDER || 'sliit-wmt';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUDINARY_CLOUD_NAME;
const UNSIGNED_UPLOAD_PRESETS = {
  vehicles: process.env.CLOUDINARY_VEHICLES_UPLOAD_PRESET || 'sliit_wmt_vehicles_unsigned',
  'profile-images': process.env.CLOUDINARY_PROFILE_IMAGES_UPLOAD_PRESET || 'sliit_wmt_profile_images_unsigned',
  promotions: process.env.CLOUDINARY_PROMOTIONS_UPLOAD_PRESET || 'sliit_wmt_promotions_unsigned',
  reviews: process.env.CLOUDINARY_REVIEWS_UPLOAD_PRESET || 'sliit_wmt_reviews_unsigned',
  slips: process.env.CLOUDINARY_SLIPS_UPLOAD_PRESET || 'sliit_wmt_slips_unsigned',
};
const hasSignedCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME
  && process.env.CLOUDINARY_API_KEY
  && process.env.CLOUDINARY_API_SECRET
);
const hasCloudinaryConfig = Boolean(CLOUDINARY_CLOUD_NAME);

if (hasCloudinaryConfig) {
  const config = {
    cloud_name: CLOUDINARY_CLOUD_NAME,
    secure: true,
  };

  if (hasSignedCloudinaryConfig) {
    config.api_key = process.env.CLOUDINARY_API_KEY;
    config.api_secret = process.env.CLOUDINARY_API_SECRET;
  }

  cloudinary.config(config);
}

const sanitizeName = (value) => (
  path
    .parse(String(value || 'upload').replace(/\s+/g, '_'))
    .name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'upload'
);

const isRemoteUrl = (value) => /^https?:\/\//i.test(String(value || ''));

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

const makeCloudinaryStorage = (folder) => ({
  _handleFile: (req, file, cb) => {
    const publicId = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${sanitizeName(file.originalname)}`;
    const options = {
      public_id: publicId,
    };
    const onUploadComplete = (error, result) => {
      if (error) {
        return cb(error);
      }

      return cb(null, {
        filename: result.public_id,
        path: result.secure_url,
        location: result.secure_url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        size: result.bytes,
      });
    };
    const upload = hasSignedCloudinaryConfig
      ? cloudinary.uploader.upload_stream(
        {
          ...options,
          folder: `${CLOUDINARY_ROOT_FOLDER}/${folder}`,
          resource_type: 'image',
          overwrite: false,
        },
        onUploadComplete,
      )
      : cloudinary.uploader.unsigned_upload_stream(
        UNSIGNED_UPLOAD_PRESETS[folder],
        options,
        onUploadComplete,
      );

    file.stream.pipe(upload);
  },
  _removeFile: (req, file, cb) => {
    if (!file?.publicId) {
      cb(null);
      return;
    }

    cloudinary.uploader.destroy(file.publicId)
      .then(() => cb(null))
      .catch(cb);
  },
});

const makeUploadStorage = (folder) => (
  hasCloudinaryConfig
    ? makeCloudinaryStorage(folder)
    : makeStorage(`uploads/${folder}`)
);

const getUploadedFileUrl = (file, fallbackFolder = '') => {
  if (!file) {
    return null;
  }

  const remoteUrl = file.secureUrl || file.location || file.secure_url || file.url;
  if (isRemoteUrl(remoteUrl)) {
    return remoteUrl;
  }

  if (isRemoteUrl(file.path)) {
    return file.path;
  }

  if (file.filename) {
    return `/uploads/${fallbackFolder ? `${fallbackFolder}/` : ''}${file.filename}`.replace(/\/+/g, '/');
  }

  if (file.path) {
    const normalizedPath = String(file.path).replace(/\\/g, '/');
    return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  }

  return null;
};

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WEBP allowed.`), false);
  }
};

const uploadSlip = multer({
  storage: makeUploadStorage('slips'),
  limits: { fileSize: MAX_SIZE },
  fileFilter,
});

const uploadVehicleImages = multer({
  storage: makeUploadStorage('vehicles'),
  limits: { fileSize: MAX_SIZE, files: 5 },
  fileFilter,
});

const uploadPromoImage = multer({
  storage: makeUploadStorage('promotions'),
  limits: { fileSize: MAX_SIZE },
  fileFilter,
});

const uploadProfileImage = multer({
  storage: makeUploadStorage('profile-images'),
  limits: { fileSize: MAX_SIZE },
  fileFilter,
});

const uploadReviewImages = multer({
  storage: makeUploadStorage('reviews'),
  limits: { fileSize: MAX_SIZE, files: 5 },
  fileFilter,
});

module.exports = {
  getUploadedFileUrl,
  uploadSlip,
  uploadVehicleImages,
  uploadPromoImage,
  uploadProfileImage,
  uploadReviewImages,
};
