const AMOUNT_TOLERANCE = 0.005;
const SEVERITY_RANK = { WARNING: 1, ERROR: 2 };

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const amountsEqual = (left, right) => Math.abs(Number(left) - Number(right)) <= AMOUNT_TOLERANCE;

const sameAmount = (left, right) => {
  if (left === null || left === undefined || right === null || right === undefined) {
    return true;
  }

  return amountsEqual(left, right);
};

const mergeSeverity = (current, next) => {
  if (!current) {
    return next;
  }

  return SEVERITY_RANK[next] > SEVERITY_RANK[current] ? next : current;
};

const appendMessage = (current, message) => {
  const next = current ? `${current}; ${message}` : message;
  return next.slice(0, 500);
};

const applyIssue = (target, severity, message) => {
  target.severity = mergeSeverity(target.severity, severity);
  target.message = appendMessage(target.message, message);
};

const formatAmount = (value) => (value === null || value === undefined ? '-' : String(round2(value)));

const sumLines = (lines, key) => round2(lines.reduce((total, line) => total + (line[key] || 0), 0));

/**
 * Jalankan validasi bisnis di atas data hasil parser.
 * Semua perbandingan angka berasal dari `parsed.issues` supaya parser menjadi satu-satunya
 * sumber kebenaran; validator hanya memetakan isu ke baris/member dan menghitung ringkasan.
 * Aturan yang butuh master produk/member dilaporkan sebagai `skippedChecks` karena skema
 * saat ini belum punya pemetaan PLU -> produk dan POS Member ID -> members.
 *
 * @param {object} parsed result of parseMemberSales()
 * @param {object} [options]
 * @returns {object}
 */
const validateMemberSales = (parsed, options = {}) => {
  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];

  const lines = parsed.lines.map((line) => ({
    ...line,
    priceQtyOk: null,
    totalOk: null,
    pluKnown: null,
    memberKnown: null,
    severity: null,
    message: null
  }));

  const linesByNumber = new Map(lines.map((line) => [line.lineNo, line]));

  for (const error of parsed.errors) {
    const existing = linesByNumber.get(error.lineNo);

    if (existing) {
      applyIssue(existing, 'ERROR', error.message);
      continue;
    }

    const synthetic = {
      lineNo: error.lineNo,
      memberId: null,
      memberName: null,
      memberStartLineNo: null,
      memberKey: null,
      checkNo: null,
      checkSeq: null,
      plu: null,
      description: null,
      price: null,
      qty: null,
      itemSales: null,
      itemDisc: null,
      itemTotal: null,
      priceQtyOk: null,
      totalOk: null,
      pluKnown: null,
      memberKnown: null,
      rawLine: error.rawLine || '',
      severity: 'ERROR',
      message: appendMessage(null, error.message)
    };

    lines.push(synthetic);
    linesByNumber.set(synthetic.lineNo, synthetic);
  }

  for (const issue of issues) {
    if (issue.scope !== 'line') {
      continue;
    }

    const line = linesByNumber.get(issue.lineNo);

    if (!line) {
      continue;
    }

    if (issue.type === 'priceQty') {
      line.priceQtyOk = 0;
    } else if (issue.type === 'itemTotal') {
      line.totalOk = 0;
    }

    applyIssue(line, issue.severity, issue.message);
  }

  for (const line of lines) {
    if (line.priceQtyOk === null && line.price !== null && line.qty !== null && line.itemSales !== null) {
      line.priceQtyOk = 1;
    }

    if (line.totalOk === null && line.itemSales !== null && line.itemDisc !== null && line.itemTotal !== null) {
      line.totalOk = 1;
    }

    if (line.memberKey && !line.checkSeq && !line.severity) {
      applyIssue(line, 'WARNING', 'Check# is missing for this item row');
    }
  }

  const memberIssues = new Map();

  for (const issue of issues) {
    if (issue.scope !== 'member') {
      continue;
    }

    const key = issue.memberStartLineNo;
    const bucket = memberIssues.get(key) || [];
    bucket.push(issue);
    memberIssues.set(key, bucket);
  }

  const members = parsed.members.map((member) => {
    const memberLines = lines.filter((line) => line.memberStartLineNo === member.startLineNo);
    const computed = member.computed || {
      itemQty: memberLines.reduce((total, line) => total + (line.qty || 0), 0),
      itemSales: sumLines(memberLines, 'itemSales'),
      itemTotal: sumLines(memberLines, 'itemTotal'),
      checkCount: new Set(memberLines.map((line) => line.checkSeq).filter(Boolean)).size
    };

    const enriched = {
      ...member,
      cItemQty: computed.itemQty,
      cItemSales: computed.itemSales,
      cItemTotal: computed.itemTotal,
      cCheckCount: computed.checkCount,
      severity: null,
      message: null
    };

    for (const issue of memberIssues.get(member.startLineNo) || []) {
      applyIssue(enriched, issue.severity, issue.message);
    }

    return enriched;
  });

  const totalItemQty = lines.reduce((total, line) => total + (line.qty || 0), 0);
  const totalItemSales = sumLines(lines, 'itemSales');
  const totalItemTotal = sumLines(lines, 'itemTotal');
  const totalChecks = new Set(
    lines.filter((line) => line.memberKey && line.checkSeq).map((line) => `${line.memberKey}|${line.checkSeq}`)
  ).size;

  const totals = {
    members: members.length,
    checks: totalChecks,
    items: lines.length,
    itemQty: totalItemQty,
    itemSales: totalItemSales,
    itemTotal: totalItemTotal
  };

  const notices = (Array.isArray(parsed.warnings) ? parsed.warnings : []).map((warning) => ({
    lineNo: warning.lineNo || null,
    code: warning.code || null,
    severity: 'WARNING',
    message: warning.message
  }));

  if (parsed.footer.itemSales !== null && !sameAmount(totalItemSales, parsed.footer.itemSales)) {
    notices.push({
      lineNo: null,
      code: 'footerItemSales',
      severity: 'WARNING',
      message: `Total Item Sales of parsed rows (${formatAmount(totalItemSales)}) differs from the report footer (${formatAmount(
        parsed.footer.itemSales
      )}), difference ${formatAmount(totalItemSales - parsed.footer.itemSales)}`
    });
  }

  if (parsed.footer.itemTotal !== null && !sameAmount(totalItemTotal, parsed.footer.itemTotal)) {
    notices.push({
      lineNo: null,
      code: 'footerItemTotal',
      severity: 'WARNING',
      message: `Total Item Total of parsed rows (${formatAmount(totalItemTotal)}) differs from the report footer (${formatAmount(
        parsed.footer.itemTotal
      )}), difference ${formatAmount(totalItemTotal - parsed.footer.itemTotal)}`
    });
  }

  const skippedChecks = [
    {
      rule: 'pluMaster',
      reason: 'No product master table exists in the current schema, so PLU cannot be validated'
    },
    {
      rule: 'memberMaster',
      reason: 'members has no column for the 20-digit POS Member ID, so member existence cannot be validated'
    }
  ];

  const errorCount =
    lines.filter((line) => line.severity === 'ERROR').length +
    members.filter((member) => member.severity === 'ERROR').length;
  const warningCount =
    lines.filter((line) => line.severity === 'WARNING').length +
    members.filter((member) => member.severity === 'WARNING').length;

  return {
    lines,
    members,
    totals,
    notices,
    skippedChecks,
    errorCount,
    warningCount,
    allowCommit: errorCount === 0,
    options
  };
};

module.exports = {
  validateMemberSales,
  round2,
  amountsEqual
};
