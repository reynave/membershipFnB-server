const express = require('express');
const controller = require('../../controllers/membership/vouchers.controller');
// const auth = require('../../middleware/auth');

const router = express.Router();

router.get('/', /*auth,*/ controller.list);
router.get('/:id', /*auth,*/ controller.detail);

module.exports = router;
