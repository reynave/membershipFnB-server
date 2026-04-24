const express = require('express');
const sampleController = require('../../controllers/membership/sample.controller');
const authRoutes = require('./auth.routes');
const pointRoutes = require('./point.routes');
const redeemRoutes = require('./redeem.routes');
const promoRoutes = require('./promos.routes');

const router = express.Router();

// --- Sample ---
router.get('/ping', sampleController.ping);

// --- Auth ---
router.use('/auth', authRoutes);

// --- Points ---
router.use('/points', pointRoutes);

// --- Redeem ---
router.use('/redeem', redeemRoutes);

// --- Promos ---
router.use('/promos', promoRoutes);



module.exports = router;
