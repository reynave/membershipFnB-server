const express = require('express');
const sampleController = require('../../controllers/membership/sample.controller');
const authRoutes = require('./auth.routes');
const pointRoutes = require('./point.routes');
const redeemRoutes = require('./redeem.routes');

const router = express.Router();

// --- Sample ---
router.get('/ping', sampleController.ping);

// --- Auth ---
router.use('/auth', authRoutes);

// --- Points ---
router.use('/points', pointRoutes);

// --- Redeem ---
router.use('/redeem', redeemRoutes);

module.exports = router;
