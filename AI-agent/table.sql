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
  `presence` tinyint(4) NOT NULL DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uq_members_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.members: ~5 rows (approximately)
INSERT INTO `members` (`id`, `tierId`, `phone`, `name`, `email`, `password_hash`, `status`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 1, '1', 'Demo User', 'demo.user@example.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 1, '2026-04-15 10:48:14', '2026-04-16 09:23:28'),
	(2, 1, '2', 'Revisi Schema', 'schema.revisi@example.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 1, '2026-04-15 11:01:51', '2026-04-16 09:23:28'),
	(3, 1, '3', 'testing', 'cso1@email.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 1, '2026-04-15 11:26:14', '2026-04-16 07:38:42'),
	(4, 1, '4', 'uat', 'uat@email.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 1, '2026-04-15 11:31:42', '2026-04-16 09:23:29'),
	(5, 1, '0', 'Test Member', 'testmember@example.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 1, '2026-04-16 09:09:38', '2026-04-16 09:23:29'),
	(6, 0, '0', 'Test Member 2', 'testmember2@example.com', '$2b$04$AkCl96DDqLukffDmY0.wNuiXQ.xHsbfavJRfQUM.kgWX2hteMH9vi', 1, 1, '2026-04-16 09:09:47', '2026-04-16 09:23:30');

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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.members_code: ~0 rows (approximately)

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
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.points: ~8 rows (approximately)
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
	(14, 14, 5, 1, 1, 30000, 0, '2026-04-16 03:15:00', 'balance test with tier', 0, 1, 1, '2026-04-16 09:10:02', '2026-04-16 09:10:02');

-- Dumping structure for table membership.tier
CREATE TABLE IF NOT EXISTS `tier` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL DEFAULT '0',
  `percentOfCashBack` float NOT NULL DEFAULT 0,
  `accumulationAmount` int(11) NOT NULL DEFAULT 0,
  `minAmount` bigint(20) NOT NULL DEFAULT 0,
  `expDate` date NOT NULL DEFAULT '2027-01-01',
  `status` tinyint(4) NOT NULL DEFAULT 1,
  `presence` tinyint(4) NOT NULL DEFAULT 1,
  `inputDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `updateDate` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table membership.tier: ~4 rows (approximately)
INSERT INTO `tier` (`id`, `name`, `percentOfCashBack`, `accumulationAmount`, `minAmount`, `expDate`, `status`, `presence`, `inputDate`, `updateDate`) VALUES
	(1, 'blue', 10, 0, 100000, '2027-01-01', 1, 1, '2026-04-16 06:20:45', '2026-04-16 07:49:45'),
	(2, 'silver', 15, 0, 500000, '2027-01-01', 1, 1, '2026-04-16 06:20:52', '2026-04-16 07:49:51'),
	(3, 'gold', 20, 0, 1000000, '2027-01-01', 1, 1, '2026-04-16 06:20:56', '2026-04-16 07:49:31'),
	(4, 'platinum', 30, 0, 2000000, '2027-01-01', 1, 1, '2026-04-16 06:20:58', '2026-04-16 07:49:31');

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
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ini table untuk transaksi masuk dari POS via API atau CSV/TXT, transaction yang sudah paid dari POS di kirim ke sini untuk kalkulas % of cashback';

-- Dumping data for table membership.transaction: ~10 rows (approximately)
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
	(14, '5', 1, 'TEST-BALANCE-002', 300000, 0, '', '', '2026-04-16 03:15:00', 'balance test with tier', 'api', 0, 1, 1, '2026-04-16 09:10:02', '2026-04-16 09:10:02');

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
