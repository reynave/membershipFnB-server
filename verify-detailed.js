const { getPool } = require('./src/config/db');

const verifyDetailed = async () => {
  const pool = await getPool();
  const conn = await pool.getConnection();

  console.log('=== DETAILED REDEEM VERIFICATION ===\n');

  // Check last 5 points entries with pointOut
  const [recentRedeems] = await conn.execute(
    'SELECT id, transactionId, memberId, pointOut, note FROM points WHERE pointOut > 0 ORDER BY id DESC LIMIT 5'
  );
  console.log('Recent Redeem Transactions (pointOut > 0):');
  recentRedeems.forEach(r => {
    console.log(`  ID: ${r.id}, TransactionId: ${r.transactionId}, Member: ${r.memberId}, Points: ${r.pointOut}`);
    console.log(`  Note: ${r.note}`);
  });

  // Check last 5 transaction entries with totalRedeem
  const [recentTransactions] = await conn.execute(
    'SELECT id, memberId, totalRedeem, redeemCode, note FROM transaction WHERE totalRedeem > 0 ORDER BY id DESC LIMIT 5'
  );
  console.log('\nRecent Redeem Transactions (totalRedeem > 0):');
  recentTransactions.forEach(t => {
    console.log(`  ID: ${t.id}, Member: ${t.memberId}, TotalRedeem: ${t.totalRedeem}`);
    console.log(`  RedeemCode: ${t.redeemCode}`);
    console.log(`  Note: ${t.note}`);
  });

  // Check members_code usage status
  const [allCodes] = await conn.execute(
    'SELECT id, memberId, redeemCode, presence FROM members_code ORDER BY id DESC LIMIT 5'
  );
  console.log('\nRecent Redeem Codes:');
  allCodes.forEach(c => {
    const status = c.presence === 0 ? '✓ USED' : '● UNUSED';
    console.log(`  ${c.redeemCode} (Member ${c.memberId}): ${status}`);
  });

  await conn.release();
  process.exit(0);
};

verifyDetailed();
