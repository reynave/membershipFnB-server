-- --------------------------------------------------------
-- Host:                         localhost
-- Server version:               10.4.28-MariaDB - mariadb.org binary distribution
-- Server OS:                    Win64
-- HeidiSQL Version:             12.17.0.7270
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping structure for table membership.members
CREATE TABLE IF NOT EXISTS `members` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tierId` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `phone` varchar(50) NOT NULL DEFAULT '0',
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `birthdate` date NOT NULL DEFAULT '1990-01-01',
  `password_hash` varchar(255) NOT NULL,
  `status` tinyint(4) NOT NULL DEFAULT 1,
  `verified` tinyint(4) NOT NULL DEFAULT 0,
  `activated` tinyint(4) NOT NULL DEFAULT 0,
  `presence` tinyint(4) NOT NULL DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uq_members_email` (`email`),
  UNIQUE KEY `phone` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.members: ~9 rows (approximately)
INSERT INTO `members` (`id`, `tierId`, `phone`, `name`, `email`, `birthdate`, `password_hash`, `status`, `verified`, `activated`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 1, '111', 'testing', 'cso1@email.com', '1990-01-01', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-15 11:26:14', '2026-04-20 09:13:08'),
	(2, 1, '2222', 'Revisi Schema', 'schema.revisi@example.com', '1990-01-01', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-15 11:01:51', '2026-04-20 09:13:10'),
	(4, 1, '3333', 'uat', 'uat@email.com', '1990-01-01', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-15 11:31:42', '2026-04-20 09:13:11'),
	(5, 1, '4444', 'Test Member', 'testmember@example.com', '1990-01-01', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-16 09:09:38', '2026-04-20 09:13:13'),
	(6, 0, '5555', 'Test Member 2', 'testmember2@example.com', '1990-01-01', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-16 09:09:47', '2026-04-20 09:13:14'),
	(12, 1, '16666', 'Demo User', 'demo.user@example.com', '1990-01-01', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-15 10:48:14', '2026-04-20 09:13:16'),
	(13, 1, '0899911122244', 'Guest 2244', 'auto-0899911122244-1776677056242-80f51698743a@guest.membership.local', '1990-01-01', '$2b$04$1Vym9vyX5kpMqgWsn7ga8OPT28/R5cbcUVxuYAojbMQuVa8QaT1nm', 1, 0, 0, 1, '2026-04-20 09:24:16', '2026-04-20 09:24:16'),
	(14, 1, '0899911122255', 'Guest 2255', 'auto-0899911122255-1776677083345-cddce4241ec5@guest.membership.local', '1990-01-01', '$2b$04$S8d.5aqm3OvzRqSHnB11EuoXNERBvDck4HX98Gt9zhV3VjVifEC7.', 1, 0, 0, 1, '2026-04-20 09:24:43', '2026-04-20 09:24:43'),
	(15, 1, '0899911122266', 'Guest 2266', 'auto-0899911122266-1776677305520-df29e99810ed@guest.membership.local', '1990-01-01', '$2b$04$XGmlXMW2NvWDowgwW1ONRuETwSL9F4O.IxWqtdELIduRhKBn38nNS', 1, 0, 0, 1, '2026-04-20 09:28:25', '2026-04-20 09:28:25'),
	(17, 1, '1abs11', 'Guest bs11', 'auto-111-1776679983543-69ed505fa544@guest.membership.local', '1990-01-01', '$2b$04$SsGa.tqd4v/pQD54FgAoDubXLZ4cqAAI/WhhCf5UFCdxzJH7pOjlm', 1, 0, 0, 1, '2026-04-20 10:13:03', '2026-04-20 10:13:03'),
	(18, 1, '88881111', 'Guest 1111', 'auto-88881111-1776682121686-93d658ebb36d@guest.membership.local', '1990-01-01', '$2b$04$rOVWqVVcnQ0BOgvM2O0PbOFaPBKqXupRSalbE0I8eVLAPhhk.EwtG', 1, 0, 0, 1, '2026-04-20 10:48:41', '2026-04-20 10:48:41');

-- Dumping structure for table membership.members_code
CREATE TABLE IF NOT EXISTS `members_code` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `memberId` int(10) unsigned NOT NULL DEFAULT 0,
  `redeemCode` varchar(50) NOT NULL DEFAULT '',
  `expDateTime` datetime NOT NULL DEFAULT '2025-01-01 00:00:00',
  `presence` tinyint(4) NOT NULL DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`redeemCode`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.members_code: ~8 rows (approximately)
INSERT INTO `members_code` (`id`, `memberId`, `redeemCode`, `expDateTime`, `presence`, `inputDate`, `updateDate`) VALUES
	(7, 1, 'TEST-REDEEM-001', '2026-12-31 23:59:59', 0, '2026-04-17 11:08:51', '2026-04-17 11:08:58'),
	(8, 1, 'BLUE-CODE-100', '2026-05-17 18:08:51', 0, '2026-04-17 11:08:51', '2026-04-17 11:10:05'),
	(9, 5, 'EXPIRED-CODE', '2025-01-01 00:00:00', 1, '2026-04-17 11:08:51', '2026-04-17 11:08:51'),
	(10, 5, 'LOW-POINT-CODE', '2026-05-17 18:11:19', 1, '2026-04-17 11:11:19', '2026-04-17 11:11:19'),
	(11, 1, 'TEST-001A', '2027-12-31 23:59:59', 0, '2026-04-20 07:40:41', '2026-04-20 07:46:22'),
	(13, 1, 'TEST-002B', '2027-12-31 23:59:59', 0, '2026-04-20 08:35:46', '2026-04-20 08:38:25'),
	(14, 999999, 'AUTO-RDM-MISS-001', '2027-12-31 23:59:59', 1, '2026-04-20 09:31:04', '2026-04-20 09:31:04'),
	(15, 999999, 'AUTO-RDM-MISS-002', '2027-12-31 23:59:59', 1, '2026-04-20 09:37:24', '2026-04-20 09:37:24');

-- Dumping structure for table membership.members_voucher
CREATE TABLE IF NOT EXISTS `members_voucher` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `voucherId` int(11) NOT NULL DEFAULT 0,
  `memberId` smallint(6) NOT NULL DEFAULT 0,
  `barcode` varchar(50) NOT NULL DEFAULT '0',
  `amount` int(11) NOT NULL DEFAULT 0,
  `expiredDate` date NOT NULL DEFAULT '2028-01-01',
  `used` tinyint(4) NOT NULL DEFAULT 0,
  `usedDate` datetime NOT NULL DEFAULT '2000-01-01 00:00:00',
  `usedMarchantId` int(11) NOT NULL DEFAULT 0,
  `presence` tinyint(1) DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.members_voucher: ~0 rows (approximately)

-- Dumping structure for table membership.merchant
CREATE TABLE IF NOT EXISTS `merchant` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL DEFAULT '',
  `startDate` date NOT NULL DEFAULT '2026-01-01',
  `expDate` date NOT NULL DEFAULT '2028-01-01',
  `description` text NOT NULL,
  `image` varchar(250) NOT NULL DEFAULT '',
  `icon` varchar(250) NOT NULL DEFAULT '',
  `status` tinyint(4) NOT NULL DEFAULT 1,
  `presence` tinyint(4) NOT NULL DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.merchant: ~3 rows (approximately)
INSERT INTO `merchant` (`id`, `name`, `startDate`, `expDate`, `description`, `image`, `icon`, `status`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 'POS Supermarket', '2026-01-01', '2028-01-01', '', '', '', 1, 1, '2026-04-16 06:20:00', '2026-04-16 07:34:37'),
	(2, 'Putien', '2026-01-01', '2028-01-01', '', '', '', 1, 1, '2026-04-16 06:20:00', '2026-04-16 07:34:37'),
	(3, 'Crystal jade', '2026-01-01', '2028-01-01', '', '', '', 1, 1, '2026-04-16 06:20:00', '2026-04-16 07:34:38');

-- Dumping structure for table membership.points
CREATE TABLE IF NOT EXISTS `points` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `transactionId` int(11) NOT NULL DEFAULT 0,
  `memberId` int(11) NOT NULL DEFAULT 0,
  `merchantId` int(11) NOT NULL DEFAULT 0,
  `tierId` smallint(6) NOT NULL DEFAULT 0,
  `pointIn` bigint(20) NOT NULL DEFAULT 0,
  `pointOut` bigint(20) NOT NULL DEFAULT 0,
  `transactionDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `note` varchar(250) NOT NULL DEFAULT '',
  `archived` tinyint(4) NOT NULL DEFAULT 0,
  `status` tinyint(4) NOT NULL DEFAULT 1,
  `presence` tinyint(4) NOT NULL DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.points: ~29 rows (approximately)
INSERT INTO `points` (`id`, `transactionId`, `memberId`, `merchantId`, `tierId`, `pointIn`, `pointOut`, `transactionDate`, `note`, `archived`, `status`, `presence`, `inputDate`, `updateDate`) VALUES
	(5, 5, 1, 1, 1, 50000, 0, '2026-04-16 07:51:13', '', 0, 1, 1, '2026-04-16 07:51:13', '2026-04-16 07:51:44'),
	(6, 6, 1, 1, 1, 50000, 0, '2026-04-16 07:34:32', 'POS paid transaction', 0, 1, 1, '2026-04-16 08:34:28', '2026-04-16 08:34:28'),
	(7, 7, 1, 1, 1, 10000, 0, '2026-04-16 01:40:00', 'SQL datetime test', 0, 1, 1, '2026-04-16 08:37:04', '2026-04-16 08:37:04'),
	(8, 8, 1, 1, 1, 10000, 0, '2026-04-16 01:40:00', 'Final verification', 0, 1, 1, '2026-04-16 08:39:26', '2026-04-16 08:39:26'),
	(9, 9, 1, 1, 1, 5000, 0, '2026-04-16 02:00:00', 'controller validation test', 0, 1, 1, '2026-04-16 08:53:54', '2026-04-16 08:53:54'),
	(10, 10, 1, 1, 1, 150000, 0, '2026-04-16 00:34:32', 'POSMANT paid transaction', 0, 1, 1, '2026-04-16 08:58:01', '2026-04-16 08:58:01'),
	(11, 11, 1, 1, 1, 150000, 0, '2026-04-16 00:34:32', 'POSMANT paid transaction', 0, 1, 1, '2026-04-16 08:59:10', '2026-04-16 08:59:10'),
	(12, 12, 1, 1, 1, 25000, 0, '2026-04-16 02:20:00', 'token header verification', 0, 1, 1, '2026-04-16 09:01:08', '2026-04-16 09:01:08'),
	(13, 13, 1, 1, 1, 150000, 0, '2026-04-16 00:34:32', 'POSMANT paid transaction', 0, 1, 1, '2026-04-16 09:04:20', '2026-04-16 09:04:20'),
	(14, 14, 5, 1, 1, 30000, 0, '2026-04-16 03:15:00', 'balance test with tier', 0, 1, 1, '2026-04-16 09:10:02', '2026-04-16 09:10:02'),
	(15, 0, 1, 1, 1, 0, 50000, '2026-04-17 04:08:58', 'Redeem - Code: TEST-REDEEM-001', 0, 1, 1, '2026-04-17 11:08:58', '2026-04-17 11:08:58'),
	(16, 0, 1, 1, 1, 0, 50000, '2026-04-17 04:10:05', 'Redeem - Code: BLUE-CODE-100', 0, 1, 1, '2026-04-17 11:10:05', '2026-04-17 11:10:05'),
	(28, 28, 14, 1, 1, 20000, 0, '2026-04-20 02:24:43', 'AUTO-PHONE-003', 0, 1, 1, '2026-04-20 09:24:43', '2026-04-20 09:24:43'),
	(29, 29, 15, 1, 1, 12000, 0, '2026-04-20 02:28:25', 'AUTO-PHONE-004', 0, 1, 1, '2026-04-20 09:28:25', '2026-04-20 09:28:25'),
	(30, 0, 15, 1, 1, 0, 5000, '2026-04-20 03:02:56', 'Redeem POS V1 - POSV1-RDM-NOCODE-001', 0, 1, 1, '2026-04-20 10:02:56', '2026-04-20 10:02:56'),
	(31, 0, 15, 1, 1, 0, 750, '2026-04-20 03:08:11', 'Redeem POS V1 - POSV1-RDM-NOCODE-003', 0, 1, 1, '2026-04-20 10:08:11', '2026-04-20 10:08:11'),
	(32, 0, 1, 1, 1, 0, 750, '2026-04-20 03:08:49', 'Redeem POS V1 - TRX-2026-00129', 0, 1, 1, '2026-04-20 10:08:49', '2026-04-20 10:08:49'),
	(33, 0, 1, 1, 1, 0, 37500, '2026-04-20 03:11:45', 'Redeem POS V1 - TRX-2026-00129', 0, 1, 1, '2026-04-20 10:11:45', '2026-04-20 10:11:45'),
	(34, 0, 1, 1, 1, 0, 37500, '2026-04-20 03:12:15', 'Redeem POS V1 - TRX-2026-00129', 0, 1, 1, '2026-04-20 10:12:15', '2026-04-20 10:12:15'),
	(35, 0, 1, 1, 1, 0, 52500, '2026-04-20 03:13:14', 'Redeem POS V1 - TRX-2026-00129', 0, 1, 1, '2026-04-20 10:13:14', '2026-04-20 10:13:14'),
	(36, 0, 1, 1, 1, 0, 52500, '2026-04-20 03:35:50', 'Redeem POS V1 - TRX-2026-00129', 0, 1, 1, '2026-04-20 10:35:50', '2026-04-20 10:35:50'),
	(37, 0, 1, 1, 1, 0, 52500, '2026-04-20 03:44:30', 'Redeem POS V1 - TRX-2026-00129', 0, 1, 1, '2026-04-20 10:44:30', '2026-04-20 10:44:30'),
	(38, 0, 1, 1, 1, 0, 52500, '2026-04-20 03:45:37', 'Redeem POS V1 - TRX-2026-00129', 0, 1, 1, '2026-04-20 10:45:37', '2026-04-20 10:45:37'),
	(39, 39, 18, 1, 1, 15000, 0, '2026-04-20 07:30:00', 'POSTMAN test 1', 0, 1, 1, '2026-04-20 10:48:41', '2026-04-20 10:48:41'),
	(40, 40, 1, 1, 1, 15000, 0, '2026-04-20 07:30:00', 'POSTMAN test 1', 0, 1, 1, '2026-04-20 10:48:54', '2026-04-20 10:48:54'),
	(41, 41, 1, 1, 1, 45000, 0, '2026-04-20 07:30:00', 'POSTMAN test 1', 0, 1, 1, '2026-04-20 10:49:10', '2026-04-20 10:49:10'),
	(42, 42, 1, 1, 1, 45000, 0, '2026-04-20 07:30:00', 'POSTMAN test 1', 0, 1, 1, '2026-04-20 10:49:13', '2026-04-20 10:49:13'),
	(43, 0, 1, 1, 1, 0, 52500, '2026-04-20 03:49:20', 'Redeem POS V1 - TRX-2026-00129', 0, 1, 1, '2026-04-20 10:49:20', '2026-04-20 10:49:20'),
	(44, 0, 1, 1, 1, 0, 9000, '2026-04-20 03:58:58', 'Redeem POS V1 - TRX-2026-00129', 0, 1, 1, '2026-04-20 10:58:58', '2026-04-20 10:58:58');

-- Dumping structure for table membership.promo
CREATE TABLE IF NOT EXISTS `promo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `img` varchar(250) NOT NULL,
  `description` mediumtext DEFAULT NULL,
  `birthdayMember` tinyint(4) NOT NULL DEFAULT 0,
  `birthdayAfter` tinyint(4) NOT NULL DEFAULT 7,
  `birthdayBefore` tinyint(4) NOT NULL DEFAULT 7,
  `startDate` date DEFAULT NULL,
  `endDate` date DEFAULT NULL,
  `presence` tinyint(1) DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.promo: ~3 rows (approximately)
INSERT INTO `promo` (`id`, `name`, `img`, `description`, `birthdayMember`, `birthdayAfter`, `birthdayBefore`, `startDate`, `endDate`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 'QA Promo API Updated', '', 'Updated promo API smoke test', 0, 0, 0, '2026-04-22', '2026-12-31', 0, '2026-04-22 06:27:41', '2026-04-22 06:27:41'),
	(2, 'Kartini', 'http://localhost:3200/public/upload/1776840518054-1.jpg', 'A highly configurable component that helps you with selecting calendar dates.\nNgbDatepicker is meant to be displayed inline on a page or put inside a popup.', 0, 0, 0, '2026-04-14', '2026-04-29', 1, '2026-04-22 06:29:15', '2026-04-22 06:48:43'),
	(3, 'Promo Ulang Tahun Hub BCA 69', 'https://pustaka.bca.co.id/Promo/3793FC69-922F-4FF6-91FE-44D1D6D0C8F4/BannerHomepage/id/20260219_banner-hut-bca.jpeg?v=23042026160415', 'Harga Spesial Rp69 Ribu\n\nSyarat & Ketentuan:\n\n- Harga spesial Rp69 ribu untuk paket Bakmi GM, Nasi Ayam Lada Cha Cha, dan 2 Es Teh Manis\n- Berlaku untuk 1x transaksi/nasabah/hari\n- Berlaku untuk pembayaran dengan QRIS di myBCA\n- Berlaku dine in dan takeaway di seluruh outlet Bakmi GM (kecuali stasiun & bandara)', 0, 0, 0, '2026-03-31', '2029-04-28', 1, '2026-04-23 09:04:49', '2026-04-23 09:05:31');

-- Dumping structure for table membership.promo_merchant
CREATE TABLE IF NOT EXISTS `promo_merchant` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `promoId` int(11) NOT NULL DEFAULT 0,
  `marchantId` int(11) NOT NULL DEFAULT 0,
  `presence` tinyint(1) DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.promo_merchant: ~5 rows (approximately)
INSERT INTO `promo_merchant` (`id`, `promoId`, `marchantId`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 1, 1, 0, '2026-04-22 06:27:41', '2026-04-22 06:27:41'),
	(2, 1, 2, 0, '2026-04-22 06:27:41', '2026-04-22 06:27:41'),
	(3, 2, 1, 1, '2026-04-22 06:29:24', '2026-04-22 06:29:24'),
	(4, 2, 2, 1, '2026-04-22 06:29:24', '2026-04-22 06:29:24'),
	(5, 2, 3, 1, '2026-04-22 06:29:24', '2026-04-22 06:29:24');

-- Dumping structure for table membership.tier
CREATE TABLE IF NOT EXISTS `tier` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL DEFAULT '0',
  `percentOfCashBack` float NOT NULL DEFAULT 0,
  `accumulationAmount` int(11) NOT NULL DEFAULT 0,
  `minAmount` bigint(20) NOT NULL DEFAULT 0,
  `maxPercentOfBill` tinyint(4) NOT NULL DEFAULT 0,
  `expDate` date NOT NULL DEFAULT '2027-01-01',
  `status` tinyint(4) NOT NULL DEFAULT 1,
  `presence` tinyint(4) NOT NULL DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.tier: ~4 rows (approximately)
INSERT INTO `tier` (`id`, `name`, `percentOfCashBack`, `accumulationAmount`, `minAmount`, `maxPercentOfBill`, `expDate`, `status`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 'blue', 10, 0, 100000, 15, '2027-01-01', 1, 1, '2026-04-16 06:20:45', '2026-04-20 09:54:45'),
	(2, 'silver', 15, 0, 500000, 15, '2027-01-01', 1, 1, '2026-04-16 06:20:52', '2026-04-20 09:54:47'),
	(3, 'gold', 20, 0, 1000000, 15, '2027-01-01', 1, 1, '2026-04-16 06:20:56', '2026-04-20 09:54:48'),
	(4, 'platinum', 30, 0, 2000000, 15, '2027-01-01', 1, 1, '2026-04-16 06:20:58', '2026-04-20 09:54:48');

-- Dumping structure for table membership.transaction
CREATE TABLE IF NOT EXISTS `transaction` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `memberId` varchar(50) NOT NULL DEFAULT '',
  `merchantId` int(11) NOT NULL DEFAULT 0,
  `bill` varchar(50) NOT NULL DEFAULT '0',
  `totalAmount` bigint(20) NOT NULL DEFAULT 0,
  `totalRedeem` bigint(20) NOT NULL DEFAULT 0,
  `redeemCode` varchar(50) NOT NULL DEFAULT '',
  `approvalCode` varchar(50) NOT NULL DEFAULT '',
  `billDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `note` varchar(250) NOT NULL DEFAULT '',
  `syncType` varchar(250) NOT NULL DEFAULT '',
  `archived` tinyint(4) NOT NULL DEFAULT 0,
  `status` tinyint(4) NOT NULL DEFAULT 1,
  `presence` tinyint(4) NOT NULL DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ini table untuk transaksi masuk dari POS via API atau CSV/TXT, transaction yang sudah paid dari POS di kirim ke sini untuk kalkulas % of cashback';

-- Dumping data for table membership.transaction: ~26 rows (approximately)
INSERT INTO `transaction` (`id`, `memberId`, `merchantId`, `bill`, `totalAmount`, `totalRedeem`, `redeemCode`, `approvalCode`, `billDate`, `note`, `syncType`, `archived`, `status`, `presence`, `inputDate`, `updateDate`) VALUES
	(5, '1', 1, 'TA1', 500000, 0, '', '', '2026-04-16 07:34:32', '', 'api', 0, 1, 1, '2026-04-16 07:34:32', '2026-04-16 07:35:31'),
	(6, '1', 1, 'UAT-POINT-001', 500000, 0, '', '', '2026-04-16 07:34:32', 'POS paid transaction', 'api', 0, 1, 1, '2026-04-16 08:34:28', '2026-04-16 08:34:28'),
	(7, '1', 1, 'UAT-POINT-002', 100000, 0, '', '', '2026-04-16 01:40:00', 'SQL datetime test', 'api', 0, 1, 1, '2026-04-16 08:37:04', '2026-04-16 08:37:04'),
	(8, '1', 1, 'UAT-POINT-003', 100000, 0, '', '', '2026-04-16 01:40:00', 'Final verification', 'api', 0, 1, 1, '2026-04-16 08:39:26', '2026-04-16 08:39:26'),
	(9, '1', 1, 'CTRL-VALID-001', 50000, 0, '', '', '2026-04-16 02:00:00', 'controller validation test', 'api', 0, 1, 1, '2026-04-16 08:53:54', '2026-04-16 08:53:54'),
	(10, '1', 1, 'TA1', 1500000, 0, '', '', '2026-04-16 00:34:32', 'POSMANT paid transaction', 'api', 0, 1, 1, '2026-04-16 08:58:01', '2026-04-16 08:58:01'),
	(11, '1', 1, 'TA1', 1500000, 0, '', '', '2026-04-16 00:34:32', 'POSMANT paid transaction', 'api', 0, 1, 1, '2026-04-16 08:59:10', '2026-04-16 08:59:10'),
	(12, '1', 1, 'TOKEN-VERIFY-001', 250000, 0, '', '', '2026-04-16 02:20:00', 'token header verification', 'api', 0, 1, 1, '2026-04-16 09:01:08', '2026-04-16 09:01:08'),
	(13, '1', 1, 'TA1', 1500000, 0, '', '', '2026-04-16 00:34:32', 'POSMANT paid transaction', 'api', 0, 1, 1, '2026-04-16 09:04:20', '2026-04-16 09:04:20'),
	(14, '5', 1, 'TEST-BALANCE-002', 300000, 0, '', '', '2026-04-16 03:15:00', 'balance test with tier', 'api', 0, 1, 1, '2026-04-16 09:10:02', '2026-04-16 09:10:02'),
	(15, '1', 1, 'REDEEM-TRX-001', 0, 50000, 'TEST-REDEEM-001', '', '2026-04-17 04:08:58', 'Approval Code: 192DB26CF300539C5E64F8255FA8B98D', 'api', 0, 1, 1, '2026-04-17 11:08:58', '2026-04-17 11:08:58'),
	(16, '1', 1, 'REDEEM-TRX-002', 0, 50000, 'BLUE-CODE-100', '', '2026-04-17 04:10:05', 'Approval Code: 57ADD8B9879304AE5A7BE858A94D28DB', 'api', 0, 1, 1, '2026-04-17 11:10:05', '2026-04-17 11:10:05'),
	(27, '13', 1, 'AUTO-PHONE-002-BILL', 200000, 0, '', '', '2026-04-20 09:24:16', 'AUTO-PHONE-002', 'api', 0, 1, 1, '2026-04-20 09:24:16', '2026-04-20 09:24:16'),
	(28, '14', 1, 'AUTO-PHONE-003-BILL', 200000, 0, '', '', '2026-04-20 02:24:43', 'AUTO-PHONE-003', 'api', 0, 1, 1, '2026-04-20 09:24:43', '2026-04-20 09:24:43'),
	(29, '15', 1, 'AUTO-PHONE-004-BILL', 120000, 0, '', '', '2026-04-20 02:28:25', 'AUTO-PHONE-004', 'api', 0, 1, 1, '2026-04-20 09:28:25', '2026-04-20 09:28:25'),
	(30, '15', 1, 'POSV1-RDM-NOCODE-001', 100000, 5000, '', '', '2026-04-20 03:02:56', 'Approval Code: 4A83D56EA9FFF839134338DA449D4A90', 'api', 0, 1, 1, '2026-04-20 10:02:56', '2026-04-20 10:02:56'),
	(31, '15', 1, 'POSV1-RDM-NOCODE-003', 5000, 750, '', '', '2026-04-20 03:08:11', 'Approval Code: B50C5E86582A526ABDFA0AB82A005D32', 'api', 0, 1, 1, '2026-04-20 10:08:11', '2026-04-20 10:08:11'),
	(32, '1', 1, 'TRX-2026-00129', 5002, 750, '', '', '2026-04-20 03:08:49', 'Approval Code: FDF2760A549F7DB68972AB28E525EBE8', 'api', 0, 1, 1, '2026-04-20 10:08:49', '2026-04-20 10:08:49'),
	(33, '1', 1, 'TRX-2026-00129', 250002, 37500, '', '9CD16618B2CE66C74D399F9C1227E3F7', '2026-04-20 03:11:45', 'Approval Code: 9CD16618B2CE66C74D399F9C1227E3F7', 'api', 0, 1, 1, '2026-04-20 10:11:45', '2026-04-20 10:11:45'),
	(34, '1', 1, 'TRX-2026-00129', 250002, 37500, '', '056E19A3FFC0F46B43A18ECA2EBC5520', '2026-04-20 03:12:15', 'Approval Code: 056E19A3FFC0F46B43A18ECA2EBC5520', 'api', 0, 1, 1, '2026-04-20 10:12:15', '2026-04-20 10:12:15'),
	(35, '1', 1, 'TRX-2026-00129', 350002, 52500, '', '024DF36E4BE85E999BF77823AF78E2A0', '2026-04-20 03:13:14', 'Approval Code: 024DF36E4BE85E999BF77823AF78E2A0', 'api', 0, 1, 1, '2026-04-20 10:13:14', '2026-04-20 10:13:14'),
	(36, '1', 1, 'TRX-2026-00129', 350002, 52500, '', '21519FE181071C382BD1FDAE63C1F84F', '2026-04-20 03:35:50', 'Approval Code: 21519FE181071C382BD1FDAE63C1F84F', 'api', 0, 1, 1, '2026-04-20 10:35:50', '2026-04-20 10:35:50'),
	(37, '1', 1, 'TRX-2026-00129', 350002, 52500, '', '6E64679B647871DE811E724A8E656E95', '2026-04-20 03:44:30', 'Approval Code: 6E64679B647871DE811E724A8E656E95', 'api', 0, 1, 1, '2026-04-20 10:44:30', '2026-04-20 10:44:30'),
	(38, '1', 1, 'TRX-2026-00129', 350002, 52500, '', '597A5459E0AB5AD42C9EDFE113F3683F', '2026-04-20 03:45:37', 'Approval Code: 597A5459E0AB5AD42C9EDFE113F3683F', 'api', 0, 1, 1, '2026-04-20 10:45:37', '2026-04-20 10:45:37'),
	(39, '18', 1, 'INV-2026-00014', 150000, 0, '', '', '2026-04-20 07:30:00', 'POSTMAN test 1', 'api', 0, 1, 1, '2026-04-20 10:48:41', '2026-04-20 10:48:41'),
	(40, '1', 1, 'INV-2026-00014', 150000, 0, '', '', '2026-04-20 07:30:00', 'POSTMAN test 1', 'api', 0, 1, 1, '2026-04-20 10:48:54', '2026-04-20 10:48:54'),
	(41, '1', 1, 'INV-2026-00014', 450000, 0, '', '', '2026-04-20 07:30:00', 'POSTMAN test 1', 'api', 0, 1, 1, '2026-04-20 10:49:10', '2026-04-20 10:49:10'),
	(42, '1', 1, 'INV-2026-00014', 450000, 0, '', '', '2026-04-20 07:30:00', 'POSTMAN test 1', 'api', 0, 1, 1, '2026-04-20 10:49:13', '2026-04-20 10:49:13'),
	(43, '1', 1, 'TRX-2026-00129', 350002, 52500, '', '023E495EAF238BD006083F7613A2D2DD', '2026-04-20 03:49:20', 'Approval Code: 023E495EAF238BD006083F7613A2D2DD', 'api', 0, 1, 1, '2026-04-20 10:49:20', '2026-04-20 10:49:20'),
	(44, '1', 1, 'TRX-2026-00129', 60002, 9000, '', 'EA729C9D02610092AF37602A0AEDB28D', '2026-04-20 03:58:58', 'Approval Code: EA729C9D02610092AF37602A0AEDB28D', 'api', 0, 1, 1, '2026-04-20 10:58:58', '2026-04-20 10:58:58');

-- Dumping structure for table membership.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `note` varchar(250) NOT NULL,
  `isLock` tinyint(4) NOT NULL DEFAULT 0,
  `invisibleUser` tinyint(4) NOT NULL DEFAULT 0,
  `presence` tinyint(4) NOT NULL DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.users: ~3 rows (approximately)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `note`, `isLock`, `invisibleUser`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 'admin', 'admin@admin.com', '$2b$10$Vn6IhUeIs6m2RwJKw4oZqO8DdDSvrG3BuzszhDHTvPwRnR0n.Wt3q', 'pass : admin123', 1, 0, 1, '2026-04-16 07:59:39', '2026-04-22 07:24:35'),
	(2, 'QA Staff Updated', 'qa.staff.1776843327@mail.com', '$2b$04$3DIBJiXqzDIddIALcfV5AelLJi.LHnkAm8waLPKcpp9A8Dx6POwkC', 'qa updated', 0, 0, 1, '2026-04-22 07:35:27', '2026-04-22 07:57:38'),
	(3, 'Staff Delete Guard', 'staff.1776843363770@mail.com', '$2b$04$60mnwA1FnA7zbC7bw5Vx0.DZElM3oNpX6m9zf.FjwTtLhHT7OgRcq', 'staff', 0, 1, 1, '2026-04-22 07:36:03', '2026-04-22 07:58:07');

-- Dumping structure for table membership.users_token
CREATE TABLE IF NOT EXISTS `users_token` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `userId` varchar(120) NOT NULL,
  `merchantId` int(11) NOT NULL DEFAULT 0,
  `token` varchar(190) NOT NULL,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uq_users_email` (`token`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.users_token: ~1 rows (approximately)
INSERT INTO `users_token` (`id`, `userId`, `merchantId`, `token`, `inputDate`, `updateDate`) VALUES
	(1, '1', 1, 'tokensimpan.database', '2026-04-16 07:59:58', '2026-04-16 08:08:50'),
	(3, '1', 2, 'pos_live_d2d4b9cc18f1b52aed1aaf121643deeba997849ebbb8eaa19771e6c921255c97', '2026-04-21 08:52:33', '2026-04-21 08:52:33');

-- Dumping structure for table membership.voucher
CREATE TABLE IF NOT EXISTS `voucher` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `img` varchar(100) NOT NULL,
  `description` mediumtext DEFAULT NULL,
  `pointsRequired` int(11) NOT NULL,
  `pointsAmount` int(11) NOT NULL,
  `startDate` date DEFAULT NULL,
  `endDate` date DEFAULT NULL,
  `quota` int(11) DEFAULT NULL,
  `presence` tinyint(1) DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.voucher: ~4 rows (approximately)
INSERT INTO `voucher` (`id`, `name`, `img`, `description`, `pointsRequired`, `pointsAmount`, `startDate`, `endDate`, `quota`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 'QA Voucher API Updated', '', 'Updated from automated API QA', 60000, 60000, '2026-04-22', '2026-12-31', 120, 0, '2026-04-22 05:42:05', '2026-04-22 05:42:06'),
	(2, 'QA Voucher API Updated', '', 'Updated from automated API QA', 60000, 60000, '2026-04-22', '2026-12-31', 120, 1, '2026-04-22 05:42:22', '2026-04-22 05:51:52'),
	(3, 'QA Voucher Invalid Test', '', 'negative test', 10000, 10000, '2026-04-22', '2026-12-31', 10, 1, '2026-04-22 05:42:33', '2026-04-22 05:51:51'),
	(4, 'test', 'http://localhost:3200/public/upload/1776840629633-3.jpg', NULL, 10000, 10000, '2026-04-15', '2026-06-03', 1000, 1, '2026-04-22 05:51:22', '2026-04-22 06:50:31');

-- Dumping structure for table membership.voucher_merchant
CREATE TABLE IF NOT EXISTS `voucher_merchant` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `voucherId` int(11) NOT NULL DEFAULT 0,
  `marchantId` int(11) NOT NULL DEFAULT 0,
  `quota` smallint(6) NOT NULL DEFAULT 0,
  `presence` tinyint(1) DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.voucher_merchant: ~6 rows (approximately)
INSERT INTO `voucher_merchant` (`id`, `voucherId`, `marchantId`, `quota`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 1, 1, 0, 0, '2026-04-22 05:42:06', '2026-04-22 05:42:06'),
	(2, 1, 2, 0, 0, '2026-04-22 05:42:06', '2026-04-22 05:42:06'),
	(3, 2, 1, 0, 0, '2026-04-22 05:42:22', '2026-04-22 05:42:22'),
	(4, 2, 2, 0, 0, '2026-04-22 05:42:22', '2026-04-22 05:42:22'),
	(5, 4, 1, 0, 0, '2026-04-22 05:59:02', '2026-04-22 05:59:12'),
	(6, 4, 2, 0, 0, '2026-04-22 05:59:02', '2026-04-22 05:59:12');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
