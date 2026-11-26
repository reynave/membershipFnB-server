/**
 * Fixture-free regression tests for the "Member Sales Listing Report" parser.
 *
 * The cases below build synthetic POS exports in memory (UTF-8/UTF-16, shifted
 * columns, reordered headers, truncation, garbage rows, duplicate check numbers,
 * repeated report blocks) so the behaviour stays covered without the real files.
 * The two real fixtures in ../DATA are also checked when present.
 *
 * Usage: node scripts/test-member-sales-parser.js
 */
const fs = require('fs');
const path = require('path');
const {
  MemberSalesParseError,
  decodeReport,
  parseMemberSales
} = require('../src/modules/import/member-sales.parser');
const { validateMemberSales } = require('../src/modules/import/member-sales.validator');

let passed = 0;
let skipped = 0;

const fail = (message) => {
  throw new Error(`FAILED: ${message}`);
};

const assert = (condition, message) => {
  if (!condition) {
    fail(message);
  }

  passed += 1;
  console.log(`ok ${passed} - ${message}`);
};

const show = (value) => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  return JSON.stringify(value);
};

const assertEqual = (actual, expected, label) => {
  if (actual !== expected) {
    fail(`${label}: expected ${show(expected)}, got ${show(actual)}`);
  }

  passed += 1;
  console.log(`ok ${passed} - ${label} = ${show(expected)}`);
};

const assertClose = (actual, expected, label, tolerance = 0.005) => {
  if (typeof actual !== 'number' || Math.abs(actual - expected) > tolerance) {
    fail(`${label}: expected ${expected}, got ${show(actual)}`);
  }

  passed += 1;
  console.log(`ok ${passed} - ${label} = ${expected}`);
};

const assertThrowsParseError = (buffer, label, messagePart = null) => {
  try {
    parseMemberSales(buffer);
  } catch (error) {
    if (!(error instanceof MemberSalesParseError)) {
      fail(`${label}: threw ${error.name} instead of MemberSalesParseError`);
    }

    if (messagePart && !error.message.includes(messagePart)) {
      fail(`${label}: message "${error.message}" does not include "${messagePart}"`);
    }

    passed += 1;
    console.log(`ok ${passed} - ${label} rejects with MemberSalesParseError`);
    return error;
  }

  fail(`${label}: expected a MemberSalesParseError`);
  return null;
};

const skip = (label) => {
  skipped += 1;
  console.log(`skip ${skipped} - ${label}`);
};

// --- encoding helpers -------------------------------------------------------

const encodeUtf8 = (text, { bom = false } = {}) =>
  Buffer.concat([bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), Buffer.from(text, 'utf8')]);

const encodeUtf16le = (text, { bom = true } = {}) =>
  Buffer.concat([bom ? Buffer.from([0xff, 0xfe]) : Buffer.alloc(0), Buffer.from(text, 'utf16le')]);

const encodeUtf16be = (text, { bom = true } = {}) => {
  const littleEndian = Buffer.from(text, 'utf16le');

  for (let index = 0; index + 1 < littleEndian.length; index += 2) {
    const high = littleEndian[index];
    littleEndian[index] = littleEndian[index + 1];
    littleEndian[index + 1] = high;
  }

  return Buffer.concat([bom ? Buffer.from([0xfe, 0xff]) : Buffer.alloc(0), littleEndian]);
};

// --- report builders -------------------------------------------------------

const OUTLET = 'THE LEAF';
const TITLE = 'Member Sales Listing Report';
const SEPARATOR = '-'.repeat(100);
const MEMBER_ID = '00002023000000000123';
const STANDARD_HEADER = 'Check#,,PLU,,Description,,Price,,Qty,,Item Sales,,Item Disc,,Item Total';

const metaLines = () => [
  `(${OUTLET})`,
  '',
  'Bus Date :, 01/01/2026 to 31/01/2026,Printed At :, 01/02/2026 10:15:00 am',
  'Printed By :, Test Runner',
  SEPARATOR,
  ''
];

const footerLines = ({
  qty,
  sales,
  disc = 0,
  total,
  checkCount = 1,
  cover = 2,
  checkDisc = 0,
  tax = 0,
  sc = 0,
  grossTotal
}) => [
  `Total:,,            ${qty},,        ${sales},,             ${disc},,        ${total}`,
  `Item Sales:,        ${sales},,#Check:,             ${checkCount}`,
  `Item Disc:,             ${disc},,Cover:,             ${cover}`,
  `Check Disc:,        ${checkDisc},,Sales/#Check:,       ${Math.round(sales / Math.max(1, checkCount))}`,
  `TAX:,        ${tax}`,
  `SC:,         ${sc}`,
  `Gross Total:,       ${grossTotal === undefined ? total - checkDisc + tax + sc : grossTotal}`
];

const buildReport = ({ blocks, endMarker = true, lineEnding = '\r\n' }) => {
  const lines = [TITLE, ...metaLines()];

  blocks.forEach((block, index) => {
    if (index > 0) {
      lines.push('');
    }

    if (block.repeatTitle) {
      lines.push(TITLE, `(${OUTLET})`, 'Bus Date :, 01/01/2026 to 31/01/2026', SEPARATOR, '');
    }

    lines.push(
      `Member ID:,${block.memberId || MEMBER_ID},,Member Name:,${block.memberName || 'TEST MEMBER'}`
    );

    if (block.header !== null) {
      lines.push(block.header || STANDARD_HEADER);
    }

    lines.push(SEPARATOR, ...(block.rows || []));

    if (block.footer !== null) {
      lines.push(SEPARATOR, ...(block.footer || []));
    }
  });

  lines.push('');

  if (endMarker) {
    lines.push('<< End of Report >>');
  }

  return lines.join(lineEnding);
};

const baselineBlock = () => ({
  rows: [
    '00039,,A001,,ITEM ONE,,        10000,,            2,,        20000,,            0,,        20000',
    'A002,,ITEM TWO,,         5000,,            1,,         5000,,         1000,,         4000'
  ],
  footer: footerLines({
    qty: 3,
    sales: 25000,
    disc: 1000,
    total: 24000,
    cover: 2,
    tax: 2500,
    sc: 1000,
    grossTotal: 27500
  })
});

const testBaseline = () => {
  const parsed = parseMemberSales(encodeUtf8(buildReport({ blocks: [baselineBlock()] })));

  assertEqual(parsed.meta.encoding, 'utf8', 'UTF-8 without BOM is detected');
  assertEqual(parsed.header.title, TITLE, 'report title');
  assertEqual(parsed.header.outlet, OUTLET, 'outlet from "(THE LEAF)"');
  assertEqual(parsed.header.periodFrom, '2026-01-01', 'Bus Date from');
  assertEqual(parsed.header.periodTo, '2026-01-31', 'Bus Date to');
  assertEqual(parsed.header.printedAt, '2026-02-01 10:15:00', 'Printed At normalised');
  assertEqual(parsed.header.printedBy, 'Test Runner', 'Printed By');
  assertEqual(parsed.members.length, 1, 'member count');
  assertEqual(parsed.members[0].checks.length, 1, 'check count');
  assertEqual(parsed.lines.length, 2, 'item count');
  assertEqual(parsed.errors.length, 0, 'no parser errors');
  assertEqual(parsed.warnings.length, 0, 'no parser warnings');
  assertEqual(parsed.issues.length, 0, 'no issues on a consistent report');

  const [first, second] = parsed.lines;

  assertEqual(first.checkNo, '00039', 'Check# is a string');
  assertEqual(first.checkSeq, 1, 'check seq starts at 1');
  assertEqual(first.plu, 'A001', 'first PLU');
  assertEqual(first.qty, 2, 'first qty');
  assertClose(first.itemSales, 20000, 'first itemSales');
  assertEqual(second.checkNo, '00039', 'continuation row inherits Check#');
  assertEqual(second.checkSeq, 1, 'continuation row inherits check seq');
  assertEqual(second.description, 'ITEM TWO', 'continuation row keeps its own description');
  assertEqual(first.amountSource, 'itemTotal', 'default amountSource');
  assertEqual(first.amount, first.itemTotal, 'default amount uses Item Total');

  const footer = parsed.members[0].footer;

  assertEqual(footer.itemQty, 3, 'footer qty');
  assertClose(footer.itemSales, 25000, 'footer itemSales');
  assertClose(footer.itemTotal, 24000, 'footer itemTotal');
  assertEqual(footer.checkCount, 1, 'footer check count');
  assertClose(footer.tax, 2500, 'footer TAX');
  assertClose(footer.sc, 1000, 'footer SC');
  assertClose(footer.grossTotal, 27500, 'footer Gross Total');
  assertEqual(parsed.footer.itemSales, 25000, 'report footer sums member itemSales');
  assertEqual(parsed.footer.endOfReport, true, 'end-of-report marker seen');
  assertEqual(parsed.meta.blocks, 1, 'one report block');

  return parsed;
};

const testEncodings = () => {
  const text = buildReport({ blocks: [baselineBlock()] });

  const be = parseMemberSales(encodeUtf16be(text));
  assertEqual(be.meta.encoding, 'utf16be', 'UTF-16 BE with BOM is detected');
  assertEqual(be.members.length, 1, 'UTF-16 BE member count');
  assertEqual(be.lines.length, 2, 'UTF-16 BE item count');
  assertEqual(be.lines[0].description, 'ITEM ONE', 'UTF-16 BE description');
  assertClose(be.footer.itemSales, 25000, 'UTF-16 BE itemSales');

  const beNoBom = parseMemberSales(encodeUtf16be(text, { bom: false }));
  assertEqual(beNoBom.meta.encoding, 'utf16be', 'UTF-16 BE without BOM is detected from 0x00 pattern');

  const le = parseMemberSales(encodeUtf16le(text));
  assertEqual(le.meta.encoding, 'utf16le', 'UTF-16 LE with BOM is detected');
  assertEqual(le.lines.length, 2, 'UTF-16 LE item count');

  const utf8Bom = parseMemberSales(encodeUtf8(text, { bom: true }));
  assertEqual(utf8Bom.meta.encoding, 'utf8', 'UTF-8 with BOM is detected');
  assertEqual(utf8Bom.members.length, 1, 'UTF-8 BOM member count');

  const lf = parseMemberSales(encodeUtf8(buildReport({ blocks: [baselineBlock()], lineEnding: '\n' })));
  assertEqual(lf.lines.length, 2, 'LF line endings parse like CRLF');
  assertEqual(lf.lines[1].plu, 'A002', 'LF item row');
};

const testHeaderVariations = () => {
  const reordered = buildReport({
    blocks: [
      {
        rows: [
          '00040,,B001,,REORDERED ITEM,,2,,7500,,0,,15000,,15000,,PROMO',
          'B002,,SECOND ROW,,1,,2000,,0,,2000,,2000,,'
        ],
        footer: footerLines({ qty: 3, sales: 17000, total: 17000, cover: 3 })
      }
    ],
    lineEnding: '\n'
  });

  const parsed = parseMemberSales(
    encodeUtf8(
      reordered.replace(
        STANDARD_HEADER,
        'Check#,,PLU,,Description,,Qty,,Price,,Item Disc,,Item Sales,,Item Total,,Notes'
      )
    )
  );

  assertEqual(parsed.lines.length, 2, 'reordered header still reads both item rows');
  assertEqual(parsed.lines[0].price, 7500, 'price mapped by header name, not position');
  assertEqual(parsed.lines[0].qty, 2, 'qty mapped by header name, not position');
  assertClose(parsed.lines[0].itemSales, 15000, 'itemSales mapped by header name');
  assertClose(parsed.lines[0].itemTotal, 15000, 'itemTotal mapped by header name');
  assertEqual(parsed.lines[0].extra.notes, 'PROMO', 'unknown header column is kept in extra');
  assertEqual(parsed.lines[0].description, 'REORDERED ITEM', 'description with reordered header');
  assertEqual(parsed.issues.length, 0, 'reordered header produces no issue');

  const extraColumns = parseMemberSales(
    encodeUtf8(
      buildReport({
        blocks: [
          {
            header:
              'Check#,,PLU,,Description,,Price,,Qty,,Item Sales,,Item Disc,,Item Total,,Promo Code',
            rows: ['00045,,G001,,EXTRA COLUMN ITEM,,10000,,1,,10000,,0,,10000,,PROMO-1'],
            footer: footerLines({ qty: 1, sales: 10000, total: 10000, cover: 1 })
          }
        ]
      })
    )
  );

  assertEqual(extraColumns.lines[0].extra['promo code'], 'PROMO-1', 'trailing extra column value');
  assertClose(extraColumns.lines[0].itemTotal, 10000, 'trailing extra column keeps numeric anchoring');

  const noHeader = parseMemberSales(
    encodeUtf8(
      buildReport({
        blocks: [
          {
            header: null,
            rows: ['00046,,H001,,ITEM WITHOUT HEADER,,10000,,2,,20000,,0,,20000'],
            footer: footerLines({ qty: 2, sales: 20000, total: 20000, cover: 2 })
          }
        ]
      })
    )
  );

  assertEqual(noHeader.lines.length, 1, 'trailing-number fallback reads a row without header');
  assertEqual(noHeader.lines[0].plu, 'H001', 'fallback PLU');
  assertEqual(noHeader.lines[0].checkNo, '00046', 'fallback Check#');
  assertClose(noHeader.lines[0].itemTotal, 20000, 'fallback itemTotal');
};

const testDescriptionsWithCommas = () => {
  const parsed = parseMemberSales(
    encodeUtf8(
      buildReport({
        blocks: [
          {
            rows: [
              '00041,,C001,,RICE, FRIED SPECIAL,,10000,,1,,10000,,0,,10000',
              'C002,,BEEF,, SPECIAL,,20000,,1,,20000,,0,,20000'
            ],
            footer: footerLines({ qty: 2, sales: 30000, total: 30000, cover: 2 })
          }
        ]
      })
    )
  );

  assertEqual(parsed.lines.length, 2, 'descriptions with commas stay on their own rows');
  assertEqual(parsed.lines[0].description, 'RICE, FRIED SPECIAL', 'single comma inside description');
  assertEqual(parsed.lines[1].description, 'BEEF,,SPECIAL', 'embedded ",," inside description is restored');
  assertClose(parsed.lines[1].itemTotal, 20000, 'numeric columns still align after an embedded ",,"');
  assertEqual(parsed.issues.length, 0, 'description commas produce no issue');
};

const testNegativeValues = () => {
  const parsed = parseMemberSales(
    encodeUtf8(
      buildReport({
        blocks: [
          {
            rows: ['00042,,D001,,RETURN ITEM,,5000,,-1,,-5000,,0,,-5000'],
            footer: footerLines({ qty: -1, sales: -5000, total: -5000, cover: 1 })
          }
        ]
      })
    )
  );

  assertEqual(parsed.lines.length, 1, 'return row is parsed');
  assertEqual(parsed.lines[0].qty, -1, 'negative qty is kept as-is');
  assertClose(parsed.lines[0].itemSales, -5000, 'negative itemSales is kept as-is');
  assertClose(parsed.lines[0].itemTotal, -5000, 'negative itemTotal is kept as-is');
  assertEqual(parsed.members[0].computed.itemQty, -1, 'negative qty summed');
  assertEqual(parsed.issues.length, 0, 'negative price x qty matches negative itemSales');
};

const testAmountSourceOption = () => {
  const buffer = encodeUtf8(buildReport({ blocks: [baselineBlock()] }));
  const bySales = parseMemberSales(buffer, { amountSource: 'itemSales' });
  const computed = parseMemberSales(buffer, { amountSource: 'computed' });

  assertEqual(bySales.amountSource, 'itemSales', 'amountSource option is echoed');
  assertEqual(bySales.lines[0].amount, bySales.lines[0].itemSales, 'amount uses Item Sales when requested');
  assertEqual(computed.lines[1].amount, 4000, 'computed amount = price x qty - itemDisc');
  assertEqual(computed.lines[0].itemTotal, 20000, 'switching amountSource does not change stored values');
};

const testDuplicateCheckNumbers = () => {
  const parsed = parseMemberSales(
    encodeUtf8(
      buildReport({
        blocks: [
          {
            rows: [
              '00043,,E001,,FIRST CHECK,,10000,,1,,10000,,0,,10000',
              '00043,,E002,,SECOND CHECK,,20000,,1,,20000,,0,,20000'
            ],
            footer: footerLines({ qty: 2, sales: 30000, total: 30000, checkCount: 2 })
          }
        ]
      })
    )
  );

  const checks = parsed.members[0].checks;

  assertEqual(checks.length, 2, 'duplicate Check# creates two checks');
  assertEqual(checks[0].no, '00043', 'first check number');
  assertEqual(checks[1].no, '00043', 'second check number is identical');
  assertEqual(checks[0].seq, 1, 'unique check key uses seq 1');
  assertEqual(checks[1].seq, 2, 'unique check key uses seq 2');
  assertEqual(parsed.lines[1].checkSeq, 2, 'second check rows carry seq 2');
  assertEqual(parsed.issues.length, 0, 'duplicate check numbers are not treated as an issue');
};

const testRepeatedReportBlock = () => {
  const block = (memberId, plu) => ({
    memberId,
    memberName: `MEMBER ${plu}`,
    rows: [`00050,,${plu},,BLOCK ITEM,,10000,,1,,10000,,0,,10000`],
    footer: footerLines({ qty: 1, sales: 10000, total: 10000, cover: 1 })
  });

  const parsed = parseMemberSales(
    encodeUtf8(
      buildReport({
        blocks: [block('00002023000000000777', 'J001'), { ...block('00002023000000000778', 'J002'), repeatTitle: true }]
      })
    )
  );

  assertEqual(parsed.meta.blocks, 2, 'repeated report title starts a second block');
  assertEqual(parsed.members.length, 2, 'members from both blocks are kept');
  assertEqual(parsed.members[0].blockIndex, 0, 'first member blockIndex');
  assertEqual(parsed.members[1].blockIndex, 1, 'second member blockIndex');
  assertEqual(parsed.members[1].memberId, '00002023000000000778', 'second block member id');
  assertEqual(parsed.lines.length, 2, 'item rows from both blocks');
  assertEqual(parsed.footer.itemSales, 20000, 'report footer sums both blocks');
  assertEqual(parsed.warnings.length, 0, 'repeated block produces no warning');
};

const testTruncatedReport = () => {
  const parsed = parseMemberSales(
    encodeUtf8(
      buildReport({
        blocks: [
          {
            rows: ['00051,,K001,,TRUNCATED ITEM,,10000,,1,,10000,,0,,10000'],
            footer: null
          }
        ],
        endMarker: false
      })
    )
  );

  const codes = parsed.warnings.map((warning) => warning.code);

  assertEqual(parsed.lines.length, 1, 'truncated report still yields its item row');
  assert(codes.includes('MISSING_FOOTER'), 'truncated member is reported as MISSING_FOOTER');
  assert(codes.includes('NO_END_MARKER'), 'missing "<< End of Report >>" is reported');
  assertEqual(parsed.members[0].footer.itemQty, null, 'missing footer stays null, not zero');
  assertEqual(parsed.issues.length, 0, 'missing footer skips footer comparisons');
  assertEqual(parsed.footer.itemSales, null, 'report footer stays null when no member footer exists');
  assertEqual(parsed.footer.endOfReport, false, 'endOfReport is false for a truncated file');
};

const testGarbageRows = () => {
  const parsed = parseMemberSales(
    encodeUtf8(
      buildReport({
        blocks: [
          {
            rows: [
              '00052,,L001,,GOOD ITEM,,10000,,1,,10000,,0,,10000',
              'THIS LINE IS GARBAGE',
              '???,,###,,???',
              '00053,,L002,,BAD NUMBERS,,not-a-price,,1,,whatever,,x,,10000',
              'L003,,GOOD ITEM TWO,,5000,,1,,5000,,0,,5000'
            ],
            footer: footerLines({ qty: 3, sales: 25000, total: 25000, cover: 2 })
          }
        ]
      })
    )
  );

  const unknown = parsed.warnings.filter((warning) => warning.code === 'UNKNOWN_LINE');
  const badNumbers = parsed.errors.filter((error) => /Could not read numeric/.test(error.message));
  const itemPlus = parsed.lines.find((line) => (line.plu || '').startsWith('L002'));

  assertEqual(parsed.lines.length, 3, 'garbage rows are skipped but real item rows survive');
  assert(unknown.length >= 2, 'garbage lines are reported as UNKNOWN_LINE warnings');
  assert(badNumbers.length >= 1, 'unreadable numeric cells are reported as errors');
  assert(itemPlus, 'row with unreadable numbers is still stored with null values');
  assertEqual(itemPlus.price, null, 'unreadable price stays null instead of 0');
  assertEqual(parsed.lines[0].plu, 'L001', 'first valid row unaffected by garbage');
  assertEqual(parsed.lines[2].plu, 'L003', 'last valid row unaffected by garbage');
};

const testHardFailures = () => {
  assertThrowsParseError(encodeUtf8('not a report at all\n'), 'file without report title', 'title was not found');
  assertThrowsParseError(encodeUtf8(buildReport({ blocks: [] })), 'report without members', 'No member block');
  assertThrowsParseError(Buffer.alloc(0), 'empty buffer', 'empty');
};

const mismatchReport = () =>
  buildReport({
    blocks: [
      {
        rows: [
          '00060,,M001,,MISMATCH PRICE,,10000,,2,,30000,,0,,30000',
          'M002,,MISMATCH TOTAL,,5000,,1,,5000,,1000,,5000'
        ],
        footer: footerLines({ qty: 3, sales: 35000, disc: 1000, total: 35000, cover: 2 })
      }
    ]
  });

const testIssuesAndValidator = () => {
  const parsed = parseMemberSales(encodeUtf8(mismatchReport()));
  const priceIssue = parsed.issues.find((issue) => issue.type === 'priceQty');
  const totalIssue = parsed.issues.find((issue) => issue.type === 'itemTotal');

  assertEqual(parsed.issues.length, 2, 'two item issues are reported');
  assert(priceIssue, 'price x qty mismatch is reported');
  assertEqual(priceIssue.severity, 'ERROR', 'price x qty mismatch is an ERROR');
  assertEqual(priceIssue.plu, 'M001', 'price issue carries the PLU');
  assertEqual(priceIssue.expected, 20000, 'price issue expected value');
  assertEqual(priceIssue.actual, 30000, 'price issue actual value');
  assert(totalIssue, 'Item Sales - Item Disc mismatch is reported');
  assertEqual(totalIssue.severity, 'WARNING', 'item total mismatch is a WARNING');

  const validation = validateMemberSales(parsed);
  const [firstLine, secondLine] = validation.lines;

  assertEqual(validation.errorCount, 1, 'validator counts one ERROR line');
  assertEqual(validation.warningCount, 1, 'validator counts one WARNING line');
  assertEqual(validation.allowCommit, false, 'errors block commit');
  assertEqual(validation.totals.members, 1, 'validator totals members');
  assertEqual(validation.totals.checks, 1, 'validator totals checks');
  assertEqual(validation.totals.items, 2, 'validator totals items');
  assertClose(validation.totals.itemSales, 35000, 'validator totals itemSales');
  assertEqual(firstLine.priceQtyOk, 0, 'validator flags price x qty');
  assertEqual(firstLine.totalOk, 1, 'validator accepts a correct item total');
  assertEqual(secondLine.priceQtyOk, 1, 'validator accepts a correct price x qty');
  assertEqual(secondLine.totalOk, 0, 'validator flags a wrong item total');
  assert(/Price x Qty/.test(firstLine.message || ''), 'validator copies the parser message to the line');
  assertEqual(validation.members[0].cItemSales, 35000, 'validator keeps recomputed member sales');
  assertEqual(validation.members[0].fItemSales, 35000, 'validator keeps member footer sales');

  const baseline = validateMemberSales(parseMemberSales(encodeUtf8(buildReport({ blocks: [baselineBlock()] }))));

  assertEqual(baseline.errorCount, 0, 'consistent report has no ERROR');
  assertEqual(baseline.warningCount, 0, 'consistent report has no WARNING');
  assertEqual(baseline.allowCommit, true, 'consistent report allows commit');
  assertEqual(baseline.lines[0].severity, null, 'consistent line has no severity');
  assertEqual(baseline.lines[0].priceQtyOk, 1, 'consistent line priceQtyOk');
  assertEqual(baseline.lines[0].totalOk, 1, 'consistent line totalOk');
  assertEqual(baseline.notices.length, 0, 'consistent report has no notice');
  assertEqual(baseline.skippedChecks.length, 2, 'validator reports skipped master-data checks');

  const footerMismatch = parseMemberSales(
    encodeUtf8(
      buildReport({
        blocks: [
          {
            rows: ['00061,,N001,,ITEM,,10000,,1,,10000,,0,,10000'],
            footer: footerLines({ qty: 1, sales: 99999, total: 10000, cover: 1 })
          }
        ]
      })
    )
  );
  const footerValidation = validateMemberSales(footerMismatch);
  const footerIssue = footerMismatch.issues.find((issue) => issue.type === 'footerItemSales');

  assert(footerIssue, 'member footer mismatch is reported by the parser');
  assertEqual(footerIssue.severity, 'ERROR', 'footer Item Sales mismatch is an ERROR');
  assertEqual(footerValidation.members[0].severity, 'ERROR', 'validator maps member issue severity');
  assertEqual(footerValidation.errorCount, 1, 'validator counts the member ERROR');
  assertEqual(footerValidation.allowCommit, false, 'member mismatch blocks commit');
};

const testRealFixtures = () => {
  const shiftFixture = path.resolve(__dirname, '../../DATA/sales test.csv');

  if (fs.existsSync(shiftFixture)) {
    const parsed = parseMemberSales(fs.readFileSync(shiftFixture));
    const shifted = parsed.issues.find((issue) => issue.plu === 'ACKL0004');

    assertEqual(parsed.members.length, 1, 'fixture "sales test.csv" member count');
    assertEqual(parsed.members[0].checks.length, 1, 'fixture "sales test.csv" check count');
    assertEqual(parsed.lines.length, 13, 'fixture "sales test.csv" item count');
    assertEqual(parsed.members[0].computed.itemQty, 16, 'fixture "sales test.csv" qty');
    assertClose(parsed.members[0].computed.itemSales, 968400, 'fixture "sales test.csv" itemSales');
    assertEqual(parsed.issues.length, 1, 'fixture "sales test.csv" single issue');
    assert(shifted, 'fixture "sales test.csv" reports ACKL0004');
    assertEqual(shifted.type, 'itemTotal', 'ACKL0004 issue type');
    assertEqual(shifted.expected, 82000, 'ACKL0004 expected item total');
    assertEqual(shifted.actual, 164000, 'ACKL0004 actual item total');
    assertEqual(parsed.warnings.length, 0, 'fixture "sales test.csv" has no warning');
    assertEqual(parsed.meta.encoding, 'utf16le', 'fixture "sales test.csv" encoding');
  } else {
    skip('fixture "sales test.csv" not found');
  }

  const cleanFixture = path.resolve(__dirname, '../../DATA/MEMBER Sales Listing Report.csv');

  if (fs.existsSync(cleanFixture)) {
    const parsed = parseMemberSales(fs.readFileSync(cleanFixture));
    const itemTotalIssues = parsed.issues.filter((issue) => issue.type === 'itemTotal');
    const memberIssues = parsed.issues.filter((issue) => issue.scope === 'member');

    assertEqual(parsed.members.length, 189, 'fixture "MEMBER Sales Listing Report.csv" member count');
    assertEqual(parsed.lines.length, 2617, 'fixture "MEMBER Sales Listing Report.csv" item count');
    assertEqual(
      parsed.members.reduce((total, member) => total + member.checks.length, 0),
      274,
      'fixture "MEMBER Sales Listing Report.csv" check count'
    );
    assertEqual(parsed.warnings.length, 0, 'fixture "MEMBER Sales Listing Report.csv" has no warning');
    assertEqual(memberIssues.length, 0, 'fixture "MEMBER Sales Listing Report.csv" footer checks all pass');
    assertEqual(itemTotalIssues.length, 196, 'fixture "MEMBER Sales Listing Report.csv" item total issues');
    assertEqual(parsed.errors.length, 0, 'fixture "MEMBER Sales Listing Report.csv" has no parser error');
  } else {
    skip('fixture "MEMBER Sales Listing Report.csv" not found');
  }
};

const CASES = [
  ['baseline UTF-8 without BOM', testBaseline],
  ['encodings: UTF-16 BE/LE, BOM variants, LF', testEncodings],
  ['header order, extra columns, no header', testHeaderVariations],
  ['descriptions containing commas', testDescriptionsWithCommas],
  ['negative qty/price (return)', testNegativeValues],
  ['amountSource option', testAmountSourceOption],
  ['duplicate check numbers', testDuplicateCheckNumbers],
  ['repeated report block', testRepeatedReportBlock],
  ['truncated report without footer', testTruncatedReport],
  ['garbage rows', testGarbageRows],
  ['hard failures', testHardFailures],
  ['issues and validator', testIssuesAndValidator],
  ['real fixtures', testRealFixtures]
];

const main = () => {
  console.log('Member Sales Listing Report parser tests');

  for (const [label, execute] of CASES) {
    console.log(`\n# ${label}`);
    execute();
  }

  console.log(`\n${passed} assertion(s) passed${skipped > 0 ? `, ${skipped} skipped` : ''}`);
};

try {
  main();
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}
