const { fail, success } = require('../../helpers/response');
const pointService = require('../../modules/membership/point.service');
const redeemService = require('../../modules/membership/redeem.service');
const { query, getPool } = require('../../config/db');

const mysqlDateTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const isValidDateTime = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  return mysqlDateTimePattern.test(trimmedValue) || !Number.isNaN(new Date(trimmedValue).getTime());
};

const buildMemberIdentifier = (source = {}) => ({
  id: source.id,
  phone: source.phone,
  email: source.email
});

const validateMemberIdentifier = (source = {}, location = 'query') => {
  const errors = [];
  const identifier = buildMemberIdentifier(source);
  const filled = ['id', 'phone', 'email'].filter((field) => String(identifier[field] || '').trim());

  if (filled.length === 0) {
    errors.push({ field: location, message: `Provide one identifier in ${location}: id, phone, or email` });
  }

  if (filled.length > 1) {
    errors.push({ field: location, message: 'Use only one identifier: id, phone, or email' });
  }

  return errors;
};

const validateMemberIdentifierQuery = (query = {}) => validateMemberIdentifier(query, 'query');
const validateMemberIdentifierBody = (body = {}) => validateMemberIdentifier(body, 'body');

const validatePointInRequest = (req) => {
  const errors = validateMemberIdentifierBody(req.body || {});
  const { bill, totalAmount, billDate, note } = req.body || {};

  if (typeof bill !== 'string' || !bill.trim()) {
    errors.push({ field: 'bill', message: 'bill is required' });
  } else if (bill.trim().length > 50) {
    errors.push({ field: 'bill', message: 'bill must be 50 characters or less' });
  }

  if (!Number.isFinite(Number(totalAmount)) || Number(totalAmount) <= 0) {
    errors.push({ field: 'totalAmount', message: 'totalAmount must be a number greater than 0' });
  }

  if (!isValidDateTime(billDate)) {
    errors.push({ field: 'billDate', message: 'billDate must be a valid datetime' });
  }

  if (note !== undefined && note !== null && typeof note !== 'string') {
    errors.push({ field: 'note', message: 'note must be a string' });
  } else if (typeof note === 'string' && note.length > 250) {
    errors.push({ field: 'note', message: 'note must be 250 characters or less' });
  }

  return errors;
};

const validateRedeemPointRequest = (req) => {
  const errors = validateMemberIdentifierBody(req.body || {});
  const { amount, transactionId, phone } = req.body || {};

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    errors.push({ field: 'amount', message: 'amount must be a number greater than 0' });
  }

  if (typeof transactionId !== 'string' || !transactionId.trim()) {
    errors.push({ field: 'transactionId', message: 'transactionId is required' });
  } else if (transactionId.trim().length > 50) {
    errors.push({ field: 'transactionId', message: 'transactionId must be 50 characters or less' });
  }

  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    errors.push({ field: 'phone', message: 'phone must be a string' });
  } else if (typeof phone === 'string' && phone.trim().length > 50) {
    errors.push({ field: 'phone', message: 'phone must be 50 characters or less' });
  }

  return errors;
};

const resolvePosUserId = (req) => {
  const fromJwt = String(req.posUser?.id || '').trim();
  const fromHeader = String(req.headers['x-pos-user-id'] || '').trim();
  const fromBody = String(req.body?.userId || '').trim();

  return fromJwt || fromHeader || fromBody || '1';
};

const resolvePosMerchantId = (req) => {
  const merchantId = Number(req.posUser?.merchantId || 0);
  return Number.isInteger(merchantId) && merchantId > 0 ? merchantId : 0;
};

const getBalance = async (req, res, next) => {
  try {
    const queryErrors = validateMemberIdentifierQuery(req.query || {});

    if (queryErrors.length > 0) {
      return fail(res, 'Validation failed', 422, queryErrors);
    }

    const member = await pointService.findMemberByIdentifier(buildMemberIdentifier(req.query));
    const result = await pointService.getTotalPoints(member.id);

    return success(
      res,
      {
        ...result,
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
          phone: member.phone
        }
      },
      'Total points fetched',
      200
    );
  } catch (error) {
    return next(error);
  }
};

const getHistoryToday = async (req, res, next) => {
  try {
    const queryErrors = validateMemberIdentifierQuery(req.query || {});

    if (queryErrors.length > 0) {
      return fail(res, 'Validation failed', 422, queryErrors);
    }

    const member = await pointService.findMemberByIdentifier(buildMemberIdentifier(req.query));
    const rows = await pointService.getPointHistoryToday(member.id);

    return success(
      res,
      {
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
          phone: member.phone
        },
        count: rows.length,
        rows
      },
      'Point history today fetched',
      200
    );
  } catch (error) {
    return next(error);
  }
};

const createPointIn = async (req, res, next) => {
  try {
    const errors = validatePointInRequest(req);

    if (errors.length > 0) {
      return fail(res, 'Validation failed', 422, errors);
    }

    const result = await pointService.createTransactionPointByPosUser({
      posUserId: resolvePosUserId(req),
      merchantId: resolvePosMerchantId(req),
      payload: req.body,
      memberIdentifier: buildMemberIdentifier(req.body),
      io: req.io
    });

    return success(res, result, 'Membership point transaction created', 201);
  } catch (error) {
    return next(error);
  }
};

const redeemPoint = async (req, res, next) => {
  try {
    const errors = validateRedeemPointRequest(req);

    if (errors.length > 0) {
      return fail(res, 'Validation failed', 422, errors);
    }

    const result = await redeemService.redeemPointByPosUser({
      posUserId: resolvePosUserId(req),
      merchantId: resolvePosMerchantId(req),
      payload: {
        ...req.body,
        memberIdentifier: buildMemberIdentifier(req.body)
      },
      io: req.io
    });

    return success(res, result, 'Point redeemed successfully', 200);
  } catch (error) {
    return next(error);
  }
};

const redeemVoucher = async (req, res, next) => {
  try {
    const barcode = String(req.body?.barcode || '').trim();

    if (!barcode) {
      return fail(res, 'barcode is required', 422);
    }

    const merchantId = resolvePosMerchantId(req) || 0;
    const pool = await getPool();
    const conn = await pool.getConnection();

    try {
      const [rows] = await conn.execute(
        `SELECT mv.id, mv.voucherId, mv.memberId, mv.barcode, mv.used
         FROM members_voucher mv
         WHERE mv.barcode = ? AND mv.presence = 1
         LIMIT 1`,
        [barcode]
      );

      const voucher = rows[0];

      if (!voucher) {
        return fail(res, 'Voucher not found', 404);
      }

      if (Number(voucher.used) && Number(voucher.used) !== 0) {
        return fail(res, 'Voucher already used', 409);
      }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await conn.beginTransaction();

      await conn.execute(
        `UPDATE members_voucher
         SET used = 1, usedDate = ?, updateDate = ?, usedMarchantId = ?
         WHERE id = ?`,
        [now, now, merchantId, voucher.id]
      );

      await conn.commit();

      return success(
        res,
        {
          id: voucher.id,
          voucherId: voucher.voucherId,
          memberId: voucher.memberId,
          barcode: voucher.barcode,
          usedDate: now,
          usedMarchantId: merchantId
        },
        'Voucher redeemed successfully',
        200
      );
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getBalance,
  getHistoryToday,
  createPointIn,
  redeemPoint,
  redeemVoucher
};


