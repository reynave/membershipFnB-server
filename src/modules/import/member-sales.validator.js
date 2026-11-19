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

/**
 * Run business validations over parsed data.
 * Rules that need a product/member master are reported as skipped because the
 * current schema has no PLU -> product and no POS member code -> members mapping.
 *
 * @param {object} parsed result of parseMemberSales()
 * @param {object} [options]
 * @returns {object}
 */
const validateMemberSales = (parsed, options = {}) => {
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

  for (const line of lines) {
    if (line.price !== null && line.qty !== null && line.itemSales !== null) {
      const expected = round2(line.price * line.qty);
      line.priceQtyOk = amountsEqual(expected, line.itemSales) ? 1 : 0;

      if (!line.priceQtyOk) {
        applyIssue(
          line,
          'ERROR',
          `Price x Qty (${formatAmount(expected)}) does not match Item Sales (${formatAmount(line.itemSales)})`
        );
      }
    }

    if (line.itemSales !== null && line.itemDisc !== null && line.itemTotal !== null) {
      const expected = round2(line.itemSales - line.itemDisc);
      line.totalOk = amountsEqual(expected, line.itemTotal) ? 1 : 0;

      if (!line.totalOk) {
        applyIssue(
          line,
          'WARNING',
          `Item Total (${formatAmount(line.itemTotal)}) does not match Item Sales - Item Disc (${formatAmount(expected)})`
        );
      }
    }

    if (!line.checkSeq) {
      applyIssue(line, 'WARNING', 'Check# is missing for this item row');
    }
  }

  const members = parsed.members.map((member) => {
    const memberLines = lines.filter((line) => line.memberId === member.memberId);
    const cItemQty = memberLines.reduce((total, line) => total + (line.qty || 0), 0);
    const cItemSales = round2(memberLines.reduce((total, line) => total + (line.itemSales || 0), 0));
    const cItemTotal = round2(memberLines.reduce((total, line) => total + (line.itemTotal || 0), 0));
    const cCheckCount = new Set(memberLines.map((line) => line.checkSeq).filter(Boolean)).size;

    const enriched = {
      ...member,
      cItemQty,
      cItemSales,
      cItemTotal,
      cCheckCount,
      severity: null,
      message: null
    };

    if (member.fItemTotal !== null && !sameAmount(cItemTotal, member.fItemTotal)) {
      applyIssue(
        enriched,
        'WARNING',
        `Item rows Item Total (${formatAmount(cItemTotal)}) differs from the member footer (${formatAmount(member.fItemTotal)})`
      );
    }

    if (member.fItemSales !== null && !sameAmount(cItemSales, member.fItemSales)) {
      applyIssue(
        enriched,
        'ERROR',
        `Item rows Item Sales (${formatAmount(cItemSales)}) does not match the member footer (${formatAmount(member.fItemSales)})`
      );
    }

    if (member.fItemQty !== null && cItemQty !== member.fItemQty) {
      applyIssue(
        enriched,
        'ERROR',
        `Item rows Qty (${cItemQty}) does not match the member footer (${member.fItemQty})`
      );
    }

    if (member.fCheckCount !== null && cCheckCount !== member.fCheckCount) {
      applyIssue(
        enriched,
        'ERROR',
        `Item rows Check# count (${cCheckCount}) does not match the member footer (${member.fCheckCount})`
      );
    }

    return enriched;
  });

  const totalItemQty = lines.reduce((total, line) => total + (line.qty || 0), 0);
  const totalItemSales = round2(lines.reduce((total, line) => total + (line.itemSales || 0), 0));
  const totalItemTotal = round2(lines.reduce((total, line) => total + (line.itemTotal || 0), 0));
  const totalChecks = new Set(
    lines.filter((line) => line.memberId && line.checkSeq).map((line) => `${line.memberId}|${line.checkSeq}`)
  ).size;

  const totals = {
    members: members.length,
    checks: totalChecks,
    items: lines.length,
    itemQty: totalItemQty,
    itemSales: totalItemSales,
    itemTotal: totalItemTotal
  };

  const notices = parsed.warnings.map((warning) => ({
    lineNo: warning.lineNo || null,
    severity: 'WARNING',
    message: warning.message
  }));

  if (parsed.footer.itemSales !== null && !sameAmount(totalItemSales, parsed.footer.itemSales)) {
    notices.push({
      lineNo: null,
      severity: 'WARNING',
      message: `Total Item Sales of parsed rows (${formatAmount(totalItemSales)}) differs from the report footer (${formatAmount(
        parsed.footer.itemSales
      )}), difference ${formatAmount(totalItemSales - parsed.footer.itemSales)}`
    });
  }

  if (parsed.footer.itemTotal !== null && !sameAmount(totalItemTotal, parsed.footer.itemTotal)) {
    notices.push({
      lineNo: null,
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

