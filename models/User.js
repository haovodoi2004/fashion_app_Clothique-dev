const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      minlength: 10,
      maxlength: 50,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      maxlength: 30,
      default: "Thành Viên Mới",
    },
    dob: {
      type: Date,
    },
    phoneNumber: {
      type: String,
    },
    avatar: {
      type: String,
      default: "/uploads/default-avatar.jpg",
    },
    admin: {
      type: Boolean,
      default: false,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    otp: {
      type: Number,
    },
    otpExpires: {
      type: Date,
    },
    addresses: [
      {
        name: { type: String, required: true },
        phoneNumber: { type: String, required: true },
        addressDetail: { type: String, required: true },
        provinceId: { type: Number, required: true },
        provinceName: { type: String },
        districtId: { type: Number, required: true },
        districtName: { type: String },
        wardCode: { type: String, required: true },
        wardName: { type: String },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
