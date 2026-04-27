const { query } = require('../../config/db');
const { success } = require('../../helpers/response');

const DEFAULT_PAGE_SIZE = 20;
const DATE_LITERAL = /^\d{4}-\d{2}-\d{2}$/;

const list = async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)     || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || DEFAULT_PAGE_SIZE);
    const search   = req.query.search ? `%${req.query.search}%` : null;
    const status   = (req.query.status || '').toLowerCase();
    const inputDate = req.query.inputDate ? String(req.query.inputDate) : '';
    const offset   = (page - 1) * pageSize;

    if (inputDate && !DATE_LITERAL.test(inputDate)) {
      const err = new Error('inputDate must be in YYYY-MM-DD format');
      err.statusCode = 422;
      return next(err);
    }

    const whereClauses = ['t.totalRedeem > 0', 't.presence = 1'];
    const params = [];

    if (search) {
      whereClauses.push('(t.redeemCode LIKE ? OR t.bill LIKE ? OR m.name LIKE ? OR mc.name LIKE ?)');
      params.push(search, search, search, search);
    }

    if (status === 'failed') {
      whereClauses.push('1 = 0');
    }

    if (inputDate) {
      whereClauses.push('DATE(t.inputDate) = ?');
      params.push(inputDate);
    }

    const where = whereClauses.join(' AND ');

    const countRows = await query(
      `SELECT COUNT(*) AS total
       FROM transaction t
       LEFT JOIN members m  ON CAST(t.memberId AS UNSIGNED) = m.id
       LEFT JOIN merchant mc ON t.merchantId = mc.id
       WHERE ${where}`,
      params
    );
    const total = countRows[0].total;

    const rows = await query(
      `SELECT t.id, t.bill, t.totalRedeem AS amount, t.redeemCode,
              t.approvalCode, t.billDate, t.inputDate, t.syncType, t.note,
              CAST(t.memberId AS UNSIGNED) AS memberId,
              COALESCE(m.name,  '-') AS memberName,
              COALESCE(m.email, '-') AS memberEmail,
              COALESCE(m.phone, '-') AS memberPhone,
              t.merchantId,
              COALESCE(mc.name, '-') AS merchantName
       FROM transaction t
       LEFT JOIN members m  ON CAST(t.memberId AS UNSIGNED) = m.id
       LEFT JOIN merchant mc ON t.merchantId = mc.id
       WHERE ${where}
       ORDER BY t.id DESC
       LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      params
    );

    return success(res, { total, page, pageSize, rows }, 'Redemptions fetched');
  } catch (err) {
    return next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const rows = await query(
      `SELECT t.id, t.bill, t.totalRedeem AS amount, t.redeemCode,
              t.approvalCode, t.billDate, t.inputDate, t.syncType, t.note,
              CAST(t.memberId AS UNSIGNED) AS memberId,
              COALESCE(m.name,  '-') AS memberName,
              COALESCE(m.email, '-') AS memberEmail,
              COALESCE(m.phone, '-') AS memberPhone,
              t.merchantId,
              COALESCE(mc.name, '-') AS merchantName,
              COALESCE(mc2.redeemCode, '') AS codeRedeemCode,
              COALESCE(mc2.expDateTime, '') AS codeExpDateTime,
              COALESCE(mc2.presence, 1) AS codePresence
       FROM transaction t
       LEFT JOIN members  m   ON CAST(t.memberId AS UNSIGNED) = m.id
       LEFT JOIN merchant mc  ON t.merchantId = mc.id
       LEFT JOIN members_code mc2 ON t.redeemCode = mc2.redeemCode
       WHERE t.id = ? AND t.presence = 1
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      const err = new Error('Redemption not found');
      err.statusCode = 404;
      return next(err);
    }

    return success(res, rows[0], 'Redemption detail fetched');
  } catch (err) {
    return next(err);
  }
};

module.exports = { list, detail };
