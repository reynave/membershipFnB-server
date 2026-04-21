require('../config/loadEnv');

const { query } = require('../config/db');

const authPosV1 = async (req, res, next) => {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  const token = authorization.replace('Bearer ', '').trim();

  try {
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    const rows = await query(
      `SELECT ut.id, ut.userId, ut.merchantId, ut.inputDate,
              u.name AS userName, u.email AS userEmail,
              m.name AS merchantName
       FROM users_token ut
       INNER JOIN users u ON u.id = CAST(ut.userId AS UNSIGNED)
       INNER JOIN merchant m ON m.id = ut.merchantId
       WHERE ut.token = ?
         AND m.status = 1
         AND m.presence = 1
       LIMIT 1`,
      [token]
    );

    const access = rows[0];

    if (!access) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive POS token'
      });
    }

    req.posUser = {
      id: String(access.userId),
      email: access.userEmail,
      name: access.userName,
      merchantId: Number(access.merchantId),
      merchantName: access.merchantName,
      tokenId: Number(access.id)
    };

    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or inactive POS token'
    });
  }
};

module.exports = authPosV1;
