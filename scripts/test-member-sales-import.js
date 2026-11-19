/**
 * Smoke test for the "Member Sales Listing Report" import.
 *
 * Runs against the configured database using the fixture in ../DATA.
 * Every batch (and its transaction rows) created here is removed at the end.
 *
 * Usage: node scripts/test-member-sales-import.js
 */
require('../src/config/loadEnv');

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/db');
const service = require('../src/modules/import/member-sales.service');

const FIXTURE = path.resolve(__dirname, '../../DATA/MEMBER Sales Listing Report.csv');
const FILE_NAME = 'MEMBER Sales Listing Report.csv';

const EXPECTED = {
  members: 189,
  checks: 274,
  items: 2617,
  warnings: 196,
  itemSales: 246408200,
  itemTotal: 267153200,
  grossTotal: 274137917
};

let passed = 0;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }

  passed += 1;
  console.log(`ok ${passed} - ${message}`);
};

const expectRejection = async (label, executor, expectedStatus) => {
  try {
    await executor();
  } catch (error) {
    assert(
      error.statusCode === expectedStatus,
      `${label} rejected with ${expectedStatus} (got ${error.statusCode || error.message})`
    );
    return error;
  }

  throw new Error(`FAILED: ${label} was expected to fail with ${expectedStatus}`);
};

const purgeBatch = async (batchId) => {
  await query('DELETE FROM `transaction` WHERE import_batch_id = ?', [batchId]);
  await query('DELETE FROM import_line WHERE batch_id = ?', [batchId]);
  await query('DELETE FROM import_member WHERE batch_id = ?', [batchId]);
  await query('DELETE FROM import_batch WHERE id = ?', [batchId]);
};

const run = async () => {
  if (!fs.existsSync(FIXTURE)) {
    throw new Error(`Fixture not found: ${FIXTURE}`);
  }

  const buffer = fs.readFileSync(FIXTURE);
  const createdBatches = [];

  try {
    const preview = await service.createPreview({ buffer, fileName: FILE_NAME, actor: 'smoke-test' });
    createdBatches.push(preview.batchId);

    assert(preview.status === 'PREVIEW', 'upload stores the report as PREVIEW');
    assert(preview.totals.members === EXPECTED.members, `preview has ${EXPECTED.members} members`);
    assert(preview.totals.checks === EXPECTED.checks, `preview has ${EXPECTED.checks} checks`);
    assert(preview.totals.items === EXPECTED.items, `preview has ${EXPECTED.items} item rows`);
    assert(preview.totals.itemSales === EXPECTED.itemSales, `preview Item Sales total is ${EXPECTED.itemSales}`);
    assert(preview.totals.itemTotal === EXPECTED.itemTotal, `preview Item Total total is ${EXPECTED.itemTotal}`);
    assert(preview.errorCount === 0, 'preview has no ERROR row');
    assert(preview.warningCount === EXPECTED.warnings, `preview has ${EXPECTED.warnings} WARNING rows`);
    assert(preview.canCommit === true, 'preview is flagged as committable');

    const memberMismatch = await query(
      `SELECT COUNT(*) AS total
       FROM import_member
       WHERE batch_id = ?
         AND (c_item_qty <> f_item_qty OR c_item_sales <> f_item_sales
              OR c_item_total <> f_item_total OR c_check_count <> f_check_count)`,
      [preview.batchId]
    );
    assert(Number(memberMismatch[0].total) === 0, 'every member footer matches its item rows');

    const repeatedCheck = await query(
      `SELECT member_id, check_no, COUNT(DISTINCT check_seq) AS seqs
       FROM import_line
       WHERE batch_id = ? AND check_no IS NOT NULL
       GROUP BY member_id, check_no
       HAVING seqs > 1`,
      [preview.batchId]
    );
    assert(repeatedCheck.length === 5, `5 members reuse a Check# on different days (got ${repeatedCheck.length})`);

    const warningLines = await service.getBatchLines(preview.batchId, { severity: 'WARNING', pageSize: 200 });
    assert(warningLines.total === EXPECTED.warnings, `line filter returns ${EXPECTED.warnings} WARNING rows`);
    assert(
      warningLines.lines.every((line) => line.totalOk === false),
      'WARNING rows are the rows where Item Total <> Item Sales - Item Disc'
    );

    const errorLines = await service.getBatchLines(preview.batchId, { severity: 'ERROR' });
    assert(errorLines.total === 0, 'line filter returns no ERROR row');

    const firstPage = await service.getBatchLines(preview.batchId, { page: 1, pageSize: 50 });
    assert(firstPage.lines.length === 50 && firstPage.totalPages === Math.ceil(EXPECTED.items / 50), 'line pagination works');


    const firstCommit = await service.commitBatch(preview.batchId, { actor: 'smoke-test', amountBasis: 'item_total' });
    assert(firstCommit.status === 'COMMITTED', 'commit marks the batch as COMMITTED');
    assert(
      firstCommit.transactionsInserted === EXPECTED.checks,
      `commit writes ${EXPECTED.checks} transaction rows`
    );
    assert(
      firstCommit.totalAmount === EXPECTED.itemTotal,
      `item_total basis writes ${EXPECTED.itemTotal} total amount (got ${firstCommit.totalAmount})`
    );

    const inserted = await query(
      'SELECT COUNT(*) AS total FROM `transaction` WHERE import_batch_id = ?',
      [preview.batchId]
    );
    assert(Number(inserted[0].total) === EXPECTED.checks, 'transaction rows are stored in the database');
    assert(
      typeof firstCommit.merchantMatched === 'boolean' && Array.isArray(firstCommit.warnings),
      'commit reports how the outlet was mapped to a merchant'
    );

    const storedMerchants = await query(
      'SELECT merchantId, COUNT(*) AS total FROM `transaction` WHERE import_batch_id = ? GROUP BY merchantId',
      [preview.batchId]
    );
    assert(
      storedMerchants.length === 1 && Number(storedMerchants[0].merchantId) === firstCommit.merchantId,
      'transaction rows use the resolved merchantId'
    );

    await expectRejection(
      'second commit of the same batch',
      () => service.commitBatch(preview.batchId, { actor: 'smoke-test' }),
      409
    );

    const duplicate = await expectRejection(
      're-upload of an already committed report',
      () => service.createPreview({ buffer, fileName: FILE_NAME, actor: 'smoke-test' }),
      409
    );
    assert(
      Array.isArray(duplicate.details && duplicate.details.duplicates) && duplicate.details.duplicates.length > 0,
      'duplicate upload returns the conflicting batch ids'
    );

    await expectRejection('delete of a COMMITTED batch', () => service.deleteBatch(preview.batchId), 409);

    // Remove the committed batch and its transactions so the next amount basis can be
    // tested without colliding with the (deterministic) bill numbers.
    await purgeBatch(preview.batchId);
    console.log('info - first committed batch was purged before testing other amount bases');

    const salesPreview = await service.createPreview({
      buffer,
      fileName: FILE_NAME,
      actor: 'smoke-test',
      override: true
    });
    createdBatches.push(salesPreview.batchId);
    const salesCommit = await service.commitBatch(salesPreview.batchId, {
      actor: 'smoke-test',
      amountBasis: 'item_sales'
    });
    assert(
      salesCommit.totalAmount === EXPECTED.itemSales,
      `item_sales basis writes ${EXPECTED.itemSales} total amount (got ${salesCommit.totalAmount})`
    );
    await purgeBatch(salesPreview.batchId);

    const grossPreview = await service.createPreview({
      buffer,
      fileName: FILE_NAME,
      actor: 'smoke-test',
      override: true
    });
    createdBatches.push(grossPreview.batchId);

    await expectRejection(
      'unknown merchantId',
      () => service.commitBatch(grossPreview.batchId, { amountBasis: 'item_total', merchantId: 99999999 }),
      404
    );

    const [knownMerchant] = await query('SELECT id FROM merchant ORDER BY id ASC LIMIT 1');
    const grossOptions = { actor: 'smoke-test', amountBasis: 'gross_total' };

    if (knownMerchant) {
      grossOptions.merchantId = Number(knownMerchant.id);
    }

    const grossCommit = await service.commitBatch(grossPreview.batchId, grossOptions);
    assert(
      grossCommit.totalAmount === EXPECTED.grossTotal,
      `gross_total basis writes ${EXPECTED.grossTotal} total amount (got ${grossCommit.totalAmount})`
    );

    if (knownMerchant) {
      assert(
        grossCommit.merchantMatched === true &&
          grossCommit.merchantId === Number(knownMerchant.id) &&
          grossCommit.warnings.length === 0,
        'explicit merchantId is used for the committed transactions'
      );
    }

    await expectRejection(
      'unsupported amountBasis',
      () => service.commitBatch(grossPreview.batchId, { amountBasis: 'net_sales' }),
      422
    );

    const deletable = await service.createPreview({
      buffer,
      fileName: FILE_NAME,
      actor: 'smoke-test',
      override: true
    });
    createdBatches.push(deletable.batchId);
    const deleted = await service.deleteBatch(deletable.batchId);
    assert(deleted.deleted === true, 'PREVIEW batch can be deleted');
    await expectRejection('detail of a deleted batch', () => service.getBatch(deletable.batchId), 404);
  } finally {
    for (const batchId of createdBatches) {
      // eslint-disable-next-line no-await-in-loop
      await purgeBatch(batchId);
    }

    console.log('info - test batches and their transaction rows were removed');
  }

  console.log(`\n${passed} assertions passed`);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\ntest failed:', error.message);
    process.exit(1);
  });
