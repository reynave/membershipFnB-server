const express = require('express');
const auth = require('../../middleware/auth');
const controller = require('../../controllers/admin/admin.member-sales-imports.controller');

const router = express.Router();

// Import "Member Sales Listing Report" (POS) into staging tables
router.post('/member-sales',                auth, controller.upload);
router.get('/member-sales',                 auth, controller.list);
router.get('/member-sales/:batchId',        auth, controller.detail);
router.get('/member-sales/:batchId/lines',  auth, controller.lines);
router.get('/member-sales/:batchId/members', auth, controller.members);
router.post('/member-sales/:batchId/commit', auth, controller.commit);
// Commit versi import_member -> transaction (dibuat terpisah, alur `commit` lama tidak berubah)
router.post('/member-sales/:batchId/commit-transaction', auth, controller.commitToTransaction);
router.delete('/member-sales/:batchId',     auth, controller.remove);

module.exports = router;
