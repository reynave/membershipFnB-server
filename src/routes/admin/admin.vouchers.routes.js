const express = require('express');
const auth = require('../../middleware/auth');
const controller = require('../../controllers/admin/admin.vouchers.controller');

const router = express.Router();

router.get('/', auth, controller.list);
router.post('/', auth, controller.create);
router.get('/:id', auth, controller.detail);
router.put('/:id', auth, controller.update);
router.put('/:id/merchants', auth, controller.setMerchants);
router.delete('/:id', auth, controller.remove);

module.exports = router;
