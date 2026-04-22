const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { success } = require('../../helpers/response');

const uploadDir = path.resolve(__dirname, '../../../public/upload');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeBaseName = path
      .basename(file.originalname || 'image', extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'image';

    cb(null, `${Date.now()}-${safeBaseName}${extension}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = new Set(['image/jpeg', 'image/png']);
  const extension = path.extname(file.originalname || '').toLowerCase();
  const allowedExtensions = new Set(['.jpg', '.jpeg', '.png']);

  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
    const err = new Error('Only jpg and png images are allowed');
    err.statusCode = 422;
    return cb(err);
  }

  return cb(null, true);
};

const uploadImageMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('image');

const uploadImage = (req, res, next) => {
  uploadImageMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        err.statusCode = 422;
        err.message = 'Image size must not exceed 5MB';
      }

      return next(err);
    }

    if (!req.file) {
      const error = new Error('Image file is required');
      error.statusCode = 422;
      return next(error);
    }

    const relativePath = `/public/upload/${req.file.filename}`;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    return success(res, {
      fileName: req.file.filename,
      path: relativePath,
      url: `${baseUrl}${relativePath}`
    }, 'Image uploaded', 201);
  });
};

module.exports = {
  uploadImage
};