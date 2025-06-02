const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variant" }],
    history: [
      {
        field: String, // Trường bị thay đổi (name, description, variant,...)
        action: String, // Hành động: "add", "update", "delete"
        oldValue: mongoose.Schema.Types.Mixed, // Giá trị cũ
        newValue: mongoose.Schema.Types.Mixed, // Giá trị mới
        changedAt: { type: Date, default: Date.now }, // Thời điểm thay đổi
      },
    ],
    isHidden: { type: Boolean, default: false },
    // status: { type: String, enum: ["Còn hàng", "Hết hàng"], default: "Còn hàng" },
    // discount: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

// Tính giá sau khi áp dụng giảm giá
// productSchema.virtual("discountedPrice").get(function () {
//   return this.price - (this.price * this.discount) / 100;
// });

module.exports = mongoose.model("Product", productSchema);
