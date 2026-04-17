const { getPool } = require('./src/config/db');

const verifyDatabase = async () => {
  const pool = await getPool();
  const conn = await pool.getConnection();

  console.log('=== VERIFYING REDEEM TRANSACTION DATA ===\n');

  // Check members_code status
  const [codes] = await conn.execute(
    'SELECT id, memberId, redeemCode, presence FROM members_code WHERE redeemCode IN (?, ?, ?)',
    ['TEST-REDEEM-001', 'BLUE-CODE-100', 'LOW-POINT-CODE']
  );
  console.log('Members Code Status:');
  codes.forEach(code => {
    console.log(`  - ${code.redeemCode} (member ${code.memberId}): presence=${code.presence} ${code.presence === 0 ? '✓ USED' : '● UNUSED'}`);
  });

  // Check points table for redeems
  const [pointsData] = await conn.execute(
    'SELECT id, memberId, pointOut, transactionId FROM points WHERE transactionId IN (?, ?) ORDER BY id DESC',
    ['REDEEM-TRX-002', 'REDEEM-TRX-005']
  );
  console.log('\nPoints Table (Redeems):');
  pointsData.forEach(p => {
    console.log(`  - transactionId: ${p.transactionId}, memberId: ${p.memberId}, pointOut: ${p.pointOut}`);
  });

  // Check transaction table for redeems
  const [transData] = await conn.execute(
    'SELECT id, memberId, totalRedeem, redeemCode, note FROM transaction WHERE redeemCode IN (?, ?) ORDER BY id DESC',
    ['BLUE-CODE-100', 'LOW-POINT-CODE']
  );
  console.log('\nTransaction Table (Redeems):');
  transData.forEach(t => {
    const approvalCode = t.note.match(/Approval Code: ([A-F0-9]+)/)?.[1] || 'N/A';
    console.log(`  - memberId: ${t.memberId}, redeemCode: ${t.redeemCode}, totalRedeem: ${t.totalRedeem}`);
    console.log(`    approvalCode: ${approvalCode}`);
  });

  await conn.release();
  process.exit(0);
};

verifyDatabase();
