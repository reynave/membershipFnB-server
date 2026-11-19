const crypto = require('crypto');

const REPORT_TITLE = 'Member Sales Listing Report';
const END_MARKER = '<< End of Report >>';
const ITEM_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Error thrown when an uploaded file is not a readable "Member Sales Listing Report".
 * `statusCode` follows the convention used by the global error handler.
 */
class MemberSalesParseError extends Error {
  constructor(message, statusCode = 422, details = null) {
    super(message);
    this.name = 'MemberSalesParseError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Decode the POS export. The report is UTF-16LE with BOM and CRLF line endings.
 */
const decodeReport = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new MemberSalesParseError('Uploaded file is empty');
  }

  const hasLittleEndianBom = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
  const hasBigEndianBom = buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff;

  if (hasBigEndianBom) {
    throw new MemberSalesParseError('File must be UTF-16LE encoded (UTF-16BE is not supported)');
  }

  if (!hasLittleEndianBom) {
    throw new MemberSalesParseError('File must be UTF-16LE encoded with BOM');
  }

  const text = buffer
    .toString('utf16le')
    .replace(/^\uFEFF/, '');

  return text.split(/\r\n|\n|\r/);
};

const splitCells = (line) => line.split(',').map((cell) => cell.trim());

const compactCells = (line) => splitCells(line).filter((cell) => cell !== '');

const isDigits = (value) => /^\d+$/.test(value);

const toInteger = (value) => {
  const cleaned = String(value === undefined || value === null ? '' : value).replace(/[\s,]/g, '');
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
};

const toAmount = (value) => {
  const cleaned = String(value === undefined || value === null ? '' : value).replace(/[\s,]/g, '');
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const pad2 = (value) => String(value).padStart(2, '0');

/**
 * Convert `dd/mm/yyyy` to `yyyy-mm-dd`. Returns null when the value is invalid.
 */
const parseDateDdMmYyyy = (value) => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value || '').trim());
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
};

/**
 * Convert `dd/mm/yyyy hh:mm:ss am|pm` to a MySQL datetime literal.
 */
const parsePrintedAt = (value) => {
  const pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i;
  const match = pattern.exec(String(value || '').trim());

  if (!match) {
    return null;
  }

  const date = parseDateDdMmYyyy(`${match[1]}/${match[2]}/${match[3]}`);
  if (!date) {
    return null;
  }

  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);
  const meridiem = (match[7] || '').toLowerCase();

  if (meridiem === 'pm' && hour < 12) {
    hour += 12;
  } else if (meridiem === 'am' && hour === 12) {
    hour = 0;
  }

  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  return `${date} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
};

const readLabelPairs = (cells) => {
  const pairs = {};

  for (let index = 0; index < cells.length - 1; index += 1) {
    if (cells[index].endsWith(':')) {
      pairs[cells[index].toLowerCase()] = cells[index + 1];
    }
  }

  return pairs;
};

const sumOrNull = (values) => {
  const numbers = values.filter((value) => value !== null && value !== undefined);
  if (numbers.length === 0) {
    return null;
  }

  return numbers.reduce((total, value) => total + value, 0);
};

const parseItemLine = (line, lineNo, currentCheckNo, currentCheckSeq, errors, currentMember) => {
  const cells = splitCells(line);
  const length = cells.length;
  const hasCheckNumber = isDigits(cells[0]);
  const checkNo = hasCheckNumber ? cells[0] : currentCheckNo;
  const checkSeq = hasCheckNumber ? (currentCheckSeq || 0) + 1 : currentCheckSeq;
  const pluIndex = hasCheckNumber ? 2 : 0;
  const descriptionIndex = hasCheckNumber ? 4 : 2;

  const price = toAmount(cells[length - 9]);
  const qty = toInteger(cells[length - 7]);
  const itemSales = toAmount(cells[length - 5]);
  const itemDisc = toAmount(cells[length - 3]);
  const itemTotal = toAmount(cells[length - 1]);
  const description = cells.slice(descriptionIndex, length - 10).join(',').trim();

  const missingNumbers = [
    ['price', price],
    ['qty', qty],
    ['item_sales', itemSales],
    ['item_disc', itemDisc],
    ['item_total', itemTotal]
  ]
    .filter(([, value]) => value === null)
    .map(([field]) => field);

  if (missingNumbers.length > 0) {
    errors.push({
      lineNo,
      message: `Could not read numeric value(s): ${missingNumbers.join(', ')}`,
      rawLine: line.trim().slice(0, 1000)
    });
  }

  if (!checkNo) {
    errors.push({
      lineNo,
      message: 'Check# could not be resolved from the item row',
      rawLine: line.trim().slice(0, 1000)
    });
  }

  const item = {
    lineNo,
    memberId: currentMember ? currentMember.memberId : null,
    memberName: currentMember ? currentMember.memberName : null,
    checkNo: checkNo || null,
    checkSeq: checkSeq || null,
    plu: cells[pluIndex] || null,
    description: description || null,
    price,
    qty,
    itemSales,
    itemDisc,
    itemTotal,
    rawLine: line.trim().slice(0, 1000)
  };

  return { item, checkNo, checkSeq };
};

/**
 * Parse a "Member Sales Listing Report" buffer into structured data.
 * Pure function: no database access, no side effects.
 *
 * @param {Buffer} buffer raw uploaded file
 * @returns {{header: object, members: object[], lines: object[], footer: object, errors: object[], warnings: object[], meta: object}}
 */
const parseMemberSales = (buffer) => {
  const rawLines = decodeReport(buffer);
  const errors = [];
  const warnings = [];
  const members = [];
  const lines = [];

  const header = {
    title: null,
    outlet: null,
    periodFrom: null,
    periodTo: null,
    printedAt: null,
    printedBy: null
  };

  const firstContentIndex = rawLines.findIndex((line) => line.trim() !== '');
  if (firstContentIndex === -1) {
    throw new MemberSalesParseError('Uploaded file only contains blank lines');
  }

  const titleLine = rawLines[firstContentIndex].trim();
  if (!titleLine.toLowerCase().includes(REPORT_TITLE.toLowerCase())) {
    throw new MemberSalesParseError(
      `Unsupported file. Expected a "${REPORT_TITLE}" export, but the first line is "${titleLine.slice(0, 80)}"`
    );
  }

  header.title = titleLine;

  let currentMember = null;
  let currentCheckNo = null;
  let currentCheckSeq = null;
  let endOfReport = false;

  for (let index = 0; index < rawLines.length; index += 1) {
    const line = rawLines[index];
    const lineNo = index + 1;
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed === END_MARKER) {
      endOfReport = true;
      continue;
    }

    const memberMatch = /^Member ID:\s*,*\s*(.*?)\s*,*\s*Member Name:\s*,*\s*(.*)$/i.exec(trimmed);
    if (memberMatch) {
      currentMember = {
        memberId: (memberMatch[1] || '').trim(),
        memberName: (memberMatch[2] || '').trim() || null,
        startLineNo: lineNo,
        fItemQty: null,
        fItemSales: null,
        fItemDisc: null,
        fItemTotal: null,
        fCheckCount: null,
        fCover: null,
        fCheckDisc: null,
        fTax: null,
        fSc: null,
        fGrossTotal: null
      };

      if (!currentMember.memberId) {
        errors.push({ lineNo, message: 'Member ID is empty', rawLine: trimmed.slice(0, 1000) });
      }

      members.push(currentMember);
      currentCheckNo = null;
      currentCheckSeq = null;
      continue;
    }

    if (!currentMember) {
      const outletMatch = /^\((.*)\)$/.exec(trimmed);
      if (outletMatch && !header.outlet) {
        header.outlet = outletMatch[1].trim() || null;
        continue;
      }

      if (/^Bus Date\s*:/i.test(trimmed)) {
        const periodPattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:to|-)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i;
        const periodMatch = periodPattern.exec(trimmed);
        if (periodMatch) {
          header.periodFrom = parseDateDdMmYyyy(periodMatch[1]);
          header.periodTo = parseDateDdMmYyyy(periodMatch[2]);
        }

        const printedAtMatch = /Printed At\s*:\s*,?\s*(.+)$/i.exec(trimmed);
        if (printedAtMatch) {
          header.printedAt = parsePrintedAt(printedAtMatch[1]);
        }

        if (!header.periodFrom || !header.periodTo) {
          errors.push({ lineNo, message: 'Bus Date period could not be parsed', rawLine: trimmed.slice(0, 1000) });
        }

        if (printedAtMatch && !header.printedAt) {
          warnings.push({ lineNo, message: 'Printed At value could not be parsed' });
        }

        continue;
      }

      if (/^Printed By\s*:/i.test(trimmed)) {
        const cells = compactCells(trimmed);
        header.printedBy = cells.length > 1 ? cells.slice(1).join(', ').trim() || null : null;
        continue;
      }

      continue;
    }


    const cells = splitCells(trimmed);
    const firstCell = cells[0];
    const labelPairs = readLabelPairs(compactCells(trimmed));

    if (/^Total\s*:/i.test(firstCell)) {
      currentMember.fItemQty = toInteger(cells[2]);
      currentMember.fItemSales = toAmount(cells[4]);
      currentMember.fItemDisc = toAmount(cells[6]);
      currentMember.fItemTotal = toAmount(cells[8]);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(labelPairs, 'item sales:')) {
      currentMember.fItemSales = toAmount(labelPairs['item sales:']);
      currentMember.fCheckCount = toInteger(labelPairs['#check:']);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(labelPairs, 'item disc:')) {
      currentMember.fItemDisc = toAmount(labelPairs['item disc:']);
      currentMember.fCover = toInteger(labelPairs['cover:']);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(labelPairs, 'check disc:')) {
      currentMember.fCheckDisc = toAmount(labelPairs['check disc:']);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(labelPairs, 'tax:')) {
      currentMember.fTax = toAmount(labelPairs['tax:']);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(labelPairs, 'sc:')) {
      currentMember.fSc = toAmount(labelPairs['sc:']);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(labelPairs, 'gross total:')) {
      currentMember.fGrossTotal = toAmount(labelPairs['gross total:']);
      continue;
    }

    if (/^Check#/i.test(firstCell) || trimmed.startsWith('-')) {
      continue;
    }

    const looksLikeItem =
      cells.length >= 13 &&
      ITEM_KEY_PATTERN.test(firstCell) &&
      !firstCell.endsWith(':') &&
      !firstCell.startsWith('-');

    if (!looksLikeItem) {
      warnings.push({ lineNo, message: `Unrecognised line inside member block: ${trimmed.slice(0, 80)}` });
      continue;
    }

    const parsed = parseItemLine(trimmed, lineNo, currentCheckNo, currentCheckSeq, errors, currentMember);
    currentCheckNo = parsed.checkNo;
    currentCheckSeq = parsed.checkSeq;
    lines.push(parsed.item);
  }

  if (members.length === 0) {
    throw new MemberSalesParseError('No member block found in the report');
  }

  if (!endOfReport) {
    warnings.push({ lineNo: rawLines.length, message: `Report is missing the "${END_MARKER}" marker` });
  }

  const footer = {
    itemQty: sumOrNull(members.map((member) => member.fItemQty)),
    itemSales: sumOrNull(members.map((member) => member.fItemSales)),
    itemDisc: sumOrNull(members.map((member) => member.fItemDisc)),
    itemTotal: sumOrNull(members.map((member) => member.fItemTotal)),
    checkCount: sumOrNull(members.map((member) => member.fCheckCount)),
    checkDisc: sumOrNull(members.map((member) => member.fCheckDisc)),
    tax: sumOrNull(members.map((member) => member.fTax)),
    sc: sumOrNull(members.map((member) => member.fSc)),
    grossTotal: sumOrNull(members.map((member) => member.fGrossTotal)),
    endOfReport
  };

  return {
    header,
    members,
    lines,
    footer,
    errors,
    warnings,
    meta: {
      totalLines: rawLines.length,
      fileHash: crypto.createHash('sha256').update(buffer).digest('hex')
    }
  };
};

module.exports = {
  REPORT_TITLE,
  END_MARKER,
  MemberSalesParseError,
  decodeReport,
  parseMemberSales,
  parseDateDdMmYyyy,
  parsePrintedAt
};

