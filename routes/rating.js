const express = require("express");
const router = express.Router();
const ratingController = require("../controllers/ratingController");
const { verifyToken } = require("../controllers/middlewareController");

// Thêm đánh giá (Yêu cầu đăng nhập)
router.post("/add", verifyToken, ratingController.addRating);

// Lấy danh sách đánh giá từ user
router.get("/user/:userId", ratingController.getRatingsByUser);

// Lấy danh sách đánh giá của một sản phẩm
router.get("/:productId", ratingController.getRatingsByProduct);

// Lấy tổng số lượt đánh giá & điểm trung bình
router.get("/summary/:productId", ratingController.getRatingSummary);

// Route xóa đánh giá
router.delete("/:ratingId", ratingController.deleteRating);

module.exports = router;