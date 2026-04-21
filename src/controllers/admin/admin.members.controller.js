const { query } = require('../../config/db');
const { success } = require('../../helpers/response');

const DEFAULT_PAGE_SIZE = 20;

const list = async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)     || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || DEFAULT_PAGE_SIZE);
    const search   = req.query.search   ? `%${req.query.search}%`   : null;
    const tierId   = req.query.tierId   ? parseInt(req.query.tierId) : null;
    const offset   = (page - 1) * pageSize;

    let whereClauses = ['m.presence = 1'];
    const params = [];

    if (search) {
      whereClauses.push('(m.name LIKE ? OR m.email LIKE ? OR m.phone LIKE ?)');
      params.push(search, search, search);
    }
    if (tierId) {
      whereClauses.push('m.tierId = ?');
      params.push(tierId);
    }

    const where = whereClauses.join(' AND ');

    const countRows = await query(
      `SELECT COUNT(*) AS total FROM members m WHERE ${where}`,
      params
    );
    const total = countRows[0].total;

    const rows = await query(
      `SELECT m.id, m.name, m.email, m.phone, m.tierId, m.status, m.activated,
              m.verified, m.inputDate, m.updateDate,
              COALESCE(t.name, '') AS tierName
       FROM members m
       LEFT JOIN tier t ON m.tierId = t.id
       WHERE ${where}
       ORDER BY m.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return success(res, { total, page, pageSize, rows }, 'Members fetched');
  } catch (err) {
    return next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const members = await query(
      `SELECT m.id, m.name, m.email, m.phone, m.tierId, m.status, m.activated,
              m.verified, m.inputDate, m.updateDate,
              COALESCE(t.name, '') AS tierName
       FROM members m
       LEFT JOIN tier t ON m.tierId = t.id
       WHERE m.id = ? AND m.presence = 1
       LIMIT 1`,
      [id]
    );

    if (members.length === 0) {
      const err = new Error('Member not found');
      err.statusCode = 404;
      return next(err);
    }

    const balanceRows = await query(
      `SELECT
         COALESCE(SUM(pointIn),  0) AS totalPointIn,
         COALESCE(SUM(pointOut), 0) AS totalPointOut,
         COALESCE(SUM(pointIn) - SUM(pointOut), 0) AS balance
       FROM points
       WHERE memberId = ? AND archived = 0 AND presence = 1`,
      [id]
    );

    const history = await query(
      `SELECT p.id, p.transactionId, p.pointIn, p.pointOut, p.transactionDate,
              p.note, p.archived,
              COALESCE(t.bill, '') AS bill,
              COALESCE(t.totalAmount, 0) AS totalAmount,
              COALESCE(mc.name, '') AS merchantName
       FROM points p
       LEFT JOIN transaction t  ON p.transactionId = t.id
       LEFT JOIN merchant   mc ON p.merchantId    = mc.id
       WHERE p.memberId = ? AND p.presence = 1
       ORDER BY p.id DESC
       LIMIT 50`,
      [id]
    );

    return success(res, {
      member:  members[0],
      balance: balanceRows[0],
      history
    }, 'Member detail fetched');
  } catch (err) {
    return next(err);
  }
};

module.exports = { list, detail };
