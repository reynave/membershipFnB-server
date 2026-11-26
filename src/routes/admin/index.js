const express = require('express');
const sampleController = require('../../controllers/admin/sample.controller');
const authRoutes       = require('./auth.routes');
const memberRoutes     = require('./member.routes');
const reportsRoutes    = require('./reports.routes');

const adminMembersRoutes      = require('./admin.members.routes');
const adminRedemptionsRoutes  = require('./admin.redemptions.routes');
const adminTiersRoutes        = require('./admin.tiers.routes');
const adminTransactionsRoutes = require('./admin.transactions.routes');
const adminPointsRoutes       = require('./admin.points.routes');
const adminUploadsRoutes      = require('./admin.uploads.routes');
const adminUsersRoutes        = require('./admin.users.routes');
const adminVouchersRoutes     = require('./admin.vouchers.routes');
const adminPromosRoutes       = require('./admin.promos.routes');
const adminImportsRoutes      = require('./admin.member-sales-imports.routes');
const adminIgourmeteRoutes    = require('./admin.igourmete-imports.routes');

const router = express.Router();

// --- Sample ---
router.get('/ping', sampleController.ping);

// --- Auth (login admin) ---
router.use('/auth', authRoutes);

// --- Legacy member/reports routes ---
router.use('/member',  memberRoutes);
router.use('/reports', reportsRoutes);

// --- Admin API ---
router.use('/members',      adminMembersRoutes);
router.use('/redemptions',  adminRedemptionsRoutes);
router.use('/tiers',        adminTiersRoutes);
router.use('/transactions', adminTransactionsRoutes);
router.use('/points',       adminPointsRoutes);
router.use('/uploads',      adminUploadsRoutes);
router.use('/users',        adminUsersRoutes);
router.use('/vouchers',     adminVouchersRoutes);
router.use('/promos',       adminPromosRoutes);
router.use('/imports',      adminImportsRoutes);
router.use('/imports',      adminIgourmeteRoutes);

module.exports = router;
