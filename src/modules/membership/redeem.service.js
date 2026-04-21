const { getPool } = require('../../config/db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const bcryptSaltRounds = toPositiveNumber(process.env.BCRYPT_SALT_ROUNDS, 10);

const buildGeneratedMemberEmail = (phone) => {
  const phoneDigits = String(phone || '').replace(/\D/g, '') || 'unknown';
  const randomPart = crypto.randomBytes(6).toString('hex');
  return `auto-${phoneDigits}-${Date.now()}-${randomPart}@guest.membership.local`;
};

const resolveDefaultTierId = async (connection) => {
  const [tiers] = await connection.execute(
    'SELECT id FROM tier WHERE status = 1 AND presence = 1 ORDER BY id ASC LIMIT 1'
  );

  if (tiers.length === 0) {
    throw createHttpError('No active tier available for auto-created member', 422);
  }

  return Number(tiers[0].id);
};

const createMemberFromPhone = async (connection, phone) => {
  const normalizedPhone = String(phone || '').trim();

  if (!normalizedPhone) {
    throw createHttpError('phone is required to auto-create member', 422);
  }

  const [existingByPhone] = await connection.execute(
    'SELECT id, tierId, phone, name, email, status, presence FROM members WHERE phone = ? LIMIT 1',
    [normalizedPhone]
  );

  if (existingByPhone.length > 0) {
    const existingMember = existingByPhone[0];

    if (Number(existingMember.status) !== 1 || Number(existingMember.presence) !== 1) {
      await connection.execute(
        'UPDATE members SET status = 1, presence = 1, verified = 0, activated = 0 WHERE id = ?',
        [existingMember.id]
      );
    }

    const [rows] = await connection.execute(
      'SELECT id, name, email, tierId, status FROM members WHERE id = ? LIMIT 1',
      [existingMember.id]
    );

    return rows[0] || existingMember;
  }

  const tierId = await resolveDefaultTierId(connection);
  const generatedEmail = buildGeneratedMemberEmail(normalizedPhone).toLowerCase();
  const generatedPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(generatedPassword, bcryptSaltRounds);
  const generatedName = `Guest ${normalizedPhone.slice(-4) || normalizedPhone}`;

  const [insertResult] = await connection.execute(
    `INSERT INTO members (tierId, phone, name, email, password_hash, status, verified, activated, presence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tierId, normalizedPhone, generatedName, generatedEmail, passwordHash, 1, 0, 0, 1]
  );

  const [createdRows] = await connection.execute(
    'SELECT id, name, email, tierId, status FROM members WHERE id = ? LIMIT 1',
    [insertResult.insertId]
  );

  if (createdRows.length === 0) {
    throw createHttpError('Failed to create member automatically', 500);
  }

  return createdRows[0];
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

const normalizeMemberIdentifier = ({ id, phone, email }) => {
  const memberId = String(id || '').trim();
  const memberPhone = String(phone || '').trim();
  const memberEmail = String(email || '').trim();

  if (memberId) {
    return { field: 'id', value: memberId };
  }

  if (memberPhone) {
    return { field: 'phone', value: memberPhone };
  }

  if (memberEmail) {
    return { field: 'email', value: memberEmail.toLowerCase() };
  }

  throw createHttpError('Provide one identifier: id, phone, or email', 422);
};

const resolveMemberByIdentifier = async (connection, identifier, options = {}) => {
  const { field, value } = normalizeMemberIdentifier(identifier || {});
  const { autoCreateByPhone = false } = options;

  const [members] = await connection.execute(
    `SELECT id, name, email, tierId, status, presence
     FROM members
     WHERE ${field} = ? AND status = 1 AND presence = 1
     LIMIT 1`,
    [value]
  );

  if (members.length === 0) {
    if (autoCreateByPhone && field === 'phone') {
      return createMemberFromPhone(connection, value);
    }

    throw createHttpError('Member not found or inactive', 404);
  }

  return members[0];
};

const getMerchantByToken = async (connection, token) => {
  const [merchantTokens] = await connection.execute(
    'SELECT userId, merchantId FROM users_token WHERE token = ? LIMIT 1',
    [token.trim()]
  );

  if (merchantTokens.length === 0) {
    throw createHttpError('Invalid token', 401);
  }

  return merchantTokens[0];
};

const getMerchantByPosUserId = async (connection, posUserId) => {
  const [merchantTokens] = await connection.execute(
    'SELECT userId, merchantId FROM users_token WHERE userId = ? ORDER BY id DESC LIMIT 1',
    [String(posUserId)]
  );

  if (merchantTokens.length === 0) {
    throw createHttpError('POS user is not linked to merchant token', 401);
  }

  return merchantTokens[0];
};

const resolveMerchantByAccess = async (connection, { posUserId, merchantId }) => {
  if (Number.isInteger(Number(merchantId)) && Number(merchantId) > 0) {
    return { userId: String(posUserId), merchantId: Number(merchantId) };
  }

  return getMerchantByPosUserId(connection, posUserId);
};

const executeRedeemPoint = async ({ merchantId, payload, io }) => {
  const redeemCode = String(payload.redeemCode || '').trim();
  const phone = String(payload.phone || '').trim();
  const amount = normalizeAmount(payload.amount);
  const transactionId = String(payload.transactionId || '').trim();
  const approvalCode = generateApprovalCode();
  const pool = await getPool();
  const connection = await pool.getConnection();

  let memberId = null; // Track memberId for socket notifications
  let transactionStarted = false;

  try {
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

    let member = members[0] || null;

    if (!member || Number(member.status) !== 1) {
      if (!phone) {
        const error = createHttpError(!member ? 'Member not found' : 'Member is not active', !member ? 404 : 400);
        error.memberId = memberId;
        error.redeemCode = redeemCode;
        throw error;
      }

      member = await createMemberFromPhone(connection, phone);
      memberId = member.id;

      await connection.execute('UPDATE members_code SET memberId = ? WHERE id = ?', [member.id, redeemCodeRecord.id]);
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

    await connection.beginTransaction();
    transactionStarted = true;

    // 7. Insert into points table (pointOut)
    const now2 = new Date();
    const transactionDate = now2.toISOString().slice(0, 19).replace('T', ' ');

    await connection.execute(
      `INSERT INTO points 
        (transactionId, memberId, merchantId, tierId, pointIn, pointOut, transactionDate, note, archived, status, presence)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, memberId, merchantId, member.tierId, 0, amount, transactionDate, `Redeem - Code: ${redeemCode}`, 0, 1, 1]
    );

    // 8. Insert into transaction table (totalRedeem)
    await connection.execute(
      `INSERT INTO transaction 
        (memberId, merchantId, bill, totalAmount, totalRedeem, redeemCode, approvalCode, billDate, note, syncType, archived, status, presence)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, merchantId, transactionId, 0, amount, redeemCode, approvalCode, transactionDate, `Approval Code: ${approvalCode}`, 'api', 0, 1, 1]
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
    if (transactionStarted) {
      await connection.rollback();
    }

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

const executeRedeemPointV1ByMember = async ({ merchantId, payload, io }) => {
  const amount = normalizeAmount(payload.amount);
  const transactionId = String(payload.transactionId || '').trim();
  const approvalCode = generateApprovalCode();
  const pool = await getPool();
  const connection = await pool.getConnection();

  let memberId = null;
  let transactionStarted = false;

  try {
    const member = await resolveMemberByIdentifier(connection, payload.memberIdentifier || {}, {
      autoCreateByPhone: true
    });

    memberId = member.id;

    const [tiers] = await connection.execute(
      'SELECT id, name, maxPercentOfBill, minAmount FROM tier WHERE id = ? AND status = 1 AND presence = 1 LIMIT 1',
      [member.tierId]
    );

    if (tiers.length === 0) {
      throw createHttpError('Member tier not found', 404);
    }

    const tier = tiers[0];
    const minAmount = Number(tier.minAmount || 0);

    if (minAmount > 0 && amount < minAmount) {
      throw createHttpError(`Minimum redeem amount is ${minAmount}`, 400);
    }

    const maxPercentOfBill = Number(tier.maxPercentOfBill || 0);
    const totalAmount = amount;
    const maxRedeemByBill = Math.floor((totalAmount * maxPercentOfBill) / 100);

    if (maxRedeemByBill <= 0) {
      throw createHttpError(`Redeem is not allowed for this bill amount based on maxPercentOfBill (${maxPercentOfBill}%)`, 400);
    }

    const [pointsSummary] = await connection.execute(
      `SELECT
        COALESCE(SUM(CASE WHEN archived = 0 THEN pointIn ELSE 0 END), 0) AS totalPointIn,
        COALESCE(SUM(CASE WHEN archived = 0 THEN pointOut ELSE 0 END), 0) AS totalPointOut
      FROM points
      WHERE memberId = ?`,
      [memberId]
    );

    const totalPointIn = Number(pointsSummary[0].totalPointIn);
    const totalPointOut = Number(pointsSummary[0].totalPointOut);
    const currentBalance = totalPointIn - totalPointOut;

    if (currentBalance < maxRedeemByBill) {
      throw createHttpError('Insufficient point balance', 400);
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const transactionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await connection.execute(
      `INSERT INTO points
        (transactionId, memberId, merchantId, tierId, pointIn, pointOut, transactionDate, note, archived, status, presence)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, memberId, merchantId, member.tierId, 0, maxRedeemByBill, transactionDate, `Redeem POS V1 - ${transactionId}`, 0, 1, 1]
    );

    await connection.execute(
      `INSERT INTO transaction
        (memberId, merchantId, bill, totalAmount, totalRedeem, redeemCode, approvalCode, billDate, note, syncType, archived, status, presence)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, merchantId, transactionId, totalAmount, maxRedeemByBill, '', approvalCode, transactionDate, `Approval Code: ${approvalCode}`, 'api', 0, 1, 1]
    );

    await connection.commit();

    if (io && memberId) {
      io.to(`member:${memberId}`).emit('redeem:success', {
        point: maxRedeemByBill,
        approvalCode,
        status: 'success',
        transactionId,
        timestamp: new Date().toISOString()
      });
    }

    return {
      point: maxRedeemByBill,
      approvalCode,
      status: 'success',
      maxPercentOfBill,
      maxAllowedPoint: maxRedeemByBill,
      totalAmount
    };
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    if (io && memberId && error.statusCode) {
      io.to(`member:${memberId}`).emit('redeem:failed', {
        status: 'failed',
        message: error.message,
        transactionId,
        timestamp: new Date().toISOString()
      });
    }

    throw error;
  } finally {
    await connection.release();
  }
};

const redeemPoint = async ({ token, payload, io }) => {
  if (!token || !token.trim()) {
    throw createHttpError('Token header is required', 401);
  }

  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    const merchant = await getMerchantByToken(connection, token);
    return await executeRedeemPoint({ merchantId: merchant.merchantId, payload, io });
  } catch (error) {
    throw error;
  } finally {
    await connection.release();
  }
};

const redeemPointByPosUser = async ({ posUserId, merchantId, payload, io }) => {
  if (!posUserId) {
    throw createHttpError('POS user is required', 401);
  }

  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    const merchant = await resolveMerchantByAccess(connection, { posUserId, merchantId });
    return await executeRedeemPointV1ByMember({ merchantId: merchant.merchantId, payload, io });
  } finally {
    await connection.release();
  }
};

module.exports = {
  redeemPoint,
  redeemPointByPosUser
};
