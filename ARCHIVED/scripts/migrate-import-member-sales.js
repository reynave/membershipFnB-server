/**
 * Migration for the "Member Sales Listing Report" staging tables.
 *
 * Adds import_line.check_seq, needed because the POS resets Check# every day:
 * the same check number can appear more than once for one member in a period
 * (fixture: 274 checks but only 269 unique member+check_no pairs). check_seq is
 * the running number of the check token inside the member block, so each visit
 * stays a separate transaction when the batch is committed.
 *
 * Usage: node scripts/migrate-import-member-sales.js
 */
require('../src/config/loadEnv');

const { getPool } = require('../src/config/db');

const columnExists = async (pool, table, column) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );

  return rows.length > 0;
};

const indexExists = async (pool, table, indexName) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [table, indexName]
  );

  return rows.length > 0;
};

const run = async () => {
  const pool = await getPool();

  const hasTable = await pool.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'import_line' LIMIT 1`
  );

  if (hasTable[0].length === 0) {
    throw new Error('Table import_line does not exist. Run AI-agent/staging-member-sales.sql first.');
  }

  if (!(await columnExists(pool, 'import_line', 'check_seq'))) {
    await pool.query(
      `ALTER TABLE import_line
       ADD COLUMN check_seq INT UNSIGNED NULL
       COMMENT 'urutan Check# dalam blok member (Check# POS reset per hari)'
       AFTER check_no`
    );
    console.log('added import_line.check_seq');
  } else {
    console.log('import_line.check_seq already exists');
  }

  if (!(await indexExists(pool, 'import_line', 'ix_line_check_seq'))) {
    await pool.query('ALTER TABLE import_line ADD KEY ix_line_check_seq (batch_id, member_id, check_seq)');
    console.log('added index ix_line_check_seq');
  } else {
    console.log('index ix_line_check_seq already exists');
  }

  // Traceability + rollback per import batch on the destination table.
  if (!(await columnExists(pool, 'transaction', 'import_batch_id'))) {
    await pool.query(
      `ALTER TABLE \`transaction\`
       ADD COLUMN import_batch_id BIGINT UNSIGNED NULL
       COMMENT 'import_batch.id when the row was stored by the report import'
       AFTER syncType`
    );
    console.log('added transaction.import_batch_id');
  } else {
    console.log('transaction.import_batch_id already exists');
  }

  if (!(await indexExists(pool, 'transaction', 'ix_transaction_import_batch'))) {
    await pool.query('ALTER TABLE `transaction` ADD KEY ix_transaction_import_batch (import_batch_id)');
    console.log('added index ix_transaction_import_batch');
  } else {
    console.log('index ix_transaction_import_batch already exists');
  }

  await pool.end();
  console.log('migration finished');
};

run().catch((error) => {
  console.error('migration failed:', error.message);
  process.exit(1);
});
