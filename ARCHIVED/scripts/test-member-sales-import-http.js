/**
 * HTTP smoke test for the admin endpoints of the "Member Sales Listing Report" import.
 *
 * Boots a minimal express app with the real admin router (no socket.io), uploads
 * the fixture through multer, previews, commits and checks the guards. All data
 * created here is removed at the end.
 *
 * Usage: node scripts/test-member-sales-import-http.js
 */
require('../src/config/loadEnv');

const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../src/config/db');
const errorHandler = require('../src/middleware/errorHandler');
const adminRoutes = require('../src/routes/admin');

const FIXTURE = path.resolve(__dirname, '../../DATA/MEMBER Sales Listing Report.csv');
const FILE_NAME = 'MEMBER Sales Listing Report.csv';
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';

let passed = 0;
const createdBatches = [];

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }

  passed += 1;
  console.log(`ok ${passed} - ${message}`);
};

const token = jwt.sign({ sub: 1, email: 'smoke-test@example.com', name: 'Smoke Test' }, JWT_SECRET, {
  expiresIn: '10m'
});

const purgeBatch = async (batchId) => {
  await query('DELETE FROM `transaction` WHERE import_batch_id = ?', [batchId]);
  await query('DELETE FROM import_line WHERE batch_id = ?', [batchId]);
  await query('DELETE FROM import_member WHERE batch_id = ?', [batchId]);
  await query('DELETE FROM import_batch WHERE id = ?', [batchId]);
};

const buildForm = () => {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(FIXTURE)], { type: 'text/csv' }), FILE_NAME);
  return form;
};

const start = async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  // Keep the real error handler but silence its dev-mode stack logging.
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
    const unauthorized = await fetch(`${baseUrl}/api/admin/imports/member-sales/1`);
    assert(unauthorized.status === 401, 'upload endpoint requires a bearer token');

    const headers = { Authorization: `Bearer ${token}` };

    const upload = await fetch(`${baseUrl}/api/admin/imports/member-sales`, {
      method: 'POST',
      headers,
      body: buildForm()
    });
    const uploadBody = await upload.json();
    assert(upload.status === 201 && uploadBody.success === true, 'POST /member-sales returns 201 with a preview');
    assert(uploadBody.data.totals.checks === 274, 'response exposes the parsed totals');
    assert(uploadBody.data.canCommit === true, 'response tells whether the batch can be committed');
    assert(Array.isArray(uploadBody.data.skippedChecks), 'response lists the skipped validation rules');

    const batchId = uploadBody.data.batchId;
    createdBatches.push(batchId);

    const detail = await fetch(`${baseUrl}/api/admin/imports/member-sales/${batchId}`, { headers });
    assert(detail.status === 200, 'GET /member-sales/:batchId returns the batch');

    const list = await fetch(
      `${baseUrl}/api/admin/imports/member-sales?status=PREVIEW&pageSize=5`,
      { headers }
    );
    const listBody = await list.json();
    assert(
      list.status === 200 &&
        Array.isArray(listBody.data.batches) &&
        listBody.data.batches.length <= 5 &&
        listBody.data.batches.some((row) => row.batchId === batchId),
      'GET /member-sales lists the staging batches'
    );

    const lines = await fetch(
      `${baseUrl}/api/admin/imports/member-sales/${batchId}/lines?severity=WARNING&pageSize=10`,
      { headers }
    );
    const linesBody = await lines.json();
    assert(linesBody.data.total === 196 && linesBody.data.lines.length === 10, 'GET lines supports filter and pagination');

    const members = await fetch(
      `${baseUrl}/api/admin/imports/member-sales/${batchId}/members?pageSize=5`,
      { headers }
    );
    const membersBody = await members.json();
    assert(
      membersBody.data.total === 189 &&
        membersBody.data.members.length === 5 &&
        membersBody.data.members[0].footer !== undefined,
      'GET members returns the staged import_member rows'
    );

    const commit = await fetch(`${baseUrl}/api/admin/imports/member-sales/${batchId}/commit`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountBasis: 'item_total' })
    });
    const commitBody = await commit.json();
    assert(
      commit.status === 200 && commitBody.data.transactionsInserted === 274,
      'POST /commit writes 274 transactions'
    );

    const secondCommit = await fetch(`${baseUrl}/api/admin/imports/member-sales/${batchId}/commit`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert(secondCommit.status === 409, 'double commit is rejected with 409');

    const remove = await fetch(`${baseUrl}/api/admin/imports/member-sales/${batchId}`, {
      method: 'DELETE',
      headers
    });
    assert(remove.status === 409, 'DELETE of a committed batch is rejected with 409');

    const badFile = new FormData();
    badFile.append('file', new Blob(['hello'], { type: 'application/pdf' }), 'report.pdf');
    const rejectedUpload = await fetch(`${baseUrl}/api/admin/imports/member-sales`, {
      method: 'POST',
      headers,
      body: badFile
    });
    assert(rejectedUpload.status === 422, 'non-csv upload is rejected with 422');

    const notFound = await fetch(`${baseUrl}/api/admin/imports/member-sales/99999999`, { headers });
    assert(notFound.status === 404, 'unknown batch returns 404');
  } finally {
    for (const batchId of createdBatches) {
      // eslint-disable-next-line no-await-in-loop
      await purgeBatch(batchId);
    }

    server.close();
    process.env.NODE_ENV = previousNodeEnv;
    console.log('info - HTTP test batch and its transaction rows were removed');
  }

  console.log(`\n${passed} assertions passed`);
};

start()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nhttp test failed:', error.message);
    process.exit(1);
  });
