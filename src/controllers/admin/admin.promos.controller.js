const { query, getPool } = require('../../config/db');
const { success } = require('../../helpers/response');

const DEFAULT_PAGE_SIZE = 20;

const toId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const toNullableString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
};

const parseMerchantIds = (merchantIds) => {
  if (!Array.isArray(merchantIds)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  for (const value of merchantIds) {
    const id = toId(value);
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    result.push(id);
  }

  return result;
};

const validatePromoPayload = (payload, { requireAll = true } = {}) => {
  const name = toNullableString(payload?.name);
  const img = toNullableString(payload?.img) || '';
  const description = toNullableString(payload?.description);
  const startDate = toNullableString(payload?.startDate);
  const endDate = toNullableString(payload?.endDate);

  if (requireAll && !name) {
    return { error: 'name is required' };
  }

  return {
    data: {
      name,
      img,
      description,
      startDate,
      endDate
    }
  };
};

const ensurePromoMerchantSchema = async () => {
  const rows = await query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'promo_merchant'`
  );

  const columns = new Set(rows.map((row) => row.COLUMN_NAME));

  if (!columns.has('promoId')) {
    const err = new Error('Table promo_merchant must contain column promoId for promo relation');
    err.statusCode = 500;
    throw err;
  }

  if (!columns.has('marchantId')) {
    const err = new Error('Table promo_merchant must contain column marchantId');
    err.statusCode = 500;
    throw err;
  }
};

const getPromoById = async (id) => {
  const rows = await query(
    `SELECT p.id, p.name, p.img,  
            p.startDate, p.endDate, p.presence, p.inputDate, p.updateDate,
            COUNT(pm.id) AS merchantCount
     FROM promo p
     LEFT JOIN promo_merchant pm ON pm.promoId = p.id AND pm.presence = 1
     WHERE p.id = ? AND p.presence = 1
     GROUP BY p.id
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
};

const list = async (req, res, next) => {
  try {
    await ensurePromoMerchantSchema();

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE);
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
      `SELECT COUNT(*) AS total
       FROM promo p
       WHERE ${where}`,
      params
    );

    const rows = await query(
      `SELECT p.id, p.name, p.img, p.description,
              p.startDate, p.endDate, p.inputDate, p.updateDate,
              COUNT(pm.id) AS merchantCount
       FROM promo p
       LEFT JOIN promo_merchant pm ON pm.promoId = p.id AND pm.presence = 1
       WHERE ${where}
       GROUP BY p.id
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return success(res, {
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
      rows: rows.map((row) => ({
        ...row,
        merchantScope: Number(row.merchantCount) > 0 ? 'selected' : 'global'
      }))
    }, 'Promos fetched');
  } catch (err) {
    return next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    await ensurePromoMerchantSchema();

    const id = toId(req.params.id);

    if (!id) {
      const err = new Error('Invalid promo id');
      err.statusCode = 422;
      return next(err);
    }

    const promo = await getPromoById(id);

    if (!promo) {
      const err = new Error('Promo not found');
      err.statusCode = 404;
      return next(err);
    }

    const merchants = await query(
      `SELECT id, name
       FROM merchant
       WHERE status = 1 AND presence = 1
       ORDER BY id ASC`
    );

    const selectedMerchants = await query(
      `SELECT pm.id, pm.promoId, pm.marchantId AS merchantId,
              COALESCE(m.name, '-') AS merchantName,
              pm.inputDate, pm.updateDate
       FROM promo_merchant pm
       LEFT JOIN merchant m ON m.id = pm.marchantId
       WHERE pm.promoId = ? AND pm.presence = 1
       ORDER BY pm.id ASC`,
      [id]
    );

    return success(res, {
      promo: {
        ...promo,
        merchantScope: Number(promo.merchantCount) > 0 ? 'selected' : 'global'
      },
      merchants,
      selectedMerchants
    }, 'Promo detail fetched');
  } catch (err) {
    return next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const validation = validatePromoPayload(req.body, { requireAll: true });

    if (validation.error) {
      const err = new Error(validation.error);
      err.statusCode = 422;
      return next(err);
    }

    const payload = validation.data;

    const result = await query(
      `INSERT INTO promo (name, img, description, startDate, endDate)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.name, payload.img, payload.description, payload.startDate, payload.endDate]
    );

    const created = await getPromoById(Number(result.insertId || 0));

    return success(res, created, 'Promo created', 201);
  } catch (err) {
    return next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = toId(req.params.id);

    if (!id) {
      const err = new Error('Invalid promo id');
      err.statusCode = 422;
      return next(err);
    }

    const existing = await getPromoById(id);

    if (!existing) {
      const err = new Error('Promo not found');
      err.statusCode = 404;
      return next(err);
    }

    const validation = validatePromoPayload(req.body, { requireAll: true });

    if (validation.error) {
      const err = new Error(validation.error);
      err.statusCode = 422;
      return next(err);
    }

    const payload = validation.data;

    await query(
      `UPDATE promo
       SET name = ?,
           img = ?,
           description = ?,
           startDate = ?,
           endDate = ?
       WHERE id = ? AND presence = 1`,
      [payload.name, payload.img, payload.description, payload.startDate, payload.endDate, id]
    );

    const updated = await getPromoById(id);

    return success(res, updated, 'Promo updated');
  } catch (err) {
    return next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const id = toId(req.params.id);

    if (!id) {
      const err = new Error('Invalid promo id');
      err.statusCode = 422;
      return next(err);
    }

    const result = await query(
      `UPDATE promo
       SET presence = 0
       WHERE id = ? AND presence = 1`,
      [id]
    );

    if (!result.affectedRows) {
      const err = new Error('Promo not found');
      err.statusCode = 404;
      return next(err);
    }

    await query(
      `UPDATE promo_merchant
       SET presence = 0
       WHERE promoId = ? AND presence = 1`,
      [id]
    );

    return success(res, { id }, 'Promo deleted');
  } catch (err) {
    return next(err);
  }
};

const setMerchants = async (req, res, next) => {
  try {
    await ensurePromoMerchantSchema();

    const id = toId(req.params.id);

    if (!id) {
      const err = new Error('Invalid promo id');
      err.statusCode = 422;
      return next(err);
    }

    const promo = await getPromoById(id);

    if (!promo) {
      const err = new Error('Promo not found');
      err.statusCode = 404;
      return next(err);
    }

    const merchantIds = parseMerchantIds(req.body?.merchantIds);

    if (merchantIds.length > 0) {
      const placeholders = merchantIds.map(() => '?').join(',');
      const activeMerchants = await query(
        `SELECT id
         FROM merchant
         WHERE status = 1 AND presence = 1 AND id IN (${placeholders})`,
        merchantIds
      );

      if (activeMerchants.length !== merchantIds.length) {
        const err = new Error('Some merchantIds are invalid or inactive');
        err.statusCode = 422;
        return next(err);
      }
    }

    const pool = await getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await connection.execute(
        `UPDATE promo_merchant
         SET presence = 0
         WHERE promoId = ? AND presence = 1`,
        [id]
      );

      if (merchantIds.length > 0) {
        const values = merchantIds.map(() => '(?, ?, 1)').join(', ');
        const params = [];

        for (const merchantId of merchantIds) {
          params.push(id, merchantId);
        }

        await connection.execute(
          `INSERT INTO promo_merchant (promoId, marchantId, presence)
           VALUES ${values}`,
          params
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const selectedMerchants = await query(
      `SELECT pm.id, pm.promoId, pm.marchantId AS merchantId,
              COALESCE(m.name, '-') AS merchantName,
              pm.inputDate, pm.updateDate
       FROM promo_merchant pm
       LEFT JOIN merchant m ON m.id = pm.marchantId
       WHERE pm.promoId = ? AND pm.presence = 1
       ORDER BY pm.id ASC`,
      [id]
    );

    return success(res, {
      promoId: id,
      merchantScope: selectedMerchants.length > 0 ? 'selected' : 'global',
      selectedMerchants
    }, 'Promo merchants updated');
  } catch (err) {
    return next(err);
  }
};

module.exports = { list, detail, create, update, remove, setMerchants };