const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variant" }],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Rating", ratingSchema);