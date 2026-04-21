const { query } = require('../../config/db');
const { success } = require('../../helpers/response');

const DEFAULT_PAGE_SIZE = 20;

const list = async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)     || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || DEFAULT_PAGE_SIZE);
    const type     = req.query.type; // 'point_in' | 'redeem' | undefined
    const offset   = (page - 1) * pageSize;

    let whereClauses = ['p.presence = 1'];
    const params = [];

    if (type === 'point_in') {
      whereClauses.push('p.pointIn > 0');
    } else if (type === 'redeem') {
      whereClauses.push('p.pointOut > 0');
    }

    const where = whereClauses.join(' AND ');

    const countRows = await query(
      `SELECT COUNT(*) AS total FROM points p WHERE ${where}`,
      params
    );
    const total = countRows[0].total;

    const rows = await query(
      `SELECT p.id, p.transactionId, p.memberId, p.merchantId, p.tierId,
              p.pointIn, p.pointOut, p.transactionDate, p.note, p.archived,
              COALESCE(t.bill, '')        AS bill,
              COALESCE(t.totalAmount, 0) AS totalAmount,
              COALESCE(m.name,  '-')     AS memberName,
              COALESCE(mc.name, '-')     AS merchantName,
              COALESCE(tr.name, '')      AS tierName
       FROM points p
       LEFT JOIN transaction t  ON p.transactionId = t.id
       LEFT JOIN members     m  ON p.memberId      = m.id
       LEFT JOIN merchant    mc ON p.merchantId    = mc.id
       LEFT JOIN tier        tr ON p.tierId        = tr.id
       WHERE ${where}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return success(res, { total, page, pageSize, rows }, 'Transactions fetched');
  } catch (err) {
    return next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const rows = await query(
      `SELECT p.id, p.transactionId, p.memberId, p.merchantId, p.tierId,
              p.pointIn, p.pointOut, p.transactionDate, p.note, p.archived,
              COALESCE(t.bill, '')        AS bill,
              COALESCE(t.totalAmount, 0) AS totalAmount,
              COALESCE(t.syncType, '')   AS syncType,
              COALESCE(t.note, '')       AS transactionNote,
              COALESCE(m.name,  '-')     AS memberName,
              COALESCE(m.email, '-')     AS memberEmail,
              COALESCE(mc.name, '-')     AS merchantName,
              COALESCE(tr.name, '')      AS tierName
       FROM points p
       LEFT JOIN transaction t  ON p.transactionId = t.id
       LEFT JOIN members     m  ON p.memberId      = m.id
       LEFT JOIN merchant    mc ON p.merchantId    = mc.id
       LEFT JOIN tier        tr ON p.tierId        = tr.id
       WHERE p.id = ? AND p.presence = 1
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      const err = new Error('Transaction not found');
      err.statusCode = 404;
      return next(err);
    }

    return success(res, rows[0], 'Transaction detail fetched');
  } catch (err) {
    return next(err);
  }
};

module.exports = { list, detail };
