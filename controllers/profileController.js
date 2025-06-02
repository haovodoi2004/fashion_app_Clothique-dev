const bcrypt = require("bcryptjs");
const User = require("../models/User");

const profileController = {
  // Lấy thông tin cá nhân
  getProfile: async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId).select("-password");

      if (!user) {
        return res.status(404).json({ message: "Không tìm thấy người dùng." });
      }

      res.json({ user });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
  },

  // Cập nhật thông tin cá nhân
  updateProfile: async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Không xác định được người dùng." });
      }

      const userId = req.user.id;
      const { name, phoneNumber } = req.body;
      const avatar = req.file;

      console.log("BODY:", req.body);
      console.log("FILE:", avatar);
      console.log("UserID:", userId);

      // Kiểm tra đầu vào
      if (!name || !phoneNumber) {
        return res.status(400).json({ message: "Cần nhập đủ thông tin cần thiết." });
      }

      if (!/^\d{10,15}$/.test(phoneNumber)) {
        return res.status(400).json({ message: "Số điện thoại không hợp lệ." });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Không tìm thấy người dùng." });
      }

      // Cập nhật thông tin người dùng
      user.name = name;
      user.phoneNumber = phoneNumber;
      if (avatar) {
        const imageUrl = `${req.protocol}://${req.get('host')}/${avatar.path.replace(/\\/g, '/')}`;
        user.avatar = imageUrl;
      }

      await user.save();

      res.json({ message: "Cập nhật thông tin thành công.", user });
    } catch (error) {
      console.error("SERVER ERROR:", error);
      res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
  },

  // Đổi mật khẩu
  changePassword: async (req, res) => {
    try {
      const userId = req.user.id;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập đầy đủ mật khẩu cũ và mới!" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Không tìm thấy người dùng." });
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Mật khẩu cũ không đúng!" });
      }

      const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
      if (!specialCharRegex.test(newPassword) || newPassword.length < 6) {
        return res.status(400).json({
          message:
            "Mật khẩu mới phải có ít nhất 6 ký tự và chứa ký tự đặc biệt!",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.json({ message: "Đổi mật khẩu thành công!" });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
  },
};

module.exports = profileController;
