const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    size: String,
    color: String,
    importPrice: { type: Number, required: true, min: 0 }, // Giá nhập
    salePrice: { type: Number, required: true, min: 0 }, // Giá bán
    stock: Number,
    images: [String],
    soldQuantity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Variant", variantSchema);
