const { query } = require('../../config/db');
const { success } = require('../../helpers/response');

const DEFAULT_PAGE_SIZE = 20;
const DATE_LITERAL = /^\d{4}-\d{2}-\d{2}$/;

// `transaction` is the main ledger table; point rows are aggregated per
// transaction so a transaction with several point entries (point in/out,
// re-calculation, ...) is still returned as one row.
const POINTS_SUM_JOIN = `
  LEFT JOIN (
    SELECT transactionId,
           SUM(pointIn)         AS pointIn,
           SUM(pointOut)        AS pointOut,
           MAX(transactionDate) AS pointDate,
           COUNT(*)             AS pointRows
    FROM points
    WHERE presence = 1
    GROUP BY transactionId
  ) p ON p.transactionId = t.id`;

// Latest point row per transaction: source of tier, archived flag and note.
const LATEST_POINT_JOIN = `
  LEFT JOIN points pl ON pl.id = (
    SELECT MAX(pid.id)
    FROM points pid
    WHERE pid.transactionId = t.id AND pid.presence = 1
  )
  LEFT JOIN tier tr ON pl.tierId = tr.id`;

const MEMBER_MERCHANT_JOIN = `
  LEFT JOIN members  m  ON CAST(t.memberId AS UNSIGNED) = m.id
  LEFT JOIN merchant mc ON t.merchantId = mc.id`;

const SELECT_COLUMNS = `
       t.id, t.bill, t.totalAmount, t.totalRedeem, t.redeemCode, t.approvalCode,
       t.billDate, t.note, t.syncType, t.status, t.presence,
       t.archived AS transactionArchived, t.inputDate, t.updateDate,
       NULLIF(CAST(t.memberId AS UNSIGNED), 0) AS memberId,
       t.merchantId,
       COALESCE(p.pointIn, 0)   AS pointIn,
       COALESCE(p.pointOut, 0)  AS pointOut,
       COALESCE(p.pointRows, 0) AS pointRows,
       COALESCE(p.pointDate, t.billDate) AS transactionDate,
       pl.id                    AS pointId,
       COALESCE(pl.note, '')    AS pointNote,
       COALESCE(pl.archived, 0) AS archived,
       COALESCE(m.name,  '-')   AS memberName,
       COALESCE(m.email, '-')   AS memberEmail,
       COALESCE(m.phone, '-')   AS memberPhone,
       COALESCE(mc.name, '-')   AS merchantName,
       COALESCE(tr.name, '')    AS tierName`;

const SEARCH_CLAUSE = '(t.bill LIKE ? OR t.note LIKE ? OR t.redeemCode LIKE ? OR m.name LIKE ? OR mc.name LIKE ?)';

const buildFilter = (req) => {
  const search        = req.query.search ? `%${req.query.search}%` : null;
  const type          = req.query.type || ''; // 'point_in' | 'redeem'
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

  const whereClauses = ['t.presence = 1'];
  const params = [];

  if (type === 'point_in') {
    whereClauses.push('COALESCE(p.pointIn, 0) > 0');
  } else if (type === 'redeem') {
    whereClauses.push('(t.totalRedeem > 0 OR COALESCE(p.pointOut, 0) > 0)');
  }

  if (search) {
    whereClauses.push(SEARCH_CLAUSE);
    params.push(search, search, search, search, search);
  }

  if (inputDateFrom) {
    whereClauses.push('DATE(t.inputDate) >= ?');
    params.push(inputDateFrom);
  }

  if (inputDateTo) {
    whereClauses.push('DATE(t.inputDate) <= ?');
    params.push(inputDateTo);
  }

  return { where: whereClauses.join(' AND '), params };
};

const list = async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)     || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || DEFAULT_PAGE_SIZE);
    const offset   = (page - 1) * pageSize;
    const { where, params } = buildFilter(req);

    const countRows = await query(
      `SELECT COUNT(*) AS total
       FROM transaction t
       ${POINTS_SUM_JOIN}
       ${MEMBER_MERCHANT_JOIN}
       WHERE ${where}`,
      params
    );
    const total = countRows[0].total;

    const rows = await query(
      `SELECT ${SELECT_COLUMNS}
       FROM transaction t
       ${POINTS_SUM_JOIN}
       ${LATEST_POINT_JOIN}
       ${MEMBER_MERCHANT_JOIN}
       WHERE ${where}
       ORDER BY t.id DESC
       LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      params
    );

    return success(res, { total, page, pageSize, rows }, 'Transactions fetched');
  } catch (err) {
    return next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error('Invalid transaction id');
      err.statusCode = 422;
      return next(err);
    }

    const rows = await query(
      `SELECT ${SELECT_COLUMNS}
       FROM transaction t
       ${POINTS_SUM_JOIN}
       ${LATEST_POINT_JOIN}
       ${MEMBER_MERCHANT_JOIN}
       WHERE t.id = ? AND t.presence = 1
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
