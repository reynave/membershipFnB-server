const { getPool } = require('../../config/db');
const crypto = require('crypto');

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateApprovalCode = () => {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
};

const normalizeAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError('amount must be a number greater than 0', 422);
  }

  return Math.floor(amount);
};

const redeemPoint = async ({ token, payload, io }) => {
  if (!token || !token.trim()) {
    throw createHttpError('Token header is required', 401);
  }

  const redeemCode = String(payload.redeemCode || '').trim();
  const amount = normalizeAmount(payload.amount);
  const transactionId = String(payload.transactionId || '').trim();
  const approvalCode = generateApprovalCode();
  const pool = await getPool();
  const connection = await pool.getConnection();

  let memberId = null; // Track memberId for socket notifications

  try {
    await connection.beginTransaction();

    // 1. Validate token & get merchantId
    const [merchantTokens] = await connection.execute(
      'SELECT userId, merchantId FROM users_token WHERE token = ? LIMIT 1',
      [token.trim()]
    );

    if (merchantTokens.length === 0) {
      throw createHttpError('Invalid token', 401);
    }

    const merchantId = merchantTokens[0].merchantId;

    // 2. Validate redeemCode exists & not expired & not used
    const [redeemCodes] = await connection.execute(
      'SELECT id, memberId, expDateTime, presence FROM members_code WHERE redeemCode = ? LIMIT 1',
      [redeemCode]
    );

    if (redeemCodes.length === 0) {
      throw createHttpError('Redeem code not found', 404);
    }

    const redeemCodeRecord = redeemCodes[0];
    memberId = redeemCodeRecord.memberId; // Set memberId for future error handling

    // Check if code already used
    if (redeemCodeRecord.presence === 0) {
      const error = createHttpError('Redeem code has been used', 410);
      error.memberId = memberId;
      error.redeemCode = redeemCode;
      throw error;
    }

    // Check if code is expired
    const expDateTime = new Date(redeemCodeRecord.expDateTime);
    const now = new Date();
    if (now > expDateTime) {
      const error = createHttpError('Redeem code has expired', 410);
      error.memberId = memberId;
      error.redeemCode = redeemCode;
      throw error;
    }

    // 3. Validate member exists & active
    const [members] = await connection.execute(
      'SELECT id, name, email, tierId, status FROM members WHERE id = ? LIMIT 1',
      [memberId]
    );

    if (members.length === 0) {
      const error = createHttpError('Member not found', 404);
      error.memberId = memberId;
      error.redeemCode = redeemCode;
      throw error;
    }

    const member = members[0];

    if (member.status !== 1) {
      const error = createHttpError('Member is not active', 400);
      error.memberId = memberId;
      error.redeemCode = redeemCode;
      throw error;
    }

    // 4. Get tier info
    const [tiers] = await connection.execute(
      'SELECT id, name FROM tier WHERE id = ? AND status = 1 LIMIT 1',
      [member.tierId]
    );

    if (tiers.length === 0) {
      const error = createHttpError('Member tier not found', 404);
      error.memberId = memberId;
      error.redeemCode = redeemCode;
      throw error;
    }

    const tier = tiers[0];

    // 5. Calculate member's current point balance
    const [pointsSummary] = await connection.execute(
      `SELECT 
        COALESCE(SUM(CASE WHEN archived = 0 THEN pointIn ELSE 0 END), 0) as totalPointIn,
        COALESCE(SUM(CASE WHEN archived = 0 THEN pointOut ELSE 0 END), 0) as totalPointOut
      FROM points 
      WHERE memberId = ?`,
      [memberId]
    );

    const totalPointIn = Number(pointsSummary[0].totalPointIn);
    const totalPointOut = Number(pointsSummary[0].totalPointOut);
    const currentBalance = totalPointIn - totalPointOut;

    // 6. Validate member has enough points
    if (currentBalance < amount) {
      const error = createHttpError('Insufficient point balance', 400);
      error.memberId = memberId;
      error.redeemCode = redeemCode;
      throw error;
    }

    // 7. Insert into points table (pointOut)
    const now2 = new Date();
    const transactionDate = now2.toISOString().slice(0, 19).replace('T', ' ');

    const [pointResult] = await connection.execute(
      `INSERT INTO points 
        (transactionId, memberId, merchantId, tierId, pointIn, pointOut, transactionDate, note, archived, status, presence)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, memberId, merchantId, member.tierId, 0, amount, transactionDate, `Redeem - Code: ${redeemCode}`, 0, 1, 1]
    );

    // 8. Insert into transaction table (totalRedeem)
    await connection.execute(
      `INSERT INTO transaction 
        (memberId, merchantId, bill, totalAmount, totalRedeem, redeemCode, billDate, note, syncType, archived, status, presence)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, merchantId, transactionId, 0, amount, redeemCode, transactionDate, `Approval Code: ${approvalCode}`, 'api', 0, 1, 1]
    );

    // 9. Update members_code to mark as used (presence = 0)
    await connection.execute(
      'UPDATE members_code SET presence = 0 WHERE id = ?',
      [redeemCodeRecord.id]
    );

    await connection.commit();

    // Emit socket notification to member - SUCCESS
    if (io && memberId) {
      io.to(`member:${memberId}`).emit('redeem:success', {
        point: amount,
        approvalCode,
        status: 'success',
        redeemCode,
        timestamp: new Date().toISOString()
      });
    }

    return {
      point: amount,
      approvalCode,
      status: 'success'
    };
  } catch (error) {
    await connection.rollback();
    
    // Emit socket notification to member - FAILED
    if (io && memberId && error.statusCode) {
      io.to(`member:${memberId}`).emit('redeem:failed', {
        status: 'failed',
        message: error.message,
        redeemCode: error.redeemCode || redeemCode,
        timestamp: new Date().toISOString()
      });
    }
    
    throw error;
  } finally {
    await connection.release();
  }
};

module.exports = {
  redeemPoint
};
