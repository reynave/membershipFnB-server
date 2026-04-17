const express = require('express');
const sampleController = require('../../controllers/admin/sample.controller');
const authRoutes = require('./auth.routes');
const memberRoutes = require('./member.routes');
const reportsRoutes = require('./reports.routes');

const router = express.Router();

// --- Sample ---
router.get('/ping', sampleController.ping);

// --- Auth ---
router.use('/auth', authRoutes);

// --- Members ---
router.use('/members', memberRoutes);

// --- Reports ---
router.use('/reports', reportsRoutes);

module.exports = router;
