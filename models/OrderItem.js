const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    salePrice: { type: Number, required: true }, // Giá bán thực tế tại thời điểm đặt hàng
    importPrice: { type: Number, required: true }, // Giá nhập tại thời điểm đặt hàng
    profit: { type: Number, required: true }, // (salePrice - importPrice) * quantity
  },
  { timestamps: true }
);

module.exports = mongoose.model("OrderItem", orderItemSchema);
