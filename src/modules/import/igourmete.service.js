const { getPool, query } = require('../../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  parseIgourmeteDbf,
  DATASET_LABELS,
  DBF_VERSION_LABELS
} = require('./igourmete-dbf.parser');

const CHUNK_SIZE = 500;
const DEFAULT_BATCH_PAGE_SIZE = 10;
const DEFAULT_ROW_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// `members.id` is VARCHAR(50) (POS member code), so a member code coming from
// the DBF can be inserted as-is without numeric casting.
const MEMBER_CODE_MAX_LENGTH = 50;

const STATUSES = new Set(['STAGED', 'COMMITTED', 'REJECTED']);
const SEVERITIES = new Set(['OK', 'WARNING', 'ERROR']);

const DAILY_ROW_COLUMNS = [
  'batchId',
  'rowNo',
  'checkUid',
  'member',
  'checkDate',
  'checkNo',
  'checkTot',
  'timeOpen',
  'isDeleted',
  'severity',
  'message',
  'rawJson'
];

const httpError = (message, statusCode, details) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
};

const clip = (value, maxLength) => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const pad2 = (value) => String(value).padStart(2, '0');

const formatDateOnly = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  return String(value).slice(0, 10);
};

const formatDateTime = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return `${formatDateOnly(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(
      value.getSeconds()
    )}`;
  }

  return String(value).slice(0, 19).replace('T', ' ');
};

const parseJsonColumn = (value, fallback) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const serializeBatch = (row) => {
  const columns = parseJsonColumn(row.columns_json, []) || [];
  const notices = parseJsonColumn(row.notices_json, []) || [];

  return {
    batchId: Number(row.id),
    status: row.status,
    fileName: row.file_name,
    fileHash: row.file_hash,
    dataset: row.dataset || 'UNKNOWN',
    datasetLabel:
      DATASET_LABELS[row.dataset || 'UNKNOWN'] || DATASET_LABELS.UNKNOWN,
    encoding: row.encoding || null,
    dbfVersion: Number(row.dbf_version || 0),
    dbfVersionLabel:
      DBF_VERSION_LABELS.get(Number(row.dbf_version || 0)) ||
      (Number(row.dbf_version || 0) ? `Version 0x${Number(row.dbf_version).toString(16)}` : null),
    dbfLastUpdated: formatDateOnly(row.dbf_last_updated),
    recordCount: Number(row.record_count || 0),
    rowCount: Number(row.row_count || 0),
    errorCount: Number(row.error_count || 0),
    warningCount: Number(row.warning_count || 0),
    columns: Array.isArray(columns) ? columns : [],
    notices: Array.isArray(notices) ? notices : [],
    uploadedAt: formatDateTime(row.created_at),
    uploadedBy: row.created_by,
    committedAt: formatDateTime(row.committed_at),
    committedBy: row.committed_by
  };
};

const bulkInsert = async (connection, table, columns, rows) => {
  if (rows.length === 0) {
    return;
  }

  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE);
    const placeholders = chunk
      .map(() => `(${columns.map(() => '?').join(', ')})`)
      .join(', ');
    const params = [];

    for (const row of chunk) {
      for (const column of columns) {
        const value = row[column];
        params.push(value === undefined ? null : value);
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await connection.query(
      `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES ${placeholders}`,
      params
    );
  }
};

const normaliseStatus = (value) => {
  const status = String(value || '').trim().toUpperCase();

  if (!status) {
    return null;
  }

  if (!STATUSES.has(status)) {
    throw httpError(`status must be one of ${[...STATUSES].join(', ')}`, 422);
  }

  return status;
};

const normaliseSeverity = (value) => {
  const severity = String(value || '').trim().toUpperCase();

  if (!severity) {
    return null;
  }

  if (!SEVERITIES.has(severity)) {
    throw httpError(`severity must be one of ${[...SEVERITIES].join(', ')}`, 422);
  }

  return severity;
};

const createBatch = async ({ buffer, fileName, encoding, actor, override = false }) => {
  const parsed = await parseIgourmeteDbf(buffer, { encoding });
  const pool = await getPool();
  const connection = await pool.getConnection();
  let batchId;

  try {
    await connection.beginTransaction();

    const [duplicates] = await connection.query(
      `SELECT id, file_name, status, created_at
         FROM dbf_import_batch
        WHERE file_hash = ? AND status IN ('STAGED', 'COMMITTED')
        ORDER BY id DESC
        LIMIT 1`,
      [parsed.fileHash]
    );

    if (duplicates.length > 0 && !override) {
      throw httpError(
        `This DBF file was already uploaded as batch ${duplicates[0].id}`,
        409,
        {
          existingBatchId: Number(duplicates[0].id),
          status: duplicates[0].status,
          fileName: duplicates[0].file_name,
          uploadedAt: formatDateTime(duplicates[0].created_at)
        }
      );
    }

    const [result] = await connection.query(
      `INSERT INTO dbf_import_batch
         (file_name, file_hash, dataset, encoding, dbf_version, dbf_last_updated,
          record_count, row_count, error_count, warning_count, columns_json, notices_json,
          status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'STAGED', ?)`,
      [
        clip(fileName, 255) || 'igourmete.dbf',
        parsed.fileHash,
        parsed.dataset,
        parsed.encoding,
        parsed.header.version,
        parsed.header.lastUpdated,
        parsed.recordCount,
        parsed.rowCount,
        parsed.errorCount,
        parsed.warningCount,
        JSON.stringify(parsed.columns),
        JSON.stringify(parsed.notices),
        clip(actor, 100)
      ]
    );

    batchId = Number(result.insertId);

    const rowValues = parsed.rows.map((row) => ({
      batchId,
      rowNo: row.rowNo,
      checkUid: clip(row.checkUid, 50) || '',
      member: clip(row.member, 50) || '',
      checkDate: row.checkDate,
      checkNo: clip(row.checkNo, 50),
      checkTot: row.checkTot,
      timeOpen: row.timeOpen,
      isDeleted: row.isDeleted ? 1 : 0,
      severity: row.severity,
      message: clip(row.message, 500),
      rawJson: JSON.stringify(row.data)
    }));

    await bulkInsert(connection, 'dbf_igourmete_daily', DAILY_ROW_COLUMNS, rowValues);

    await connection.commit();
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Connection may already be rolled back; keep the original error.
    }

    throw error;
  } finally {
    connection.release();
  }

  return getBatch(batchId);
};

const listBatches = async (options = {}) => {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(options.pageSize, 10) || DEFAULT_BATCH_PAGE_SIZE)
  );
  const offset = (page - 1) * pageSize;

  // `dbf_import_batch` may hold rows created before this module existed (the
  // table is also used by a CSV test import). Only rows with DBF metadata are
  // part of the Igourmete staging list.
  const whereClauses = ["(dataset <> 'UNKNOWN' OR record_count > 0)"];
  const params = [];
  const status = normaliseStatus(options.status);

  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  if (options.search) {
    const like = `%${String(options.search).trim()}%`;
    whereClauses.push('(file_name LIKE ? OR created_by LIKE ? OR CAST(id AS CHAR) LIKE ?)');
    params.push(like, like, like);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRows = await query(`SELECT COUNT(*) AS total FROM dbf_import_batch ${whereSql}`, params);
  const total = Number(countRows[0].total);

  const rows = await query(
    `SELECT * FROM dbf_import_batch ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    batches: rows.map((row) => ({
      ...serializeBatch(row),
      canCommit: row.status === 'STAGED' && Number(row.error_count) === 0
    }))
  };
};

const getBatch = async (batchId) => {
  const rows = await query('SELECT * FROM dbf_import_batch WHERE id = ? LIMIT 1', [batchId]);

  if (rows.length === 0) {
    throw httpError(`Import batch ${batchId} not found`, 404);
  }

  const batch = serializeBatch(rows[0]);

  return {
    ...batch,
    canCommit: batch.status === 'STAGED' && batch.errorCount === 0
  };
};

const getBatchRows = async (batchId, options = {}) => {
  const batchRows = await query(
    'SELECT id, columns_json FROM dbf_import_batch WHERE id = ? LIMIT 1',
    [batchId]
  );

  if (batchRows.length === 0) {
    throw httpError(`Import batch ${batchId} not found`, 404);
  }

  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(options.pageSize, 10) || DEFAULT_ROW_PAGE_SIZE)
  );
  const offset = (page - 1) * pageSize;

  const whereClauses = ['batchId = ?'];
  const params = [batchId];
  const severity = normaliseSeverity(options.severity);

  if (severity) {
    whereClauses.push('severity = ?');
    params.push(severity);
  }

  if (options.search) {
    const like = `%${String(options.search).trim()}%`;
    whereClauses.push(
      '(checkUid LIKE ? OR member LIKE ? OR checkNo LIKE ? OR message LIKE ? OR CAST(rawJson AS CHAR) LIKE ?)'
    );
    params.push(like, like, like, like, like);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM dbf_igourmete_daily ${whereSql}`,
    params
  );
  const total = Number(countRows[0].total);

  const rows = await query(
    `SELECT id, rowNo, member, isDeleted, severity, message, rawJson
       FROM dbf_igourmete_daily
       ${whereSql}
       ORDER BY rowNo ASC, id ASC
       LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    batchId: Number(batchId),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    columns: parseJsonColumn(batchRows[0].columns_json, []) || [],
    rows: rows.map((row) => ({
      id: Number(row.id),
      rowNo: Number(row.rowNo),
      member: row.member || null,
      isDeleted: Boolean(row.isDeleted),
      severity: row.severity,
      message: row.message,
      data: parseJsonColumn(row.rawJson, {}) || {}
    }))
  };
};

const bcryptSaltRounds = (() => {
  const parsed = Number(process.env.BCRYPT_SALT_ROUNDS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
})();

const normaliseMemberCode = (value) => {
  const code = String(value === null || value === undefined ? '' : value).trim();

  if (!code || code === '0') {
    return null;
  }

  return code.length > MEMBER_CODE_MAX_LENGTH ? code.slice(0, MEMBER_CODE_MAX_LENGTH) : code;
};

/**
 * Pastikan setiap kode member di baris staging punya baris di `members`.
 *
 * Aturan:
 *   - `members.id` sudah ada           -> baris dibiarkan apa adanya (tidak di-update)
 *   - belum ada                        -> insert `id`/`phone`/`email`/`name` = member,
 *                                         `verified = 0`, `activated = 0`
 *
 * `password_hash` wajib diisi (NOT NULL tanpa default), jadi dipakai hash bcrypt dari
 * password acak yang langsung dibuang: member hasil import tidak bisa login sampai
 * password di-set ulang.
 *
 * Pencocokan memakai `id`, `phone`, dan `email` karena `members.phone`/`members.email`
 * unik — kode yang sudah terpakai tidak boleh menghasilkan error duplikat.
 */
const ensureMembersFromRows = async (connection, rows) => {
  const codes = [];
  const seenCodes = new Set();
  const invalidCodes = new Set();

  for (const row of rows) {
    const code = normaliseMemberCode(row.member);

    if (!code) {
      invalidCodes.add(String(row.member === null || row.member === undefined ? '' : row.member));
      continue;
    }

    if (seenCodes.has(code)) {
      continue;
    }

    seenCodes.add(code);
    codes.push(code);
  }

  const result = {
    candidates: codes.length,
    inserted: 0,
    existing: 0,
    conflicted: 0,
    skipped: invalidCodes.size
  };

  if (codes.length === 0) {
    return result;
  }

  const knownValues = new Set();

  for (let offset = 0; offset < codes.length; offset += CHUNK_SIZE) {
    const chunk = codes.slice(offset, offset + CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(', ');
    const [found] = await connection.query(
      `SELECT id, phone, email
         FROM members
        WHERE id IN (${placeholders})
           OR phone IN (${placeholders})
           OR email IN (${placeholders})`,
      [...chunk, ...chunk, ...chunk]
    );

    for (const member of found) {
      knownValues.add(String(member.id));
      knownValues.add(String(member.phone));
      knownValues.add(String(member.email));
    }
  }

  const missing = codes.filter((code) => !knownValues.has(code));

  result.existing = codes.length - missing.length;

  if (missing.length === 0) {
    return result;
  }

  const passwordHash = await bcrypt.hash(
    crypto.randomBytes(16).toString('hex'),
    bcryptSaltRounds
  );

  for (let offset = 0; offset < missing.length; offset += CHUNK_SIZE) {
    const chunk = missing.slice(offset, offset + CHUNK_SIZE);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, 0, 0)').join(', ');
    const params = [];

    for (const code of chunk) {
      params.push(code, code, code, code, passwordHash);
    }

    // INSERT IGNORE: baris yang bentrok dengan unique `phone`/`email` (data lama
    // di luar import ini) dilewati, bukan menggagalkan seluruh commit.
    const [insertResult] = await connection.query(
      `INSERT IGNORE INTO members (id, phone, email, name, password_hash, verified, activated)
       VALUES ${placeholders}`,
      params
    );

    result.inserted += Number(insertResult.affectedRows || 0);
  }

  result.conflicted = missing.length - result.inserted;

  return result;
};

const TRANSACTION_SYNC_TYPE = 'dbf_igourmate';

const buildTransactionBill = (row) => {
  const checkDate = formatDateOnly(row.checkDate);
  const checkNo = clip(row.checkNo, 50);

  if (!checkDate || !checkNo) {
    return null;
  }

  // checkDate + checkNo, contoh: 2026-11-25.00001.
  return clip(`${checkDate}.${checkNo}`, 50);
};

/**
 * Kirim baris `dbf_igourmete_daily` yang valid ke `transaction`.
 *
 * Mapping (sesuai kontrak):
 *   checkUid -> transaction.checkUid
 *   member   -> transaction.memberId
 *   checkDate + checkNo -> transaction.bill
 *   timeOpen -> transaction.billDate
 *   syncType = 'dbf_igourmate'
 *
 * `transaction.bill` unik, sehingga commit ulang file yang sama (batch baru)
 * memperbarui baris lama, bukan membuat duplikat.
 */
const sendRowsToTransaction = async (connection, batchId, rows) => {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const bill = buildTransactionBill(row);

    if (!bill) {
      skipped += 1;
      continue;
    }

    const checkDate = formatDateOnly(row.checkDate);
    const billDate = row.timeOpen
      ? formatDateTime(row.timeOpen)
      : `${checkDate} 00:00:00`;
    const totalAmount = Number.isFinite(Number(row.checkTot))
      ? Math.round(Number(row.checkTot))
      : 0;

    const [result] = await connection.query(
      `INSERT INTO transaction
         (checkUid, memberId, merchantId, bill, totalAmount, totalRedeem,
          redeemCode, approvalCode, billDate, note, syncType)
       VALUES (?, ?, 0, ?, ?, 0, '', '', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         checkUid = VALUES(checkUid),
         memberId = VALUES(memberId),
         totalAmount = VALUES(totalAmount),
         billDate = VALUES(billDate),
         note = VALUES(note),
         syncType = VALUES(syncType)`,
      [
        clip(row.checkUid, 50) || '',
        clip(row.member, 50) || '',
        bill,
        totalAmount,
        billDate,
        clip(`Igourmate DBF batch #${batchId} | check ${row.checkNo}`, 250),
        TRANSACTION_SYNC_TYPE
      ]
    );

    if (result.affectedRows === 1) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  return { inserted, updated, skipped };
};

const commitBatch = async (batchId, options = {}) => {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM dbf_import_batch WHERE id = ? FOR UPDATE',
      [batchId]
    );

    if (rows.length === 0) {
      throw httpError(`Import batch ${batchId} not found`, 404);
    }

    const batch = rows[0];

    if (batch.status !== 'STAGED') {
      throw httpError(
        `Batch ${batchId} is ${batch.status}; only a STAGED batch can be committed.`,
        409
      );
    }

    if (Number(batch.error_count) > 0) {
      throw httpError(
        `Batch ${batchId} still has ${batch.error_count} error(s). Fix the source file and upload it again.`,
        409
      );
    }

    const [counts] = await connection.query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN isDeleted = 1 OR severity = 'ERROR' THEN 1 ELSE 0 END), 0) AS skipped
         FROM dbf_igourmete_daily
        WHERE batchId = ?`,
      [batchId]
    );

    const skipped = Number(counts[0].skipped);

    const [eligibleRows] = await connection.query(
      `SELECT rowNo, checkUid, member, checkDate, checkNo, checkTot, timeOpen
         FROM dbf_igourmete_daily
        WHERE batchId = ? AND isDeleted = 0 AND severity <> 'ERROR'
        ORDER BY rowNo ASC, id ASC`,
      [batchId]
    );

    const members = await ensureMembersFromRows(connection, eligibleRows);
    const transactions = await sendRowsToTransaction(connection, batchId, eligibleRows);

    await connection.query(
      `UPDATE dbf_import_batch
          SET status = 'COMMITTED', committed_by = ?, committed_at = NOW()
        WHERE id = ? AND status = 'STAGED'`,
      [clip(options.actor, 100), batchId]
    );

    await connection.commit();

    const skippedTotal = skipped + transactions.skipped;

    return {
      batchId: Number(batchId),
      status: 'COMMITTED',
      inserted: transactions.inserted,
      updated: transactions.updated,
      skipped: skippedTotal,
      transactions: {
        inserted: transactions.inserted,
        updated: transactions.updated,
        skipped: transactions.skipped,
        syncType: TRANSACTION_SYNC_TYPE
      },
      members: {
        candidates: members.candidates,
        inserted: members.inserted,
        existing: members.existing,
        conflicted: members.conflicted,
        skipped: members.skipped
      },
      message:
        `Batch #${batchId} committed — ${transactions.inserted} transaction row(s) inserted` +
        (transactions.updated > 0 ? `, ${transactions.updated} updated` : '') +
        (members.inserted > 0 ? `, ${members.inserted} member(s) created` : '') +
        (skippedTotal > 0 ? `, ${skippedTotal} row(s) skipped` : '') +
        `.`
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Connection may already be rolled back; keep the original error.
    }

    throw error;
  } finally {
    connection.release();
  }
};

const deleteBatch = async (batchId) => {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT id, status FROM dbf_import_batch WHERE id = ? FOR UPDATE',
      [batchId]
    );

    if (rows.length === 0) {
      throw httpError(`Import batch ${batchId} not found`, 404);
    }

    if (rows[0].status === 'COMMITTED') {
      throw httpError(
        `Batch ${batchId} is already committed and can no longer be deleted.`,
        409
      );
    }

    const [result] = await connection.query(
      'DELETE FROM dbf_igourmete_daily WHERE batchId = ?',
      [batchId]
    );

    await connection.query('DELETE FROM dbf_import_batch WHERE id = ?', [batchId]);

    await connection.commit();

    return {
      batchId: Number(batchId),
      deletedRows: Number(result.affectedRows || 0)
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Connection may already be rolled back; keep the original error.
    }

    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  createBatch,
  listBatches,
  getBatch,
  getBatchRows,
  commitBatch,
  deleteBatch
};



