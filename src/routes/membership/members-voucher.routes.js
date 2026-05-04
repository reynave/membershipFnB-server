const express = require('express');
const controller = require('../../controllers/membership/membersVoucher.controller');
const auth = require('../../middleware/auth');

const router = express.Router();

// GET /api/membership/members-voucher
router.get('/', auth, controller.listMy);
// GET /api/membership/members-voucher/history
router.get('/history', auth, controller.listHistory);
// GET /api/membership/members-voucher/:id
router.get('/:id', auth, controller.getById);

module.exports = router;
