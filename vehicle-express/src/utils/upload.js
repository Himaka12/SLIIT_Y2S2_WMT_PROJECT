const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const CLOUDINARY_ROOT_FOLDER = process.env.CLOUDINARY_ROOT_FOLDER || 'sliit-wmt';
const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME
  && process.env.CLOUDINARY_API_KEY
  && process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
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
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: `${CLOUDINARY_ROOT_FOLDER}/${folder}`,
        public_id: publicId,
        resource_type: 'image',
        overwrite: false,
      },
      (error, result) => {
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
      },
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
