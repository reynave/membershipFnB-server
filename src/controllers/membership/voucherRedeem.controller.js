const { query, getPool } = require('../../config/db');
const { success, fail } = require('../../helpers/response');

const toId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const generateBarcode = (memberId, voucherId) => {
  return `V-${voucherId}-M-${memberId}-${Date.now().toString(36)}`;
};

const redeem = async (req, res, next) => {
  try {
    const voucherId = toId(req.body?.voucherId || req.params?.voucherId);
    const memberId = req.user?.id || toId(req.body?.memberId);

    if (!voucherId) {
      return fail(res, 'Invalid voucher id', 422);
    }

    if (!memberId) {
      return fail(res, 'Member not authenticated', 401);
    }

    // Fetch voucher
    const rows = await query(
      `SELECT id, name, img, description, pointsRequired, pointsAmount, endDate
       FROM voucher
       WHERE id = ? AND presence = 1
       LIMIT 1`,
      [voucherId]
    );

    const voucher = rows[0];

    if (!voucher) {
      return fail(res, 'Voucher not found', 404);
    }

    const barcode = generateBarcode(memberId, voucherId);
    const amount = Number(voucher.pointsAmount || 0);

    // expiredDate: use voucher.endDate if present, else one year from now
    let expiredDate = voucher.endDate || null;
    if (!expiredDate) {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      expiredDate = d.toISOString().slice(0, 10);
    }

    const pool = await getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const result = await conn.execute(
        `INSERT INTO members_voucher (voucherId, memberId, barcode, amount, expiredDate, used, presence)
         VALUES (?, ?, ?, ?, ?, 0, 1)`,
        [voucherId, memberId, barcode, amount, expiredDate]
      );

      await conn.commit();

      const insertId = Number(result[0]?.insertId || 0);

      return success(res, { id: insertId, voucherId, memberId, barcode }, 'Voucher redeemed (reserved)');
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

module.exports = { redeem };
