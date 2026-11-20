const crypto = require('crypto');

const REPORT_TITLE = 'Member Sales Listing Report';
const END_MARKER = '<< End of Report >>';

/**
 * Nama kolom pada header laporan bisa berubah antar versi POS. Pemetaan dilakukan
 * lewat alias, bukan lewat posisi/index kolom.
 */
const COLUMN_ALIASES = {
  'check#': 'checkNo',
  check: 'checkNo',
  'check no': 'checkNo',
  checkno: 'checkNo',
  'check number': 'checkNo',
  plu: 'plu',
  'plu#': 'plu',
  'plu code': 'plu',
  'item code': 'plu',
  itemcode: 'plu',
  code: 'plu',
  sku: 'plu',
  description: 'description',
  'item description': 'description',
  'item name': 'description',
  desc: 'description',
  name: 'description',
  price: 'price',
  'unit price': 'price',
  unitprice: 'price',
  qty: 'qty',
  quantity: 'qty',
  'qty sold': 'qty',
  'item sales': 'itemSales',
  itemsales: 'itemSales',
  sales: 'itemSales',
  amount: 'itemSales',
  'item amount': 'itemSales',
  'item disc': 'itemDisc',
  'item disc.': 'itemDisc',
  'item discount': 'itemDisc',
  itemdisc: 'itemDisc',
  disc: 'itemDisc',
  discount: 'itemDisc',
  'item total': 'itemTotal',
  itemtotal: 'itemTotal',
  'line total': 'itemTotal'
};

const NUMERIC_COLUMN_KEYS = ['price', 'qty', 'itemSales', 'itemDisc', 'itemTotal'];
const AMOUNT_SOURCES = new Set(['itemTotal', 'itemSales', 'computed']);

/**
 * Label footer member (`Label:,nilai`) juga bisa berbeda antar versi laporan.
 */
const FOOTER_ALIASES = {
  'item sales': 'itemSales',
  'item sale': 'itemSales',
  sales: 'itemSales',
  '#check': 'checkCount',
  '# check': 'checkCount',
  '#checks': 'checkCount',
  '#checks.': 'checkCount',
  check: 'checkCount',
  'check count': 'checkCount',
  'total check': 'checkCount',
  'number of check': 'checkCount',
  'item disc': 'itemDisc',
  'item discount': 'itemDisc',
  disc: 'itemDisc',
  cover: 'cover',
  'cover(s)': 'cover',
  pax: 'cover',
  'check disc': 'checkDisc',
  'check discount': 'checkDisc',
  'sales/#check': 'salesPerCheck',
  'sales/check': 'salesPerCheck',
  'sales per check': 'salesPerCheck',
  'average per check': 'salesPerCheck',
  tax: 'tax',
  vat: 'tax',
  sc: 'sc',
  service: 'sc',
  'service charge': 'sc',
  'gross total': 'grossTotal',
  'grand total': 'grossTotal'
};

const FOOTER_KEYS = [
  'itemQty',
  'itemSales',
  'itemDisc',
  'itemTotal',
  'checkCount',
  'cover',
  'checkDisc',
  'salesPerCheck',
  'tax',
  'sc',
  'grossTotal'
];

class MemberSalesParseError extends Error {
  constructor(message, statusCode = 422, details = null) {
    super(message);
    this.name = 'MemberSalesParseError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const pad2 = (value) => String(value).padStart(2, '0');

/**
 * Deteksi encoding dari BOM, atau dari pola byte 0x00 saat BOM tidak ada.
 */
const detectEncoding = (buffer) => {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { encoding: 'utf16le', bomLength: 2 };
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { encoding: 'utf16be', bomLength: 2 };
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { encoding: 'utf8', bomLength: 3 };
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  let evenZeros = 0;
  let oddZeros = 0;

  for (let index = 0; index + 1 < sample.length; index += 2) {
    if (sample[index] === 0x00) {
      evenZeros += 1;
    }
    if (sample[index + 1] === 0x00) {
      oddZeros += 1;
    }
  }

  const pairs = Math.floor(sample.length / 2) || 1;

  // Teks ASCII di UTF-16LE menaruh byte 0x00 di posisi ganjil, UTF-16BE di posisi genap.
  if (oddZeros / pairs > 0.2 && oddZeros > evenZeros * 4) {
    return { encoding: 'utf16le', bomLength: 0 };
  }

  if (evenZeros / pairs > 0.2 && evenZeros > oddZeros * 4) {
    return { encoding: 'utf16be', bomLength: 0 };
  }

  return { encoding: 'utf8', bomLength: 0 };
};

/**
 * Tukar pasangan byte supaya UTF-16BE bisa dibaca Buffer#toString('utf16le').
 */
const swapUtf16Bytes = (buffer, start) => {
  const usableEnd = buffer.length - ((buffer.length - start) % 2);
  const swapped = Buffer.alloc(Math.max(0, usableEnd - start));

  for (let index = start; index < usableEnd; index += 2) {
    swapped[index - start] = buffer[index + 1];
    swapped[index - start + 1] = buffer[index];
  }

  return swapped;
};

const decodeText = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new MemberSalesParseError('Uploaded file is empty');
  }

  const { encoding, bomLength } = detectEncoding(buffer);
  let text;

  if (encoding === 'utf16le') {
    text = buffer.subarray(bomLength).toString('utf16le');
  } else if (encoding === 'utf16be') {
    text = swapUtf16Bytes(buffer, bomLength).toString('utf16le');
  } else {
    text = buffer.subarray(bomLength).toString('utf8');
  }

  text = text.replace(/^\uFEFF/, '').replace(/\u0000+$/g, '');

  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  return { encoding, lines, text };
};

/**
 * Decode the POS export. Mengembalikan daftar baris (API lama tetap dipertahankan).
 */
const decodeReport = (buffer) => decodeText(buffer).lines;

const NUMERIC_TEXT_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Baca angka tanpa menelan teks diam-diam. Mendukung spasi padding, tanda minus,
 * desimal, format ribuan `1,234.56`, dan format Eropa `1.234,56`.
 */
const toAmount = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  let text = String(value).trim();

  if (!text) {
    return null;
  }

  if (/^\(.*\)$/.test(text)) {
    text = `-${text.slice(1, -1).trim()}`;
  }

  text = text.replace(/[\s\u00A0]/g, '');

  if (!text) {
    return null;
  }

  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replace(/,/g, '');
  } else if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?\d+,\d{1,2}$/.test(text)) {
    text = text.replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }

  if (!NUMERIC_TEXT_PATTERN.test(text)) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const toInteger = (value) => {
  const parsed = toAmount(value);

  if (parsed === null || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
};

const isNumericCell = (value) => toAmount(value) !== null;

/**
 * `dd/mm/yyyy` (atau `yyyy-mm-dd`) -> `yyyy-mm-dd`. Null bila tidak valid.
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

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const parseAnyDate = (value) => {
  const text = String(value || '').trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return parseDateDdMmYyyy(`${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}`);
  }

  return parseDateDdMmYyyy(text);
};

/**
 * `dd/mm/yyyy hh:mm(:ss) am|pm` -> `yyyy-mm-dd hh:mm:ss`.
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

const normalizeLabel = (value) =>
  String(value === null || value === undefined ? '' : value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/:$/, '')
    .trim();

/**
 * Laporan memakai `,,` sebagai pemisah kolom. Bila sebuah baris hanya memakai
 * koma tunggal (footer `TAX:, 123`), baris itu tetap dipecah per koma.
 */
const splitColumns = (line) => {
  const cells = String(line).split(',,').map((cell) => cell.trim());

  if (cells.length > 1) {
    return cells;
  }

  const single = String(line)
    .split(',')
    .map((cell) => cell.trim());

  return single.length > 1 ? single : cells;
};

/**
 * Bangun peta kolom dari baris header. Kunci yang tidak dikenal disimpan sebagai
 * `extra:<nama kolom>` supaya nilainya tidak hilang.
 */
const buildColumnMap = (cells) => {
  if (!Array.isArray(cells) || cells.length < 2) {
    return null;
  }

  const keys = cells.map((cell) => {
    const label = normalizeLabel(cell);

    if (!label) {
      return null;
    }

    return COLUMN_ALIASES[label] || `extra:${label}`;
  });

  const numericCount = keys.filter((key) => key && NUMERIC_COLUMN_KEYS.includes(key)).length;
  const hasIdentity = keys.includes('plu') || keys.includes('description');

  if (numericCount < 2 || !hasIdentity) {
    return null;
  }

  const indexByKey = new Map();

  keys.forEach((key, index) => {
    if (key && !indexByKey.has(key)) {
      indexByKey.set(key, index);
    }
  });

  return { keys, indexByKey, length: keys.length };
};

/**
 * Ambil cell dari kanan berdasarkan posisi kolom di header. Ini membuat baris
 * lanjutan (tanpa Check#) dan Description yang mengandung `,,` tetap sejajar.
 */
const cellFromRight = (cells, columnMap, headerIndex) => {
  const position = cells.length - columnMap.length + headerIndex;

  if (position < 0 || position >= cells.length) {
    return null;
  }

  return cells[position];
};

/**
 * Footer member berisi pasangan `Label:,nilai`; antar pasangan dipisah `,,` dan
 * label/nilai dipisah satu koma. Baris dianggap footer hanya bila seluruh isinya
 * berbentuk pasangan label/nilai, supaya baris item tidak salah kelas.
 */
const readFooterPairs = (line) => {
  const tokens = String(line)
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '');

  if (tokens.length < 2 || tokens.length % 2 !== 0) {
    return null;
  }

  const pairs = [];

  for (let index = 0; index < tokens.length; index += 2) {
    const label = tokens[index];

    if (!/^[^:]+:$/.test(label)) {
      return null;
    }

    pairs.push({ label, value: tokens[index + 1] });
  }

  return pairs;
};

const applyFooterPairs = (member, pairs, lineNo, warnings) => {
  member.sawFooter = true;

  for (const { label, value } of pairs) {
    const key = FOOTER_ALIASES[normalizeLabel(label)];

    if (!key) {
      member.footerExtra[normalizeLabel(label)] = String(value || '').trim() || null;
      continue;
    }

    const parsed = key === 'checkCount' || key === 'cover' ? toInteger(value) : toAmount(value);

    if (parsed === null) {
      warnings.push({
        lineNo,
        code: 'UNPARSABLE_FOOTER',
        message: `Footer value for "${String(label).trim()}" is not a number: "${value}"`,
        text: `${label},${value}`
      });
      continue;
    }

    member.footer[key] = parsed;
  }
};

/**
 * Baris `Total:` berisi beberapa angka tanpa label. Jumlah kolomnya bisa berbeda
 * antar versi laporan, jadi dipetakan dari kanan (qty, sales, disc, total).
 */
const applyFooterTotal = (member, cells, lineNo, warnings) => {
  member.sawFooter = true;
  const values = cells.slice(1);

  if (values.length === 4) {
    member.footer.itemQty = toInteger(values[0]);
    member.footer.itemSales = toAmount(values[1]);
    member.footer.itemDisc = toAmount(values[2]);
    member.footer.itemTotal = toAmount(values[3]);
  } else if (values.length === 3) {
    member.footer.itemQty = toInteger(values[0]);
    member.footer.itemSales = toAmount(values[1]);
    member.footer.itemTotal = toAmount(values[2]);
  } else if (values.length === 2) {
    member.footer.itemQty = toInteger(values[0]);
    member.footer.itemTotal = toAmount(values[1]);
  } else {
    warnings.push({
      lineNo,
      code: 'UNPARSABLE_FOOTER',
      message: `Total line has ${values.length} value(s); expected 2-4`,
      text: cells.join(',,')
    });
    return;
  }

  for (const key of ['itemQty', 'itemSales', 'itemDisc', 'itemTotal']) {
    if (member.footer[key] === null) {
      warnings.push({
        lineNo,
        code: 'UNPARSABLE_FOOTER',
        message: `Footer value for "${key}" is not a number`,
        text: cells.join(',,')
      });
    }
  }
};

const firstNumericIndex = (columnMap) => {
  let first = columnMap.length;

  for (const key of NUMERIC_COLUMN_KEYS) {
    const index = columnMap.indexByKey.get(key);

    if (index !== undefined && index < first) {
      first = index;
    }
  }

  return first;
};

/**
 * Ambil semua kolom angka yang ada di header, dari kanan. Nilai yang tidak valid
 * dibiarkan null dan dilaporkan (tidak diganti 0).
 */
const collectNumeric = (cells, columnMap) => {
  const result = { values: {}, missing: [], extra: {}, present: [] };

  NUMERIC_COLUMN_KEYS.forEach((key) => {
    result.values[key] = null;
  });

  for (const key of NUMERIC_COLUMN_KEYS) {
    const index = columnMap.indexByKey.get(key);

    if (index === undefined) {
      continue;
    }

    result.present.push(key);
    const raw = cellFromRight(cells, columnMap, index);
    const value = key === 'qty' ? toInteger(raw) : toAmount(raw);
    result.values[key] = value;

    if (value === null) {
      result.missing.push({ key, raw });
    }
  }

  for (const [key, index] of columnMap.indexByKey.entries()) {
    if (!key.startsWith('extra:')) {
      continue;
    }

    const raw = cellFromRight(cells, columnMap, index);
    result.extra[key.slice('extra:'.length)] = raw === null ? null : raw || null;
  }

  return result;
};

/**
 * Fallback saat header kolom tidak ada / tidak terbaca: ambil deretan angka dari
 * kanan sebanyak kolom angka standar, sisanya dianggap teks identitas.
 */
const collectTrailingNumbers = (cells) => {
  const tail = [];

  for (let index = cells.length - 1; index >= 0 && tail.length < 5; index -= 1) {
    if (!isNumericCell(cells[index])) {
      break;
    }

    tail.unshift(cells[index]);
  }

  if (tail.length < 5) {
    return null;
  }

  return {
    values: {
      price: toAmount(tail[0]),
      qty: toInteger(tail[1]),
      itemSales: toAmount(tail[2]),
      itemDisc: toAmount(tail[3]),
      itemTotal: toAmount(tail[4])
    },
    leftCells: cells.slice(0, cells.length - 5),
    extra: {}
  };
};

/**
 * Petakan cell teks (di kiri kolom angka pertama) ke kolom identitasnya.
 * Description boleh terdiri dari beberapa cell karena teks aslinya bisa memuat `,,`.
 */
const assignIdentity = (leftCells, hasCheck, columnMap) => {
  const values = { checkNo: null, plu: null, description: null };
  const extra = {};

  if (!columnMap) {
    let rest = leftCells;

    if (hasCheck && rest.length > 0) {
      values.checkNo = rest[0] || null;
      rest = rest.slice(1);
    }

    values.plu = rest.length > 0 ? rest[0] || null : null;

    if (rest.length > 1) {
      values.description = rest.slice(1).join(',,').trim() || null;
    }

    return { values, extra };
  }

  const leftKeys = columnMap.keys.slice(0, firstNumericIndex(columnMap));
  let cursor = 0;

  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];

    if (!key) {
      cursor += 1;
      continue;
    }

    if (key === 'description') {
      const reserved = leftKeys.slice(index + 1).filter((item) => item && item !== 'description').length;
      const take = Math.max(0, leftCells.length - cursor - reserved);
      values.description = leftCells.slice(cursor, cursor + take).join(',,').trim() || null;
      cursor += take;
      continue;
    }

    if (key === 'checkNo') {
      if (hasCheck) {
        values.checkNo = leftCells[cursor] || null;
        cursor += 1;
      }
      continue;
    }

    if (key.startsWith('extra:')) {
      extra[key.slice('extra:'.length)] = leftCells[cursor] || null;
      cursor += 1;
      continue;
    }

    values[key] = leftCells[cursor] || null;
    cursor += 1;
  }

  if (cursor < leftCells.length) {
    const remainder = leftCells.slice(cursor).join(',,').trim();

    if (remainder) {
      values.description = values.description ? `${values.description},,${remainder}` : remainder;
    }
  }

  return { values, extra };
};

/**
 * Baca satu baris item. Nilai angka diambil dari kanan (selaras header) supaya
 * baris lanjutan tanpa Check# tetap terbaca. Bila header tidak ada, dipakai
 * fallback deretan angka di ujung baris.
 */
const readItemRow = ({ cells, columnMap, line, lineNo, amountSource, errors }) => {
  if (!Array.isArray(cells) || cells.length < 2) {
    return null;
  }

  // Baris lanjutan kadang tetap menulis pemisah untuk kolom Check# yang kosong.
  const workingCells =
    columnMap && columnMap.indexByKey.has('checkNo') && cells[0] === '' ? cells.slice(1) : cells;

  let numeric = null;

  if (columnMap) {
    const collected = collectNumeric(workingCells, columnMap);

    if (collected.present.length > 0 && collected.missing.length < collected.present.length) {
      numeric = collected;
    }
  }

  let leftCells;
  let hasCheck;
  let values;
  let extra;

  if (numeric) {
    const first = firstNumericIndex(columnMap);
    const leftCount = workingCells.length - (columnMap.length - first);
    leftCells = workingCells.slice(0, Math.max(0, leftCount));
    hasCheck =
      columnMap.indexByKey.has('checkNo') &&
      workingCells.length >= columnMap.length &&
      /^\d+$/.test(workingCells[0]);
    values = numeric.values;
    extra = numeric.extra;

    if (numeric.missing.length > 0) {
      errors.push({
        lineNo,
        message: `Could not read numeric value(s): ${numeric.missing.map((item) => item.key).join(', ')}`,
        rawLine: line.slice(0, 1000)
      });
    }
  } else {
    const fallback = collectTrailingNumbers(workingCells);

    if (!fallback) {
      return null;
    }

    leftCells = fallback.leftCells;
    hasCheck = leftCells.length >= 3 && /^\d+$/.test(leftCells[0]);
    values = fallback.values;
    extra = fallback.extra;
  }

  const identity = assignIdentity(leftCells, hasCheck, columnMap);

  if (!identity.values.plu && !identity.values.description) {
    return null;
  }

  let amount = values.itemTotal;

  if (amountSource === 'itemSales') {
    amount = values.itemSales;
  } else if (amountSource === 'computed') {
    amount = values.price === null || values.qty === null
      ? null
      : round2(values.price * values.qty - (values.itemDisc || 0));
  }

  return {
    hasCheck,
    checkNo: identity.values.checkNo,
    plu: identity.values.plu,
    description: identity.values.description,
    price: values.price,
    qty: values.qty,
    itemSales: values.itemSales,
    itemDisc: values.itemDisc,
    itemTotal: values.itemTotal,
    amount,
    extra: { ...extra, ...identity.extra }
  };
};

const createMember = ({ memberId, memberName, startLineNo, blockIndex }) => ({
  memberId,
  memberName,
  name: memberName,
  startLineNo,
  blockIndex,
  checks: [],
  footer: {},
  footerExtra: {},
  computed: null,
  sawFooter: false,
  finalized: false,
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
});

const amountsEqual = (left, right) => Math.abs(Number(left) - Number(right)) <= 0.005;

const sumOrNull = (values) => {
  const numbers = values.filter((value) => value !== null && value !== undefined);

  if (numbers.length === 0) {
    return null;
  }

  return round2(numbers.reduce((total, value) => total + Number(value), 0));
};

/**
 * Tutup satu member: hitung ulang dari item, bandingkan dengan footer, dan buat
 * baris isu. Tidak ada nilai yang diubah; hanya dilaporkan.
 */
const finalizeMember = ({ member, issues, warnings }) => {
  if (!member || member.finalized) {
    return member;
  }

  member.finalized = true;

  const computed = { itemQty: 0, itemSales: 0, itemDisc: 0, itemTotal: 0, checkCount: member.checks.length };

  for (const check of member.checks) {
    for (const item of check.items) {
      computed.itemQty += item.qty || 0;
      computed.itemSales += item.itemSales || 0;
      computed.itemDisc += item.itemDisc || 0;
      computed.itemTotal += item.itemTotal || 0;
    }
  }

  computed.itemSales = round2(computed.itemSales);
  computed.itemDisc = round2(computed.itemDisc);
  computed.itemTotal = round2(computed.itemTotal);
  member.computed = computed;

  const footer = {};
  FOOTER_KEYS.forEach((key) => {
    footer[key] = member.footer[key] === undefined ? null : member.footer[key];
  });
  footer.qty = footer.itemQty;
  footer.extra = member.footerExtra;
  member.footer = footer;

  member.fItemQty = footer.itemQty;
  member.fItemSales = footer.itemSales;
  member.fItemDisc = footer.itemDisc;
  member.fItemTotal = footer.itemTotal;
  member.fCheckCount = footer.checkCount;
  member.fCover = footer.cover;
  member.fCheckDisc = footer.checkDisc;
  member.fTax = footer.tax;
  member.fSc = footer.sc;
  member.fGrossTotal = footer.grossTotal;

  if (!member.sawFooter) {
    warnings.push({
      lineNo: member.startLineNo,
      code: 'MISSING_FOOTER',
      message: `Member ${member.memberId || '(unknown)'} has no footer summary; the file may be truncated`,
      text: ''
    });
  }

  const addMemberIssue = (type, severity, expected, actual, message) => {
    issues.push({
      scope: 'member',
      lineNo: member.startLineNo,
      memberId: member.memberId,
      memberStartLineNo: member.startLineNo,
      checkSeq: null,
      checkNo: null,
      plu: null,
      type,
      severity,
      expected,
      actual,
      message
    });
  };

  if (footer.itemQty !== null && computed.itemQty !== footer.itemQty) {
    addMemberIssue(
      'footerItemQty',
      'ERROR',
      computed.itemQty,
      footer.itemQty,
      `Item rows Qty (${computed.itemQty}) does not match the member footer (${footer.itemQty})`
    );
  }

  if (footer.itemSales !== null && !amountsEqual(computed.itemSales, footer.itemSales)) {
    addMemberIssue(
      'footerItemSales',
      'ERROR',
      computed.itemSales,
      footer.itemSales,
      `Item rows Item Sales (${round2(computed.itemSales)}) does not match the member footer (${round2(footer.itemSales)})`
    );
  }

  if (footer.itemTotal !== null && !amountsEqual(computed.itemTotal, footer.itemTotal)) {
    addMemberIssue(
      'footerItemTotal',
      'WARNING',
      computed.itemTotal,
      footer.itemTotal,
      `Item rows Item Total (${round2(computed.itemTotal)}) differs from the member footer (${round2(footer.itemTotal)})`
    );
  }

  if (footer.checkCount !== null && computed.checkCount !== footer.checkCount) {
    addMemberIssue(
      'footerCheckCount',
      'ERROR',
      computed.checkCount,
      footer.checkCount,
      `Item rows Check# count (${computed.checkCount}) does not match the member footer (${footer.checkCount})`
    );
  }

  const grossParts = [footer.itemTotal, footer.checkDisc, footer.tax, footer.sc];

  if (grossParts.every((value) => value !== null)) {
    const expected = round2(footer.itemTotal - footer.checkDisc + footer.tax + footer.sc);

    if (!amountsEqual(expected, footer.grossTotal)) {
      addMemberIssue(
        'grossTotal',
        'WARNING',
        expected,
        footer.grossTotal,
        `Gross Total (${round2(footer.grossTotal)}) does not match Item Total - Check Disc + TAX + SC (${expected})`
      );
    }
  }

  collectItemIssues(member, issues);

  return member;
};

const collectItemIssues = (member, issues) => {
  for (const check of member.checks) {
    for (const item of check.items) {
      if (item.price !== null && item.qty !== null && item.itemSales !== null) {
        const expected = round2(item.price * item.qty);

        if (!amountsEqual(expected, item.itemSales)) {
          issues.push({
            scope: 'line',
            lineNo: item.lineNo,
            memberId: member.memberId,
            memberStartLineNo: member.startLineNo,
            checkSeq: item.checkSeq,
            checkNo: item.checkNo,
            plu: item.plu,
            type: 'priceQty',
            severity: 'ERROR',
            expected,
            actual: item.itemSales,
            message: `Price x Qty (${expected}) does not match Item Sales (${round2(item.itemSales)})`
          });
        }
      }

      if (item.itemSales !== null && item.itemDisc !== null && item.itemTotal !== null) {
        const expected = round2(item.itemSales - item.itemDisc);

        if (!amountsEqual(expected, item.itemTotal)) {
          issues.push({
            scope: 'line',
            lineNo: item.lineNo,
            memberId: member.memberId,
            memberStartLineNo: member.startLineNo,
            checkSeq: item.checkSeq,
            checkNo: item.checkNo,
            plu: item.plu,
            type: 'itemTotal',
            severity: 'WARNING',
            expected,
            actual: item.itemTotal,
            message: `Item Total (${round2(item.itemTotal)}) does not match Item Sales - Item Disc (${expected})`
          });
        }
      }
    }
  }
};

/**
 * Baris meta di atas blok member (atau di header blok yang diulang).
 * Mengembalikan true bila baris dikenali sebagai meta.
 */
const parseMetaLine = (trimmed, header, lineNo, warnings) => {
  if (/^Bus\s*Date\b/i.test(trimmed)) {
    const period = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s*(?:to|until|s\/d|-)\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i.exec(trimmed);

    if (period) {
      header.periodFrom = header.periodFrom || parseAnyDate(period[1]);
      header.periodTo = header.periodTo || parseAnyDate(period[2]);
    } else {
      warnings.push({
        lineNo,
        code: 'BUS_DATE',
        message: 'Bus Date period could not be parsed',
        text: trimmed.slice(0, 1000)
      });
    }

    const printed = /Printed\s*At\s*:\s*,?\s*([^,]+)/i.exec(trimmed);

    if (printed) {
      header.printedAt = header.printedAt || parsePrintedAt(printed[1]);

      if (!header.printedAt) {
        warnings.push({
          lineNo,
          code: 'PRINTED_AT',
          message: `Printed At value could not be parsed: "${printed[1].trim()}"`,
          text: trimmed.slice(0, 1000)
        });
      }
    }

    return true;
  }

  if (/^Printed\s*At\s*:/i.test(trimmed)) {
    const match = /^Printed\s*At\s*:\s*,?\s*(.*)$/i.exec(trimmed);
    const value = match ? match[1].trim() : '';
    header.printedAt = header.printedAt || parsePrintedAt(value);

    if (!header.printedAt) {
      warnings.push({
        lineNo,
        code: 'PRINTED_AT',
        message: `Printed At value could not be parsed: "${value}"`,
        text: trimmed.slice(0, 1000)
      });
    }

    return true;
  }

  if (/^Printed\s*By\s*:/i.test(trimmed)) {
    const match = /^Printed\s*By\s*:\s*,?\s*(.*)$/i.exec(trimmed);
    header.printedBy = header.printedBy || ((match && match[1].trim()) || null);
    return true;
  }

  const outlet = /^\(([^()]*)\)$/.exec(trimmed);

  if (outlet) {
    header.outlet = header.outlet || (outlet[1].trim() || null);
    return true;
  }

  return false;
};

const MEMBER_LINE_PATTERN =
  /^Member\s*ID\s*:\s*,*\s*([^,]*)\s*(?:,,\s*Member\s*Name\s*:\s*,?\s*(.*))?$/i;

const createMemberFromLine = (trimmed, lineNo, blockIndex, errors) => {
  const match = MEMBER_LINE_PATTERN.exec(trimmed);
  const memberId = match ? String(match[1] || '').trim() : '';
  const rawName = match ? String(match[2] || '').trim() : '';
  const memberName = rawName.replace(/^,+|,+$/g, '').trim() || null;

  if (!memberId) {
    errors.push({ lineNo, message: 'Member ID is empty', rawLine: trimmed.slice(0, 1000) });
  }

  return createMember({
    memberId: memberId || null,
    memberName,
    startLineNo: lineNo,
    blockIndex
  });
};

/**
 * Parse a "Member Sales Listing Report" buffer into structured data.
 * Pure function: no database access, no side effects.
 *
 * @param {Buffer} buffer raw uploaded file
 * @param {object} [options]
 * @param {'itemTotal'|'itemSales'|'computed'} [options.amountSource='itemTotal']
 * @returns {{header: object, members: object[], lines: object[], footer: object,
 *   issues: object[], errors: object[], warnings: object[], meta: object}}
 */
const parseMemberSales = (buffer, options = {}) => {
  const amountSource = AMOUNT_SOURCES.has(options.amountSource) ? options.amountSource : 'itemTotal';
  const { encoding, lines: rawLines, text } = decodeText(buffer);

  const errors = [];
  const warnings = [];
  const issues = [];
  const members = [];
  const lines = [];

  const header = {
    title: null,
    outlet: null,
    periodFrom: null,
    periodTo: null,
    printedAt: null,
    printedAtRaw: null,
    printedBy: null
  };

  let titleIndex = -1;
  let preambleCount = 0;

  for (let index = 0; index < rawLines.length; index += 1) {
    const trimmed = rawLines[index].trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed.toLowerCase().includes(REPORT_TITLE.toLowerCase())) {
      titleIndex = index;
      break;
    }

    preambleCount += 1;

    if (preambleCount <= 20) {
      warnings.push({
        lineNo: index + 1,
        code: 'PREAMBLE',
        message: `Line before the report title was ignored: ${trimmed.slice(0, 80)}`,
        text: trimmed.slice(0, 1000)
      });
    }
  }

  if (titleIndex === -1) {
    throw new MemberSalesParseError(
      `Unsupported file. Expected a "${REPORT_TITLE}" export, but the title was not found`
    );
  }

  header.title = rawLines[titleIndex].trim();

  let currentMember = null;
  let currentCheck = null;
  let columnMap = null;
  let blockIndex = 0;
  let endOfReport = false;

  const closeMember = () => {
    if (!currentMember) {
      return;
    }

    finalizeMember({ member: currentMember, issues, warnings });
    currentMember = null;
    currentCheck = null;
  };

  for (let index = titleIndex; index < rawLines.length; index += 1) {
    const raw = rawLines[index];
    const trimmed = raw.trim();
    const lineNo = index + 1;

    if (!trimmed) {
      continue;
    }

    if (endOfReport) {
      warnings.push({
        lineNo,
        code: 'AFTER_END',
        message: `Line after the end-of-report marker: ${trimmed.slice(0, 80)}`,
        text: trimmed.slice(0, 1000)
      });
      continue;
    }

    if (/^-{3,}/.test(trimmed)) {
      continue;
    }

    if (trimmed.startsWith('<<')) {
      endOfReport = true;
      closeMember();
      continue;
    }

    if (index === titleIndex) {
      continue;
    }

    if (trimmed.length <= 120 && trimmed.toLowerCase().includes(REPORT_TITLE.toLowerCase())) {
      closeMember();
      columnMap = null;
      blockIndex += 1;
      continue;
    }

    if (parseMetaLine(trimmed, header, lineNo, warnings)) {
      const printed = /Printed\s*At\s*:\s*,?\s*([^,]+)/i.exec(trimmed);

      if (printed && !header.printedAtRaw) {
        header.printedAtRaw = printed[1].trim();
      }

      continue;
    }

    if (/^Member\s*ID\s*:/i.test(trimmed)) {
      closeMember();
      currentMember = createMemberFromLine(trimmed, lineNo, blockIndex, errors);
      members.push(currentMember);
      continue;
    }

    const cells = splitColumns(trimmed);
    const headerMap = buildColumnMap(cells);

    if (headerMap) {
      columnMap = headerMap;
      continue;
    }

    if (/^Total\s*:/i.test(cells[0] || '')) {
      if (currentMember) {
        applyFooterTotal(currentMember, cells, lineNo, warnings);
      } else {
        warnings.push({
          lineNo,
          code: 'FOOTER_OUTSIDE_MEMBER',
          message: 'Total line found outside a member block',
          text: trimmed.slice(0, 1000)
        });
      }

      continue;
    }

    const footerPairs = readFooterPairs(trimmed);

    if (footerPairs) {
      if (currentMember) {
        applyFooterPairs(currentMember, footerPairs, lineNo, warnings);
      } else {
        warnings.push({
          lineNo,
          code: 'FOOTER_OUTSIDE_MEMBER',
          message: 'Footer line found outside a member block',
          text: trimmed.slice(0, 1000)
        });
      }

      continue;
    }

    if (!currentMember) {
      warnings.push({
        lineNo,
        code: 'UNKNOWN_LINE',
        message: `Line outside a member block was ignored: ${trimmed.slice(0, 80)}`,
        text: trimmed.slice(0, 1000)
      });
      continue;
    }

    const item = readItemRow({ cells, columnMap, line: trimmed, lineNo, amountSource, errors });

    if (!item) {
      warnings.push({
        lineNo,
        code: 'UNKNOWN_LINE',
        message: `Unrecognised line inside member block: ${trimmed.slice(0, 80)}`,
        text: trimmed.slice(0, 1000)
      });
      continue;
    }

    let check = currentCheck;

    if (item.hasCheck) {
      check = {
        seq: currentMember.checks.length + 1,
        no: item.checkNo,
        lineNo,
        items: []
      };
      currentMember.checks.push(check);
      currentCheck = check;
    } else if (!check) {
      errors.push({
        lineNo,
        message: 'Item row has no Check# and no previous check to inherit',
        rawLine: trimmed.slice(0, 1000)
      });
    }

    const line = {
      lineNo,
      memberId: currentMember.memberId,
      memberName: currentMember.memberName,
      memberStartLineNo: currentMember.startLineNo,
      memberKey: `${currentMember.startLineNo}:${currentMember.memberId || ''}`,
      checkNo: check ? check.no : null,
      checkSeq: check ? check.seq : null,
      plu: item.plu,
      description: item.description,
      price: item.price,
      qty: item.qty,
      itemSales: item.itemSales,
      itemDisc: item.itemDisc,
      itemTotal: item.itemTotal,
      amount: item.amount,
      amountSource,
      extra: item.extra,
      rawLine: trimmed.slice(0, 1000)
    };

    lines.push(line);

    if (check) {
      check.items.push(line);
    }
  }

  closeMember();

  if (members.length === 0) {
    throw new MemberSalesParseError('No member block found in the report');
  }

  if (!endOfReport) {
    warnings.push({
      lineNo: rawLines.length,
      code: 'NO_END_MARKER',
      message: `Report is missing the "${END_MARKER}" marker`,
      text: ''
    });
  }

  const footer = {
    itemQty: sumOrNull(members.map((member) => member.footer.itemQty)),
    itemSales: sumOrNull(members.map((member) => member.footer.itemSales)),
    itemDisc: sumOrNull(members.map((member) => member.footer.itemDisc)),
    itemTotal: sumOrNull(members.map((member) => member.footer.itemTotal)),
    checkCount: sumOrNull(members.map((member) => member.footer.checkCount)),
    checkDisc: sumOrNull(members.map((member) => member.footer.checkDisc)),
    tax: sumOrNull(members.map((member) => member.footer.tax)),
    sc: sumOrNull(members.map((member) => member.footer.sc)),
    grossTotal: sumOrNull(members.map((member) => member.footer.grossTotal)),
    endOfReport
  };

  return {
    header,
    outlet: header.outlet,
    dateFrom: header.periodFrom,
    dateTo: header.periodTo,
    printedAt: header.printedAt,
    printedBy: header.printedBy,
    members,
    lines,
    footer,
    issues,
    errors,
    warnings: warnings.map((warning) => ({ ...warning, line: warning.lineNo })),
    amountSource,
    meta: {
      totalLines: rawLines.length,
      encoding,
      blocks: blockIndex + 1,
      amountSource,
      fileHash: crypto.createHash('sha256').update(buffer).digest('hex'),
      byteLength: buffer.length,
      charLength: text.length
    }
  };
};

module.exports = {
  REPORT_TITLE,
  END_MARKER,
  MemberSalesParseError,
  decodeReport,
  decodeText,
  detectEncoding,
  parseMemberSales,
  parseDateDdMmYyyy,
  parsePrintedAt,
  toAmount,
  toInteger
};
