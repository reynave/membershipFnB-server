/**
 * Service smoke test for the Igourmate DBF import.
 *
 * Reads DATA/dbf/CHECK.DBF, stages it, pages/filters the staged rows, checks the
 * duplicate guard, commits once and verifies the guards. Every batch created
 * here is removed at the end.
 *
 * Usage: node scripts/test-igourmete-import.js
 */
require('../src/config/loadEnv');

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/db');
const { IgourmeteDbfParseError } = require('../src/modules/import/igourmete-dbf.parser');
const service = require('../src/modules/import/igourmete.service');

const FIXTURE = path.resolve(__dirname, '../../DATA/dbf/CHECK.DBF');
const FILE_NAME = 'CHECK.DBF';
const ACTOR = 'igourmete-smoke-test@example.com';

let passed = 0;
const createdBatches = [];
const createdBills = [];

const pad2 = (value) => String(value).padStart(2, '0');

const formatDateOnly = (value) => {
  if (!(value instanceof Date)) {
    return value ? String(value).slice(0, 10) : null;
  }

  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
};

const formatDateTime = (value) => {
  if (!(value instanceof Date)) {
    return value ? String(value).slice(0, 19).replace('T', ' ') : null;
  }

  return `${formatDateOnly(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(
    value.getSeconds()
  )}`;
};

const purgeTransactions = async () => {
  for (const bill of createdBills) {
    // eslint-disable-next-line no-await-in-loop
    await query('DELETE FROM transaction WHERE syncType = ? AND bill = ?', ['dbf_igourmate', bill]);
  }
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }

  passed += 1;
  console.log(`ok ${passed} - ${message}`);
};

const purgeBatch = async (batchId) => {
  await query('DELETE FROM dbf_igourmete_daily WHERE batchId = ?', [batchId]);
  await query('DELETE FROM dbf_import_batch WHERE id = ?', [batchId]);
};

const create = async (override) =>
  service.createBatch({
    buffer: fs.readFileSync(FIXTURE),
    fileName: FILE_NAME,
    encoding: 'auto',
    actor: ACTOR,
    override
  });

const start = async () => {
  try {
    let parseError = null;

    try {
      await service.createBatch({
        buffer: Buffer.from('this is not a dbf file'),
        fileName: 'broken.dbf',
        encoding: 'auto',
        actor: ACTOR,
        override: true
      });
    } catch (error) {
      parseError = error;
    }

    assert(
      parseError instanceof IgourmeteDbfParseError && parseError.statusCode === 422,
      'a non-DBF upload is rejected with IgourmeteDbfParseError (422)'
    );

    const batch = await create(true);
    createdBatches.push(batch.batchId);

    assert(batch.status === 'STAGED', 'upload stores a STAGED batch');
    assert(batch.dataset === 'DAILY_CHECK', 'CHECK.DBF is detected as DAILY_CHECK');
    assert(batch.encoding === 'windows-1252', 'language driver 0 falls back to windows-1252');
    assert(batch.dbfVersionLabel === 'dBase III', 'DBF version byte 0x03 is dBase III');
    assert(batch.dbfLastUpdated === '2026-11-25', 'DBF header date is normalised to YYYY-MM-DD');
    assert(batch.recordCount === 10 && batch.rowCount === 10, 'header and staged row count are 10');
    assert(batch.errorCount === 0 && batch.warningCount === 0, 'valid rows produce no issues');
    assert(batch.columns.length === 73, 'all 73 DBF field descriptors are stored');
    assert(
      batch.columns[0].name === 'FDATE' && batch.columns[2].name === 'FCHECKUID',
      'field schema keeps DBF names and order'
    );
    assert(batch.notices.length === 1, 'the missing language driver is reported as a notice');
    assert(batch.canCommit === true, 'a clean STAGED batch can be committed');

    const list = await service.listBatches({ status: 'STAGED', pageSize: 100, search: 'CHECK' });
    assert(
      list.batches.some((row) => row.batchId === batch.batchId),
      'listBatches returns the new staging batch'
    );

    const page = await service.getBatchRows(batch.batchId, { page: 1, pageSize: 5 });
    assert(page.total === 10 && page.rows.length === 5, 'staged rows support pagination');
    assert(page.rows[0].rowNo === 1, 'rows are ordered by DBF record number');
    assert(
      page.rows[0].data.FCHECK === '00001' && page.rows[0].data.FDATE === '2026-11-25',
      'row data exposes the DBF fields with normalised dates'
    );
    assert(
      page.rows[0].data.FTIMEOPEN === '2026-11-25 10:29:42',
      'compact DBF time strings are normalised to datetime'
    );
    assert(page.columns.length === 73, 'rows endpoint repeats the field schema');
    assert(
      page.rows[1].member === '00002024000000001498' &&
        page.rows[1].data.FMEMBER === '00002024000000001498',
      'FMEMBER is staged in the member column and in rawJson'
    );

    const warnings = await service.getBatchRows(batch.batchId, { severity: 'WARNING' });
    assert(warnings.total === 0, 'severity filter works');

    const search = await service.getBatchRows(batch.batchId, { search: '00002' });
    assert(
      search.total >= 1 &&
        search.rows.some((row) => row.data.FCHECK === '00002'),
      'search scans the record JSON'
    );

    const projection = await query(
      `SELECT checkUid, member, checkDate, checkNo, checkTot, timeOpen
         FROM dbf_igourmete_daily WHERE batchId = ? AND rowNo = 2`,
      [batch.batchId]
    );
    assert(
      projection.length === 1 &&
        projection[0].checkUid === 'D1504E9A4CA54531980C93C2BDB53D2A' &&
        projection[0].member === '00002024000000001498' &&
        projection[0].checkNo === '00002' &&
        Number(projection[0].checkTot) === 475127,
      'dbf_igourmete_daily is filled from the DBF columns (including FMEMBER)'
    );

    let duplicateError = null;

    try {
      await create(false);
    } catch (error) {
      duplicateError = error;
    }

    assert(
      duplicateError &&
        duplicateError.statusCode === 409 &&
        duplicateError.details.existingBatchId === batch.batchId,
      'uploading the same file twice is rejected with 409'
    );

    const stagingRows = await query(
      `SELECT checkDate, checkNo
         FROM dbf_igourmete_daily
        WHERE batchId = ? AND isDeleted = 0 AND severity <> 'ERROR'
        ORDER BY rowNo ASC, id ASC`,
      [batch.batchId]
    );
    const expectedBills = stagingRows.map(
      (row) => `${formatDateOnly(row.checkDate)}.${row.checkNo}`
    );
    createdBills.push(...expectedBills);

    const billPlaceholders = expectedBills.map(() => '?').join(', ');
    await query(
      `DELETE FROM transaction WHERE syncType = ? AND bill IN (${billPlaceholders})`,
      ['dbf_igourmate', ...expectedBills]
    );

    const commit = await service.commitBatch(batch.batchId, { actor: ACTOR });
    assert(
      commit.inserted === 10 && commit.updated === 0 && commit.skipped === 0,
      'commit reports 10 inserted rows'
    );
    assert(
      commit.transactions &&
        commit.transactions.inserted === 10 &&
        commit.transactions.syncType === 'dbf_igourmate',
      'commit sends the staged rows to transaction with syncType dbf_igourmate'
    );

    const transactionRows = await query(
      `SELECT checkUid, memberId, bill, totalAmount, billDate, syncType
         FROM transaction
        WHERE bill IN (${billPlaceholders})
        ORDER BY bill ASC`,
      expectedBills
    );
    assert(transactionRows.length === 10, 'transaction has one row per staged check');

    const secondTransaction = transactionRows.find(
      (row) => row.bill === expectedBills[1]
    );
    assert(
      secondTransaction &&
        secondTransaction.checkUid === 'D1504E9A4CA54531980C93C2BDB53D2A' &&
        secondTransaction.memberId === '00002024000000001498' &&
        Number(secondTransaction.totalAmount) === 475127 &&
        secondTransaction.syncType === 'dbf_igourmate',
      'transaction fields follow checkUid/memberId/bill/totalAmount mapping'
    );
    assert(
      formatDateTime(secondTransaction.billDate) === formatDateTime(projection[0].timeOpen),
      'transaction.billDate follows dbf_igourmete_daily.timeOpen'
    );

    const committed = await service.getBatch(batch.batchId);
    assert(
      committed.status === 'COMMITTED' && committed.committedAt && committed.canCommit === false,
      'committed batch is no longer STAGED'
    );

    let secondCommitError = null;

    try {
      await service.commitBatch(batch.batchId, { actor: ACTOR });
    } catch (error) {
      secondCommitError = error;
    }

    assert(
      secondCommitError && secondCommitError.statusCode === 409,
      'double commit is rejected with 409'
    );

    let deleteCommittedError = null;

    try {
      await service.deleteBatch(batch.batchId);
    } catch (error) {
      deleteCommittedError = error;
    }

    assert(
      deleteCommittedError && deleteCommittedError.statusCode === 409,
      'a committed batch cannot be deleted with 409'
    );

    const removable = await create(true);
    createdBatches.push(removable.batchId);

    const removed = await service.deleteBatch(removable.batchId);
    assert(removed.deletedRows === 10, 'delete removes the staged rows of a STAGED batch');

    const rowsAfterDelete = await query(
      'SELECT COUNT(*) AS total FROM dbf_igourmete_daily WHERE batchId = ?',
      [removable.batchId]
    );
    assert(Number(rowsAfterDelete[0].total) === 0, 'deleting a batch removes its rows');

    let missingError = null;

    try {
      await service.getBatch(removable.batchId);
    } catch (error) {
      missingError = error;
    }

    assert(missingError && missingError.statusCode === 404, 'a deleted batch returns 404');

  } finally {
    await purgeTransactions();

    for (const batchId of createdBatches) {
      // eslint-disable-next-line no-await-in-loop
      await purgeBatch(batchId);
    }

    console.log('info - smoke test batches, staged rows and transactions were removed');
  }

  console.log(`\n${passed} assertions passed`);
};

start()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nigourmete import test failed:', error.message);
    process.exit(1);
  });
