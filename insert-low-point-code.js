const { getPool } = require('./src/config/db');

const insertTestCode = async () => {
  const pool = await getPool();
  const conn = await pool.getConnection();
  const [r] = await conn.execute(
    'INSERT INTO members_code (memberId, redeemCode, expDateTime, presence) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), 1)',
    [5, 'LOW-POINT-CODE']
  );
  console.log('✓ Inserted redeem code for member 5 (balance: 30000 points)');
  await conn.release();
  process.exit(0);
};

insertTestCode();
