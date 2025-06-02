const authController = require("../controllers/authControllers");

const router = require("express").Router();

// Register
router.post("/register", authController.register);

// Login
router.post("/login", authController.login);

// Refesh token
router.post("/refresh", authController.refreshToken);

// Send otp
router.post("/send-otp", authController.sendOTP);

// Verify otp
router.post("/verify-otp", authController.verifyOTP);

// Reset password
router.post("/reset-password", authController.resetPassword);

// Go to login page
router.get("/login", authController.loginPage);

module.exports = router;
