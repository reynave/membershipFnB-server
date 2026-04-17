require('../../config/loadEnv');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');

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

  return {
    token,
    member: sanitizeMember(member)
  };
};

module.exports = {
  register,
  login
};
