const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paymentMethod: { type: String, enum: ["COD", "MoMo"], required: true },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded", "Cancelled"],
      default: "Pending",
    },
    history: [
      {
        status: String, // Trạng thái giao dịch tại thời điểm đó
        changedAt: { type: Date, default: Date.now }, // Thời gian thay đổi
        changedBy: { type: String, required: false },
        note: String, // Ghi chú nếu cần (ví dụ: lý do hoàn tiền)
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
