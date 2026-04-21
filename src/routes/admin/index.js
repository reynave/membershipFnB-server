const express = require('express');
const sampleController = require('../../controllers/admin/sample.controller');
const authRoutes       = require('./auth.routes');
const memberRoutes     = require('./member.routes');
const reportsRoutes    = require('./reports.routes');

const adminMembersRoutes      = require('./admin.members.routes');
const adminRedemptionsRoutes  = require('./admin.redemptions.routes');
const adminTiersRoutes        = require('./admin.tiers.routes');
const adminTransactionsRoutes = require('./admin.transactions.routes');
const adminUsersRoutes        = require('./admin.users.routes');

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
router.use('/users',        adminUsersRoutes);

module.exports = router;
