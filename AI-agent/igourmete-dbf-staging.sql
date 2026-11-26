-- --------------------------------------------------------
-- Igourmate DBF import staging
-- --------------------------------------------------------
-- Flow:
--   1. POST /api/admin/imports/igourmete parses the .dbf with the `dbffile`
--      package and writes one row per DBF record into `dbf_igourmete_daily`.
--   2. `dbf_import_batch` keeps the batch header (file hash, encoding, DBF
--      header metadata, field schema JSON, error/warning counters).
--   3. POST /:batchId/commit only marks the batch COMMITTED; the staged rows
--      stay in `dbf_igourmete_daily` tagged with `batchId` for auditing.
--
-- The two tables already existed in the membership database. This file contains
-- the upgrade that was applied plus the equivalent fresh-install DDL.
-- --------------------------------------------------------

SET NAMES utf8mb4;

-- --------------------------------------------------------
-- 1. Upgrade dbf_import_batch (batch header)
-- --------------------------------------------------------
ALTER TABLE `dbf_import_batch`
  MODIFY COLUMN `status` ENUM('STAGED','COMMITTED','REJECTED') NOT NULL DEFAULT 'STAGED',
  ADD COLUMN `dataset` VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN' COMMENT 'DAILY_CHECK | MEMBER_PROFILE | MEMBER_CLASS | SALES | UNKNOWN' AFTER `file_hash`,
  ADD COLUMN `encoding` VARCHAR(32) NOT NULL DEFAULT 'windows-1252' COMMENT 'Encoding used to decode the DBF text' AFTER `dataset`,
  ADD COLUMN `dbf_version` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'DBF version byte (offset 0)' AFTER `encoding`,
  ADD COLUMN `dbf_last_updated` DATE NULL COMMENT 'DBF header last-update date' AFTER `dbf_version`,
  ADD COLUMN `record_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Records declared in the DBF header' AFTER `dbf_last_updated`,
  ADD COLUMN `row_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Rows actually staged' AFTER `record_count`,
  ADD COLUMN `columns_json` JSON NULL COMMENT 'DBF field descriptors' AFTER `row_count`,
  ADD COLUMN `notices_json` JSON NULL COMMENT 'Parser notices' AFTER `columns_json`,
  ADD KEY `ix_dbf_import_batch_hash` (`file_hash`),
  ADD KEY `ix_dbf_import_batch_status` (`status`);

-- --------------------------------------------------------
-- 2. Upgrade dbf_igourmete_daily (staged rows)
-- --------------------------------------------------------
-- The original table was empty when this migration ran. The `id` column was
-- added as a surrogate key because `checkUid` alone cannot identify a row when
-- the same DBF is uploaded again (different batchId).
ALTER TABLE `dbf_igourmete_daily`
  DROP PRIMARY KEY,
  ADD COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
  MODIFY COLUMN `batchId` BIGINT UNSIGNED NOT NULL,
  ADD COLUMN `rowNo` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Record number in the DBF file (1-based)' AFTER `batchId`,
  MODIFY COLUMN `checkTot` DECIMAL(15,4) NULL COMMENT 'FCKTOT (FCHECKTOT in newer exports)',
  ADD COLUMN `isDeleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'DBF deletion flag (0x2A)' AFTER `timeOpen`,
  ADD COLUMN `severity` ENUM('OK','WARNING','ERROR') NOT NULL DEFAULT 'OK' AFTER `isDeleted`,
  ADD COLUMN `message` VARCHAR(500) NULL AFTER `severity`,
  ADD COLUMN `rawJson` JSON NULL COMMENT 'Full DBF record, key = DBF field name' AFTER `message`,
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_dbf_igourmete_daily_batch_row` (`batchId`, `rowNo`),
  ADD KEY `ix_dbf_igourmete_daily_check_uid` (`checkUid`),
  ADD KEY `ix_dbf_igourmete_daily_batch_severity` (`batchId`, `severity`),
  ADD CONSTRAINT `fk_dbf_igourmete_daily_batch`
    FOREIGN KEY (`batchId`) REFERENCES `dbf_import_batch` (`id`) ON DELETE CASCADE,
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- --------------------------------------------------------
-- 2b. Kolom member (FMEMBER) — ditambahkan menyusul
-- --------------------------------------------------------
-- `member` menyimpan FMEMBER (20 digit POS member id) dari CHECK.DBF.
-- Bila kolom belum ada, gunakan:
--   ALTER TABLE `dbf_igourmete_daily`
--     ADD COLUMN `member` VARCHAR(50) NOT NULL DEFAULT '' COMMENT 'FMEMBER' AFTER `checkUid`;
-- Default dinormalkan dari 'FMEMBER' menjadi '' supaya baris tanpa member tidak
-- menyimpan teks "FMEMBER".
ALTER TABLE `dbf_igourmete_daily`
  MODIFY COLUMN `member` VARCHAR(50) NOT NULL DEFAULT '' COMMENT 'FMEMBER' AFTER `checkUid`;

-- --------------------------------------------------------
-- 3. Fresh-install DDL (same end state as above)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbf_import_batch` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `file_name` VARCHAR(255) NOT NULL,
  `file_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 isi file',
  `dataset` VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN' COMMENT 'DAILY_CHECK | MEMBER_PROFILE | MEMBER_CLASS | SALES | UNKNOWN',
  `encoding` VARCHAR(32) NOT NULL DEFAULT 'windows-1252' COMMENT 'Encoding used to decode the DBF text',
  `dbf_version` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'DBF version byte (offset 0)',
  `dbf_last_updated` DATE NULL COMMENT 'DBF header last-update date',
  `record_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Records declared in the DBF header',
  `row_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Rows actually staged',
  `columns_json` JSON NULL COMMENT 'DBF field descriptors',
  `notices_json` JSON NULL COMMENT 'Parser notices',
  `status` ENUM('STAGED','COMMITTED','REJECTED') NOT NULL DEFAULT 'STAGED',
  `error_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `warning_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_by` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `committed_by` VARCHAR(100) NULL,
  `committed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `ix_dbf_import_batch_hash` (`file_hash`),
  KEY `ix_dbf_import_batch_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `dbf_igourmete_daily` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `batchId` BIGINT UNSIGNED NOT NULL,
  `rowNo` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Record number in the DBF file (1-based)',
  `checkUid` VARCHAR(50) NOT NULL DEFAULT '' COMMENT 'FCHECKUID',
  `member` VARCHAR(50) NOT NULL DEFAULT '' COMMENT 'FMEMBER',
  `checkDate` DATE NULL COMMENT 'FDATE',
  `checkNo` VARCHAR(50) NULL COMMENT 'FCHECK',
  `checkTot` DECIMAL(15,4) NULL COMMENT 'FCKTOT (FCHECKTOT in newer exports)',
  `timeOpen` DATETIME NULL COMMENT 'FTIMEOPEN',
  `isDeleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'DBF deletion flag (0x2A)',
  `severity` ENUM('OK','WARNING','ERROR') NOT NULL DEFAULT 'OK',
  `message` VARCHAR(500) NULL,
  `rawJson` JSON NULL COMMENT 'Full DBF record, key = DBF field name',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dbf_igourmete_daily_batch_row` (`batchId`, `rowNo`),
  KEY `ix_dbf_igourmete_daily_check_uid` (`checkUid`),
  KEY `ix_dbf_igourmete_daily_batch_severity` (`batchId`, `severity`),
  CONSTRAINT `fk_dbf_igourmete_daily_batch`
    FOREIGN KEY (`batchId`) REFERENCES `dbf_import_batch` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

