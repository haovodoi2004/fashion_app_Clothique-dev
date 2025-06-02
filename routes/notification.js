const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const User = require("../models/User");
const { verifyToken } = require("../controllers/middlewareController");

// Lấy tất cả thông báo (mới + đã đọc), sắp theo timestamp giảm dần
router.get("/", async (req, res) => {
  try {
    const notes = await Notification.find().sort({ timestamp: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tạo mới một thông báo
router.post("/", async (req, res) => {
  const { userId, username, message, title, data } = req.body;

  try {
    // 1. Lưu notification vào MongoDB
    const note = new Notification({
      userId,
      username,
      title: title || "Thông báo",
      message,
      data: data || {},
      read: false,
      timestamp: new Date(),
    });
    await note.save();

    // 2. Lấy instance io từ app và emit vào room "admin"
    const io = req.app.get("io");
    io.to("admin").emit("newNotification", {
      _id: note._id,
      userId,
      username,
      title: note.title,
      message: note.message,
      type: data?.type || "default",
      data: note.data,
      timestamp: note.timestamp.toISOString(),
    });

    // 3. Trả về response
    return res.status(201).json(note);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Đánh dấu một thông báo là đã đọc
router.patch("/markAsRead", async (req, res) => {
  const { id } = req.body;
  try {
    const note = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );
    if (!note)
      return res.status(404).json({ error: "Không tìm thấy notification" });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.patch("/:id/read", async (req, res) => {
  console.log("[PATCH /notifications/:id/read]", req.params.id, req.body);
  const note = await Notification.findByIdAndUpdate(
    req.params.id,
    { read: true },
    { new: true }
  );
  if (!note) return res.status(404).json({ error: "Not found" });
  res.json(note);
});
router.put("/mark-all-read", async (req, res) => {
  try {
    await Notification.updateMany({}, { read: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Lưu FCM token cho user (có thể dùng sau đăng ký)
router.post("/save-token", async (req, res) => {
  const { userId, fcmToken } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Người dùng không tồn tại" });

    user.fcmToken = fcmToken;
    await user.save();

    res.status(200).json({ message: "Lưu FCM token thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi lưu token", error: err.message });
  }
});

// ✅ Cập nhật FCM token sau khi đăng nhập lần đầu (dùng accessToken)
router.post("/update-fcm", verifyToken, async (req, res) => {
  const { fcmToken } = req.body;
  try {
    if (!fcmToken) {
      return res.status(400).json({ message: "Thiếu FCM token" });
    }

    console.log("[update-fcm] userId từ token:", req.user.id); // Log để kiểm tra
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    user.fcmToken = fcmToken;
    await user.save();

    console.log(
      "✅ Nhận được FCM token từ client:",
      fcmToken,
      "cho userId:",
      req.user.id
    );
    res.status(200).json({ message: "FCM token đã được cập nhật" });
  } catch (err) {
    console.error("[update-fcm] Lỗi:", err.message);
    res
      .status(500)
      .json({ message: "Lỗi server khi lưu token", error: err.message });
  }
});

module.exports = router;
