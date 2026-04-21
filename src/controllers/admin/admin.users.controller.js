const crypto = require('crypto');
const { query } = require('../../config/db');
const { success } = require('../../helpers/response');

const toId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const generateOpaqueToken = () => `pos_live_${crypto.randomBytes(32).toString('hex')}`;

const getUserById = async (id) => {
  const users = await query(
    `SELECT id, name, email, inputDate FROM users WHERE id = ? LIMIT 1`,
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
      `SELECT u.id, u.name, u.email, u.inputDate,
              COUNT(ut.id) AS tokenCount
       FROM users u
       LEFT JOIN users_token ut ON ut.userId = u.id
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

    if (!user) {
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

module.exports = { list, detail, createToken, removeToken };
