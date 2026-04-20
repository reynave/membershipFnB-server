require('../config/loadEnv');

const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || 'local-dev-secret';

const authPosV1 = (req, res, next) => {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  const token = authorization.replace('Bearer ', '').trim();

  try {
    const payload = jwt.verify(token, jwtSecret);
    const userId = String(payload.sub || '').trim();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid POS token payload'
      });
    }

    req.posUser = {
      id: userId,
      email: payload.email,
      name: payload.name
    };

    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

module.exports = authPosV1;
