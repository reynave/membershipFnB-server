-- Staging tables untuk import "Member Sales Listing Report" (MySQL 5.7+/8.x, InnoDB, utf8mb4)
-- Prinsip: data sumber agak kotor, jadi staging dibuat TOLERAN.
--   * Setiap baris menyimpan teks asli (raw_line) agar bisa ditelusuri.
--   * Kolom angka NULL-able: baris yang gagal parse tetap masuk staging
--     dengan severity/message, tidak menggagalkan seluruh file.
--   * Validasi (cocok/tidak cocok) disimpan sebagai flag, bukan dibuang.

SET NAMES utf8mb4;

-- 1) Satu baris per file yang diupload
CREATE TABLE IF NOT EXISTS import_batch (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  file_name        VARCHAR(255)  NOT NULL,
  file_hash        CHAR(64)      NOT NULL COMMENT 'SHA-256 isi file',
  outlet           VARCHAR(100)  NULL,
  period_from      DATE          NULL,
  period_to        DATE          NULL,
  printed_at       DATETIME      NULL,
  printed_by       VARCHAR(100)  NULL,
  status           ENUM('PREVIEW','COMMITTED','REJECTED') NOT NULL DEFAULT 'PREVIEW',
  total_members    INT UNSIGNED  NOT NULL DEFAULT 0,
  total_checks     INT UNSIGNED  NOT NULL DEFAULT 0,
  total_items      INT UNSIGNED  NOT NULL DEFAULT 0,
  total_item_sales DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_item_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  footer_gross     DECIMAL(15,2) NULL COMMENT 'Gross Total di footer file',
  error_count      INT UNSIGNED  NOT NULL DEFAULT 0,
  warning_count    INT UNSIGNED  NOT NULL DEFAULT 0,
  created_by       VARCHAR(100)  NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  committed_by     VARCHAR(100)  NULL,
  committed_at     DATETIME      NULL,
  PRIMARY KEY (id),
  KEY ix_batch_hash   (file_hash),
  KEY ix_batch_period (outlet, period_from, period_to, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Cek duplikat file/periode dilakukan di aplikasi (hash atau outlet+periode yang
-- sudah COMMITTED). Tidak dibuat UNIQUE karena batch REJECTED boleh diupload ulang.

-- 2) Satu baris per blok member (angka footer dari file, untuk validasi silang)
CREATE TABLE IF NOT EXISTS import_member (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id         BIGINT UNSIGNED NOT NULL,
  member_id        VARCHAR(30)   NOT NULL,
  member_name      VARCHAR(150)  NULL,
  start_line_no    INT UNSIGNED  NOT NULL COMMENT 'nomor baris "Member ID:" di file',
  -- nilai yang tertulis di footer file
  f_item_qty       INT           NULL COMMENT 'Total: qty',
  f_item_sales     DECIMAL(15,2) NULL,
  f_item_disc      DECIMAL(15,2) NULL,
  f_item_total     DECIMAL(15,2) NULL,
  f_check_count    INT           NULL COMMENT '#Check:',
  f_cover          INT           NULL,
  f_check_disc     DECIMAL(15,2) NULL,
  f_tax            DECIMAL(15,2) NULL,
  f_sc             DECIMAL(15,2) NULL,
  f_gross_total    DECIMAL(15,2) NULL,
  -- nilai hasil hitung dari baris item (diisi saat validasi)
  c_item_qty       INT           NULL,
  c_item_sales     DECIMAL(15,2) NULL,
  c_item_total     DECIMAL(15,2) NULL,
  c_check_count    INT           NULL,
  severity         ENUM('ERROR','WARNING') NULL,
  message          VARCHAR(500)  NULL,
  PRIMARY KEY (id),
  KEY ix_member_batch (batch_id, member_id),
  CONSTRAINT fk_member_batch FOREIGN KEY (batch_id)
    REFERENCES import_batch (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Satu baris per item (baris detail)
CREATE TABLE IF NOT EXISTS import_line (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id         BIGINT UNSIGNED NOT NULL,
  line_no          INT UNSIGNED  NOT NULL COMMENT 'nomor baris di file',
  member_id        VARCHAR(30)   NULL,
  member_name      VARCHAR(150)  NULL,
  check_no         VARCHAR(20)   NULL COMMENT 'hasil carry-forward',
  check_seq        INT UNSIGNED  NULL COMMENT 'urutan Check# dalam blok member (Check# POS reset per hari)',
  plu              VARCHAR(30)   NULL,
  description      VARCHAR(255)  NULL,
  price            DECIMAL(15,2) NULL,
  qty              INT           NULL,
  item_sales       DECIMAL(15,2) NULL,
  item_disc        DECIMAL(15,2) NULL,
  item_total       DECIMAL(15,2) NULL,
  -- flag validasi: NULL = belum dicek / tidak berlaku
  price_qty_ok     TINYINT(1)    NULL COMMENT 'price*qty = item_sales',
  total_ok         TINYINT(1)    NULL COMMENT 'item_total = item_sales - item_disc',
  plu_known        TINYINT(1)    NULL COMMENT 'ada di master produk',
  member_known     TINYINT(1)    NULL COMMENT 'ada di master member',
  severity         ENUM('ERROR','WARNING') NULL,
  message          VARCHAR(500)  NULL,
  raw_line         VARCHAR(1000) NOT NULL COMMENT 'teks asli untuk penelusuran',
  PRIMARY KEY (id),
  KEY ix_line_batch  (batch_id, line_no),
  KEY ix_line_check  (batch_id, member_id, check_no),
  KEY ix_line_check_seq (batch_id, member_id, check_seq),
  KEY ix_line_sev    (batch_id, severity),
  KEY ix_line_plu    (batch_id, plu),
  CONSTRAINT fk_line_batch FOREIGN KEY (batch_id)
    REFERENCES import_batch (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Query bantu
-- ---------------------------------------------------------------------------

-- Baris bermasalah dalam satu batch
-- SELECT line_no, member_id, check_no, plu, price, qty, item_sales, item_total, severity, message, raw_line
-- FROM import_line WHERE batch_id = ? AND severity IS NOT NULL ORDER BY line_no;

-- Isi hitungan per member lalu tandai yang tidak cocok dengan footer
-- UPDATE import_member m
-- JOIN (SELECT batch_id, member_id,
--              SUM(qty) q, SUM(item_sales) s, SUM(item_total) t,
--              COUNT(DISTINCT check_no) c
--       FROM import_line WHERE batch_id = ? GROUP BY batch_id, member_id) x
--   ON x.batch_id = m.batch_id AND x.member_id = m.member_id
-- SET m.c_item_qty = x.q, m.c_item_sales = x.s, m.c_item_total = x.t, m.c_check_count = x.c,
--     m.severity = IF(x.s <> m.f_item_sales OR x.c <> m.f_check_count, 'ERROR',
--                  IF(x.t <> m.f_item_total, 'WARNING', NULL)),
--     m.message  = IF(x.s <> m.f_item_sales OR x.c <> m.f_check_count,
--                     'Hitungan item tidak cocok dengan footer member',
--                  IF(x.t <> m.f_item_total, 'Item Total berbeda dari footer', NULL))
-- WHERE m.batch_id = ?;

-- Bersihkan batch PREVIEW yang terbengkalai (> 7 hari); line/member ikut terhapus (CASCADE)
-- DELETE FROM import_batch WHERE status = 'PREVIEW' AND created_at < NOW() - INTERVAL 7 DAY;

-- ---------------------------------------------------------------------------
-- Kolom tambahan di tabel tujuan (dijalankan oleh scripts/migrate-import-member-sales.js)
-- ---------------------------------------------------------------------------
-- ALTER TABLE `transaction`
--   ADD COLUMN import_batch_id BIGINT UNSIGNED NULL
--   COMMENT 'import_batch.id when the row was stored by the report import'
--   AFTER syncType;
-- ALTER TABLE `transaction` ADD KEY ix_transaction_import_batch (import_batch_id);
--
-- Rollback satu batch hasil import:
-- DELETE FROM `transaction` WHERE import_batch_id = ?;
