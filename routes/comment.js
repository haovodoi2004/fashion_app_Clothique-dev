const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const { verifyToken } = require("../controllers/middlewareController");
const middlewareController = require("../controllers/middlewareController");

// Thêm bình luận (Yêu cầu đăng nhập)
router.post("/add", verifyToken, commentController.addComment);

// Lấy danh sách bình luận của một sản phẩm
router.get("/:productId", middlewareController.verifyToken, commentController.getCommentsByProduct);

// Lấy danh sách phản hồi của bình luận
router.get("/replies/:commentId", middlewareController.verifyToken, commentController.getRepliesByCommentId);

// Gửi phản hồi mới
router.post("/replies/:commentId", middlewareController.verifyToken, commentController.replyComment);

router.put("/update/:commentId", verifyToken, commentController.updateComment);

// Like bình luận (Yêu cầu đăng nhập)
router.patch("/like/:commentId", verifyToken, commentController.likeComment);

// Dislike bình luận (Yêu cầu đăng nhập)
router.patch("/dislike/:commentId", verifyToken, commentController.dislikeComment);

// Xóa bình luận (Yêu cầu đăng nhập)
router.delete("/:commentId", verifyToken, commentController.deleteComment);

module.exports = router;
