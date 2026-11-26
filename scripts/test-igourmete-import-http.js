/**
 * HTTP smoke test for /api/admin/imports/igourmete.
 *
 * Boots a minimal express app with the real admin router (no socket.io), uploads
 * DATA/dbf/CHECK.DBF through multer, verifies auth/detail/list/rows/commit
 * guards and cleans up every batch it created.
 *
 * Usage: node scripts/test-igourmete-import-http.js
 */
require('../src/config/loadEnv');

const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../src/config/db');
const errorHandler = require('../src/middleware/errorHandler');
const adminRoutes = require('../src/routes/admin');

const FIXTURE = path.resolve(__dirname, '../../DATA/dbf/CHECK.DBF');
const FILE_NAME = 'CHECK.DBF';
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';

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

const token = jwt.sign(
  { sub: 1, email: 'igourmete-http-test@example.com', name: 'HTTP Test' },
  JWT_SECRET,
  { expiresIn: '10m' }
);

const purgeBatch = async (batchId) => {
  await query('DELETE FROM dbf_igourmete_daily WHERE batchId = ?', [batchId]);
  await query('DELETE FROM dbf_import_batch WHERE id = ?', [batchId]);
};

const buildForm = (fileName = FILE_NAME, override = true) => {
  const form = new FormData();
  form.append(
    'file',
    new Blob([fs.readFileSync(FIXTURE)], { type: 'application/octet-stream' }),
    fileName
  );
  form.append('encoding', 'auto');
  if (override) {
    form.append('override', '1');
  }
  return form;
};

const start = async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use(errorHandler);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const unauthorized = await fetch(`${baseUrl}/api/admin/imports/igourmete/1`);
    assert(unauthorized.status === 401, 'the endpoint requires a bearer token');

    const headers = { Authorization: `Bearer ${token}` };

    const upload = await fetch(`${baseUrl}/api/admin/imports/igourmete`, {
      method: 'POST',
      headers,
      body: buildForm()
    });
    const uploadBody = await upload.json();

    assert(upload.status === 201 && uploadBody.success === true, 'POST /igourmete returns 201');
    assert(uploadBody.data.dataset === 'DAILY_CHECK', 'response reports the detected dataset');
    assert(
      uploadBody.data.rowCount === 10 && uploadBody.data.columns.length === 73,
      'response includes the staged rows count and field schema'
    );

    const batchId = uploadBody.data.batchId;
    createdBatches.push(batchId);

    const stagingRows = await query(
      `SELECT checkDate, checkNo
         FROM dbf_igourmete_daily
        WHERE batchId = ? AND isDeleted = 0 AND severity <> 'ERROR'
        ORDER BY rowNo ASC, id ASC`,
      [batchId]
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

    const detail = await fetch(`${baseUrl}/api/admin/imports/igourmete/${batchId}`, { headers });
    const detailBody = await detail.json();
    assert(
      detail.status === 200 && detailBody.data.dbfVersionLabel === 'dBase III',
      'GET /igourmete/:batchId returns the batch header'
    );

    const list = await fetch(
      `${baseUrl}/api/admin/imports/igourmete?status=STAGED&search=CHECK&pageSize=5`,
      { headers }
    );
    const listBody = await list.json();
    assert(
      list.status === 200 &&
        listBody.data.batches.some((row) => row.batchId === batchId) &&
        listBody.data.batches.length <= 5,
      'GET /igourmete lists the staging batches'
    );

    const rows = await fetch(
      `${baseUrl}/api/admin/imports/igourmete/${batchId}/rows?pageSize=5&severity=OK`,
      { headers }
    );
    const rowsBody = await rows.json();
    assert(
      rows.status === 200 && rowsBody.data.total === 10 && rowsBody.data.rows.length === 5,
      'GET /igourmete/:batchId/rows supports pagination and severity'
    );
    assert(rowsBody.data.rows[0].data.FCHECK === '00001', 'rows contain the full DBF record');

    const filtered = await fetch(
      `${baseUrl}/api/admin/imports/igourmete/${batchId}/rows?search=95ADE8B7`,
      { headers }
    );
    const filteredBody = await filtered.json();
    assert(filteredBody.data.total === 1, 'GET rows supports searching a DBF field');

    const byMember = await fetch(
      `${baseUrl}/api/admin/imports/igourmete/${batchId}/rows?search=00002024000000001498`,
      { headers }
    );
    const byMemberBody = await byMember.json();
    assert(
      byMemberBody.data.total === 1 &&
        byMemberBody.data.rows[0].member === '00002024000000001498',
      'GET rows exposes and searches member (FMEMBER)'
    );

    const commit = await fetch(`${baseUrl}/api/admin/imports/igourmete/${batchId}/commit`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const commitBody = await commit.json();
    assert(
      commit.status === 200 && commitBody.data.inserted === 10,
      'POST /commit marks the batch committed'
    );
    assert(
      commitBody.data.transactions &&
        commitBody.data.transactions.inserted === 10 &&
        commitBody.data.transactions.syncType === 'dbf_igourmate',
      'POST /commit reports 10 rows sent to transaction'
    );

    const transactionRows = await query(
      `SELECT checkUid, memberId, bill, totalAmount, billDate, syncType
         FROM transaction
        WHERE bill IN (${billPlaceholders})
        ORDER BY bill ASC`,
      expectedBills
    );
    const secondTransaction = transactionRows.find(
      (row) => row.bill === expectedBills[1]
    );
    assert(
      transactionRows.length === 10 &&
        secondTransaction &&
        secondTransaction.checkUid === 'D1504E9A4CA54531980C93C2BDB53D2A' &&
        secondTransaction.memberId === '00002024000000001498' &&
        secondTransaction.syncType === 'dbf_igourmate',
      'commit writes dbf_igourmete_daily rows into transaction'
    );

    const secondCommit = await fetch(`${baseUrl}/api/admin/imports/igourmete/${batchId}/commit`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert(secondCommit.status === 409, 'a double commit is rejected with 409');

    const removeCommitted = await fetch(`${baseUrl}/api/admin/imports/igourmete/${batchId}`, {
      method: 'DELETE',
      headers
    });
    assert(removeCommitted.status === 409, 'DELETE of a committed batch is rejected with 409');

    const secondUpload = await fetch(`${baseUrl}/api/admin/imports/igourmete`, {
      method: 'POST',
      headers,
      body: buildForm()
    });
    const secondUploadBody = await secondUpload.json();
    const removableId = secondUploadBody.data.batchId;
    createdBatches.push(removableId);

    const remove = await fetch(`${baseUrl}/api/admin/imports/igourmete/${removableId}`, {
      method: 'DELETE',
      headers
    });
    const removeBody = await remove.json();
    assert(
      remove.status === 200 && removeBody.data.deletedRows === 10,
      'DELETE removes a STAGED batch and its rows'
    );

    const badExtension = new FormData();
    badExtension.append('file', new Blob(['hello'], { type: 'application/pdf' }), 'report.pdf');
    const rejectedExtension = await fetch(`${baseUrl}/api/admin/imports/igourmete`, {
      method: 'POST',
      headers,
      body: badExtension
    });
    assert(rejectedExtension.status === 422, 'a non-.dbf upload is rejected with 422');

    const badContent = new FormData();
    badContent.append('file', new Blob(['hello'], { type: 'application/octet-stream' }), 'fake.dbf');
    const rejectedContent = await fetch(`${baseUrl}/api/admin/imports/igourmete`, {
      method: 'POST',
      headers,
      body: badContent
    });
    assert(rejectedContent.status === 422, 'an invalid DBF header is rejected with 422');

    const notFound = await fetch(`${baseUrl}/api/admin/imports/igourmete/99999999`, { headers });
    assert(notFound.status === 404, 'an unknown batch returns 404');

  } finally {
    await purgeTransactions();

    for (const batchId of createdBatches) {
      // eslint-disable-next-line no-await-in-loop
      await purgeBatch(batchId);
    }

    server.close();
    process.env.NODE_ENV = previousNodeEnv;
    console.log('info - HTTP test batches, staged rows and transactions were removed');
  }

  console.log(`\n${passed} assertions passed`);
};

start()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nigourmete HTTP test failed:', error.message);
    process.exit(1);
  });
