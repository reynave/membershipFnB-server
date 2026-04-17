const express = require('express');
const redeemController = require('../../controllers/membership/redeem.controller');

const router = express.Router();

router.post('/redeem', redeemController.redeemPoint);

module.exports = router;
