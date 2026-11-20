const crypto = require('crypto');
const { getPool, query } = require('../../config/db');
const { parseMemberSales } = require('./member-sales.parser');
const { validateMemberSales, round2 } = require('./member-sales.validator');

const CHUNK_SIZE = 500;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const AMOUNT_BASES = new Set(['item_sales', 'item_total', 'gross_total']);

/** Catatan baris transaction yang dibuat oleh commit CSV Igourmate. */
const CSV_COMMIT_NOTE = 'CSV Igourmate Import';

/**
 * `import_member.period_from` diisi dari periode laporan dan `check_no` dari
 * `import_line.check_no`. Kolom periode bisa bernama `period_from` (skema baru)
 * atau `date` (varian ALTER TABLE), jadi urutannya dipakai sebagai fallback.
 */
const MEMBER_PERIOD_COLUMNS = ['period_from', 'date'];
const MEMBER_PERIOD_DEFAULT = '2000-01-01';

const MEMBER_COLUMNS = [
  'batch_id',
  'period_from',
  'check_no',
  'member_id',
  'member_name',
  'start_line_no',
  'f_item_qty',
  'f_item_sales',
  'f_item_disc',
  'f_item_total',
  'f_check_count',
  'f_cover',
  'f_check_disc',
  'f_tax',
  'f_sc',
  'f_gross_total',
  'c_item_qty',
  'c_item_sales',
  'c_item_total',
  'c_check_count',
  'severity',
  'message'
];

const LINE_COLUMNS = [
  'batch_id',
  'line_no',
  'member_id',
  'member_name',
  'check_no',
  'check_seq',
  'plu',
  'description',
  'price',
  'qty',
  'item_sales',
  'item_disc',
  'item_total',
  'price_qty_ok',
  'total_ok',
  'plu_known',
  'member_known',
  'severity',
  'message',
  'raw_line'
];

const TRANSACTION_COLUMNS = [
  'memberId',
  'merchantId',
  'bill',
  'totalAmount',
  'totalRedeem',
  'redeemCode',
  'approvalCode',
  'billDate',
  'note',
  'syncType',
  'import_batch_id'
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
    return `${formatDateOnly(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
  }

  return String(value).slice(0, 19).replace('T', ' ');
};

const toNumber = (value) => (value === null || value === undefined ? 0 : Number(value));

/** Keeps NULL as null so the API returns the import_member value exactly as stored. */
const toNullableNumber = (value) => (value === null || value === undefined ? null : Number(value));

const serializeBatch = (row) => ({
  batchId: Number(row.id),
  fileName: row.file_name,
  fileHash: row.file_hash,
  outlet: row.outlet,
  periodFrom: formatDateOnly(row.period_from),
  periodTo: formatDateOnly(row.period_to),
  printedAt: formatDateTime(row.printed_at),
  printedBy: row.printed_by,
  status: row.status,
  totals: {
    members: Number(row.total_members),
    checks: Number(row.total_checks),
    items: Number(row.total_items),
    itemSales: toNumber(row.total_item_sales),
    itemTotal: toNumber(row.total_item_total)
  },
  footerGross: row.footer_gross === null ? null : toNumber(row.footer_gross),
  errorCount: Number(row.error_count),
  warningCount: Number(row.warning_count),
  createdBy: row.created_by,
  createdAt: formatDateTime(row.created_at),
  committedBy: row.committed_by,
  committedAt: formatDateTime(row.committed_at)
});

const serializeLine = (row) => ({
  id: Number(row.id),
  lineNo: Number(row.line_no),
  memberId: row.member_id,
  memberName: row.member_name,
  checkNo: row.check_no,
  checkSeq: row.check_seq === null || row.check_seq === undefined ? null : Number(row.check_seq),
  plu: row.plu,
  description: row.description,
  price: row.price === null ? null : toNumber(row.price),
  qty: row.qty === null ? null : Number(row.qty),
  itemSales: row.item_sales === null ? null : toNumber(row.item_sales),
  itemDisc: row.item_disc === null ? null : toNumber(row.item_disc),
  itemTotal: row.item_total === null ? null : toNumber(row.item_total),
  priceQtyOk: row.price_qty_ok === null ? null : Boolean(row.price_qty_ok),
  totalOk: row.total_ok === null ? null : Boolean(row.total_ok),
  pluKnown: row.plu_known === null ? null : Boolean(row.plu_known),
  memberKnown: row.member_known === null ? null : Boolean(row.member_known),
  severity: row.severity,
  message: row.message,
  rawLine: row.raw_line
});

const serializeMember = (row) => ({
  id: Number(row.id),
  memberId: row.member_id,
  memberName: row.member_name,
  periodFrom: formatDateOnly(row.period_from || row.date),
  checkNo: row.check_no || '',
  startLineNo: Number(row.start_line_no),
  footer: {
    itemQty: toNullableNumber(row.f_item_qty),
    itemSales: toNullableNumber(row.f_item_sales),
    itemDisc: toNullableNumber(row.f_item_disc),
    itemTotal: toNullableNumber(row.f_item_total),
    checkCount: toNullableNumber(row.f_check_count),
    cover: toNullableNumber(row.f_cover),
    checkDisc: toNullableNumber(row.f_check_disc),
    tax: toNullableNumber(row.f_tax),
    sc: toNullableNumber(row.f_sc),
    grossTotal: toNullableNumber(row.f_gross_total)
  },
  computed: {
    itemQty: toNullableNumber(row.c_item_qty),
    itemSales: toNullableNumber(row.c_item_sales),
    itemTotal: toNullableNumber(row.c_item_total),
    checkCount: toNullableNumber(row.c_check_count)
  },
  severity: row.severity,
  message: row.message
});

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
    await connection.query(`INSERT INTO \`${table}\` (${columns.join(', ')}) VALUES ${placeholders}`, params);
  }
};

/**
 * Kolom `period_from` dan `check_no` ditambahkan ke import_member lewat ALTER TABLE.
 * Kolom yang benar-benar ada dideteksi dari skema (sekali per proses) supaya insert
 * staging tetap jalan baik kolom periode bernama `period_from` maupun `date`.
 */
let importMemberColumnsPromise = null;

const resolveImportMemberColumns = async (connection) => {
  if (!importMemberColumnsPromise) {
    importMemberColumnsPromise = (async () => {
      const [rows] = await connection.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'import_member'`
      );

      const existing = new Set(rows.map((row) => row.COLUMN_NAME));
      const periodColumn = MEMBER_PERIOD_COLUMNS.find((column) => existing.has(column)) || null;
      const optionalColumns = [periodColumn, existing.has('check_no') ? 'check_no' : null].filter(Boolean);
      const baseColumns = MEMBER_COLUMNS.filter(
        (column) => column !== 'period_from' && column !== 'date' && column !== 'check_no' && column !== 'batch_id'
      );

      return ['batch_id', ...optionalColumns, ...baseColumns];
    })().catch((error) => {
      importMemberColumnsPromise = null;
      throw error;
    });
  }

  return importMemberColumnsPromise;
};

/**
 * `transaction` di beberapa database belum punya `import_batch_id` (migrasi belum
 * dijalankan), jadi kolom yang di-insert disaring sesuai skema aktual.
 */
let transactionColumnsPromise = null;

const resolveTransactionColumns = async (connection) => {
  if (!transactionColumnsPromise) {
    transactionColumnsPromise = (async () => {
      const [rows] = await connection.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transaction'`
      );

      const existing = new Set(rows.map((row) => row.COLUMN_NAME));
      return TRANSACTION_COLUMNS.filter((column) => existing.has(column));
    })().catch((error) => {
      transactionColumnsPromise = null;
      throw error;
    });
  }

  return transactionColumnsPromise;
};

/** Check pertama milik member (urutan file) untuk kolom import_member.check_no. */
const resolveMemberCheckNo = (member, memberLines) => {
  const checks = Array.isArray(member.checks) ? member.checks : [];
  const firstCheck = checks.find((check) => check && check.no);

  if (firstCheck) {
    return clip(firstCheck.no, 50);
  }

  const firstLine = (memberLines || []).find((line) => line.checkNo);
  return firstLine ? clip(firstLine.checkNo, 50) : '';
};

const findCommittedDuplicates = async (connection, fileHash, header) => {
  const [rows] = await connection.query(
    `SELECT id, file_name, file_hash, outlet, period_from, period_to, committed_at
     FROM import_batch
     WHERE status = 'COMMITTED'
       AND (file_hash = ? OR (outlet <=> ? AND period_from <=> ? AND period_to <=> ?))
     ORDER BY id DESC
     LIMIT 5`,
    [fileHash, header.outlet, header.periodFrom, header.periodTo]
  );

  return rows.map((row) => ({
    batchId: Number(row.id),
    fileName: row.file_name,
    outlet: row.outlet,
    periodFrom: formatDateOnly(row.period_from),
    periodTo: formatDateOnly(row.period_to),
    committedAt: formatDateTime(row.committed_at),
    sameFile: row.file_hash === fileHash
  }));
};

const createPreview = async ({ buffer, fileName, actor, override = false }) => {
  const parsed = parseMemberSales(buffer);
  const validation = validateMemberSales(parsed);
  const { header, footer, meta } = parsed;

  const pool = await getPool();
  const connection = await pool.getConnection();
  let batchId;

  try {
    await connection.beginTransaction();

    const duplicates = await findCommittedDuplicates(connection, meta.fileHash, header);

    if (duplicates.length > 0 && !override) {
      throw httpError(
        `This report was already committed as batch ${duplicates.map((item) => item.batchId).join(', ')}`,
        409,
        { duplicates }
      );
    }

    const [batchResult] = await connection.query(
      `INSERT INTO import_batch
         (file_name, file_hash, outlet, period_from, period_to, printed_at, printed_by, status,
          total_members, total_checks, total_items, total_item_sales, total_item_total, footer_gross,
          error_count, warning_count, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PREVIEW', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clip(fileName, 255) || 'member-sales.csv',
        meta.fileHash,
        clip(header.outlet, 100),
        header.periodFrom,
        header.periodTo,
        header.printedAt,
        clip(header.printedBy, 100),
        validation.totals.members,
        validation.totals.checks,
        validation.totals.items,
        validation.totals.itemSales,
        validation.totals.itemTotal,
        footer.grossTotal,
        validation.errorCount,
        validation.warningCount,
        clip(actor, 100)
      ]
    );

    batchId = Number(batchResult.insertId);

    // import_member.period_from = periode laporan, import_member.check_no = check
    // pertama member yang bersangkutan (diambil dari baris import_line-nya).
    const memberColumns = await resolveImportMemberColumns(connection);
    const memberLinesByStart = new Map();

    for (const line of validation.lines) {
      if (!line.memberStartLineNo) {
        continue;
      }

      const bucket = memberLinesByStart.get(line.memberStartLineNo) || [];
      bucket.push(line);
      memberLinesByStart.set(line.memberStartLineNo, bucket);
    }

    const memberRows = validation.members.map((member) => {
      const checkNo = resolveMemberCheckNo(member, memberLinesByStart.get(member.startLineNo));

      return {
        batch_id: batchId,
        period_from: header.periodFrom,
        date: header.periodFrom,
        check_no: checkNo,
        member_id: clip(member.memberId, 30),
        member_name: clip(member.memberName, 150),
        start_line_no: member.startLineNo,
        f_item_qty: member.fItemQty,
        f_item_sales: member.fItemSales,
        f_item_disc: member.fItemDisc,
        f_item_total: member.fItemTotal,
        f_check_count: member.fCheckCount,
        f_cover: member.fCover,
        f_check_disc: member.fCheckDisc,
        f_tax: member.fTax,
        f_sc: member.fSc,
        f_gross_total: member.fGrossTotal,
        c_item_qty: member.cItemQty,
        c_item_sales: member.cItemSales,
        c_item_total: member.cItemTotal,
        c_check_count: member.cCheckCount,
        severity: member.severity,
        message: clip(member.message, 500)
      };
    });

    const lineRows = validation.lines.map((line) => ({
      batch_id: batchId,
      line_no: line.lineNo,
      member_id: clip(line.memberId, 30),
      member_name: clip(line.memberName, 150),
      check_no: clip(line.checkNo, 20),
      check_seq: line.checkSeq,
      plu: clip(line.plu, 30),
      description: clip(line.description, 255),
      price: line.price,
      qty: line.qty,
      item_sales: line.itemSales,
      item_disc: line.itemDisc,
      item_total: line.itemTotal,
      price_qty_ok: line.priceQtyOk,
      total_ok: line.totalOk,
      plu_known: line.pluKnown,
      member_known: line.memberKnown,
      severity: line.severity,
      message: clip(line.message, 500),
      raw_line: clip(line.rawLine, 1000) || ''
    }));

    await bulkInsert(connection, 'import_member', memberColumns, memberRows);
    await bulkInsert(connection, 'import_line', LINE_COLUMNS, lineRows);

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

  const batch = await getBatch(batchId);

  return {
    ...batch,
    notices: validation.notices.slice(0, 100),
    skippedChecks: validation.skippedChecks,
    overridden: override
  };
};



const listBatches = async (options = {}) => {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(options.pageSize, 10) || DEFAULT_PAGE_SIZE)
  );
  const offset = (page - 1) * pageSize;

  const whereClauses = [];
  const params = [];

  if (options.status) {
    whereClauses.push('status = ?');
    params.push(String(options.status).trim().toUpperCase());
  } else {
    // Batch yang sudah di-commit bukan lagi "staging", jadi default-nya disembunyikan.
    whereClauses.push("status <> 'COMMITTED'");
  }

  if (options.search) {
    whereClauses.push('(file_name LIKE ? OR outlet LIKE ? OR created_by LIKE ?)');
    const like = `%${options.search}%`;
    params.push(like, like, like);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRows = await query(`SELECT COUNT(*) AS total FROM import_batch ${whereSql}`, params);
  const total = Number(countRows[0].total);

  const rows = await query(
    `SELECT * FROM import_batch ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    batches: rows.map((row) => ({
      ...serializeBatch(row),
      canCommit: row.status === 'PREVIEW' && Number(row.error_count) === 0
    }))
  };
};

const getBatch = async (batchId) => {
  const rows = await query('SELECT * FROM import_batch WHERE id = ? LIMIT 1', [batchId]);

  if (rows.length === 0) {
    throw httpError(`Import batch ${batchId} not found`, 404);
  }

  const batch = serializeBatch(rows[0]);

  const lineSeverities = { ERROR: 0, WARNING: 0 };
  const lineSeverityRows = await query(
    `SELECT severity, COUNT(*) AS total
     FROM import_line
     WHERE batch_id = ? AND severity IS NOT NULL
     GROUP BY severity`,
    [batchId]
  );

  for (const row of lineSeverityRows) {
    lineSeverities[row.severity] = Number(row.total);
  }

  const memberIssues = { ERROR: 0, WARNING: 0 };
  const memberIssueRows = await query(
    `SELECT severity, COUNT(*) AS total
     FROM import_member
     WHERE batch_id = ? AND severity IS NOT NULL
     GROUP BY severity`,
    [batchId]
  );

  for (const row of memberIssueRows) {
    memberIssues[row.severity] = Number(row.total);
  }

  return {
    ...batch,
    lineSeverities,
    memberIssues,
    footerComparison: {
      reportGrossTotal: batch.footerGross,
      rowsItemTotal: batch.totals.itemTotal,
      rowsItemSales: batch.totals.itemSales,
      difference: batch.footerGross === null ? null : round2(batch.totals.itemTotal - batch.footerGross)
    },
    canCommit: batch.status === 'PREVIEW' && batch.errorCount === 0
  };
};

const getBatchLines = async (batchId, options = {}) => {
  const batchRows = await query('SELECT id FROM import_batch WHERE id = ? LIMIT 1', [batchId]);

  if (batchRows.length === 0) {
    throw httpError(`Import batch ${batchId} not found`, 404);
  }

  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(options.pageSize, 10) || DEFAULT_PAGE_SIZE)
  );
  const offset = (page - 1) * pageSize;

  const whereClauses = ['batch_id = ?'];
  const params = [batchId];

  if (options.severity) {
    whereClauses.push('severity = ?');
    params.push(options.severity);
  }

  if (options.memberId) {
    whereClauses.push('member_id = ?');
    params.push(options.memberId);
  }

  if (options.checkNo) {
    whereClauses.push('check_no = ?');
    params.push(options.checkNo);
  }

  if (options.search) {
    whereClauses.push('(plu LIKE ? OR description LIKE ? OR member_name LIKE ?)');
    const like = `%${options.search}%`;
    params.push(like, like, like);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const countRows = await query(`SELECT COUNT(*) AS total FROM import_line ${whereSql}`, params);
  const total = Number(countRows[0].total);

  const rows = await query(
    `SELECT * FROM import_line ${whereSql} ORDER BY line_no ASC, id ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    batchId: Number(batchId),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    lines: rows.map(serializeLine)
  };
};

const getBatchMembers = async (batchId, options = {}) => {
  const batchRows = await query('SELECT id FROM import_batch WHERE id = ? LIMIT 1', [batchId]);

  if (batchRows.length === 0) {
    throw httpError(`Import batch ${batchId} not found`, 404);
  }

  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(options.pageSize, 10) || DEFAULT_PAGE_SIZE)
  );
  const offset = (page - 1) * pageSize;

  const whereClauses = ['batch_id = ?'];
  const params = [batchId];

  if (options.severity) {
    whereClauses.push('severity = ?');
    params.push(options.severity);
  }

  if (options.search) {
    whereClauses.push('(member_id LIKE ? OR member_name LIKE ?)');
    const like = `%${options.search}%`;
    params.push(like, like);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const countRows = await query(`SELECT COUNT(*) AS total FROM import_member ${whereSql}`, params);
  const total = Number(countRows[0].total);

  const rows = await query(
    `SELECT * FROM import_member ${whereSql} ORDER BY start_line_no ASC, id ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    batchId: Number(batchId),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    members: rows.map(serializeMember)
  };
};

const normalizeBillDate = (value) => {
  if (!value) {
    return null;
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return `${text} 23:59:59`;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
    return text;
  }

  throw httpError('billDate must use the format YYYY-MM-DD or YYYY-MM-DD HH:mm:ss', 422);
};

const buildTransactionRows = (batch, lineGroups, memberTotals, options) => {
  const { amountBasis, merchantId, billDate } = options;
  const periodKey = (formatDateOnly(batch.period_from) || '0000-00-00').replace(/-/g, '');
  const transactions = [];
  let index = 0;

  while (index < lineGroups.length) {
    const memberId = lineGroups[index].member_id;
    const memberLines = [];

    while (index < lineGroups.length && lineGroups[index].member_id === memberId) {
      memberLines.push(lineGroups[index]);
      index += 1;
    }

    const member = memberTotals.get(memberId) || {};
    const memberItemTotal = toNumber(member.f_item_total);
    const memberGross =
      member.f_gross_total === null || member.f_gross_total === undefined ? null : toNumber(member.f_gross_total);

    const amounts = memberLines.map((row) => {
      const itemSales = toNumber(row.item_sales);
      const itemTotal = toNumber(row.item_total);

      if (amountBasis === 'item_sales') {
        return Math.round(itemSales);
      }

      if (amountBasis === 'gross_total') {
        if (memberGross === null || memberItemTotal === 0) {
          return Math.round(itemTotal);
        }

        return Math.round((itemTotal / memberItemTotal) * memberGross);
      }

      return Math.round(itemTotal);
    });

    if (amountBasis === 'gross_total' && memberGross !== null && memberItemTotal !== 0) {
      const target = Math.round(memberGross);
      const rounded = amounts.reduce((total, amount) => total + amount, 0);
      amounts[amounts.length - 1] += target - rounded;
    }

    memberLines.forEach((row, lineIndex) => {
      const checkNo = row.check_no || 'NA';
      const fingerprint = crypto
        .createHash('sha256')
        .update(
          [
            batch.outlet || '',
            formatDateOnly(batch.period_from) || '',
            formatDateOnly(batch.period_to) || '',
            memberId,
            row.check_seq
          ].join('|')
        )
        .digest('hex')
        .slice(0, 10);

      transactions.push({
        memberId: clip(memberId, 50),
        merchantId,
        bill: clip(`IGR-${periodKey}-${checkNo}-${fingerprint}`, 50),
        totalAmount: amounts[lineIndex],
        totalRedeem: 0,
        redeemCode: '',
        approvalCode: '',
        billDate,
        note: clip(`Import batch ${batch.id} | check ${checkNo} | ${batch.file_name}`, 250),
        syncType: 'import',
        import_batch_id: Number(batch.id)
      });
    });
  }

  return transactions;
};

const commitBatch = async (
  batchId,
  { actor, amountBasis = 'item_total', billDate, merchantId: merchantIdInput } = {}
) => {
  if (!AMOUNT_BASES.has(amountBasis)) {
    throw httpError(`amountBasis must be one of: ${[...AMOUNT_BASES].join(', ')}`, 422);
  }

  const pool = await getPool();
  const connection = await pool.getConnection();
  let result;

  try {
    await connection.beginTransaction();

    const [batchRows] = await connection.query('SELECT * FROM import_batch WHERE id = ? FOR UPDATE', [batchId]);

    if (batchRows.length === 0) {
      throw httpError(`Import batch ${batchId} not found`, 404);
    }

    const batch = batchRows[0];

    if (batch.status === 'COMMITTED') {
      throw httpError(`Import batch ${batchId} is already committed`, 409);
    }

    if (batch.status !== 'PREVIEW') {
      throw httpError(`Import batch ${batchId} has status ${batch.status} and cannot be committed`, 409);
    }

    if (Number(batch.error_count) > 0) {
      throw httpError(
        `Import batch ${batchId} still has ${batch.error_count} error(s); fix the file and upload it again`,
        422
      );
    }

    const [memberRows] = await connection.query(
      'SELECT member_id, f_item_total, f_gross_total FROM import_member WHERE batch_id = ?',
      [batchId]
    );
    const memberTotals = new Map(memberRows.map((row) => [row.member_id, row]));

    const [lineGroups] = await connection.query(
      `SELECT member_id, MAX(member_name) AS member_name, check_no, check_seq,
              SUM(qty) AS qty, SUM(item_sales) AS item_sales, SUM(item_total) AS item_total
       FROM import_line
       WHERE batch_id = ? AND member_id IS NOT NULL AND check_seq IS NOT NULL
       GROUP BY member_id, check_no, check_seq
       ORDER BY member_id ASC, check_seq ASC`,
      [batchId]
    );

    if (lineGroups.length === 0) {
      throw httpError(`Import batch ${batchId} has no check to commit`, 422);
    }

    const requestedMerchantId =
      merchantIdInput === undefined || merchantIdInput === null || merchantIdInput === ''
        ? null
        : Number.parseInt(merchantIdInput, 10);

    if (requestedMerchantId !== null && (!Number.isInteger(requestedMerchantId) || requestedMerchantId <= 0)) {
      throw httpError('merchantId must be a positive integer', 422);
    }

    let merchantId = 0;
    let merchantMatched = false;

    if (requestedMerchantId !== null) {
      const [merchantRows] = await connection.query('SELECT id FROM merchant WHERE id = ? LIMIT 1', [
        requestedMerchantId
      ]);

      if (merchantRows.length === 0) {
        throw httpError(`Merchant ${requestedMerchantId} not found`, 404);
      }

      merchantId = Number(merchantRows[0].id);
      merchantMatched = true;
    } else {
      // The report only carries the outlet name, so reuse the merchant master when
      // the outlet matches it. Otherwise the transactions keep merchantId = 0 and the
      // caller is warned in the response.
      const [merchantRows] = await connection.query(
        'SELECT id FROM merchant WHERE LOWER(name) = LOWER(?) AND presence = 1 ORDER BY id ASC LIMIT 1',
        [batch.outlet || '']
      );

      if (merchantRows.length > 0) {
        merchantId = Number(merchantRows[0].id);
        merchantMatched = true;
      }
    }

    const resolvedBillDate =
      normalizeBillDate(billDate) ||
      `${formatDateOnly(batch.period_to) || formatDateOnly(batch.period_from)} 23:59:59`;

    if (resolvedBillDate.startsWith('null')) {
      throw httpError('Report period is unknown, pass billDate explicitly', 422);
    }

    const transactions = buildTransactionRows(batch, lineGroups, memberTotals, {
      amountBasis,
      merchantId,
      billDate: resolvedBillDate
    });

    const bills = transactions.map((transaction) => transaction.bill);

    if (new Set(bills).size !== bills.length) {
      throw httpError('Generated bill numbers are not unique; report contains conflicting checks', 422);
    }

    for (let offset = 0; offset < bills.length; offset += CHUNK_SIZE) {
      const chunk = bills.slice(offset, offset + CHUNK_SIZE);
      // eslint-disable-next-line no-await-in-loop
      const [existing] = await connection.query(
        `SELECT bill FROM \`transaction\` WHERE bill IN (${chunk.map(() => '?').join(', ')})`,
        chunk
      );

      if (existing.length > 0) {
        throw httpError('Some generated bills already exist in the transaction table', 409, {
          existingBills: existing.map((row) => row.bill).slice(0, 20)
        });
      }
    }

    // Kolom disaring sesuai skema: `import_batch_id` belum tentu ada di database lama.
    await bulkInsert(
      connection,
      'transaction',
      await resolveTransactionColumns(connection),
      transactions
    );

    const [updateResult] = await connection.query(
      `UPDATE import_batch
       SET status = 'COMMITTED', committed_at = NOW(), committed_by = ?
       WHERE id = ? AND status = 'PREVIEW'`,
      [clip(actor, 100), batchId]
    );

    if (updateResult.affectedRows !== 1) {
      throw httpError(`Import batch ${batchId} could not be marked as committed`, 409);
    }

    await connection.commit();

    result = {
      batchId: Number(batchId),
      status: 'COMMITTED',
      amountBasis,
      outlet: batch.outlet,
      merchantId,
      merchantMatched,
      billDate: resolvedBillDate,
      transactionsInserted: transactions.length,
      totalAmount: transactions.reduce((total, transaction) => total + transaction.totalAmount, 0),
      warnings: merchantMatched
        ? []
        : [
            `No merchant matches outlet "${batch.outlet || 'unknown'}"; transactions were stored with merchantId 0. ` +
              'Pass merchantId in the request body to link them to a merchant.'
          ]
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Connection may already be rolled back; keep the original error.
    }

    if (error.code === 'ER_DUP_ENTRY') {
      throw httpError(`Duplicate bill detected: ${error.sqlMessage || error.message}`, 409);
    }

    if (error.code === 'ER_BAD_FIELD_ERROR') {
      throw httpError(`transaction table is missing a column required by the import: ${error.message}`, 500);
    }

    throw error;
  } finally {
    connection.release();
  }

  return result;
};

/**
 * Commit ringkas: satu baris `import_member` menjadi satu baris `transaction`.
 *
 * - memberId    <- import_member.member_id
 * - totalAmount <- ROUND(import_member.f_gross_total)
 * - billDate    <- import_member.period_from (fallback import_batch.period_from) 00:00:00
 * - bill        <- period_from + '.' + import_member.check_no + '.' + import_member.id
 *
 * Contoh: periode 2026-01-01, check 00033, id 1 => `2026-01-01.00033.1`.
 * Karena `import_member.id` (BIGINT AUTO_INCREMENT) selalu unik dan satu batch hanya
 * boleh di-commit sekali (status PREVIEW -> COMMITTED), nomor bill ini tidak mungkin
 * duplikat sehingga tidak perlu penyesuaian/akhiran tambahan.
 */
const commitToTransaction = async (batchId, { actor, merchantId: merchantIdInput } = {}) => {
  const pool = await getPool();
  const connection = await pool.getConnection();
  let result;

  try {
    await connection.beginTransaction();

    const [batchRows] = await connection.query('SELECT * FROM import_batch WHERE id = ? FOR UPDATE', [batchId]);

    if (batchRows.length === 0) {
      throw httpError(`Import batch ${batchId} not found`, 404);
    }

    const batch = batchRows[0];

    if (batch.status === 'COMMITTED') {
      throw httpError(`Import batch ${batchId} is already committed`, 409);
    }

    if (batch.status !== 'PREVIEW') {
      throw httpError(`Import batch ${batchId} has status ${batch.status} and cannot be committed`, 409);
    }

    if (Number(batch.error_count) > 0) {
      throw httpError(
        `Import batch ${batchId} still has ${batch.error_count} error(s); fix the file and upload it again`,
        422
      );
    }

    const memberColumns = await resolveImportMemberColumns(connection);
    const periodColumn = MEMBER_PERIOD_COLUMNS.find((column) => memberColumns.includes(column)) || null;
    const memberSelect = ['id', 'member_id', 'member_name', 'start_line_no', 'f_gross_total'];

    if (periodColumn) {
      memberSelect.push(periodColumn);
    }

    if (memberColumns.includes('check_no')) {
      memberSelect.push('check_no');
    }

    const [memberRows] = await connection.query(
      `SELECT ${memberSelect.join(', ')}
       FROM import_member
       WHERE batch_id = ?
       ORDER BY start_line_no ASC, id ASC`,
      [batchId]
    );

    if (memberRows.length === 0) {
      throw httpError(`Import batch ${batchId} has no member row to commit`, 422);
    }

    // Staging yang di-upload sebelum kolom check_no ada: ambil check dari import_line.
    const fallbackCheckNos = new Map();

    if (memberRows.some((row) => !String(row.check_no || '').trim())) {
      const [lineRows] = await connection.query(
        `SELECT member_id, check_no
         FROM import_line
         WHERE batch_id = ? AND member_id IS NOT NULL AND check_no IS NOT NULL AND check_no <> ''
         ORDER BY member_id ASC, check_seq ASC, line_no ASC`,
        [batchId]
      );

      for (const row of lineRows) {
        if (!fallbackCheckNos.has(row.member_id)) {
          fallbackCheckNos.set(row.member_id, row.check_no);
        }
      }
    }

    const batchPeriod = formatDateOnly(batch.period_from);

    const prepareRow = (row) => {
      const memberPeriod = periodColumn ? formatDateOnly(row[periodColumn]) : null;
      const periodDate = memberPeriod && memberPeriod > MEMBER_PERIOD_DEFAULT ? memberPeriod : batchPeriod;

      if (!periodDate) {
        throw httpError('Report period is unknown, cannot build billDate', 422);
      }

      const checkNo = String(row.check_no || fallbackCheckNos.get(row.member_id) || '')
        .trim()
        .replace(/\s+/g, '');
      // Bill = periode + '.' + nomor check + '.' + id baris staging.
      // `import_member.id` membuat nomor bill unik walau beberapa member memakai
      // periode & check yang sama.
      const checkSegment = checkNo || 'NA';

      return {
        id: String(row.id),
        memberId: clip(row.member_id, 50) || '',
        periodDate,
        checkNo,
        bill: clip(`${periodDate}.${checkSegment}.${row.id}`, 50),
        billDate: `${periodDate} 00:00:00`,
        totalAmount: Math.round(toNumber(row.f_gross_total))
      };
    };

    const prepared = memberRows.map(prepareRow);

    const requestedMerchantId =
      merchantIdInput === undefined || merchantIdInput === null || merchantIdInput === ''
        ? null
        : Number.parseInt(merchantIdInput, 10);

    if (requestedMerchantId !== null && (!Number.isInteger(requestedMerchantId) || requestedMerchantId <= 0)) {
      throw httpError('merchantId must be a positive integer', 422);
    }

    let merchantId = 0;
    let merchantMatched = false;

    if (requestedMerchantId !== null) {
      const [merchantRows] = await connection.query('SELECT id FROM merchant WHERE id = ? LIMIT 1', [
        requestedMerchantId
      ]);

      if (merchantRows.length === 0) {
        throw httpError(`Merchant ${requestedMerchantId} not found`, 404);
      }

      merchantId = Number(merchantRows[0].id);
      merchantMatched = true;
    } else {
      // Report hanya memuat nama outlet; pakai merchant master bila namanya sama.
      const [merchantRows] = await connection.query(
        'SELECT id FROM merchant WHERE LOWER(name) = LOWER(?) AND presence = 1 ORDER BY id ASC LIMIT 1',
        [batch.outlet || '']
      );

      if (merchantRows.length > 0) {
        merchantId = Number(merchantRows[0].id);
        merchantMatched = true;
      }
    }

    const note = clip(`${CSV_COMMIT_NOTE} #${batch.id}`, 250);
    const transactionColumns = await resolveTransactionColumns(connection);
    const transactions = prepared.map((row) => ({
      memberId: row.memberId,
      merchantId,
      bill: row.bill,
      totalAmount: row.totalAmount,
      totalRedeem: 0,
      redeemCode: '',
      approvalCode: '',
      billDate: row.billDate,
      note,
      syncType: 'import',
      import_batch_id: Number(batch.id)
    }));

    await bulkInsert(connection, 'transaction', transactionColumns, transactions);

    const [updateResult] = await connection.query(
      `UPDATE import_batch
       SET status = 'COMMITTED', committed_at = NOW(), committed_by = ?
       WHERE id = ? AND status = 'PREVIEW'`,
      [clip(actor, 100), batchId]
    );

    if (updateResult.affectedRows !== 1) {
      throw httpError(`Import batch ${batchId} could not be marked as committed`, 409);
    }

    await connection.commit();

    const warnings = [];

    if (!merchantMatched) {
      warnings.push(
        `No merchant matches outlet "${batch.outlet || 'unknown'}"; transactions were stored with merchantId 0. ` +
          'Pass merchantId in the request body to link them to a merchant.'
      );
    }

    result = {
      batchId: Number(batchId),
      status: 'COMMITTED',
      outlet: batch.outlet,
      note,
      merchantId,
      merchantMatched,
      billDate: prepared[0].billDate,
      billFormat: '<period_from>.<import_member.check_no>.<import_member.id>',
      sampleBills: prepared.slice(0, 10).map((row) => ({
        id: Number(row.id),
        memberId: row.memberId,
        checkNo: row.checkNo,
        bill: row.bill
      })),
      transactionsInserted: transactions.length,
      totalAmount: transactions.reduce((total, transaction) => total + transaction.totalAmount, 0),
      warnings
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Connection may already be rolled back; keep the original error.
    }

    if (error.code === 'ER_DUP_ENTRY') {
      throw httpError(`Duplicate bill detected: ${error.sqlMessage || error.message}`, 409);
    }

    if (error.code === 'ER_BAD_FIELD_ERROR') {
      throw httpError(`transaction table is missing a column required by the import: ${error.message}`, 500);
    }

    throw error;
  } finally {
    connection.release();
  }

  return result;
};

const deleteBatch = async (batchId) => {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT id, status FROM import_batch WHERE id = ? FOR UPDATE', [batchId]);

    if (rows.length === 0) {
      throw httpError(`Import batch ${batchId} not found`, 404);
    }

    if (rows[0].status === 'COMMITTED') {
      throw httpError('Committed batches cannot be deleted because the transactions are already stored', 409);
    }

    await connection.query('DELETE FROM import_line WHERE batch_id = ?', [batchId]);
    await connection.query('DELETE FROM import_member WHERE batch_id = ?', [batchId]);
    await connection.query('DELETE FROM import_batch WHERE id = ?', [batchId]);

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

  return { batchId: Number(batchId), deleted: true };
};

module.exports = {
  createPreview,
  listBatches,
  getBatch,
  getBatchLines,
  getBatchMembers,
  commitBatch,
  commitToTransaction,
  deleteBatch
};

