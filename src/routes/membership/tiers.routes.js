const express = require('express');
const controller = require('../../controllers/membership/tiers.controller');
const auth = require('../../middleware/auth');

const router = express.Router();

router.get('/progress', auth, controller.progress);
router.post('/upgrade', auth, controller.upgrade);
router.get('/', auth, controller.list);

module.exports = router;