const { query } = require('../../config/db');
const { success, fail } = require('../../helpers/response');

const listMy = async (req, res, next) => {
  try {
    const memberId = req.user?.id;

    if (!memberId) {
      return fail(res, 'Member not authenticated', 401);
    }

    const rows = await query(
      `SELECT mv.id, mv.voucherId, mv.memberId, mv.barcode, mv.amount, mv.expiredDate, mv.used, mv.usedDate, mv.inputDate, mv.updateDate,
              COALESCE(v.name, '-') AS voucherName, COALESCE(v.img, '') AS voucherImg, COALESCE(v.description, '') AS voucherDescription,
              COALESCE(v.pointsRequired, 0) AS pointsRequired, COALESCE(v.pointsAmount, 0) AS pointsAmount,
              mv.usedMarchantId, COALESCE(usedMerchant.name, '-') AS usedMerchantName
       FROM members_voucher mv
       LEFT JOIN voucher v ON v.id = mv.voucherId
       LEFT JOIN merchant usedMerchant ON mv.usedMarchantId = usedMerchant.id
       WHERE mv.memberId = ? AND mv.presence = 1 AND mv.used = 0
       ORDER BY mv.id DESC`,
      [memberId]
    );

    return success(res, { rows }, 'Member vouchers fetched');
  } catch (err) {
    return next(err);
  }
};

const listHistory = async (req, res, next) => {
  try {
    const memberId = req.user?.id;

    if (!memberId) {
      return fail(res, 'Member not authenticated', 401);
    }

    // used > 0 => used, used = -1 => expired/failed
    const rows = await query(
      `SELECT mv.id, mv.voucherId, mv.memberId, mv.barcode, mv.amount, mv.expiredDate, mv.used, mv.usedDate, mv.inputDate, mv.updateDate,
              COALESCE(v.name, '-') AS voucherName, COALESCE(v.img, '') AS voucherImg, COALESCE(v.description, '') AS voucherDescription,
              COALESCE(v.pointsRequired, 0) AS pointsRequired, COALESCE(v.pointsAmount, 0) AS pointsAmount,
              mv.usedMarchantId, COALESCE(usedMerchant.name, '-') AS usedMerchantName
       FROM members_voucher mv
       LEFT JOIN voucher v ON v.id = mv.voucherId
       LEFT JOIN merchant usedMerchant ON mv.usedMarchantId = usedMerchant.id
       WHERE mv.memberId = ? AND mv.presence = 1 AND mv.used <> 0
       ORDER BY mv.id DESC`,
      [memberId]
    );

    return success(res, { rows }, 'Member voucher history fetched');
  } catch (err) {
    return next(err);
  }
};

module.exports = { listMy, listHistory };

const getById = async (req, res, next) => {
  try {
    const memberId = req.user?.id;
    const id = Number(req.params?.id || 0);

    if (!memberId) return fail(res, 'Member not authenticated', 401);
    if (!id) return fail(res, 'Invalid id', 422);

    const rows = await query(
      `SELECT mv.id, mv.voucherId, mv.memberId, mv.barcode, mv.amount, mv.expiredDate, mv.used, mv.usedDate, mv.inputDate, mv.updateDate,
              COALESCE(v.name, '-') AS voucherName, COALESCE(v.img, '') AS voucherImg, COALESCE(v.description, '') AS voucherDescription,
              COALESCE(v.pointsRequired, 0) AS pointsRequired, COALESCE(v.pointsAmount, 0) AS pointsAmount,
              mv.usedMarchantId, COALESCE(usedMerchant.name, '-') AS usedMerchantName
       FROM members_voucher mv
       LEFT JOIN voucher v ON v.id = mv.voucherId
       LEFT JOIN merchant usedMerchant ON mv.usedMarchantId = usedMerchant.id
       WHERE mv.id = ? AND mv.memberId = ? AND mv.presence = 1
       LIMIT 1`,
      [id, memberId]
    );

    const row = rows[0] || null;

    if (!row) return fail(res, 'Member voucher not found', 404);

    return success(res, { voucher: row }, 'Member voucher fetched');
  } catch (err) {
    return next(err);
  }
};

module.exports = { listMy, listHistory, getById };

