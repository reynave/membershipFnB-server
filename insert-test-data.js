const { getPool } = require('./src/config/db');

const insertTestData = async () => {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();

    console.log('Inserting test redeem codes...');

    // Insert test redeem codes
    const result = await connection.execute(
      `INSERT INTO members_code (memberId, redeemCode, expDateTime, presence) 
       VALUES (1, 'TEST-REDEEM-001', '2026-12-31 23:59:59', 1),
               (1, 'BLUE-CODE-100', DATE_ADD(NOW(), INTERVAL 30 DAY), 1),
               (5, 'EXPIRED-CODE', '2025-01-01 00:00:00', 1)`
    );

    console.log('✓ Test data inserted successfully');
    console.log(`Inserted rows: ${result[0].affectedRows}`);

    await connection.release();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error inserting test data:', error.message);
    process.exit(1);
  }
};

insertTestData();
