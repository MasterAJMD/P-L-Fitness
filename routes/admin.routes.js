const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const auth = require('../middleware/auth');

// DASHBOARD PAGE
router.get("/", AdminController.getDashboard);

// PUBLIC API ENDPOINT (no auth required for initial setup)
router.post("/seed-admin", AdminController.seedAdmin);

// PROTECTED API ENDPOINTS (require authentication)
router.get("/load", auth, AdminController.loadUsers);
router.post("/insert", auth, AdminController.createUser);
router.put("/update", auth, AdminController.updateUser);
router.put("/delete", auth, AdminController.deleteUser);
router.put("/bulk-delete", auth, AdminController.bulkDeleteUsers);
router.put("/bulk-update", auth, AdminController.bulkUpdateUsers);
router.post("/send-email", auth, AdminController.sendEmail);
router.post("/import-csv", auth, AdminController.importUsersFromCSV);
router.get("/dashboard-analytics", auth, AdminController.getDashboardAnalytics);
router.get("/advanced-analytics", auth, AdminController.getAdvancedAnalytics);

module.exports = router;