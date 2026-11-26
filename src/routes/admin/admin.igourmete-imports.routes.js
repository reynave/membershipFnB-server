const express = require('express');
const auth = require('../../middleware/auth');
const controller = require('../../controllers/admin/admin.igourmete-imports.controller');

const router = express.Router();

// Igourmate DBF import -> staging tables (dbf_import_batch / dbf_igourmete_daily)
router.post('/igourmete',                 auth, controller.upload);
router.get('/igourmete',                  auth, controller.list);
router.get('/igourmete/:batchId',         auth, controller.detail);
router.get('/igourmete/:batchId/rows',    auth, controller.rows);
router.post('/igourmete/:batchId/commit', auth, controller.commit);
router.delete('/igourmete/:batchId',      auth, controller.remove);

module.exports = router;
