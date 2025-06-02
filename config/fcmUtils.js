const admin = require("firebase-admin");

const sendPushNotification = async (message) => {
  try {
    await admin.messaging().send(message);
  } catch (err) {
    console.error(`[FCM] Lỗi khi gửi thông báo: ${err.message}`);
  }
};

module.exports = { sendPushNotification };
