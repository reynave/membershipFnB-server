const express = require('express');
const auth = require('../../middleware/auth');
const controller = require('../../controllers/admin/admin.users.controller');

const router = express.Router();

router.get('/',    auth, controller.list);
router.post('/',   auth, controller.create);
router.get('/:id', auth, controller.detail);
router.put('/:id', auth, controller.update);
router.delete('/:id', auth, controller.remove);
router.post('/:id/tokens', auth, controller.createToken);
router.delete('/:id/tokens/:tokenId', auth, controller.removeToken);

module.exports = router;
