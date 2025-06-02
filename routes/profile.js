const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const authMiddleware = require("../controllers/middlewareController");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// API Lấy thông tin cá nhân
router.get("/", authMiddleware.verifyToken, profileController.getProfile);

// API Cập nhật thông tin cá nhân
router.put('/', authMiddleware.verifyToken, upload.single('avatar'), profileController.updateProfile);

// API Đổi mật khẩu
router.put("/change-password", authMiddleware.verifyToken, profileController.changePassword);

module.exports = router;