const jwt = require("jsonwebtoken");
const User = require("../models/User");

const middlewareController = {
  // ✅ Xác thực token từ cả Cookie & Header
  verifyToken: (req, res, next) => {
    let accessToken = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({ message: "Bạn chưa đăng nhập!" });
    }

    jwt.verify(accessToken, process.env.JWT_ACCESS_KEY, (err, user) => {
      if (err) {
        console.log("Lỗi xác thực token:", err.message);
        return res.status(403).json({ message: "Token không hợp lệ!" });
      }
      req.user = user;
      next();
    });
  },

  // ✅ Xác thực quyền Admin
  verifyTokenAndAdmin: (req, res, next) => {
    middlewareController.verifyToken(req, res, () => {
      if (req.user.admin) {
        next();
      } else {
        res.status(403).json({ message: "Bạn không có quyền truy cập!" });
      }
    });
  },

  updateLastActive: async (req, res, next) => {
    try {
      const user = await User.findOne({ email: req.user.email });
      if (user) {
        user.lastActive = new Date();
        await user.save();
      }
      next();
    } catch (error) {
      console.error("Lỗi cập nhật hoạt động:", error);
      next();
    }
  },
};

module.exports = middlewareController;
