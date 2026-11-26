/**
 * Regression test for `members.id` being VARCHAR(50) without AUTO_INCREMENT.
 *
 * Covers: ID generator shape (0000 + year + 12 digits), register after an
 * Igourmate-style imported member exists, sequential IDs, duplicate email guard,
 * member login, and `points.memberId` accepting a 20-digit code.
 * Every row created here is deleted at the end.
 *
 * Usage: node scripts/test-member-id.js
 */
require('../src/config/loadEnv');

const bcrypt = require('bcryptjs');
const { query } = require('../src/config/db');
const { buildMemberId } = require('../src/helpers/memberId');
const authService = require('../src/modules/membership/auth.service');
const pointService = require('../src/modules/membership/point.service');

const ACTOR_EMAIL_DOMAIN = 'member-id-test.local';
const IMPORTED_ID = '00002024000000009999';

let passed = 0;
const createdIds = [];
const createdPhones = [];
const createdBills = [];

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }

  passed += 1;
  console.log(`ok ${passed} - ${message}`);
};

const stamp = Date.now();
const emailA = `member-a-${stamp}@${ACTOR_EMAIL_DOMAIN}`;
const emailB = `member-b-${stamp}@${ACTOR_EMAIL_DOMAIN}`;
const currentYear = new Date().getFullYear();

const cleanup = async () => {
  const ids = createdIds.concat([IMPORTED_ID]);

  for (const bill of createdBills) {
    // eslint-disable-next-line no-await-in-loop
    await query('DELETE FROM transaction WHERE bill = ?', [bill]);
  }

  // Auto-create member by phone berjalan di luar transaksi point: kalau proses point
  // gagal, member-nya tetap ada. Hapus lewat phone supaya sisa data tetap bersih.
  for (const phone of createdPhones) {
    // eslint-disable-next-line no-await-in-loop
    await query('DELETE FROM points WHERE memberId IN (SELECT id FROM members WHERE phone = ?)', [phone]);
    // eslint-disable-next-line no-await-in-loop
    await query('DELETE FROM members_logs WHERE userId IN (SELECT id FROM members WHERE phone = ?)', [phone]);
    // eslint-disable-next-line no-await-in-loop
    await query('DELETE FROM members WHERE phone = ?', [phone]);
  }

  // Log untuk percobaan register dengan email duplikat memakai userId 0, jadi tidak
  // ikut terhapus lewat daftar id. Bersihkan lewat domain email test.
  await query('DELETE FROM members_logs WHERE note LIKE ?', [`%${ACTOR_EMAIL_DOMAIN}%`]);

  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    await query('DELETE FROM points WHERE memberId = ?', [id]);
    // eslint-disable-next-line no-await-in-loop
    await query('DELETE FROM members_logs WHERE userId = ?', [id]);
    // eslint-disable-next-line no-await-in-loop
    await query('DELETE FROM members WHERE id = ?', [id]);
  }

  console.log('info - test members, points and logs were removed');
};

const start = async () => {
  try {
    assert(
      buildMemberId(2026, 1) === '00002026000000000001',
      'buildMemberId memakai format 0000 + tahun + 12 digit'
    );
    assert(buildMemberId(2026, 1).length === 20, 'ID member panjangnya 20 karakter');

    // Member hasil import DBF Igourmate: id = phone = email = name = kode 20 digit.
    const placeholderHash = await bcrypt.hash('imported-placeholder', 4);

    await query(
      `INSERT INTO members (id, phone, email, name, password_hash, verified, activated)
       VALUES (?, ?, ?, ?, ?, 0, 0)`,
      [IMPORTED_ID, IMPORTED_ID, `${IMPORTED_ID}@import.local`, IMPORTED_ID, placeholderHash]
    );

    const importedRows = await query('SELECT id FROM members WHERE id = ?', [IMPORTED_ID]);
    assert(importedRows.length === 1, 'member hasil import 20 digit bisa disimpan apa adanya');

    const memberA = await authService.register({
      name: 'Member Id Test A',
      email: emailA,
      password: 'secret123'
    });
    createdIds.push(memberA.id);

    assert(/^\d{20}$/.test(memberA.id), `register menghasilkan ID 20 digit (${memberA.id})`);
    assert(
      memberA.id.startsWith(`0000${currentYear}`),
      `ID register memakai prefix 0000 + tahun berjalan (${currentYear})`
    );
    assert(memberA.id !== IMPORTED_ID, 'ID register tidak bentrok dengan kode import');

    const registeredRows = await query('SELECT phone FROM members WHERE id = ?', [memberA.id]);
    assert(
      registeredRows.length === 1 && registeredRows[0].phone === memberA.id,
      'registrasi tanpa nomor HP memakai ID member sebagai phone'
    );

    const memberB = await authService.register({
      name: 'Member Id Test B',
      email: emailB,
      password: 'secret123'
    });
    createdIds.push(memberB.id);

    assert(memberB.id !== memberA.id, 'registrasi kedua mendapat ID berbeda');
    assert(
      Number(memberB.id.slice(8)) === Number(memberA.id.slice(8)) + 1,
      'nomor urut ID register berjalan (MAX + 1)'
    );

    const login = await authService.login({ email: emailA, password: 'secret123' });
    assert(Boolean(login.token) && login.member.id === memberA.id, 'member hasil register bisa login');

    let duplicateError = null;

    try {
      await authService.register({ name: 'Member Id Test A', email: emailA, password: 'secret123' });
    } catch (error) {
      duplicateError = error;
    }

    assert(
      duplicateError && duplicateError.statusCode === 409,
      'email duplikat ditolak dengan 409'
    );

    await query(
      `INSERT INTO points (transactionId, memberId, merchantId, tierId, pointIn, pointOut, note)
       VALUES (0, ?, 1, 1, 1000, 0, ?)`,
      [memberA.id, 'memberId varchar test']
    );

    const pointRows = await query(
      'SELECT memberId, pointIn FROM points WHERE memberId = ? AND note = ?',
      [memberA.id, 'memberId varchar test']
    );
    assert(
      pointRows.length === 1 && pointRows[0].memberId === memberA.id,
      'points.memberId menerima kode 20 digit untuk member hasil import'
    );

    const guestPhone = `0899${String(stamp).slice(-8)}`;
    const guestBill = `MEMBER-ID-TEST-${stamp}`;
    createdPhones.push(guestPhone);

    const pointResult = await pointService.createTransactionPointByPosUser({
      posUserId: 1,
      merchantId: 1,
      memberIdentifier: { phone: guestPhone },
      payload: {
        bill: guestBill,
        totalAmount: 100000,
        billDate: new Date().toISOString(),
        note: 'member id test'
      }
    });

    createdBills.push(guestBill);
    createdIds.push(pointResult.member.id);

    assert(
      /^\d{20}$/.test(pointResult.member.id),
      `auto-create member by phone memakai ID 20 digit (${pointResult.member.id})`
    );
    assert(
      pointResult.member.phone === guestPhone,
      'auto-create member menyimpan nomor HP asli (bukan ID)'
    );
    assert(
      Number(pointResult.transactionId) > 0 && Number(pointResult.points.pointIn) > 0,
      'point masuk tersimpan untuk member yang baru dibuat'
    );
  } finally {
    await cleanup();
  }

  console.log(`\n${passed} assertions passed`);
};

start()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('\nmember id test failed:', error.message);

    try {
      await cleanup();
    } catch (cleanupError) {
      console.error('cleanup failed:', cleanupError.message);
    }

    process.exit(1);
  });
