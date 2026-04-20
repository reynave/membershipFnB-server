const express = require('express');
const redeemController = require('../../controllers/membership/redeem.controller');

const router = express.Router();

router.post('/redeem', (req, res, next) => {
	// #swagger.path = '/api/membership/redeem/redeem'
	// #swagger.tags = ['Redeem']
	// #swagger.summary = 'Redeem member point from POS'
	return redeemController.redeemPoint(req, res, next);
});

module.exports = router;
