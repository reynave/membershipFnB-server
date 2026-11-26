const { query } = require('../../config/db');
const { success } = require('../../helpers/response');

const DEFAULT_PAGE_SIZE = 20;
const DATE_LITERAL = /^\d{4}-\d{2}-\d{2}$/;

/** Shared FROM/JOIN block: points is the ledger, the joins only feed labels/filters. */
const FROM_POINTS = `
  FROM points p
  LEFT JOIN transaction t  ON p.transactionId = t.id
  LEFT JOIN members     m  ON p.memberId      = m.id
  LEFT JOIN merchant    mc ON p.merchantId    = mc.id
  LEFT JOIN tier        tr ON p.tierId        = tr.id`;

const buildFilter = (req) => {
  const search        = req.query.search ? `%${req.query.search}%` : null;
  const type          = req.query.type;     // 'point_in' | 'point_out' | ''
  const archived      = req.query.archived; // '0' | '1' | ''
  const inputDateFrom = req.query.inputDateFrom ? String(req.query.inputDateFrom) : '';
  const inputDateTo   = req.query.inputDateTo   ? String(req.query.inputDateTo)   : '';

  if (inputDateFrom && !DATE_LITERAL.test(inputDateFrom)) {
    const err = new Error('inputDateFrom must be in YYYY-MM-DD format');
    err.statusCode = 422;
    throw err;
  }

  if (inputDateTo && !DATE_LITERAL.test(inputDateTo)) {
    const err = new Error('inputDateTo must be in YYYY-MM-DD format');
    err.statusCode = 422;
    throw err;
  }

  const whereClauses = ['p.presence = 1'];
  const params = [];

  if (type === 'point_in') {
    whereClauses.push('p.pointIn > 0');
  } else if (type === 'point_out') {
    whereClauses.push('p.pointOut > 0');
  }

  if (archived === '0' || archived === '1') {
    whereClauses.push('p.archived = ?');
    params.push(Number(archived));
  }

  if (search) {
    whereClauses.push('(t.bill LIKE ? OR p.note LIKE ? OR m.name LIKE ? OR mc.name LIKE ?)');
    params.push(search, search, search, search);
  }

  if (inputDateFrom) {
    whereClauses.push('DATE(p.transactionDate) >= ?');
    params.push(inputDateFrom);
  }

  if (inputDateTo) {
    whereClauses.push('DATE(p.transactionDate) <= ?');
    params.push(inputDateTo);
  }

  return { where: whereClauses.join(' AND '), params };
};

const list = async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || DEFAULT_PAGE_SIZE);
    const offset   = (page - 1) * pageSize;
    const { where, params } = buildFilter(req);

    const countRows = await query(
      `SELECT COUNT(*) AS total ${FROM_POINTS} WHERE ${where}`,
      params
    );
    const total = countRows[0].total;

    const summaryRows = await query(
      `SELECT COALESCE(SUM(p.pointIn), 0)  AS totalPointIn,
              COALESCE(SUM(p.pointOut), 0) AS totalPointOut
       ${FROM_POINTS}
       WHERE ${where}`,
      params
    );

    const rows = await query(
      `SELECT p.id, p.transactionId, p.memberId, p.merchantId, p.tierId,
              p.pointIn, p.pointOut, p.transactionDate, p.note, p.archived,
              p.status, p.presence, p.inputDate, p.updateDate,
              COALESCE(t.bill, '')        AS bill,
              COALESCE(t.totalAmount, 0)  AS totalAmount,
              COALESCE(m.name, '-')       AS memberName,
              COALESCE(mc.name, '-')      AS merchantName,
              COALESCE(tr.name, '')       AS tierName
       ${FROM_POINTS}
       WHERE ${where}
       ORDER BY p.id DESC
       LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      params
    );

    const summary = summaryRows[0] || { totalPointIn: 0, totalPointOut: 0 };
    summary.balance = Number(summary.totalPointIn) - Number(summary.totalPointOut);

    return success(res, { total, page, pageSize, summary, rows }, 'Points fetched');
  } catch (err) {
    return next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error('Invalid point id');
      err.statusCode = 422;
      return next(err);
    }

    const rows = await query(
      `SELECT p.id, p.transactionId, p.memberId, p.merchantId, p.tierId,
              p.pointIn, p.pointOut, p.transactionDate, p.note, p.archived,
              p.status, p.presence, p.inputDate, p.updateDate,
              COALESCE(t.bill, '')        AS bill,
              COALESCE(t.totalAmount, 0)  AS totalAmount,
              COALESCE(t.totalRedeem, 0)  AS totalRedeem,
              COALESCE(t.billDate, '')    AS billDate,
              COALESCE(t.syncType, '')    AS syncType,
              COALESCE(t.note, '')        AS transactionNote,
              COALESCE(m.name, '-')       AS memberName,
              COALESCE(m.email, '-')      AS memberEmail,
              COALESCE(m.phone, '-')      AS memberPhone,
              COALESCE(mc.name, '-')      AS merchantName,
              COALESCE(tr.name, '')       AS tierName
       ${FROM_POINTS}
       WHERE p.id = ? AND p.presence = 1
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      const err = new Error('Point not found');
      err.statusCode = 404;
      return next(err);
    }

    return success(res, rows[0], 'Point detail fetched');
  } catch (err) {
    return next(err);
  }
};

module.exports = { list, detail };
