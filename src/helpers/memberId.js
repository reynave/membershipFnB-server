/**
 * Helper ID member.
 *
 * `members.id` bertipe `VARCHAR(50)` dan **bukan** AUTO_INCREMENT sejak kode member
 * dari DBF Igourmate (20 digit, contoh `00002024000000001498`) diimpor apa adanya.
 * Akibatnya INSERT tanpa `id` menyimpan string kosong dan INSERT kedua gagal
 * (`ER_DUP_ENTRY` untuk PRIMARY). Helper ini mengisi `id` dengan bentuk yang sama
 * dengan kode POS/DBF supaya seluruh sistem hanya memakai satu format:
 *
 *     `0000` + tahun (4 digit) + nomor urut (12 digit)  -> 20 karakter
 *
 * Nomor urut diambil dari MAX(id) tahun berjalan + 1, sehingga tidak bentrok dengan
 * kode yang sudah diimpor dari POS. Kalau dua proses mendapat nomor yang sama,
 * INSERT diulang (maksimal MAX_INSERT_ATTEMPTS kali).
 */

const ID_PREFIX = '0000';
const SEQUENCE_WIDTH = 12;
const MAX_INSERT_ATTEMPTS = 5;

const buildMemberId = (year, sequence) =>
  `${ID_PREFIX}${year}${String(sequence).padStart(SEQUENCE_WIDTH, '0')}`;

/**
 * Hitung ID member berikutnya untuk tahun tertentu.
 * @param {{ execute: Function }} executor pool atau connection mysql2
 * @param {number} [year] default tahun berjalan
 * @returns {Promise<string>} contoh `00002026000000000001`
 */
const nextMemberId = async (executor, year = new Date().getFullYear()) => {
  const prefix = `${ID_PREFIX}${year}`;

  const [rows] = await executor.execute(
    'SELECT COALESCE(MAX(CAST(SUBSTRING(id, ?) AS UNSIGNED)), 0) AS maxSequence FROM members WHERE id LIKE ?',
    [prefix.length + 1, `${prefix}%`]
  );

  const maxSequence = Number(rows[0] && rows[0].maxSequence) || 0;

  return buildMemberId(year, maxSequence + 1);
};

const isPrimaryKeyCollision = (error) =>
  Boolean(error) &&
  error.code === 'ER_DUP_ENTRY' &&
  /for key 'PRIMARY'/i.test(String(error.sqlMessage || error.message || ''));

/**
 * INSERT member baru dengan ID yang dibuat otomatis.
 * @param {{ execute: Function }} executor pool atau connection mysql2
 * @param {Record<string, unknown> | ((memberId: string) => Record<string, unknown>)} data
 *   kolom selain `id`, atau fungsi yang menerima ID hasil generator (dipakai kalau
 *   ada kolom lain yang nilainya diturunkan dari ID, mis. `phone`).
 * @returns {Promise<string>} ID member yang tersimpan
 */
const insertMember = async (executor, data) => {
  const buildData = typeof data === 'function' ? data : () => data;

  let lastError;

  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const memberId = await nextMemberId(executor);
    const row = buildData(memberId);
    const columns = Object.keys(row);

    if (columns.length === 0) {
      throw new Error('insertMember membutuhkan minimal satu kolom');
    }

    const columnList = ['`id`'].concat(columns.map((column) => `\`${column}\``)).join(', ');
    const placeholders = Array.apply(null, Array(columns.length + 1)).map(() => '?').join(', ');
    const values = columns.map((column) => row[column]);

    try {
      // eslint-disable-next-line no-await-in-loop
      await executor.execute(
        `INSERT INTO members (${columnList}) VALUES (${placeholders})`,
        [memberId].concat(values)
      );
      return memberId;
    } catch (error) {
      lastError = error;

      if (!isPrimaryKeyCollision(error)) {
        throw error;
      }
    }
  }

  throw lastError;
};

module.exports = {
  buildMemberId,
  nextMemberId,
  insertMember
};
