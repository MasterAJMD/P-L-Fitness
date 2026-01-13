const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');

// DASHBOARD PAGE
router.get("/", AuthController.getDashboard);

// API ENDPOINTS
router.post("/login", AuthController.login);

module.exports = router;