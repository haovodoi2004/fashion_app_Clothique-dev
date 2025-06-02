const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const authController = {
  // Register
  register: async (req, res) => {
    try {
      const { email, password } = req.body; 
  
      if (!email || !password ) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập đầy đủ thông tin!" });
      }
  
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Email không hợp lệ!" });
      }
  
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email đã được sử dụng!" });
      }
  
      const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
      if (!specialCharRegex.test(password)) {
        return res
          .status(400)
          .json({ message: "Mật khẩu phải chứa ít nhất một ký tự đặc biệt!" });
      }
  
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
  
      const newUser = new User({
        email,
        password: hashed,
        admin: req.body.admin || false,
      });
  
      const user = await newUser.save();
  
      res.status(201).json({ message: "Đăng ký thành công!", user });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  // Generate access token
  generateAccessToken: (user) => {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        admin: user.admin,
      },
      process.env.JWT_ACCESS_KEY,
      { expiresIn: "1d" }
    );
  },
  // Generate refresh token
  generateRefreshToken: (user) => {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        admin: user.admin,
      },
      process.env.JWT_REFRESH_KEY,
      { expiresIn: "365d" }
    );
  },
  // Login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập email và mật khẩu!" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Email không hợp lệ!" });
      }

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({ message: "Email không tồn tại!" });
      }

      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(404).json({ message: "Password không đúng!" });
      }

      user.status = true;
      user.lastActive = new Date();

      if (user && validPassword) {
        const accessToken = authController.generateAccessToken(user);
        const refreshToken = authController.generateRefreshToken(user);
        const { password, ...others } = user._doc;
        // ✅ **Lưu Access Token vào HTTP-only Cookie**
        res.cookie("accessToken", accessToken, {
          httpOnly: true, // 🔒 Không thể truy cập từ JavaScript (bảo vệ XSS)
          secure: true, // 🔐 Chỉ gửi khi HTTPS
          sameSite: "Strict", // 🚀 Bảo vệ CSRF
        });

        // ✅ **Lưu Refresh Token vào HTTP-only Cookie**
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "Strict",
        });
        res.status(200).json({
          message: "Đăng nhập thành công!",
          ...others,
          accessToken,
          refreshToken,
        });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  // Refresh token
  refreshToken: (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "Bạn chưa đăng nhập!" });
    }
    jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY, (err, user) => {
      if (err) {
        return res.status(403).json({ message: err.message });
      }
      const newAccessToken = authController.generateAccessToken(user);
      const newRefreshToken = authController.generateRefreshToken(user);
      res
        .status(200)
        .json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    });
  },
  // Send OTP
  sendOTP: async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập email!" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    let user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OTP cập nhật lại mật khẩu",
      text: `OTP của bạn: ${otp}`,
    };
    try {
      await transporter.sendMail(mailOptions);
      res.json({ message: "Gửi mã OTP thành công." });
    } catch (error) {
      res.status(500).json({ error: "Gửi mã OTP thất bại." });
    }
  },
  // Verify OTP
  verifyOTP: async (req, res) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.otp !== Number(otp) || user.otpExpires < Date.now()) {
      return res
        .status(400)
        .json({ error: "Mã OTP của bạn không đúng hoặc đã quá hạn." });
    }

    user.otp = null;
    user.otpExpires = null;
    await user.save();

    const token = jwt.sign({ email }, process.env.JWT_RESET_KEY, {
      expiresIn: "15m",
    });

    res.json({ message: "Xác nhận mã OTP thành công.", token });
  },
  // Reset password
  resetPassword: async (req, res) => {
    const { token, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "Vui lòng nhập mật khẩu mới!" });
    }

    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    if (!specialCharRegex.test(newPassword)) {
      return res
        .status(400)
        .json({ message: "Mật khẩu phải chứa ít nhất một ký tự đặc biệt!" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_RESET_KEY);
      const user = await User.findOne({ email: decoded.email });

      if (!user) {
        return res.status(404).json({ error: "Không tìm thấy User." });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.json({ message: "Cập nhật lại mật khẩu thành công." });
    } catch (error) {
      res.status(400).json({ error: "Token không đúng hoặc đã quá hạn" });
    }
  },
  // Go to login page
  loginPage: (req, res) => {
    const accessToken = req.cookies.accessToken; // Lấy token từ cookie

    if (accessToken) {
      return res.redirect("/v1/dashboard/"); // Nếu có token, chuyển hướng sang dashboard
    }

    res.render("login");
  },

  logout: async (req, res) => {
    try {
      const user = await User.findOne({ email: req.user.email });
      if (user) {
        user.status = false;
        await user.save();
      }
      res.status(200).json({ message: "Đăng xuất thành công!" });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },
};

module.exports = authController;
