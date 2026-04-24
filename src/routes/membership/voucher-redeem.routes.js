const express = require('express');
const controller = require('../../controllers/membership/voucherRedeem.controller');
const auth = require('../../middleware/auth');

const router = express.Router();

// POST /api/membership/voucher-redeem
router.post('/', auth, controller.redeem);

module.exports = router;
