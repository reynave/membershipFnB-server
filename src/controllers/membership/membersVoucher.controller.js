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
              COALESCE(v.pointsRequired, 0) AS pointsRequired, COALESCE(v.pointsAmount, 0) AS pointsAmount
       FROM members_voucher mv
       LEFT JOIN voucher v ON v.id = mv.voucherId
       WHERE mv.memberId = ? AND mv.presence = 1 AND mv.used = 0
       ORDER BY mv.id DESC`,
      [memberId]
    );

    return success(res, { rows }, 'Member vouchers fetched');
  } catch (err) {
    return next(err);
  }
};

module.exports = { listMy };
