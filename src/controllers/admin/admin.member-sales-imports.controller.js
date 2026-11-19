const path = require('path');
const multer = require('multer');
const { success, fail } = require('../../helpers/response');
const { MemberSalesParseError } = require('../../modules/import/member-sales.parser');
const service = require('../../modules/import/member-sales.service');

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.csv', '.txt']);
const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
  'application/octet-stream'
]);

const fileFilter = (_req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const error = new Error('Only .csv or .txt report files are allowed');
    error.statusCode = 422;
    return cb(error);
  }

  return cb(null, true);
};

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES }
}).single('file');

const parseBatchId = (req) => {
  const batchId = Number.parseInt(req.params.batchId, 10);

  if (!Number.isInteger(batchId) || batchId <= 0) {
    const error = new Error('batchId must be a positive integer');
    error.statusCode = 422;
    throw error;
  }

  return batchId;
};

const isTruthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const handleError = (res, next, error) => {
  if (error instanceof MemberSalesParseError) {
    return fail(res, error.message, error.statusCode || 422, error.details);
  }

  if (error.statusCode && error.details) {
    return fail(res, error.message, error.statusCode, error.details);
  }

  return next(error);
};

const upload = (req, res, next) => {
  uploadMiddleware(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError instanceof multer.MulterError) {
        const error = new Error(
          uploadError.code === 'LIMIT_FILE_SIZE'
            ? 'Report file must not exceed 20MB'
            : `Upload failed: ${uploadError.message}`
        );
        error.statusCode = 422;
        return handleError(res, next, error);
      }

      return handleError(res, next, uploadError);
    }

    if (!req.file) {
      const error = new Error('Report file is required (multipart field name: file)');
      error.statusCode = 422;
      return handleError(res, next, error);
    }

    const override = isTruthy(req.query.override) || isTruthy(req.body && req.body.override);

    try {
      const batch = await service.createPreview({
        buffer: req.file.buffer,
        fileName: req.file.originalname,
        actor: req.user ? req.user.email || req.user.name : null,
        override
      });

      const message =
        batch.errorCount > 0
          ? `Report stored as preview with ${batch.errorCount} error(s)`
          : 'Report stored as preview';

      return success(res, batch, message, 201);
    } catch (error) {
      return handleError(res, next, error);
    }
  });
};

const list = async (req, res, next) => {
  try {
    const result = await service.listBatches({
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
      search: req.query.search
    });

    return success(res, result, 'Import batches');
  } catch (error) {
    return handleError(res, next, error);
  }
};

const detail = async (req, res, next) => {
  try {
    const batch = await service.getBatch(parseBatchId(req));
    return success(res, batch, 'Import batch detail');
  } catch (error) {
    return handleError(res, next, error);
  }
};

const lines = async (req, res, next) => {
  try {
    const result = await service.getBatchLines(parseBatchId(req), {
      page: req.query.page,
      pageSize: req.query.pageSize,
      severity: req.query.severity,
      memberId: req.query.memberId,
      checkNo: req.query.checkNo,
      search: req.query.search
    });

    return success(res, result, 'Import batch lines');
  } catch (error) {
    return handleError(res, next, error);
  }
};

const members = async (req, res, next) => {
  try {
    const result = await service.getBatchMembers(parseBatchId(req), {
      page: req.query.page,
      pageSize: req.query.pageSize,
      severity: req.query.severity,
      search: req.query.search
    });

    return success(res, result, 'Import batch members');
  } catch (error) {
    return handleError(res, next, error);
  }
};

const commit = async (req, res, next) => {
  try {
    const result = await service.commitBatch(parseBatchId(req), {
      actor: req.user ? req.user.email || req.user.name : null,
      amountBasis: req.body && req.body.amountBasis,
      billDate: req.body && req.body.billDate,
      merchantId: req.body && req.body.merchantId
    });

    return success(res, result, 'Import batch committed');
  } catch (error) {
    return handleError(res, next, error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await service.deleteBatch(parseBatchId(req));
    return success(res, result, 'Import batch deleted');
  } catch (error) {
    return handleError(res, next, error);
  }
};

module.exports = {
  upload,
  list,
  detail,
  lines,
  members,
  commit,
  remove
};
