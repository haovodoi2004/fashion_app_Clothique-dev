const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // ID người gửi
    username: { type: String, required: true }, // Tên hiển thị
    title: { type: String, required: true }, // Tiêu đề thông báo
    message: { type: String, required: true }, // Nội dung thông báo
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // Dữ liệu bổ sung cho thông báo
    read: { type: Boolean, default: false }, // Đã đọc hay chưa
    // type: { type: String, enum: ['message', 'comment', 'order'], required: true },// Thêm loại thông báo
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true } // Thêm trường createdAt và updatedAt tự động
);

module.exports = mongoose.model("Notification", NotificationSchema);
