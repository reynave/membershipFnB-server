const { getPool } = require('../../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
      'SELECT id, tierId, phone, name, email FROM members WHERE id = ? LIMIT 1',
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
    'SELECT id, tierId, phone, name, email FROM members WHERE id = ? LIMIT 1',
    [insertResult.insertId]
  );

  if (createdRows.length === 0) {
    throw createHttpError('Failed to create member automatically', 500);
  }

  return createdRows[0];
};

const mysqlDateTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const normalizeAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError('totalAmount must be a number greater than 0', 422);
  }

  return Math.floor(amount);
};

const normalizeBillDate = (value) => {
  if (mysqlDateTimePattern.test(String(value).trim())) {
    return String(value).trim();
  }

  const billDate = new Date(value);

  if (Number.isNaN(billDate.getTime())) {
    throw createHttpError('billDate must be a valid date', 422);
  }

  return billDate.toISOString().slice(0, 19).replace('T', ' ');
};

const calculatePoint = ({ totalAmount, percentOfCashBack, accumulationAmount }) => {
  if (Number(accumulationAmount) > 0) {
    return Math.floor(totalAmount / Number(accumulationAmount));
  }

  return Math.floor((totalAmount * Number(percentOfCashBack)) / 100);
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
    `SELECT id, tierId, phone, name, email
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
    'SELECT userId, merchantId, token FROM users_token WHERE token = ? LIMIT 1',
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

const buildPointInPayload = async ({ connection, merchant, member, payload }) => {
  const bill = String(payload.bill || '').trim();
  const note = payload.note ? String(payload.note).trim() : '';
  const totalAmount = normalizeAmount(payload.totalAmount);
  const billDate = normalizeBillDate(payload.billDate);

  if (!bill) {
    throw createHttpError('bill is required', 422);
  }

  if (!member.tierId || Number(member.tierId) <= 0) {
    throw createHttpError('Member tier is not configured', 422);
  }

  const [tiers] = await connection.execute(
    'SELECT id, name, percentOfCashBack, accumulationAmount FROM tier WHERE id = ? AND status = 1 AND presence = 1 LIMIT 1',
    [member.tierId]
  );

  if (tiers.length === 0) {
    throw createHttpError('Tier not found or inactive', 404);
  }

  const tier = tiers[0];
  const earnedPoint = calculatePoint({
    totalAmount,
    percentOfCashBack: tier.percentOfCashBack,
    accumulationAmount: tier.accumulationAmount
  });

  return {
    bill,
    note,
    totalAmount,
    billDate,
    tier,
    earnedPoint,
    merchantId: merchant.merchantId
  };
};

const insertPointInTransaction = async ({ connection, member, merchantId, pointInPayload }) => {
  await connection.beginTransaction();

  const [transactionResult] = await connection.execute(
    'INSERT INTO transaction (memberId, merchantId, bill, totalAmount, billDate, note, syncType) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [member.id, merchantId, pointInPayload.bill, pointInPayload.totalAmount, pointInPayload.billDate, pointInPayload.note, 'api']
  );

  await connection.execute(
    'INSERT INTO points (transactionId, memberId, merchantId, tierId, pointIn, pointOut, transactionDate, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      transactionResult.insertId,
      member.id,
      merchantId,
      pointInPayload.tier.id,
      pointInPayload.earnedPoint,
      0,
      pointInPayload.billDate,
      pointInPayload.note
    ]
  );

  await connection.commit();

  return {
    transactionId: transactionResult.insertId,
    merchantId,
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      tierId: member.tierId
    },
    tier: {
      id: pointInPayload.tier.id,
      name: pointInPayload.tier.name,
      percentOfCashBack: Number(pointInPayload.tier.percentOfCashBack),
      accumulationAmount: Number(pointInPayload.tier.accumulationAmount)
    },
    transaction: {
      bill: pointInPayload.bill,
      totalAmount: pointInPayload.totalAmount,
      billDate: pointInPayload.billDate,
      note: pointInPayload.note,
      syncType: 'api'
    },
    points: {
      pointIn: pointInPayload.earnedPoint,
      pointOut: 0
    }
  };
};

const createTransactionPoint = async ({ token, payload }) => {
  if (!token || !token.trim()) {
    throw createHttpError('Token header is required', 401);
  }

  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    const merchant = await getMerchantByToken(connection, token);
    const member = await resolveMemberByIdentifier(connection, { id: payload.memberId });
    const pointInPayload = await buildPointInPayload({
      connection,
      merchant,
      member,
      payload
    });
    const result = await insertPointInTransaction({
      connection,
      member,
      merchantId: merchant.merchantId,
      pointInPayload
    });

    return {
      ...result,
      token: {
        userId: merchant.userId
      }
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_rollbackError) {
      // Ignore rollback error and surface the original failure.
    }

    throw error;
  } finally {
    connection.release();
  }
};

const createTransactionPointByPosUser = async ({ posUserId, merchantId, payload, memberIdentifier, io }) => {
  if (!posUserId) {
    throw createHttpError('POS user is required', 401);
  }

  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    const merchant = await resolveMerchantByAccess(connection, { posUserId, merchantId });
    const member = await resolveMemberByIdentifier(connection, memberIdentifier || {}, { autoCreateByPhone: true });
    const pointInPayload = await buildPointInPayload({
      connection,
      merchant,
      member,
      payload
    });

    const result = await insertPointInTransaction({
      connection,
      member,
      merchantId: merchant.merchantId,
      pointInPayload
    });

    if (io && member.id) {
      io.to(`member:${member.id}`).emit('point:in', {
        transactionId: result.transactionId,
        pointIn: result.points.pointIn,
        bill: result.transaction.bill,
        totalAmount: result.transaction.totalAmount,
        tier: result.tier.name,
        timestamp: new Date().toISOString()
      });
    }

    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_rollbackError) {
      // Ignore rollback error and surface the original failure.
    }

    throw error;
  } finally {
    connection.release();
  }
};

const getTotalPoints = async (memberId) => {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    const [result] = await connection.execute(
      'SELECT COALESCE(SUM(pointIn), 0) AS totalPointIn, COALESCE(SUM(pointOut), 0) AS totalPointOut FROM points WHERE memberId = ? AND archived = 0 AND presence = 1',
      [memberId]
    );

    if (!result || result.length === 0) {
      return {
        memberId,
        balancePoint: 0
      };
    }

    const summary = result[0];
    const balancePoint = Number(summary.totalPointIn) - Number(summary.totalPointOut);

    return {
      memberId,
      balancePoint
    };
  } finally {
    connection.release();
  }
};

const getPointHistory = async (memberId) => {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.execute(
      'SELECT id, transactionId, merchantId, tierId, pointIn, pointOut, transactionDate, note FROM points WHERE memberId = ? AND archived = 0 ORDER BY transactionDate DESC',
      [memberId]
    );

    return rows;
  } finally {
    connection.release();
  }
};

const getPointHistoryToday = async (memberId) => {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.execute(
      'SELECT id, transactionId, merchantId, tierId, pointIn, pointOut, transactionDate, note FROM points WHERE memberId = ? AND archived = 0 AND DATE(transactionDate) = CURDATE() ORDER BY transactionDate DESC',
      [memberId]
    );

    return rows;
  } finally {
    connection.release();
  }
};

const findMemberByIdentifier = async (identifier) => {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    return await resolveMemberByIdentifier(connection, identifier || {});
  } finally {
    connection.release();
  }
};

module.exports = {
  createTransactionPoint,
  createTransactionPointByPosUser,
  getTotalPoints,
  getPointHistory,
  getPointHistoryToday,
  findMemberByIdentifier
};