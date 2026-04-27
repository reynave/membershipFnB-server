require('../../config/loadEnv');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');

const addMemberLog = async (userId, note, success = 0) => {
  try {
    // try insert with success column first (some schemas include it)
    await query(
      'INSERT INTO members_logs (userId, note, success) VALUES (?, ?, ?)',
      [userId || 0, note, success ? 1 : 0]
    );
  } catch (err) {
    try {
      // fallback to insert without success column
      await query('INSERT INTO members_logs (userId, note) VALUES (?, ?)', [userId || 0, note]);
    } catch (e) {
      // ignore logging errors
    }
  }
};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const jwtSecret = process.env.JWT_SECRET || 'local-dev-secret';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';
const bcryptSaltRounds = toNumber(process.env.BCRYPT_SALT_ROUNDS, 10);

const sanitizeMember = (member) => ({
  id: member.id,
  name: member.name,
  email: member.email,
  createdAt: member.created_at
});

const register = async ({ name, email, password }) => {
  const existing = await query('SELECT id FROM members WHERE email = ? LIMIT 1', [email]);

  if (existing.length > 0) {
    try {
      await addMemberLog(0, `Register failed - email already registered - ${email}`);
    } catch (e) {}
    const error = new Error('Email already registered');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);

  await query('INSERT INTO members (name, email, password_hash) VALUES (?, ?, ?)', [
    name,
    email,
    passwordHash
  ]);

  const rows = await query(
    'SELECT id, name, email, inputDate AS created_at FROM members WHERE email = ? LIMIT 1',
    [email]
  );

  try {
    await addMemberLog(rows[0].id, `Register success - email: ${email}`, 1);
  } catch (e) {}

  return sanitizeMember(rows[0]);
};

const login = async ({ email, password }) => {
  const rows = await query(
    'SELECT id, name, email, password_hash, inputDate AS created_at FROM members WHERE email = ? AND status = 1 AND presence = 1 LIMIT 1',
    [email]
  );

  if (rows.length === 0) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const member = rows[0];
  const matched = await bcrypt.compare(password, member.password_hash);

  if (!matched) {
    try {
      await addMemberLog(member.id, `Login failed - wrong password - email: ${email}`);
    } catch (e) {}
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign(
    {
      email: member.email,
      name: member.name,
      role: 'membership'
    },
    jwtSecret,
    {
      subject: String(member.id),
      expiresIn: jwtExpiresIn
    }
  );

  try {
    await addMemberLog(member.id, `Login success - email: ${email}`, 1);
  } catch (e) {}

  return {
    token,
    member: sanitizeMember(member)
  };
};

module.exports = {
  register,
  login
};
