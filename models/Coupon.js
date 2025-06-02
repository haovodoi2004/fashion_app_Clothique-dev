const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // VD: GIAM10
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true }, // giảm theo % hoặc số tiền
  discountValue: { type: Number, required: true }, // VD: 10 (% hoặc số tiền)
  
  // Thêm giới hạn cho phần trăm
  maxDiscountAmount: { type: Number, default: null }, // Giới hạn số tiền tối đa cho giảm giá phần trăm
  
  minOrderValue: { type: Number, default: 0 }, // đơn hàng tối thiểu

  maxUses: { type: Number, default: 1 }, // tổng số lượt dùng
  usedCount: { type: Number, default: 0 }, // đã dùng bao nhiêu lần

  maxUsesPerUser: { type: Number, default: 1 }, // mỗi người dùng được dùng bao nhiêu lần
  usersUsed: [{ userId: mongoose.Schema.Types.ObjectId }], // lưu ai đã dùng rồi

  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },

  // Thêm trường isHidden để ẩn coupon
  isHidden: { type: Boolean, default: false }, // Ẩn coupon khi không muốn sử dụng

}, {
  timestamps: true, // Tự động thêm trường createdAt và updatedAt
});

module.exports = mongoose.model('Coupon', couponSchema);
