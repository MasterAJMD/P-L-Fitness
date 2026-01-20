const express = require('express');
const router = express.Router();
const AccessLogController = require('../controllers/accessLog.controller');
const auth = require('../middleware/auth');

// All access log routes require authentication
router.get("/load", auth, AccessLogController.loadAccessLogs);
router.get("/analytics", auth, AccessLogController.getAnalytics);
router.get("/user-activity/:userId", auth, AccessLogController.getUserActivity);
router.delete("/cleanup", auth, AccessLogController.cleanupOldLogs);

module.exports = router;
