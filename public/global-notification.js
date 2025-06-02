// public/js/global-notification.js
(function () {
  // 1) Kết nối socket ngay khi file được load
  const socket = io();

  // 2) Lấy adminId, adminName, fcmToken từ thẻ meta hoặc biến global
  const adminId = window.__ADMIN_ID__;
  const adminName = window.__ADMIN_NAME__;
  const fcmToken = window.__FCM_TOKEN__; // nếu bạn lưu token ở localStorage thì lấy ở đây

  // 3) Đăng ký với server (vừa để server lưu socketUsers, vừa để lưu FCM token nếu có)
  socket.emit("register", {
    userId: adminId,
    username: adminName,
    fcmToken, // phần này server sẽ gọi saveFcmToken()
    isAuthenticated: true,
  });

  // 4) Lắng nghe sự kiện notification chung từ server
  //    – newNotification: khi admin có notification mới lưu vào DB
  socket.on("newNotification", (n) => {
    // chuyển n.timestamp thành chuỗi hiển thị nếu cần
    n.timestamp = new Date(n.timestamp).toLocaleTimeString();

    // gọi lại hàm addNotification trong UI để cập nhật badge + dropdown
    if (typeof addNotification === "function") {
      addNotification({
        userId: n.userId,
        username: n.username,
        timestamp: n.timestamp,
        _id: n._id,
        type: n.type,
        message: n.message,
      });
    } else {
      console.warn("addNotification chưa được định nghĩa trên page này.");
    }
  });

  // 5) (Tuỳ chọn) Lắng nghe event broadcast khác
  socket.on("notification", (notif) => {
    console.log("FCM push -> trên web nhận được:", notif);
    // bạn có thể xử lý thêm UI cho các loại notification này
  });
})();
