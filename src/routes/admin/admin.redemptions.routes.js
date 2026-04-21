const express = require('express');
const auth = require('../../middleware/auth');
const controller = require('../../controllers/admin/admin.redemptions.controller');

const router = express.Router();

router.get('/',    auth, controller.list);
router.get('/:id', auth, controller.detail);

module.exports = router;
