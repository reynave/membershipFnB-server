require("./loadEnv");

const mysql = require("mysql2/promise");

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: toNumber(process.env.DB_PORT, 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "membership_db"
};

let pool;

const ensureDatabaseExists = async () => {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
  await connection.end();
};

const getPool = async () => {
  if (!pool) {
    await ensureDatabaseExists();

    pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  return pool;
};

const query = async (sql, params = []) => {
  const activePool = await getPool();
  const [rows] = await activePool.execute(sql, params);
  return rows;
};

const initDatabase = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS members (
      -- id mengikuti kode member POS/DBF (20 digit) sehingga VARCHAR, bukan AUTO_INCREMENT.
      -- INSERT member baru wajib memakai helper src/helpers/memberId.js.
      id VARCHAR(50) NOT NULL DEFAULT '',
      tierId TINYINT UNSIGNED NOT NULL DEFAULT 0,
      phone VARCHAR(50) NOT NULL DEFAULT '0',
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL,
      birthdate DATE NOT NULL DEFAULT '1990-01-01',
      password_hash VARCHAR(255) NOT NULL,
      status TINYINT NOT NULL DEFAULT 1,
      verified TINYINT NOT NULL DEFAULT 0,
      activated TINYINT NOT NULL DEFAULT 0,
      presence TINYINT NOT NULL DEFAULT 1,
      inputDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updateDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_members_email (email),
      UNIQUE KEY phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

module.exports = {
  query,
  initDatabase,
  getPool
};
