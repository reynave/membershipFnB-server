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
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.members: ~9 rows (approximately)
INSERT INTO `members` (`id`, `tierId`, `phone`, `name`, `email`, `password_hash`, `status`, `verified`, `activated`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 1, '111', 'testing', 'cso1@email.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-15 11:26:14', '2026-04-20 09:13:08'),
	(2, 1, '2222', 'Revisi Schema', 'schema.revisi@example.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-15 11:01:51', '2026-04-20 09:13:10'),
	(4, 1, '3333', 'uat', 'uat@email.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-15 11:31:42', '2026-04-20 09:13:11'),
	(5, 1, '4444', 'Test Member', 'testmember@example.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-16 09:09:38', '2026-04-20 09:13:13'),
	(6, 0, '5555', 'Test Member 2', 'testmember2@example.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-16 09:09:47', '2026-04-20 09:13:14'),
	(12, 1, '16666', 'Demo User', 'demo.user@example.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 0, 1, 1, '2026-04-15 10:48:14', '2026-04-20 09:13:16'),
	(13, 1, '0899911122244', 'Guest 2244', 'auto-0899911122244-1776677056242-80f51698743a@guest.membership.local', '$2b$04$1Vym9vyX5kpMqgWsn7ga8OPT28/R5cbcUVxuYAojbMQuVa8QaT1nm', 1, 0, 0, 1, '2026-04-20 09:24:16', '2026-04-20 09:24:16'),
	(14, 1, '0899911122255', 'Guest 2255', 'auto-0899911122255-1776677083345-cddce4241ec5@guest.membership.local', '$2b$04$S8d.5aqm3OvzRqSHnB11EuoXNERBvDck4HX98Gt9zhV3VjVifEC7.', 1, 0, 0, 1, '2026-04-20 09:24:43', '2026-04-20 09:24:43'),
	(15, 1, '0899911122266', 'Guest 2266', 'auto-0899911122266-1776677305520-df29e99810ed@guest.membership.local', '$2b$04$XGmlXMW2NvWDowgwW1ONRuETwSL9F4O.IxWqtdELIduRhKBn38nNS', 1, 0, 0, 1, '2026-04-20 09:28:25', '2026-04-20 09:28:25');

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
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.points: ~25 rows (approximately)
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
	(17, 17, 1, 1, 1, 5000, 0, '2026-04-20 04:00:00', 'service test', 0, 1, 1, '2026-04-20 07:13:34', '2026-04-20 07:13:34'),
	(18, 18, 1, 1, 1, 13000, 0, '2026-04-20 06:00:00', 'no jwt test', 0, 1, 1, '2026-04-20 07:18:08', '2026-04-20 07:18:08'),
	(19, 19, 1, 1, 1, 11100, 0, '2026-04-20 07:00:00', 'TEST-001A', 0, 1, 1, '2026-04-20 07:43:41', '2026-04-20 07:43:41'),
	(20, 0, 1, 1, 1, 0, 1000, '2026-04-20 00:46:22', 'Redeem - Code: TEST-001A', 0, 1, 1, '2026-04-20 07:46:22', '2026-04-20 07:46:22'),
	(21, 21, 1, 1, 1, 12300, 0, '2026-04-20 08:34:04', 'TEST-002A', 0, 1, 1, '2026-04-20 08:34:04', '2026-04-20 08:34:04'),
	(22, 22, 1, 1, 1, 12500, 0, '2026-04-20 08:38:18', 'TEST-002B', 0, 1, 1, '2026-04-20 08:38:18', '2026-04-20 08:38:18'),
	(23, 0, 1, 1, 1, 0, 1000, '2026-04-20 01:38:25', 'Redeem - Code: TEST-002B', 0, 1, 1, '2026-04-20 08:38:25', '2026-04-20 08:38:25'),
	(24, 24, 1, 1, 1, 15000, 0, '2026-04-20 07:30:00', 'POSTMAN test 1', 0, 1, 1, '2026-04-20 08:55:59', '2026-04-20 08:55:59'),
	(25, 25, 1, 1, 1, 15000, 0, '2026-04-20 07:30:00', 'POSTMAN test 1', 0, 1, 1, '2026-04-20 09:08:34', '2026-04-20 09:08:34'),
	(26, 26, 1, 1, 1, 15000, 0, '2026-04-20 07:30:00', 'POSTMAN test 1', 0, 1, 1, '2026-04-20 09:08:42', '2026-04-20 09:08:42'),
	(27, 27, 13, 1, 1, 20000, 0, '2026-04-20 09:24:16', 'AUTO-PHONE-002', 0, 1, 1, '2026-04-20 09:24:16', '2026-04-20 09:24:16'),
	(28, 28, 14, 1, 1, 20000, 0, '2026-04-20 02:24:43', 'AUTO-PHONE-003', 0, 1, 1, '2026-04-20 09:24:43', '2026-04-20 09:24:43'),
	(29, 29, 15, 1, 1, 12000, 0, '2026-04-20 02:28:25', 'AUTO-PHONE-004', 0, 1, 1, '2026-04-20 09:28:25', '2026-04-20 09:28:25');

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
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ini table untuk transaksi masuk dari POS via API atau CSV/TXT, transaction yang sudah paid dari POS di kirim ke sini untuk kalkulas % of cashback';

-- Dumping data for table membership.transaction: ~25 rows (approximately)
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
	(17, '1', 1, 'POSV1-SVC-TEST', 50000, 0, '', '', '2026-04-20 04:00:00', 'service test', 'api', 0, 1, 1, '2026-04-20 07:13:34', '2026-04-20 07:13:34'),
	(18, '1', 1, 'POS-V1-NOJWT-001', 130000, 0, '', '', '2026-04-20 06:00:00', 'no jwt test', 'api', 0, 1, 1, '2026-04-20 07:18:08', '2026-04-20 07:18:08'),
	(19, '1', 1, 'TEST-001A-POINT', 111000, 0, '', '', '2026-04-20 07:00:00', 'TEST-001A', 'api', 0, 1, 1, '2026-04-20 07:43:41', '2026-04-20 07:43:41'),
	(20, '1', 1, 'TEST-001A', 0, 1000, 'TEST-001A', '', '2026-04-20 00:46:22', 'Approval Code: 061F27EF76724C37A860B18B45792530', 'api', 0, 1, 1, '2026-04-20 07:46:22', '2026-04-20 07:46:22'),
	(21, '1', 1, 'TEST-002A-POINT', 123000, 0, '', '', '2026-04-20 08:34:04', 'TEST-002A', 'api', 0, 1, 1, '2026-04-20 08:34:04', '2026-04-20 08:34:04'),
	(22, '1', 1, 'TEST-002B-POINT-2', 125000, 0, '', '', '2026-04-20 08:38:18', 'TEST-002B', 'api', 0, 1, 1, '2026-04-20 08:38:18', '2026-04-20 08:38:18'),
	(23, '1', 1, 'TEST-002B-RDM', 0, 1000, 'TEST-002B', '', '2026-04-20 01:38:25', 'Approval Code: 765207572DD182AA9053967F7D1C07B2', 'api', 0, 1, 1, '2026-04-20 08:38:25', '2026-04-20 08:38:25'),
	(24, '1', 1, 'INV-2026-00012', 150000, 0, '', '', '2026-04-20 07:30:00', 'POSTMAN test 1', 'api', 0, 1, 1, '2026-04-20 08:55:59', '2026-04-20 08:55:59'),
	(25, '1', 1, 'INV-2026-00012', 150000, 0, '', '', '2026-04-20 07:30:00', 'POSTMAN test 1', 'api', 0, 1, 1, '2026-04-20 09:08:34', '2026-04-20 09:08:34'),
	(26, '1', 1, 'INV-2026-00012', 150000, 0, '', '', '2026-04-20 07:30:00', 'POSTMAN test 1', 'api', 0, 1, 1, '2026-04-20 09:08:42', '2026-04-20 09:08:42'),
	(27, '13', 1, 'AUTO-PHONE-002-BILL', 200000, 0, '', '', '2026-04-20 09:24:16', 'AUTO-PHONE-002', 'api', 0, 1, 1, '2026-04-20 09:24:16', '2026-04-20 09:24:16'),
	(28, '14', 1, 'AUTO-PHONE-003-BILL', 200000, 0, '', '', '2026-04-20 02:24:43', 'AUTO-PHONE-003', 'api', 0, 1, 1, '2026-04-20 09:24:43', '2026-04-20 09:24:43'),
	(29, '15', 1, 'AUTO-PHONE-004-BILL', 120000, 0, '', '', '2026-04-20 02:28:25', 'AUTO-PHONE-004', 'api', 0, 1, 1, '2026-04-20 09:28:25', '2026-04-20 09:28:25');

-- Dumping structure for table membership.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.users: ~1 rows (approximately)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `inputDate`, `updateDate`) VALUES
	(1, 'admin', 'admin@admin.com', '123123', '2026-04-16 07:59:39', '2026-04-16 07:59:50');

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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.users_token: ~1 rows (approximately)
INSERT INTO `users_token` (`id`, `userId`, `merchantId`, `token`, `inputDate`, `updateDate`) VALUES
	(1, '1', 1, 'tokensimpan.database', '2026-04-16 07:59:58', '2026-04-16 08:08:50');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
