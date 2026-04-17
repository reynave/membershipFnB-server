const express = require('express');
const pointController = require('../../controllers/membership/point.controller');
const auth = require('../../middleware/auth');

const router = express.Router();

router.post('/transactions', pointController.createTransactionPoint);
router.get('/balance', auth, pointController.getTotalPoints);
router.get('/history', auth, pointController.getPointHistory);

module.exports = router;