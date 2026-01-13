const express = require('express');
const router = express.Router();
const RewardsController = require('../controllers/rewards.controller');

// DASHBOARD
router.get("/", RewardsController.getDashboard);

// API ROUTES
router.get("/load", RewardsController.loadRewards);
router.get("/admin-load", RewardsController.adminLoad);
router.post("/convert-attendance", RewardsController.convertAttendance);
router.post("/redeem-voucher", RewardsController.redeemVoucher);

module.exports = router;