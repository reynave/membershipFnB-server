require("../../config/loadEnv");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../../config/db");

const addUserLog = async (userId, note, success = 0) => {
  try {
    await query(
      "INSERT INTO users_logs (userId, note, success) VALUES (?, ?, ?)",
      [userId || 0, note, success ? 1 : 0]
    );
  } catch (err) {
    // ignore logging errors to not break auth flow
  }
};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const jwtSecret = process.env.JWT_SECRET || "local-dev-secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1d";
const bcryptSaltRounds = toNumber(process.env.BCRYPT_SALT_ROUNDS, 10);

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.created_at
});

const register = async ({ name, email, password }) => {
  const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);

  if (existing.length > 0) {
      await addUserLog(0, `Register failed - email already registered - ${email}`);
      const error = new Error("Email already registered");
      error.statusCode = 409;
      throw error;
  }

  const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);

  await query(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    [name, email, passwordHash]
  );

  const users = await query(
    "SELECT id, name, email, inputDate AS created_at FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  try {
    await addUserLog(users[0].id, `Register success - email: ${email}`, 1);
  } catch (e) {}

  return sanitizeUser(users[0]);
};

const login = async ({ email, password }) => {
  const users = await query(
    "SELECT id, name, email, password_hash, inputDate AS created_at FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  if (users.length === 0) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
  }

  const user = users[0];
  const passwordMatched = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatched) {
      await addUserLog(user.id, `Login failed - wrong password - email: ${email}`);
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
  }

  const token = jwt.sign(
    {
      email: user.email,
      name: user.name
    },
    jwtSecret,
    {
      subject: String(user.id),
      expiresIn: jwtExpiresIn
    }
  );

  try {
    await addUserLog(user.id, `Login success - email: ${email}`, 1);
  } catch (e) {}

  return {
    token,
    user: sanitizeUser(user)
  };
};

const getProfile = async (userId) => {
  const users = await query(
    "SELECT id, name, email, inputDate AS created_at FROM users WHERE id = ? LIMIT 1",
    [userId]
  );

  if (users.length === 0) {
    const error = new Error("Member not found");
    error.statusCode = 404;
    throw error;
  }

  return sanitizeUser(users[0]);
};

module.exports = {
  register,
  login,
  getProfile
};
