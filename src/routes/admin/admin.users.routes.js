const express = require('express');
const auth = require('../../middleware/auth');
const controller = require('../../controllers/admin/admin.users.controller');

const router = express.Router();

router.get('/',    auth, controller.list);
router.get('/:id', auth, controller.detail);
router.post('/:id/tokens', auth, controller.createToken);
router.delete('/:id/tokens/:tokenId', auth, controller.removeToken);

module.exports = router;
