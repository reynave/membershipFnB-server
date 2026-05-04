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
    const requiredPoints = Number(voucher.pointsRequired || 0);

    if (!Number.isFinite(requiredPoints) || requiredPoints <= 0) {
      return fail(res, 'Voucher pointsRequired is invalid', 422);
    }

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
      const [memberRows] = await conn.execute(
        'SELECT id, tierId FROM members WHERE id = ? AND status = 1 LIMIT 1',
        [memberId]
      );

      const member = memberRows[0];

      if (!member) {
        return fail(res, 'Member not found or inactive', 404);
      }

      const [pointSummaryRows] = await conn.execute(
        `SELECT
           COALESCE(SUM(CASE WHEN archived = 0 AND presence = 1 THEN pointIn ELSE 0 END), 0) AS totalPointIn,
           COALESCE(SUM(CASE WHEN archived = 0 AND presence = 1 THEN pointOut ELSE 0 END), 0) AS totalPointOut
         FROM points
         WHERE memberId = ?`,
        [memberId]
      );

      const totalPointIn = Number(pointSummaryRows[0]?.totalPointIn || 0);
      const totalPointOut = Number(pointSummaryRows[0]?.totalPointOut || 0);
      const currentBalance = totalPointIn - totalPointOut;

      if (currentBalance < requiredPoints) {
        return fail(res, 'Insufficient point balance', 400, {
          balancePoint: currentBalance,
          pointsRequired: requiredPoints,
        });
      }

      await conn.beginTransaction();

      const result = await conn.execute(
        `INSERT INTO members_voucher (voucherId, memberId, barcode, amount, expiredDate, used, presence)
         VALUES (?, ?, ?, ?, ?, 0, 1)`,
        [voucherId, memberId, barcode, amount, expiredDate]
      );

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await conn.execute(
        `INSERT INTO points
           (transactionId, memberId, merchantId, tierId, pointIn, pointOut, transactionDate, note, archived, status, presence)
         VALUES
           (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          0,
          memberId,
          0,
          Number(member.tierId || 0),
          0,
          requiredPoints,
          now,
          `Voucher redeem - voucherId: ${voucherId}`,
          0,
          1,
          1,
        ]
      );

      await conn.commit();

      const insertId = Number(result[0]?.insertId || 0);

      return success(
        res,
        { id: insertId, voucherId, memberId, barcode, pointOut: requiredPoints },
        'Voucher redeemed (reserved)'
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

module.exports = { redeem };
