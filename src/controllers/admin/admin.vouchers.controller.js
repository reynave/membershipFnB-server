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

const validateVoucherPayload = (payload, { requireAll = true } = {}) => {
  const name = toNullableString(payload?.name);
  const img = toNullableString(payload?.img) || '';
  const description = toNullableString(payload?.description);

  const pointsRequired = Number(payload?.pointsRequired);
  const pointsAmount = Number(payload?.pointsAmount);
  const quotaRaw = payload?.quota;

  const startDate = toNullableString(payload?.startDate);
  const endDate = toNullableString(payload?.endDate);

  if (requireAll && !name) {
    return { error: 'name is required' };
  }

  if (requireAll && (!Number.isInteger(pointsRequired) || pointsRequired <= 0)) {
    return { error: 'pointsRequired must be a positive integer' };
  }

  if (requireAll && (!Number.isInteger(pointsAmount) || pointsAmount <= 0)) {
    return { error: 'pointsAmount must be a positive integer' };
  }

  if (quotaRaw !== undefined && quotaRaw !== null && quotaRaw !== '') {
    const quota = Number(quotaRaw);
    if (!Number.isInteger(quota) || quota < 0) {
      return { error: 'quota must be a non-negative integer' };
    }
  }

  return {
    data: {
      name,
      img,
      description,
      pointsRequired: Number.isInteger(pointsRequired) ? pointsRequired : null,
      pointsAmount: Number.isInteger(pointsAmount) ? pointsAmount : null,
      startDate,
      endDate,
      quota: quotaRaw === '' || quotaRaw === undefined ? null : Number(quotaRaw)
    }
  };
};

const ensureVoucherMerchantSchema = async () => {
  const rows = await query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'voucher_merchant'`
  );

  const columns = new Set(rows.map((row) => row.COLUMN_NAME));

  if (!columns.has('voucherId')) {
    const err = new Error('Table voucher_merchant must contain column voucherId for voucher relation');
    err.statusCode = 500;
    throw err;
  }

  if (!columns.has('marchantId')) {
    const err = new Error('Table voucher_merchant must contain column marchantId');
    err.statusCode = 500;
    throw err;
  }
};

const getVoucherById = async (id) => {
  const rows = await query(
    `SELECT v.id, v.name, v.img, v.description, v.pointsRequired, v.pointsAmount,
            v.startDate, v.endDate, v.quota, v.presence, v.inputDate, v.updateDate,
            COUNT(vm.id) AS merchantCount
     FROM voucher v
     LEFT JOIN voucher_merchant vm ON vm.voucherId = v.id AND vm.presence = 1
     WHERE v.id = ? AND v.presence = 1
     GROUP BY v.id
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
};

const list = async (req, res, next) => {
  try {
    await ensureVoucherMerchantSchema();

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE);
    const offset = (page - 1) * pageSize;
    const search = toNullableString(req.query.search);

    const params = [];
    const whereClauses = ['v.presence = 1'];

    if (search) {
      whereClauses.push('(v.name LIKE ? OR v.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = whereClauses.join(' AND ');

    const countRows = await query(
      `SELECT COUNT(*) AS total
       FROM voucher v
       WHERE ${where}`,
      params
    );

    const rows = await query(
      `SELECT v.id, v.name, v.img, v.description, v.pointsRequired, v.pointsAmount,
              v.startDate, v.endDate, v.quota, v.inputDate, v.updateDate,
              COUNT(vm.id) AS merchantCount
       FROM voucher v
       LEFT JOIN voucher_merchant vm ON vm.voucherId = v.id AND vm.presence = 1
       WHERE ${where}
       GROUP BY v.id
       ORDER BY v.id DESC
       LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      params
    );

    const normalizedRows = rows.map((row) => ({
      ...row,
      merchantScope: Number(row.merchantCount) > 0 ? 'selected' : 'global'
    }));

    return success(res, {
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
      rows: normalizedRows
    }, 'Vouchers fetched');
  } catch (err) {
    return next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    await ensureVoucherMerchantSchema();

    const id = toId(req.params.id);

    if (!id) {
      const err = new Error('Invalid voucher id');
      err.statusCode = 422;
      return next(err);
    }

    const voucher = await getVoucherById(id);

    if (!voucher) {
      const err = new Error('Voucher not found');
      err.statusCode = 404;
      return next(err);
    }

    const merchants = await query(
      `SELECT m.id, m.name
       FROM merchant m
       WHERE m.status = 1 AND m.presence = 1
       ORDER BY m.id ASC`
    );

    const selectedMerchants = await query(
      `SELECT vm.id, vm.voucherId, vm.marchantId AS merchantId,
              COALESCE(m.name, '-') AS merchantName,
              vm.quota, vm.inputDate, vm.updateDate
       FROM voucher_merchant vm
       LEFT JOIN merchant m ON m.id = vm.marchantId
       WHERE vm.voucherId = ? AND vm.presence = 1
       ORDER BY vm.id ASC`,
      [id]
    );

    return success(res, {
      voucher: {
        ...voucher,
        merchantScope: Number(voucher.merchantCount) > 0 ? 'selected' : 'global'
      },
      merchants,
      selectedMerchants
    }, 'Voucher detail fetched');
  } catch (err) {
    return next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const validation = validateVoucherPayload(req.body, { requireAll: true });

    if (validation.error) {
      const err = new Error(validation.error);
      err.statusCode = 422;
      return next(err);
    }

    const payload = validation.data;

    const result = await query(
      `INSERT INTO voucher (name, img, description, pointsRequired, pointsAmount, startDate, endDate, quota)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.name,
        payload.img,
        payload.description,
        payload.pointsRequired,
        payload.pointsAmount,
        payload.startDate,
        payload.endDate,
        payload.quota
      ]
    );

    const created = await getVoucherById(Number(result.insertId || 0));

    return success(res, created, 'Voucher created', 201);
  } catch (err) {
    return next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = toId(req.params.id);

    if (!id) {
      const err = new Error('Invalid voucher id');
      err.statusCode = 422;
      return next(err);
    }

    const existing = await getVoucherById(id);

    if (!existing) {
      const err = new Error('Voucher not found');
      err.statusCode = 404;
      return next(err);
    }

    const validation = validateVoucherPayload(req.body, { requireAll: true });

    if (validation.error) {
      const err = new Error(validation.error);
      err.statusCode = 422;
      return next(err);
    }

    const payload = validation.data;

    await query(
      `UPDATE voucher
       SET name = ?,
           img = ?,
           description = ?,
           pointsRequired = ?,
           pointsAmount = ?,
           startDate = ?,
           endDate = ?,
           quota = ?
       WHERE id = ? AND presence = 1`,
      [
        payload.name,
        payload.img,
        payload.description,
        payload.pointsRequired,
        payload.pointsAmount,
        payload.startDate,
        payload.endDate,
        payload.quota,
        id
      ]
    );

    const updated = await getVoucherById(id);

    return success(res, updated, 'Voucher updated');
  } catch (err) {
    return next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const id = toId(req.params.id);

    if (!id) {
      const err = new Error('Invalid voucher id');
      err.statusCode = 422;
      return next(err);
    }

    const result = await query(
      `UPDATE voucher
       SET presence = 0
       WHERE id = ? AND presence = 1`,
      [id]
    );

    if (!result.affectedRows) {
      const err = new Error('Voucher not found');
      err.statusCode = 404;
      return next(err);
    }

    await query(
      `UPDATE voucher_merchant
       SET presence = 0
       WHERE voucherId = ? AND presence = 1`,
      [id]
    );

    return success(res, { id }, 'Voucher deleted');
  } catch (err) {
    return next(err);
  }
};

const setMerchants = async (req, res, next) => {
  try {
    await ensureVoucherMerchantSchema();

    const id = toId(req.params.id);

    if (!id) {
      const err = new Error('Invalid voucher id');
      err.statusCode = 422;
      return next(err);
    }

    const voucher = await getVoucherById(id);

    if (!voucher) {
      const err = new Error('Voucher not found');
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
        `UPDATE voucher_merchant
         SET presence = 0
         WHERE voucherId = ? AND presence = 1`,
        [id]
      );

      if (merchantIds.length > 0) {
        const values = merchantIds.map(() => '(?, ?, 0, 1)').join(', ');
        const params = [];

        for (const merchantId of merchantIds) {
          params.push(id, merchantId);
        }

        await connection.execute(
          `INSERT INTO voucher_merchant (voucherId, marchantId, quota, presence)
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
      `SELECT vm.id, vm.voucherId, vm.marchantId AS merchantId,
              COALESCE(m.name, '-') AS merchantName,
              vm.quota, vm.inputDate, vm.updateDate
       FROM voucher_merchant vm
       LEFT JOIN merchant m ON m.id = vm.marchantId
       WHERE vm.voucherId = ? AND vm.presence = 1
       ORDER BY vm.id ASC`,
      [id]
    );

    return success(res, {
      voucherId: id,
      merchantScope: selectedMerchants.length > 0 ? 'selected' : 'global',
      selectedMerchants
    }, 'Voucher merchants updated');
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
  setMerchants
};
