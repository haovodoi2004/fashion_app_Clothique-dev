// models/FcmToken.js
const mongoose = require("mongoose");

const FcmTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  token: { type: String, required: true },
}, {
  timestamps: true, // tự động tạo createdAt và updatedAt
});

module.exports = mongoose.model("FcmToken", FcmTokenSchema);
