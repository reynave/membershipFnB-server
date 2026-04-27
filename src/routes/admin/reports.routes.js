const express = require('express');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const auth = require('../../middleware/auth');
const { query } = require('../../config/db');

const router = express.Router();
const MAX_LIMIT = 200;
const DEFAULT_JSON_LIMIT = 50;
const DEFAULT_HTML_LIMIT = 200;

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNullableString = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
};

const normalizeDateOnly = (value) => {
  const normalized = toNullableString(value);

  if (!normalized) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const err = new Error('date format must be YYYY-MM-DD');
    err.statusCode = 400;
    throw err;
  }

  return normalized;
};

const parseFormat = (value) => {
  const normalized = (toNullableString(value) || 'html').toLowerCase();

  if (normalized !== 'html' && normalized !== 'json') {
    const err = new Error('format must be html or json');
    err.statusCode = 400;
    throw err;
  }

  return normalized;
};

const buildMembersReport = async (req, format) => {
  const page = toPositiveInt(req.query.page, 1);
  const rawLimit = toPositiveInt(req.query.limit, format === 'json' ? DEFAULT_JSON_LIMIT : DEFAULT_HTML_LIMIT);
  const limit = Math.min(MAX_LIMIT, rawLimit);
  const offset = (page - 1) * limit;
  const searchValue = toNullableString(req.query.search);
  const tierId = req.query.tierId ? toPositiveInt(req.query.tierId, 0) : null;
  const dateFrom = normalizeDateOnly(req.query.dateFrom);
  const dateTo = normalizeDateOnly(req.query.dateTo);

  const whereClauses = ['m.presence = 1'];
  const params = [];

  if (searchValue) {
    const keyword = `%${searchValue}%`;
    whereClauses.push('(m.name LIKE ? OR m.email LIKE ? OR m.phone LIKE ?)');
    params.push(keyword, keyword, keyword);
  }

  if (tierId) {
    whereClauses.push('m.tierId = ?');
    params.push(tierId);
  }

  if (dateFrom) {
    whereClauses.push('DATE(m.inputDate) >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    whereClauses.push('DATE(m.inputDate) <= ?');
    params.push(dateTo);
  }

  const where = whereClauses.join(' AND ');
  const countRows = await query(
    `SELECT COUNT(*) AS total
     FROM members m
     WHERE ${where}`,
    params
  );

  const rows = await query(
    `SELECT m.id, m.name, m.email, m.phone, m.inputDate,
            COALESCE(t.name, '') AS tierName,
            m.activated, m.status
     FROM members m
     LEFT JOIN tier t ON m.tierId = t.id
     WHERE ${where}
     ORDER BY m.id DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  return {
    meta: {
      reportKey: 'members',
      generatedAt: new Date().toISOString(),
      page,
      limit,
      total: Number(countRows[0]?.total || 0)
    },
    filters: {
      dateFrom,
      dateTo,
      tierId,
      search: searchValue
    },
    rows: rows.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      tierName: member.tierName || '-',
      activated: Number(member.activated) === 1,
      status: Number(member.status) === 1,
      createdAt: member.inputDate
    }))
  };
};

const buildTransactionsDailyReport = async (req, format) => {
  // Ambil range tanggal
  const dateFrom = normalizeDateOnly(req.query.dateFrom);
  const dateTo = normalizeDateOnly(req.query.dateTo);

  // Validasi wajib ada start dan end date
  if (!dateFrom || !dateTo) {
    const err = new Error('Start Date (dateFrom) dan End Date (dateTo) wajib diisi');
    err.statusCode = 400;
    throw err;
  }

  // Query summary per hari
  const rows = await query(
    `SELECT DATE(inputDate) AS date,
            COUNT(*) AS count,
            COALESCE(SUM(totalAmount),0) AS totalAmount,
            COALESCE(SUM(totalRedeem),0) AS totalRedeem
     FROM transaction
     WHERE presence = 1
       AND DATE(inputDate) >= ?
       AND DATE(inputDate) <= ?
     GROUP BY DATE(inputDate)
     ORDER BY DATE(inputDate) ASC`,
    [dateFrom, dateTo]
  );

  // Summary total
  let totalCount = 0;
  let totalAmount = 0;
  let totalRedeem = 0;
  rows.forEach(r => {
    totalCount += Number(r.count);
    totalAmount += Number(r.totalAmount);
    totalRedeem += Number(r.totalRedeem);
  });

  return {
    meta: {
      reportKey: 'transactions-daily',
      generatedAt: new Date().toISOString(),
      total: rows.length
    },
    filters: {
      dateFrom,
      dateTo
    },
    rows: rows.map(r => ({
      date: r.date,
      count: Number(r.count),
      totalAmount: Number(r.totalAmount),
      totalRedeem: Number(r.totalRedeem)
    })),
    summary: {
      totalCount,
      totalAmount,
      totalRedeem
    }
  };
};

const buildMembersLogsReport = async (_req, _format) => {
  const rows = await query(
    `SELECT m.id, m.userId, m.note, m.success, m.inputDate, u.name as userName
    FROM members_logs as m
    join members as u on m.userId = u.id
    ORDER BY m.inputDate DESC LIMIT 30`
  );

  return {
    meta: {
      reportKey: 'members-logs',
      generatedAt: new Date().toISOString(),
      total: rows.length
    },
    filters: {},
    rows: rows.map(r => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      note: r.note,
      success: Number(r.success) === 1,
      inputDate: r.inputDate
    }))
  };
};

const buildUsersLogsReport = async (_req, _format) => {
  const rows = await query(
    `SELECT u.id, u.userId, u.note, u.success, u.inputDate, m.name as userName
    FROM users_logs as u
    join members as m on u.userId = m.id
    ORDER BY u.inputDate DESC LIMIT 30`
  );

  return {
    meta: {
      reportKey: 'users-logs',
      generatedAt: new Date().toISOString(),
      total: rows.length
    },
    filters: {},
    rows: rows.map(r => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      note: r.note,
      success: Number(r.success) === 1,
      inputDate: r.inputDate
    }))
  };
};

const reportsRegistry = {
  members: {
    key: 'members',
    label: 'Members Report',
    templateFile: 'members-report.ejs',
    supports: ['html', 'json'],
    build: buildMembersReport
  },
  'transactions-daily': {
    key: 'transactions-daily',
    label: 'Transactions Daily Report',
    templateFile: 'transactions-daily-report.ejs',
    supports: ['html', 'json'],
    build: buildTransactionsDailyReport
  }
};

// Add simple logs reports (no paging, limit 30, ordered by inputDate DESC)
reportsRegistry['members-logs'] = {
  key: 'members-logs',
  label: 'Members Logs',
  templateFile: 'members-logs.ejs',
  supports: ['html', 'json'],
  build: buildMembersLogsReport
};

reportsRegistry['users-logs'] = {
  key: 'users-logs',
  label: 'Users Logs',
  templateFile: 'users-logs.ejs',
  supports: ['html', 'json'],
  build: buildUsersLogsReport
};

const renderTemplate = async (templateFile, viewModel) => {
  const templatePath = path.join(__dirname, '..', '..', 'reports', 'templates', templateFile);
  const templateSource = fs.readFileSync(templatePath, 'utf8');

  return ejs.render(templateSource, viewModel, {
    filename: templatePath
  });
};

router.get('/', /*auth,*/ async (_req, res, next) => {
  try {
    const data = Object.values(reportsRegistry).map((report) => ({
      key: report.key,
      label: report.label,
      supports: report.supports
    }));

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:reportKey', /*auth,*/ async (req, res, next) => {
  try {
    const reportKey = toNullableString(req.params.reportKey);
    const format = parseFormat(req.query.format);
    const report = reportsRegistry[reportKey];

    if (!report) {
      const err = new Error('Report not found');
      err.statusCode = 404;
      throw err;
    }

    if (!report.supports.includes(format)) {
      const err = new Error('Requested report format is not supported');
      err.statusCode = 400;
      throw err;
    }

    let payload;
    try {
      payload = await report.build(req, format);
    } catch (err) {
      // Kirim error ke user dalam format HTML agar tampil di frontend
      const msg = err?.message || 'Report error';
      if (format === 'json') {
        return res.status(err.statusCode || 400).json({ success: false, message: msg });
      } else {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(err.statusCode || 400).send(`<div class=\"alert alert-danger\">${msg}</div>`);
      }
    }

    if (format === 'json') {
      return res.status(200).json({
        success: true,
        meta: payload.meta,
        filters: payload.filters,
        rows: payload.rows
      });
    }

    // Untuk report yang ada summary, inject summary
    const html = await renderTemplate(report.templateFile, {
      title: report.label,
      meta: payload.meta,
      filters: payload.filters,
      rows: payload.rows,
      summary: payload.summary || null
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
