const express = require('express');
const auth = require('../../middleware/auth');
const controller = require('../../controllers/admin/admin.uploads.controller');

const router = express.Router();

router.post('/image', auth, controller.uploadImage);

module.exports = router;