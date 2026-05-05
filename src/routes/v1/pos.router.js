require('../../config/loadEnv');

const express = require('express');
const posController = require('../../controllers/v1/pos.controller');
const authPosV1 = require('../../middleware/authPosV1');

const router = express.Router();
const posV1JwtRequired = String(process.env.POS_V1_JWT_REQUIRED || 'false').toLowerCase() === 'true';
const posV1AuthMiddleware = posV1JwtRequired
	? authPosV1
	: (_req, _res, next) => next();

router.get('/members/balance', posV1AuthMiddleware, posController.getBalance);
router.get('/members/history/today', posV1AuthMiddleware, posController.getHistoryToday);
router.post('/points/in', posV1AuthMiddleware, posController.createPointIn);
router.post('/redeem', posV1AuthMiddleware, posController.redeemPoint);
router.post('/redeem-voucher', posV1AuthMiddleware, posController.redeemVoucher);


module.exports = router;