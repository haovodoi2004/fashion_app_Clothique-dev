// models/FcmToken.js
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
// socket.js
const admin = require("firebase-admin");
const Message = require("../models/Message");
const HiddenUser = require("../models/HiddenUser");
const FcmToken = require("../models/FcmToken");
const { sendPushNotification } = require("../config/fcmUtils");
const User = require("../models/User");
let io;
const socketUsers = {};
let adminSocketId = null;
let activeUsers = {};
let messages = {};
let cachedHiddenUsers = new Set();
let user;
/**
 * Lấy FCM token của user từ database
 */

const getFcmToken = async (userId) => {
  try {
    console.log("[getFcmToken] Nhận userId:", userId);
    // Đảm bảo userId là chuỗi hợp lệ
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("[getFcmToken] userId không hợp lệ:", userId);
      return { success: false, error: "userId không hợp lệ" };
    }

    const user = await User.findById(userId).select("fcmToken");
    console.log("[getFcmToken] Kết quả truy vấn User:", user);

    if (!user) {
      console.error("[getFcmToken] Không tìm thấy người dùng:", userId);
      return { success: false, error: "Không tìm thấy người dùng" };
    }

    if (!user.fcmToken) {
      console.error("[getFcmToken] Không có FCM token cho userId:", userId);
      return { success: false, error: "Không tìm thấy FCM token" };
    }

    console.log("[getFcmToken] FCM token:", user.fcmToken);
    return { success: true, token: user.fcmToken };
  } catch (error) {
    console.error("[getFcmToken] Lỗi:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = getFcmToken;

/**
 * Lưu hoặc cập nhật FCM token của user vào database
 */
// Trong backend
const saveFcmToken = async (req, res) => {
  try {
    const { userId, token } = req.body;
    await FcmToken.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { token, updatedAt: new Date() },
      { upsert: true }
    );
    res.status(200).json({ message: "Lưu FCM token thành công" });
  } catch (error) {
    console.error(`[FCM] Lỗi khi lưu token: ${error.message}`);
    res
      .status(500)
      .json({ message: "Lỗi khi lưu FCM token", error: error.message });
  }
};

/**
 * Gửi FCM notification đến user cụ thể
 */
const sendNotificationForUser = async (userIdentifier, notificationData) => {
  try {
    if (!notificationData.message) {
      console.error("[Notification] Thiếu message trong notificationData");
      return { success: false, error: "Thiếu message trong notificationData" };
    }

    let foundUser;
    if (mongoose.Types.ObjectId.isValid(userIdentifier)) {
      foundUser = await User.findById(userIdentifier);
    } else {
      foundUser = await User.findOne({
        $or: [{ username: userIdentifier }, { email: userIdentifier }],
      });
    }

    if (!foundUser) {
      console.error(
        `[Notification] Không tìm thấy người dùng với identifier: ${userIdentifier}`
      );
      return {
        success: false,
        error: `Không tìm thấy người dùng với identifier: ${userIdentifier}`,
      };
    }

    const username =
      foundUser.username || foundUser.email || "Người dùng không xác định";
    const fcmTokenResult = await getFcmToken(foundUser._id);

    // Lưu thông báo vào DB
    const notificationDoc = new Notification({
      userId: foundUser._id,
      username,
      title: notificationData.title || "Thông báo mới",
      message: notificationData.message,
      type: notificationData.type || "default",
      data: notificationData.data,
      read: false,
      timestamp: new Date(),
    });
    await notificationDoc.save();

    if (!fcmTokenResult.success) {
      console.error(
        `[Notification] ${fcmTokenResult.error} cho ${username} (${foundUser._id})`
      );
      return { success: false, error: fcmTokenResult.error };
    }

    // Chuyển đổi tất cả giá trị trong data thành chuỗi
    const stringifiedData = {};
    for (const [key, value] of Object.entries(notificationData.data || {})) {
      stringifiedData[key] = String(value); // Chuyển đổi thành chuỗi
    }

    const message = {
      token: fcmTokenResult.token,
      notification: {
        title: notificationData.title || "Thông báo mới",
        body: notificationData.message,
      },
      data: {
        type: notificationData.type || "default",
        ...stringifiedData, // Sử dụng dữ liệu đã chuyển đổi
      },
    };

    // Gửi thông báo và kiểm tra kết quả
    try {
      await sendPushNotification(message);
      console.log(
        `[Notification] Đã gửi đến ${username} (${foundUser._id}): ${notificationData.message}`
      );
      return { success: true, message: `Đã gửi thông báo đến ${username}` };
    } catch (error) {
      console.error(`[FCM] Lỗi khi gửi thông báo: ${error.message}`);
      return {
        success: false,
        error: `Lỗi khi gửi thông báo FCM: ${error.message}`,
      };
    }
  } catch (error) {
    console.error(`[Notification] Lỗi khi gửi thông báo: ${error.message}`);
    return { success: false, error: error.message };
  }
};
/**
 * Gửi broadcast FCM đến tất cả users
 */
const sendNotificationToAllUsers = async (notification) => {
  const records = await FcmToken.find({}, "token");
  const tokens = records.map((r) => r.token);
  if (!tokens.length) {
    console.log("❌ Không có FCM token để gửi broadcast.");
    return;
  }

  const message = {
    tokens,
    notification: {
      title: notification.title || "Thông báo từ hệ thống",
      body: notification.message || "Bạn có thông báo mới!",
    },
    data: Object.fromEntries(
      Object.entries(notification.data || {}).map(([k, v]) => [k, String(v)])
    ),
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log("✅ Đã gửi broadcast FCM notification:", response);
  } catch (error) {
    console.error("❌ Lỗi gửi broadcast FCM notification:", error);
  }
};

const initSocket = (server) => {
  io = require("socket.io")(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    // Đăng ký socket và lưu FCM token
    socket.on("register", async ({ userId, username, fcmToken }) => {
      console.log(`📥 Đã nhận register từ ${userId}, socketId: ${socket.id}`);
      if (userId === "admin") {
        socket.join("admin");
      }

      socketUsers[userId] = socket.id;
      activeUsers[userId] = username || userId;

      if (fcmToken) await saveFcmToken(userId, fcmToken);

      if (userId === "admin") {
        adminSocketId = socket.id;
        console.log("🟢 Admin đã kết nối:", adminSocketId);

        Message.distinct("sender", { receiver: "admin" })
          .then((pastUsers) => {
            pastUsers.forEach((user) => {
              if (!activeUsers[user]) activeUsers[user] = user;
            });
            updateAdminUserList();
          })
          .catch((err) => console.log("❌ Lỗi lấy user cũ:", err));
      } else {
        updateAdminUserList();
      }
    });

    // Gửi tin nhắn riêng
    socket.on("sendPrivateMessage", async (data, callback) => {
      const { sender, receiver, message: msgText } = data;

      if (!socketUsers[sender]) {
        return callback?.({
          status: "error",
          message: "Bạn chưa đăng ký socket!",
        });
      }

      try {
        // Lưu tin nhắn vào DB
        const msg = new Message({
          sender,
          receiver,
          message: msgText,
          timestamp: new Date(),
        });
        await msg.save();
        const senderName = activeUsers[sender] || sender;

        // Emit real-time cho cả người gửi và người nhận
        if (socketUsers[receiver]) {
          io.to(socketUsers[receiver]).emit("receivePrivateMessage", {
            sender,
            receiver,
            senderName,
            message: msgText,
            timestamp: msg.timestamp,
          });
        } else {
          // Nếu receiver offline, gửi FCM notification
          const notification = {
            title: "Tin nhắn từ Admin",
            message: "Bạn có tin nhắn mới từ Admin",
            data: {
              type: "message", // Thêm type: 'message'
              sender,
              receiver,
              message: msgText,
            },
          };
          await sendNotificationForUser(receiver, notification);
        }

        // Emit lại cho người gửi
        if (socketUsers[sender]) {
          io.to(socketUsers[sender]).emit("receivePrivateMessage", {
            sender,
            senderName: activeUsers[sender] || sender,
            receiver,
            message: msgText,
            timestamp: msg.timestamp,
          });
        }

        // Nếu sender là admin, gửi thông báo popup cho user
        if (sender === "admin" && socketUsers[receiver]) {
          io.to(socketUsers[receiver]).emit("notification", {
            title: "Tin nhắn mới",
            message: msgText,
            type: "message", // Thêm type để đồng bộ
          });
        }

        // Nếu receiver là admin, lưu thông báo vào DB và gửi socket
        if (receiver === "admin") {
          const notificationDoc = new Notification({
            userId: sender,
            username: activeUsers[sender] || sender,
            title: "Bạn có một tin nhắn từ hệ thống",
            type: "message",
            message: msgText,
            timestamp: new Date(),
            read: false,
          });
          await notificationDoc.save();

          if (adminSocketId) {
            io.to(adminSocketId).emit("newNotification", {
              _id: notificationDoc._id,
              userId: sender,
              username: activeUsers[sender] || sender,
              type: "message",
              message: msgText,
              timestamp: notificationDoc.timestamp,
            });
          }

          // Gửi FCM cho admin nếu offline
          await sendNotificationForUser("admin", {
            title: "Tin nhắn từ người dùng",
            message: `Tin nhắn mới từ ${senderName}: ${msgText}`,
            data: {
              type: "message", // Thêm type: 'message'
              sender,
              receiver,
              message: msgText,
            },
          });
        }

        callback?.({ status: "ok" });
      } catch (err) {
        console.log("❌ Lỗi lưu tin nhắn:", err);
        callback?.({ status: "error", message: "Không gửi được tin nhắn!" });
      }
    });

    // Cập nhật trạng thái đơn hàng
    socket.on("orderStatusUpdate", async (data, callback) => {
      if (!data.userId)
        return callback?.({ status: "error", message: "Thiếu userId!" });

      const notification = {
        title: "Cập nhật đơn hàng",
        message: `Đơn hàng #${data.orderId} cập nhật: ${data.status}`,
        data,
      };
      await sendNotificationForUser(data.userId, notification);
      if (socketUsers[data.userId])
        io.to(socketUsers[data.userId]).emit("notification", notification);
      callback?.({ status: "ok" });
    });
    // Admin thêm bình luận mới
    socket.on(
      "adminComment",
      async ({ userId, postId, commentText }, callback) => {
        try {
          // Lưu Notification vào DB
          const note = new Notification({
            userId,
            title: "Bình luận mới từ Admin",
            message: commentText,
            type: "comment",
            data: { postId },
            timestamp: new Date(),
            read: false,
          });
          await note.save();

          // Gửi FCM
          await sendNotificationForUser(userId, {
            title: note.title,
            message: note.message,
            type: note.type,
            data: note.data,
          });

          // Emit socket
          if (socketUsers[userId]) {
            io.to(socketUsers[userId]).emit("newCommentNotification", note);
          }
          callback?.({ status: "ok", notification: note });
        } catch (err) {
          console.error("❌ Lỗi adminComment:", err);
          callback?.({ status: "error" });
        }
      }
    );

    // Ẩn chat với user
    socket.on("hideChatWithUser", async (userId) => {
      try {
        await HiddenUser.findOneAndUpdate(
          { adminId: "admin", userId },
          {},
          { upsert: true }
        );
        delete activeUsers[userId];
        updateAdminUserList();
      } catch (err) {
        console.log("❌ Lỗi khi ẩn user:", err);
      }
    });

    // Lấy danh sách user đã ẩn
    socket.on("getHiddenUsers", async () => {
      try {
        const hidden = await HiddenUser.find({ adminId: "admin" });
        const result = {};
        hidden.forEach((u) => (result[u.userId] = true));
        socket.emit("hiddenUsersList", result);
      } catch (err) {
        console.log("❌ Lỗi khi lấy danh sách ẩn:", err);
      }
    });

    // Bỏ ẩn user
    socket.on("unhideUser", async (userId) => {
      try {
        await HiddenUser.deleteOne({ adminId: "admin", userId });
        activeUsers[userId] = userId;
        updateAdminUserList();
      } catch (err) {
        console.log("❌ Lỗi khi bỏ ẩn user:", err);
      }
    });

    // Lấy 50 tin nhắn gần nhất
    socket.on("getMessages", async (userId) => {
      try {
        const chat = await Message.find({
          $or: [
            { sender: userId, receiver: "admin" },
            { sender: "admin", receiver: userId },
          ],
          hidden: false,
        })
          .sort({ timestamp: -1 })
          .limit(50)
          .select("sender receiver message timestamp");

        const formatted = chat.reverse().map((msg) => ({
          sender: msg.sender,
          senderName: activeUsers[msg.sender] || msg.sender,
          message: msg.message,
          timestamp: msg.timestamp,
        }));
        socket.emit("chatHistory", { userId, messages: formatted });
      } catch (err) {
        console.log("❌ Lỗi khi lấy lịch sử tin nhắn:", err);
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      removeUser(socket);
    });
  });
};

const updateAdminUserList = async () => {
  if (!adminSocketId) return;

  if (cachedHiddenUsers.size === 0) {
    try {
      const hidden = await HiddenUser.find({ adminId: "admin" });
      cachedHiddenUsers = new Set(hidden.map((u) => u.userId));
    } catch (err) {
      console.log("❌ Lỗi tải danh sách user ẩn:", err);
    }
  }

  const usersArray = Object.keys(activeUsers)
    .filter((id) => !cachedHiddenUsers.has(id))
    .map((id) => ({
      userId: id,
      username: activeUsers[id],
      lastMessageTime: messages[id]?.[messages[id].length - 1]?.timestamp || 0,
    }))
    .sort((a, b) => b.lastMessageTime - a.lastMessageTime);

  io.to(adminSocketId).emit("updateUserList", usersArray);
};
/**
 * Lấy danh sách thông báo của user (mới nhất trước)
 */
const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50); // Số lượng thông báo tối đa

    res.status(200).json({ notifications });
  } catch (err) {
    console.error("❌ Lỗi khi lấy thông báo:", err);
    res.status(500).json({ message: "Lỗi server khi lấy thông báo!" });
  }
};

/**
 * Đánh dấu một thông báo là đã đọc
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Không tìm thấy thông báo" });
    }

    res.status(200).json({ message: "Đã đánh dấu là đã đọc", notification });
  } catch (err) {
    console.error("❌ Lỗi đánh dấu thông báo:", err);
    res.status(500).json({ message: "Lỗi server khi cập nhật thông báo" });
  }
};
const createNotification = async (req, res) => {
  try {
    const { userId, title, message, data } = req.body;
    const notification = new Notification({ userId, title, message, data });
    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi tạo thông báo", error });
  }
};

const removeUser = (socket) => {
  const userId = Object.keys(socketUsers).find(
    (key) => socketUsers[key] === socket.id
  );
  if (userId) {
    delete socketUsers[userId];
    delete activeUsers[userId];
    if (userId === "admin") adminSocketId = null;
    updateAdminUserList();
  }
};

module.exports = {
  initSocket,
  sendNotificationForUser,
  sendNotificationToAllUsers,
  getUserNotifications,
  markAsRead,
  createNotification,
};
