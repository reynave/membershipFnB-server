const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { DBFFile, DELETED } = require('dbffile');

/**
 * Server-side reader for Igourmate DBF files.
 *
 * The Angular admin never parses a DBF: the file is uploaded untouched and this
 * module decodes the header, the field descriptors and every record with the
 * third-party `dbffile` package (dBase III / IV / Visual FoxPro).
 *
 * `DBFFile.open()` only accepts a path, while multer keeps the upload in memory,
 * so the buffer is written to a short-lived temp file and removed afterwards.
 */

const DEFAULT_ENCODING = 'windows-1252';
const MAX_FIELD_COUNT = 2048;

const DATASET_LABELS = {
  DAILY_CHECK: 'Daily check (POS)',
  MEMBER_PROFILE: 'Member profile',
  MEMBER_CLASS: 'Member class',
  SALES: 'Sales / receipt',
  UNKNOWN: 'Unknown dataset'
};

const SUPPORTED_ENCODINGS = new Set([
  'windows-1252',
  'iso-8859-1',
  'windows-1250',
  'windows-1251',
  'windows-1253',
  'windows-1254',
  'windows-1257',
  'cp437',
  'cp850',
  'cp852',
  'cp865',
  'cp866',
  'ibm866',
  'utf-8'
]);

/** dBase language driver byte (offset 29) -> iconv encoding. */
const LANGUAGE_DRIVER_ENCODINGS = new Map([
  [0x01, 'cp437'],
  [0x02, 'cp850'],
  [0x03, 'windows-1252'],
  [0x57, 'windows-1252'],
  [0x58, 'windows-1252'],
  [0x59, 'windows-1252'],
  [0x64, 'cp852'],
  [0x65, 'cp866'],
  [0x66, 'cp865'],
  [0xc8, 'windows-1250'],
  [0xc9, 'windows-1251'],
  [0xca, 'windows-1254'],
  [0xcb, 'windows-1253'],
  [0xcc, 'windows-1257']
]);

const DBF_VERSION_LABELS = new Map([
  [0x02, 'FoxBASE'],
  [0x03, 'dBase III'],
  [0x04, 'dBase IV'],
  [0x05, 'dBase V'],
  [0x07, 'Visual FoxPro'],
  [0x30, 'Visual FoxPro'],
  [0x31, 'Visual FoxPro (auto increment)'],
  [0x32, 'Visual FoxPro (VarChar)'],
  [0x7b, 'dBase IV with memo'],
  [0x83, 'dBase III with memo'],
  [0x8b, 'dBase IV with memo'],
  [0xf5, 'FoxPro 2.x with memo']
]);

class IgourmeteDbfParseError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'IgourmeteDbfParseError';
    this.statusCode = 422;
    this.details = details;
  }
}

const pad2 = (value) => String(value).padStart(2, '0');

const formatDateParts = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const formatTimeParts = (year, month, day, hour, minute, second) => {
  const date = formatDateParts(year, month, day);

  if (!date || hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  return `${date} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
};

/** DBF `D` values (and legacy `YYYYMMDD` strings) -> `YYYY-MM-DD`. */
const parseDateValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : formatDateParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (compact) {
    return formatDateParts(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  }

  const dashed = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (dashed) {
    return formatDateParts(Number(dashed[1]), Number(dashed[2]), Number(dashed[3]));
  }

  return null;
};

/** DBF `T` values (and legacy `YYYYMMDDHHmmss` strings) -> `YYYY-MM-DD HH:mm:ss`. */
const parseDateTimeValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return formatTimeParts(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds()
    );
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(text);
  if (compact) {
    return formatTimeParts(
      Number(compact[1]),
      Number(compact[2]),
      Number(compact[3]),
      Number(compact[4]),
      Number(compact[5]),
      Number(compact[6])
    );
  }

  const compactDay = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (compactDay) {
    const date = formatDateParts(
      Number(compactDay[1]),
      Number(compactDay[2]),
      Number(compactDay[3])
    );
    return date ? `${date} 00:00:00` : null;
  }

  const dashed = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(text);
  if (dashed) {
    return formatTimeParts(
      Number(dashed[1]),
      Number(dashed[2]),
      Number(dashed[3]),
      Number(dashed[4]),
      Number(dashed[5]),
      dashed[6] ? Number(dashed[6]) : 0
    );
  }

  return null;
};

const normaliseEncodingName = (value) => {
  const text = String(value || '').trim().toLowerCase();

  if (!text || text === 'auto') {
    return 'auto';
  }

  const aliases = {
    ansi: 'windows-1252',
    latin1: 'iso-8859-1',
    'iso8859-1': 'iso-8859-1',
    utf8: 'utf-8',
    'cp-1252': 'windows-1252',
    win1252: 'windows-1252'
  };

  return aliases[text] || text;
};

/**
 * Explicit encoding wins; otherwise the DBF language driver byte decides and the
 * ancient "no codepage" (0) files fall back to Windows-1252.
 */
const resolveEncoding = (requestedEncoding, languageDriver) => {
  const requested = normaliseEncodingName(requestedEncoding);

  if (requested !== 'auto') {
    if (!SUPPORTED_ENCODINGS.has(requested)) {
      throw new IgourmeteDbfParseError(
        `Unsupported encoding "${requestedEncoding}". Use auto, windows-1252, ` +
          'iso-8859-1, windows-1250, windows-1251, cp437, cp850 or utf-8.'
      );
    }

    return requested;
  }

  return LANGUAGE_DRIVER_ENCODINGS.get(languageDriver) || DEFAULT_ENCODING;
};

const readHeader = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new IgourmeteDbfParseError('The uploaded file is empty.');
  }

  if (buffer.length < 32) {
    throw new IgourmeteDbfParseError(
      'The uploaded file is too small to be a DBF file (the header needs at least 32 bytes).'
    );
  }

  const version = buffer.readUInt8(0);
  const yearByte = buffer.readUInt8(1);
  const month = buffer.readUInt8(2);
  const day = buffer.readUInt8(3);
  const recordCount = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  const languageDriver = buffer.readUInt8(29);

  if (headerLength < 33 || headerLength > buffer.length) {
    throw new IgourmeteDbfParseError(
      `Invalid DBF header length (${headerLength}). The file is not a readable DBF file.`
    );
  }

  if ((headerLength - 33) % 32 !== 0) {
    throw new IgourmeteDbfParseError(
      'Invalid DBF field descriptor area. The file is not a readable DBF file.'
    );
  }

  const fieldCount = (headerLength - 33) / 32;

  if (fieldCount < 1 || fieldCount > MAX_FIELD_COUNT) {
    throw new IgourmeteDbfParseError(
      `Invalid number of DBF fields (${fieldCount}). The file is not a readable DBF file.`
    );
  }

  if (buffer[headerLength - 1] !== 0x0d) {
    throw new IgourmeteDbfParseError(
      'The DBF header terminator (0x0D) is missing. The file is not a readable DBF file.'
    );
  }

  if (recordLength < 1) {
    throw new IgourmeteDbfParseError(`Invalid DBF record length (${recordLength}).`);
  }

  const declaredSize = headerLength + recordCount * recordLength;

  if (declaredSize > buffer.length) {
    throw new IgourmeteDbfParseError(
      `The DBF file is truncated: the header declares ${recordCount} record(s) ` +
        `(${declaredSize} bytes) but the upload only has ${buffer.length} bytes.`
    );
  }

  if (recordCount === 0) {
    throw new IgourmeteDbfParseError('The DBF file contains no records.');
  }

  // Modern writers store "year - 2000" instead of the dBase "year - 1900".
  const pivotYear = yearByte < 80 ? 2000 + yearByte : 1900 + yearByte;
  const lastUpdated = formatDateParts(pivotYear, month, day);

  return {
    version,
    versionLabel: DBF_VERSION_LABELS.get(version) || `Unknown (0x${version.toString(16)})`,
    lastUpdated,
    recordCount,
    headerLength,
    recordLength,
    languageDriver,
    fieldCount
  };
};

const stripControlChars = (value) => String(value).replace(/\u0000/g, '').trim();

const normaliseValue = (value, field) => {
  if (value === null || value === undefined) {
    return null;
  }

  switch (field.type) {
    case 'D':
      return parseDateValue(value);

    case 'T':
      return value instanceof Date
        ? formatTimeParts(
            value.getUTCFullYear(),
            value.getUTCMonth() + 1,
            value.getUTCDate(),
            value.getUTCHours(),
            value.getUTCMinutes(),
            value.getUTCSeconds()
          )
        : stripControlChars(value) || null;

    case 'L':
      return typeof value === 'boolean' ? value : null;

    case 'N':
    case 'F':
    case 'Y':
    case 'I':
    case 'B': {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    default:
      return stripControlChars(value) || null;
  }
};

const detectDataset = (fieldNames) => {
  const names = new Set(fieldNames.map((name) => String(name).toUpperCase()));

  if (names.has('FCHECKUID') && names.has('FDATE') && names.has('FCHECK')) {
    return 'DAILY_CHECK';
  }

  if (names.has('MEMBERID') && (names.has('FIRSTNAME') || names.has('DISPLAYNAME'))) {
    return 'MEMBER_PROFILE';
  }

  if (names.has('CLASSID') || names.has('MEMBERCLASSID')) {
    return 'MEMBER_CLASS';
  }

  if (names.has('CHECKNO') || names.has('BILLNO') || names.has('PLU')) {
    return 'SALES';
  }

  return 'UNKNOWN';
};

/** Case-insensitive lookup that always returns the first non-empty value. */
const pick = (data, names) => {
  for (const name of names) {
    const value = data[name];
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
};

const buildRow = (record, fields, rowNo) => {
  const isDeleted = record[DELETED] === true;
  const data = {};
  const dateFields = new Set(['FDATE', 'DATE', 'CHECKDATE', 'BILLDATE']);
  const dateTimeFields = new Set([
    'FTIMEOPEN',
    'FTIMECLOSE',
    'FTIMELAST',
    'FTMASSIGN',
    'TIMEOPEN',
    'TIMECLOSE'
  ]);

  for (const field of fields) {
    const value = normaliseValue(record[field.name], field);
    const name = String(field.name).toUpperCase();

    if (typeof value === 'string' && dateFields.has(name)) {
      data[field.name] = parseDateValue(value) || value;
    } else if (typeof value === 'string' && dateTimeFields.has(name)) {
      data[field.name] = parseDateTimeValue(value) || value;
    } else {
      data[field.name] = value;
    }
  }

  const messages = [];
  let severity = 'OK';

  if (isDeleted) {
    severity = 'WARNING';
    messages.push('Record is marked as deleted in the DBF file.');
  }

  const dataset = detectDataset(fields.map((field) => field.name));
  const checkUid = stripControlChars(pick(data, ['FCHECKUID']) || '');
  const member = stripControlChars(pick(data, ['FMEMBER', 'MEMBERID']) || '');

  if (dataset === 'DAILY_CHECK' && !checkUid) {
    severity = 'ERROR';
    messages.push('FCHECKUID is empty.');
  }

  const rawDate = pick(data, ['FDATE']);
  const checkDate = parseDateValue(rawDate);

  if (rawDate && !checkDate) {
    messages.push(`FDATE "${rawDate}" could not be parsed as a date.`);
    if (severity === 'OK') {
      severity = 'WARNING';
    }
  }

  const rawTimeOpen = pick(data, ['FTIMEOPEN']);
  const timeOpen = parseDateTimeValue(rawTimeOpen);

  if (rawTimeOpen && !timeOpen) {
    messages.push(`FTIMEOPEN "${rawTimeOpen}" could not be parsed as a date/time.`);
    if (severity === 'OK') {
      severity = 'WARNING';
    }
  }

  const rawCheckTot = pick(data, ['FCHECKTOT', 'FCKTOT']);
  const checkTot = rawCheckTot === null ? null : Number(rawCheckTot);

  return {
    rowNo,
    isDeleted,
    severity,
    message: messages.length > 0 ? messages.join(' ') : null,
    data,
    checkUid,
    member: member || null,
    checkDate,
    checkNo: stripControlChars(pick(data, ['FCHECK', 'CHECKNO']) || '') || null,
    checkTot: Number.isFinite(checkTot) ? checkTot : null,
    timeOpen
  };
};

const parseBuffer = async (buffer, options = {}) => {
  const header = readHeader(buffer);
  const encoding = resolveEncoding(options.encoding, header.languageDriver);
  const tempPath = path.join(os.tmpdir(), `igourmete-${crypto.randomUUID()}.dbf`);

  await fs.writeFile(tempPath, buffer);

  let dbf;
  let records;

  try {
    dbf = await DBFFile.open(tempPath, {
      encoding,
      includeDeletedRecords: true,
      readMode: 'loose'
    });

    records = await dbf.readRecords();
  } catch (error) {
    throw new IgourmeteDbfParseError(`Unable to read the DBF file: ${error.message}`, {
      encoding
    });
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }

  if (!Array.isArray(dbf.fields) || dbf.fields.length === 0) {
    throw new IgourmeteDbfParseError('The DBF file has no field descriptors.');
  }

  let offset = 1; // The first byte of every record is the deletion flag.
  const columns = dbf.fields.map((field) => {
    const column = {
      name: stripControlChars(field.name),
      type: field.type,
      length: field.size,
      decimals: field.decimalPlaces || 0,
      offset
    };

    offset += field.size;
    return column;
  });

  const dataset = detectDataset(columns.map((column) => column.name));
  const notices = [];

  if (header.languageDriver === 0) {
    notices.push(
      `The DBF language driver byte is 0 (no codepage); the server decoded the text as ${encoding}.`
    );
  }

  if (columns.some((column) => column.type === 'M')) {
    notices.push(
      'Memo fields contain block references only; the matching .dbt/.fpt file was not uploaded.'
    );
  }

  const rows = records.map((record, index) => buildRow(record, columns, index + 1));
  const deletedCount = rows.filter((row) => row.isDeleted).length;

  if (deletedCount > 0) {
    notices.push(
      `${deletedCount} record(s) are marked as deleted in the DBF file and were staged as WARNING.`
    );
  }

  if (records.length !== header.recordCount) {
    notices.push(
      `The header declares ${header.recordCount} record(s) but ${records.length} could be read.`
    );
  }

  let errorCount = 0;
  let warningCount = 0;

  for (const row of rows) {
    if (row.severity === 'ERROR') {
      errorCount += 1;
    } else if (row.severity === 'WARNING') {
      warningCount += 1;
    }
  }

  return {
    fileHash: crypto.createHash('sha256').update(buffer).digest('hex'),
    fileSize: buffer.length,
    encoding,
    dataset,
    datasetLabel: DATASET_LABELS[dataset] || DATASET_LABELS.UNKNOWN,
    header,
    columns,
    notices,
    rows,
    recordCount: header.recordCount,
    rowCount: rows.length,
    errorCount,
    warningCount,
    deletedCount
  };
};

const parseIgourmeteDbf = async (buffer, options = {}) => parseBuffer(buffer, options);

module.exports = {
  IgourmeteDbfParseError,
  parseIgourmeteDbf,
  parseDateValue,
  parseDateTimeValue,
  detectDataset,
  DATASET_LABELS,
  DBF_VERSION_LABELS,
  DEFAULT_ENCODING
};




