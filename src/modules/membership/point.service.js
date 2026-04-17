const { getPool } = require('../../config/db');

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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

const createTransactionPoint = async ({ token, payload }) => {
  if (!token || !token.trim()) {
    throw createHttpError('Token header is required', 401);
  }

  const memberId = String(payload.memberId || '').trim();
  const bill = String(payload.bill || '').trim();
  const note = payload.note ? String(payload.note).trim() : '';
  const totalAmount = normalizeAmount(payload.totalAmount);
  const billDate = normalizeBillDate(payload.billDate);
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    const [merchantTokens] = await connection.execute(
      'SELECT userId, merchantId, token FROM users_token WHERE token = ? LIMIT 1',
      [token.trim()]
    );

    if (merchantTokens.length === 0) {
      throw createHttpError('Invalid token', 401);
    }

    const merchantToken = merchantTokens[0];
    const [members] = await connection.execute(
      'SELECT id, tierId, name, email FROM members WHERE id = ? AND status = 1 AND presence = 1 LIMIT 1',
      [memberId]
    );

    if (members.length === 0) {
      throw createHttpError('Member not found or inactive', 404);
    }

    const member = members[0];

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

    await connection.beginTransaction();

    const [transactionResult] = await connection.execute(
      'INSERT INTO transaction (memberId, merchantId, bill, totalAmount, billDate, note, syncType) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [memberId, merchantToken.merchantId, bill, totalAmount, billDate, note, 'api']
    );

    await connection.execute(
      'INSERT INTO points (transactionId, memberId, merchantId, tierId, pointIn, pointOut, transactionDate, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        transactionResult.insertId,
        member.id,
        merchantToken.merchantId,
        tier.id,
        earnedPoint,
        0,
        billDate,
        note
      ]
    );

    await connection.commit();

    return {
      transactionId: transactionResult.insertId,
      merchantId: merchantToken.merchantId,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        tierId: member.tierId
      },
      tier: {
        id: tier.id,
        name: tier.name,
        percentOfCashBack: Number(tier.percentOfCashBack),
        accumulationAmount: Number(tier.accumulationAmount)
      },
      transaction: {
        bill,
        totalAmount,
        billDate,
        note,
        syncType: 'api'
      },
      points: {
        pointIn: earnedPoint,
        pointOut: 0
      },
      token: {
        userId: merchantToken.userId
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
        totalPointIn: 0,
        totalPointOut: 0,
        balancePoint: 0
      };
    }

    const summary = result[0];
    const balancePoint = Number(summary.totalPointIn) - Number(summary.totalPointOut);

    return {
      memberId,
      totalPointIn: Number(summary.totalPointIn),
      totalPointOut: Number(summary.totalPointOut),
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

module.exports = {
  createTransactionPoint,
  getTotalPoints,
  getPointHistory
};