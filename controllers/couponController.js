const Coupon = require("../models/Coupon");
const User = require("../models/User");

const couponController = {
  getAllCoupon: async (req, res) => {
    try {
      const isAdmin = req.user.admin;
      const {
        discountType,
        status,
        isHidden,
        code,
        page = 1,
        limit = 10,
      } = req.query; // Lấy limit từ query params

      const filter = {};
      if (!isAdmin) filter.isHidden = false;
      if (discountType) filter.discountType = discountType;
      if (status === "expired") {
        filter.validUntil = { $lt: new Date() };
      } else if (status === "active") {
        filter.validUntil = { $gte: new Date() };
        filter.isHidden = false; // ✅ Bổ sung điều kiện loại bỏ mã đã ẩn
      }
      if (isHidden !== undefined) filter.isHidden = isHidden === "true";
      if (code) filter.code = { $regex: code, $options: "i" };

      const skip = (parseInt(page) - 1) * parseInt(limit); // Tính skip dựa trên page và limit

      const total = await Coupon.countDocuments(filter);
      const coupons = await Coupon.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)); // Sử dụng limit từ query params

      res.status(200).json({
        total,
        page: parseInt(page),
        limit: parseInt(limit), // Trả lại limit trong response
        totalPages: Math.ceil(total / limit), // Tính tổng số trang
        coupons,
      });
    } catch (error) {
      res.status(500).json({
        message: "Lỗi khi lấy danh sách coupon.",
        error: error.message,
      });
    }
  },
  addCoupon: async (req, res) => {
    try {
      const {
        code,
        discountType,
        discountValue,
        minOrderValue,
        maxUses,
        maxUsesPerUser,
        validFrom,
        validUntil,
        maxDiscountAmount,
      } = req.body;

      // Kiểm tra dữ liệu đầu vào
      if (
        !code ||
        !discountType ||
        !discountValue ||
        !validFrom ||
        !validUntil
      ) {
        return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
      }

      // Kiểm tra kiểu giảm giá hợp lệ
      const validDiscountTypes = ["percentage", "fixed"];
      if (!validDiscountTypes.includes(discountType)) {
        return res.status(400).json({
          message:
            "Kiểu giảm giá không hợp lệ. Chọn 'percentage' hoặc 'fixed'.",
        });
      }

      // Kiểm tra giá trị giảm giá hợp lệ
      if (
        discountType === "percentage" &&
        (discountValue <= 0 || discountValue > 100)
      ) {
        return res
          .status(400)
          .json({ message: "Giá trị giảm giá phần trăm phải từ 1 đến 100." });
      }
      if (discountType === "fixed" && discountValue <= 0) {
        return res
          .status(400)
          .json({ message: "Giá trị giảm giá cố định phải lớn hơn 0." });
      }

      // Kiểm tra ngày hợp lệ
      if (new Date(validFrom) >= new Date(validUntil)) {
        return res
          .status(400)
          .json({ message: "Ngày hết hạn phải sau ngày bắt đầu." });
      }

      // Kiểm tra mã coupon có tồn tại chưa
      const existingCoupon = await Coupon.findOne({ code });
      if (existingCoupon) {
        return res.status(400).json({ message: "Mã giảm giá này đã tồn tại!" });
      }

      // Tạo coupon mới
      const newCoupon = new Coupon({
        code,
        discountType,
        discountValue,
        minOrderValue,
        maxUses,
        maxUsesPerUser,
        validFrom,
        validUntil,
        maxDiscountAmount,
      });

      // Lưu coupon vào cơ sở dữ liệu
      await newCoupon.save();

      // Trả về thông báo thành công
      res.status(201).json({
        message: "Coupon đã được thêm thành công!",
        coupon: newCoupon,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Lỗi khi thêm coupon.", error: error.message });
    }
  },
  hideCoupon: async (req, res) => {
    try {
      const { id } = req.params;
      const coupon = await Coupon.findById(id);

      if (!coupon) {
        return res.status(404).json({ message: "Không tìm thấy mã giảm giá." });
      }

      const newIsHidden = !coupon.isHidden; // Đảo ngược trạng thái hiện tại
      await Coupon.findByIdAndUpdate(id, { isHidden: newIsHidden });

      res.json({
        message: `Coupon đã được ${newIsHidden ? "ẩn" : "hiển thị"}`,
      });
    } catch (error) {
      console.error("Lỗi khi ẩn/hiện mã giảm giá:", error);
      res
        .status(500)
        .json({
          message: "Thao tác ẩn/hiện mã thất bại",
          error: error.message,
        });
    }
  },
  editCoupon: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Tìm coupon
      const coupon = await Coupon.findById(id);
      if (!coupon) {
        return res.status(404).json({ message: "Không tìm thấy mã giảm giá." });
      }

      // Không cho phép sửa nếu mã đã được sử dụng
      if (coupon.usedCount > 0) {
        return res
          .status(400)
          .json({ message: "Không thể sửa vì mã này đã có người sử dụng." });
      }

      // Validate cơ bản
      if (!updateData.code || typeof updateData.code !== "string") {
        return res.status(400).json({ message: "Mã giảm giá không hợp lệ." });
      }
      if (!["percentage", "fixed"].includes(updateData.discountType)) {
        return res.status(400).json({
          message:
            "Loại giảm giá không hợp lệ. Chỉ chấp nhận 'percentage' hoặc 'fixed'.",
        });
      }
      if (
        typeof updateData.discountValue !== "number" ||
        updateData.discountValue <= 0
      ) {
        return res
          .status(400)
          .json({ message: "Giá trị giảm giá không hợp lệ." });
      }
      if (
        updateData.discountType === "percentage" &&
        (updateData.discountValue > 100 || updateData.discountValue <= 0)
      ) {
        return res.status(400).json({
          message: "Phần trăm giảm phải lớn hơn 0 và không được vượt quá 100%.",
        });
      }
      if (updateData.discountType === "fixed") {
        if (
          updateData.maxDiscountAmount !== undefined &&
          (typeof updateData.maxDiscountAmount !== "number" ||
            updateData.maxDiscountAmount < 0)
        ) {
          return res
            .status(400)
            .json({ message: "Giá trị giảm tối đa không hợp lệ." });
        }
      } else {
        // Nếu là percentage, đảm bảo maxDiscountAmount không được gửi hoặc là undefined
        delete updateData.maxDiscountAmount;
      }
      if (
        typeof updateData.minOrderValue !== "number" ||
        updateData.minOrderValue < 0
      ) {
        return res
          .status(400)
          .json({ message: "Giá trị đơn hàng tối thiểu không hợp lệ." });
      }
      if (typeof updateData.maxUses !== "number" || updateData.maxUses < 1) {
        return res
          .status(400)
          .json({ message: "Số lượt dùng tối đa không hợp lệ." });
      }
      if (
        typeof updateData.maxUsesPerUser !== "number" ||
        updateData.maxUsesPerUser < 1
      ) {
        return res
          .status(400)
          .json({ message: "Số lượt dùng mỗi người không hợp lệ." });
      }
      if (!updateData.validFrom || !updateData.validUntil) {
        return res.status(400).json({ message: "Ngày hiệu lực không hợp lệ." });
      }

      // Cập nhật
      Object.assign(coupon, updateData);
      await coupon.save();

      return res
        .status(200)
        .json({ message: "Cập nhật mã giảm giá thành công.", coupon });
    } catch (error) {
      console.error("Lỗi khi cập nhật mã giảm giá:", error); // Log lỗi chi tiết
      return res.status(500).json({
        message: "Lỗi khi cập nhật mã giảm giá.",
        error: error.message,
      });
    }
  },
  getUsersUsed: async (req, res) => {
    try {
      const { id } = req.params;

      const coupon = await Coupon.findById(id);
      if (!coupon) {
        return res.status(404).json({ message: "Không tìm thấy mã giảm giá." });
      }

      const userIds = coupon.usersUsed.map((u) => u.userId);
      const users = await User.find({ _id: { $in: userIds } }).select(
        "name email"
      );

      return res.status(200).json({
        code: coupon.code,
        count: users.length,
        users,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Lỗi khi lấy danh sách người dùng.",
        error: error.message,
      });
    }
  },
  getCouponDetails: async (req, res) => {
    try {
      const { id } = req.params; // Lấy ID của coupon từ tham số URL

      // Tìm coupon theo ID
      const coupon = await Coupon.findById(id);
      if (!coupon) {
        return res.status(404).json({ message: "Không tìm thấy mã giảm giá." });
      }

      // Trả về thông tin chi tiết coupon
      return res.status(200).json(coupon);
    } catch (error) {
      return res.status(500).json({
        message: "Lỗi khi lấy thông tin mã giảm giá.",
        error: error.message,
      });
    }
  },
};

module.exports = couponController;
