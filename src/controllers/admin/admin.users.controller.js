const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../../config/db');
const { success } = require('../../helpers/response');

const toId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const generateOpaqueToken = () => `pos_live_${crypto.randomBytes(32).toString('hex')}`;
const bcryptSaltRounds = Math.max(4, parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10) || 10);

const toNullableString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
};

const toBoolInt = (value) => (value ? 1 : 0);

const getUserById = async (id) => {
  const users = await query(
    `SELECT id, name, email, note, isLock, invisibleUser, presence, inputDate, updateDate
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return users[0] || null;
};

const getActiveMerchantById = async (id) => {
  const merchants = await query(
    `SELECT id, name, status, presence, inputDate
     FROM merchant
     WHERE id = ? AND status = 1 AND presence = 1
     LIMIT 1`,
    [id]
  );

  return merchants[0] || null;
};

const list = async (req, res, next) => {
  try {
    const users = await query(
      `SELECT u.id, u.name, u.email, u.note, u.isLock, u.invisibleUser, u.inputDate, u.updateDate,
              COUNT(ut.id) AS tokenCount
       FROM users u
       LEFT JOIN users_token ut ON ut.userId = u.id
       WHERE u.presence = 1 AND COALESCE(u.invisibleUser, 0) = 0
       GROUP BY u.id
       ORDER BY u.id ASC`
    );
    return success(res, users, 'Users fetched');
  } catch (err) {
    return next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const id = toId(req.params.id);

    const user = await getUserById(id);

    if (!user || Number(user.presence) !== 1) {
      const err = new Error('User not found');
      err.statusCode = 404;
      return next(err);
    }

    const tokens = await query(
      `SELECT ut.id, ut.merchantId, ut.token, ut.inputDate,
              COALESCE(m.name, '-') AS merchantName
       FROM users_token ut
       LEFT JOIN merchant m ON ut.merchantId = m.id
       WHERE ut.userId = ?
       ORDER BY ut.id ASC`,
      [String(id)]
    );

    const merchants = await query(
      `SELECT id, name, inputDate
       FROM merchant
       WHERE status = 1 AND presence = 1
       ORDER BY id ASC`
    );

    return success(res, { user, tokens, merchants }, 'User detail fetched');
  } catch (err) {
    return next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const name = toNullableString(req.body?.name);
    const email = toNullableString(req.body?.email);
    const password = toNullableString(req.body?.password);
    const note = toNullableString(req.body?.note) || '';
    const isLock = toBoolInt(req.body?.isLock);

    if (!name || !email || !password) {
      const err = new Error('name, email, and password are required');
      err.statusCode = 422;
      return next(err);
    }

    if (password.length < 6) {
      const err = new Error('password must be at least 6 characters');
      err.statusCode = 422;
      return next(err);
    }

    const existing = await query(
      `SELECT id
       FROM users
       WHERE email = ? AND presence = 1
       LIMIT 1`,
      [email]
    );

    if (existing.length > 0) {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      return next(err);
    }

    const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, note, isLock, presence)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [name, email, passwordHash, note, isLock]
    );

    const created = await getUserById(Number(result.insertId || 0));

    return success(res, created, 'User created', 201);
  } catch (err) {
    return next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = toId(req.params.id);

    if (!id) {
      const err = new Error('Invalid user id');
      err.statusCode = 422;
      return next(err);
    }

    const user = await getUserById(id);

    if (!user || Number(user.presence) !== 1) {
      const err = new Error('User not found');
      err.statusCode = 404;
      return next(err);
    }

    const name = toNullableString(req.body?.name);
    const email = toNullableString(req.body?.email);
    const note = toNullableString(req.body?.note) || '';
    const password = toNullableString(req.body?.password);
    const isLock = req.body?.isLock === undefined ? Number(user.isLock || 0) : toBoolInt(req.body?.isLock);

    if (!name || !email) {
      const err = new Error('name and email are required');
      err.statusCode = 422;
      return next(err);
    }

    if (password && password.length < 6) {
      const err = new Error('password must be at least 6 characters');
      err.statusCode = 422;
      return next(err);
    }

    const existing = await query(
      `SELECT id
       FROM users
       WHERE email = ? AND id <> ? AND presence = 1
       LIMIT 1`,
      [email, id]
    );

    if (existing.length > 0) {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      return next(err);
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);
      await query(
        `UPDATE users
         SET name = ?, email = ?, note = ?, isLock = ?, password_hash = ?
         WHERE id = ? AND presence = 1`,
        [name, email, note, isLock, passwordHash, id]
      );
    } else {
      await query(
        `UPDATE users
         SET name = ?, email = ?, note = ?, isLock = ?
         WHERE id = ? AND presence = 1`,
        [name, email, note, isLock, id]
      );
    }

    const updated = await getUserById(id);

    return success(res, updated, 'User updated');
  } catch (err) {
    return next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    const requesterId = toId(req.user?.id);

    if (!id) {
      const err = new Error('Invalid user id');
      err.statusCode = 422;
      return next(err);
    }

    const user = await getUserById(id);

    if (!user || Number(user.presence) !== 1) {
      const err = new Error('User not found');
      err.statusCode = 404;
      return next(err);
    }

    if (id === requesterId) {
      const err = new Error('You cannot delete your own account');
      err.statusCode = 422;
      return next(err);
    }

    if (Number(user.isLock) === 1) {
      const err = new Error('Master user cannot be deleted');
      err.statusCode = 422;
      return next(err);
    }

    await query(
      `UPDATE users
       SET presence = 0
       WHERE id = ? AND presence = 1`,
      [id]
    );

    await query(
      `DELETE FROM users_token
       WHERE userId = ?`,
      [String(id)]
    );

    return success(res, { id }, 'User deleted');
  } catch (err) {
    return next(err);
  }
};

const createToken = async (req, res, next) => {
  try {
    const userId = toId(req.params.id);
    const merchantId = toId(req.body?.merchantId);

    if (!userId || !merchantId) {
      const err = new Error('userId and merchantId are required');
      err.statusCode = 422;
      return next(err);
    }

    const user = await getUserById(userId);

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      return next(err);
    }

    const merchant = await getActiveMerchantById(merchantId);

    if (!merchant) {
      const err = new Error('Merchant not found or inactive');
      err.statusCode = 404;
      return next(err);
    }

    let token = '';
    let createdTokenId = 0;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      token = generateOpaqueToken();

      try {
        const result = await query(
          `INSERT INTO users_token (userId, merchantId, token)
           VALUES (?, ?, ?)`,
          [String(userId), merchantId, token]
        );

        createdTokenId = Number(result.insertId || 0);
        break;
      } catch (error) {
        if (error && error.code === 'ER_DUP_ENTRY') {
          continue;
        }

        throw error;
      }
    }

    if (!createdTokenId) {
      const err = new Error('Failed to generate unique token');
      err.statusCode = 500;
      return next(err);
    }

    const tokens = await query(
      `SELECT ut.id, ut.userId, ut.merchantId, ut.token, ut.inputDate,
              COALESCE(m.name, '-') AS merchantName
       FROM users_token ut
       LEFT JOIN merchant m ON ut.merchantId = m.id
       WHERE ut.id = ?
       LIMIT 1`,
      [createdTokenId]
    );

    return success(
      res,
      {
        token: tokens[0] || {
          id: createdTokenId,
          userId: String(userId),
          merchantId,
          merchantName: merchant.name,
          token
        }
      },
      'POS token created',
      201
    );
  } catch (err) {
    return next(err);
  }
};

const removeToken = async (req, res, next) => {
  try {
    const userId = toId(req.params.id);
    const tokenId = toId(req.params.tokenId);

    if (!userId || !tokenId) {
      const err = new Error('userId and tokenId are required');
      err.statusCode = 422;
      return next(err);
    }

    const result = await query(
      `DELETE FROM users_token
       WHERE id = ? AND userId = ?`,
      [tokenId, String(userId)]
    );

    if (!result.affectedRows) {
      const err = new Error('Token not found');
      err.statusCode = 404;
      return next(err);
    }

    return success(res, { id: tokenId }, 'POS token deleted');
  } catch (err) {
    return next(err);
  }
};

module.exports = { list, detail, create, update, remove, createToken, removeToken };
