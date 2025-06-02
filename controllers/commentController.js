const Comment = require("../models/Comment");
const forbiddenWords = require("../utils/forbiddenWords");

const commentController = {
  // Thêm bình luận
  addComment: async (req, res) => {
    try {
      const { productId, userId, content } = req.body;

      if (!productId || !userId || !content) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập đầy đủ thông tin!" });
      }

      // Kiểm tra từ cấm bằng regex
      const forbiddenPattern = new RegExp(forbiddenWords.join("|"), "i");
      if (forbiddenPattern.test(content)) {
        return res.status(400).json({ message: "Bình luận chứa từ cấm!" });
      }

      const newComment = new Comment({ productId, userId, content });
      await newComment.save();

      res
        .status(201)
        .json({ message: "Bình luận đã được gửi!", comment: newComment });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server!", error: error.message });
    }
  },

  updateComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      if (!content.trim()) {
        return res.status(400).json({ message: "Nội dung không được để trống!" });
      }

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Không tìm thấy bình luận!" });
      }

      const forbiddenPattern = new RegExp(forbiddenWords.join("|"), "i");
      if (forbiddenPattern.test(content)) {
        return res.status(400).json({ message: "Bình luận chứa từ cấm!" });
      }

      if (comment.userId.toString() !== userId) {
        return res.status(403).json({ message: "Bạn không có quyền sửa bình luận này!" });
      }

      comment.content = content;
      await comment.save();

      res.status(200).json({ message: "Cập nhật bình luận thành công", comment });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  // Lấy danh sách bình luận của sản phẩm
  getCommentsByProduct: async (req, res) => {
    try {
      const { productId } = req.params;
      const { userId } = req.query;

      const query = { productId };

      if (userId) {
        query.userId = userId; // chỉ lấy bình luận của người dùng này
      }

      const comments = await Comment.find(query)
        .populate("userId", "_id name avatar")
        .populate("replies.userId", "name")
        .sort({ createdAt: -1 });

      // Nếu có userId, chỉ trả về comment đầu tiên nếu có, hoặc null nếu không có comment
      if (userId) {
        if (comments.length === 0) {
          return res.status(200).json(null); // Không có comment
        }
        return res.status(200).json(comments[0]);
      }

      // Nếu không có userId, trả về toàn bộ bình luận
      return res.status(200).json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error.message);
      res.status(500).json({ message: "Lỗi server!", error: error.message });
    }
  },

  // Gửi phản hồi mới
  replyComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const adminId = req.user.id;

      if (!content.trim()) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập nội dung phản hồi!" });
      }

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Không tìm thấy bình luận!" });
      }

      // ✅ Thêm phản hồi và lấy lại `_id`
      const newReply = { userId: adminId, content };
      comment.replies.push(newReply);
      await comment.save();


      res.json({ success: true, message: "Phản hồi đã được gửi" });
    } catch (err) {
      console.error("❌ Lỗi server:", err); // In lỗi server
      res.status(500).json({ success: false, message: "Lỗi server" });
    }
  },

  // Thêm lượt thích
  likeComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.id;

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      const alreadyLiked = comment.likedBy.includes(userId);

      if (alreadyLiked) {
        await Comment.updateOne(
          { _id: commentId },
          { $pull: { likedBy: userId } }
        );
        return res.status(200).json({ message: "Disliked the comment" });
      } else {
        await Comment.updateOne(
          { _id: commentId },
          { $addToSet: { likedBy: userId } }
        );
        return res.status(200).json({ message: "Liked the comment" });
      }
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  dislikeComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.id;

      // Tìm comment trước
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      const alreadyLiked = comment.likedBy.includes(userId);
      if (!alreadyLiked) {
        return res.status(400).json({ message: "You haven't Disliked this comment yet" });
      }

      // Nếu đã like, bỏ like ra
      await Comment.updateOne(
        { _id: commentId },
        { $pull: { likedBy: userId } }
      );

      return res.status(200).json({ message: "Disliked the comment" });
    } catch (error) {
      console.error("Dislike error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },


  // Xóa bình luận (chỉ người tạo hoặc admin mới được xóa)
  deleteComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.isAdmin;

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Không tìm thấy bình luận!" });
      }

      // Chỉ cho phép xóa nếu là người tạo bình luận hoặc admin
      if (comment.userId.toString() !== userId && !isAdmin) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền xóa bình luận này!" });
      }

      await comment.deleteOne();
      res.status(200).json({ message: "Bình luận đã được xóa!" });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server!", error: error.message });
    }
  },

  // Lấy danh sách phản hồi của bình luận
  getRepliesByCommentId: async (req, res) => {
    try {
      const comment = await Comment.findById(req.params.commentId).populate(
        "replies.userId"
      );
      if (!comment)
        return res
          .status(404)
          .json({ success: false, message: "Bình luận không tồn tại" });

      res.json({ success: true, comment });
    } catch (err) {
      res.status(500).json({ success: false, message: "Lỗi server" });
    }
  },
};

module.exports = commentController;
