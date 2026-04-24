const express = require('express');
const controller = require('../../controllers/membership/membersVoucher.controller');
const auth = require('../../middleware/auth');

const router = express.Router();

// GET /api/membership/members-voucher
router.get('/', auth, controller.listMy);

module.exports = router;
