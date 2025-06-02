const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderItems: [{ type: mongoose.Schema.Types.ObjectId, ref: "OrderItem" }],
    totalAmount: { type: Number, required: true },

    // Trạng thái đơn hàng
    orderStatus: {
      type: String,
      enum: [
        "Pending",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
        "Completed",
      ],
      default: "Pending",
    },

    history: [
      {
        status: { type: String, required: true }, // Trạng thái của đơn hàng
        changedAt: { type: Date, default: Date.now }, // Thời gian thay đổi
        changedBy: { type: String, required: false }, // Người thay đổi, có thể là hệ thống, người dùng
        description: { type: String, required: true }, // Mô tả thay đổi (ví dụ: "Đơn hàng đã được thanh toán", "Đơn hàng đã bị hủy")
      },
    ],

    // Địa chỉ giao hàng
    shippingAddress: {
      name: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      districtId: { type: Number, required: true },
      wardCode: { type: String, required: true },
      addressDetail: { type: String, required: true },
    },

    // Mã đơn hàng GHN
    GHNOrderCode: { type: String, default: null },

    // Phí vận chuyển GHN
    shippingFee: { type: Number, default: 0 },

    // Thời gian giao dự kiến từ GHN
    expectedDeliveryTime: { type: String, default: null },

    // Số tiền giảm giá
    discountAmount: { type: Number, default: 0 },

    // ID của coupon đã áp dụng
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },

    // Thanh toán
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "MoMo"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Refunded", "Cancelled"],
      default: "Pending",
    },
    transId: { type: Number, default: null },
    momoOrderId: { type: String, default: null },
    deliveredAt: {
      type: Date,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
