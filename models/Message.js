const mongoose = require("mongoose");

// Định nghĩa schema cho tin nhắn
const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      required: true, // người gửi (Admin hoặc User)
    },
    receiver: {
      type: String,
      required: true, // người nhận (Admin hoặc User)
    },
    message: {
      type: String,
      required: true, // Nội dung tin nhắn
    },
    timestamp: {
      type: Date,
      default: Date.now, // Thời gian gửi tin nhắn (mặc định là thời gian hiện tại)
    },
    hidden: { type: Boolean, default: false } // Thêm trường ẩn tin nhắn
  },
  {
    timestamps: true, // Mongoose sẽ tự động thêm `createdAt` và `updatedAt` vào tin nhắn
  }
);

// Tạo model Message từ schema
const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
