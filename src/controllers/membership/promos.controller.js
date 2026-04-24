const { query } = require('../../config/db');
const { success, fail } = require('../../helpers/response');

const toId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const toNullableString = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const getPromoById = async (id) => {
  const rows = await query(
    `SELECT p.id, p.name, p.img, p.description,
            p.startDate, p.endDate, p.presence, p.inputDate, p.updateDate,
            p.birthdayMember, p.birthdayAfter, p.birthdayBefore
     FROM promo p
     WHERE p.id = ? AND p.presence = 1
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
};

const list = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize, 10) || 20);
    const offset = (page - 1) * pageSize;
    const search = toNullableString(req.query.search);

    const params = [];
    const whereClauses = ['p.presence = 1'];

    if (search) {
      whereClauses.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = whereClauses.join(' AND ');

    const countRows = await query(
      `SELECT COUNT(*) AS total FROM promo p WHERE ${where}`,
      params
    );

    const rows = await query(
      `SELECT p.id, p.name, p.img, p.description,
              p.startDate, p.endDate, p.inputDate, p.updateDate
       FROM promo p
       WHERE ${where}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return success(res, {
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
      rows
    }, 'Promos fetched');
  } catch (err) {
    return next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const id = toId(req.params.id);

    if (!id) {
      return fail(res, 'Invalid promo id', 422);
    }

    const promo = await getPromoById(id);

    if (!promo) {
      return fail(res, 'Promo not found', 404);
    }

    return success(res, { promo }, 'Promo detail fetched');
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  list,
  detail
};
