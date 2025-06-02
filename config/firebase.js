const admin = require("firebase-admin");
require("dotenv").config(); // Đảm bảo dotenv đã được tải

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log("✅ Firebase Admin SDK đã được khởi tạo!");
  } catch (error) {
    console.error("❌ Lỗi khi khởi tạo Firebase Admin SDK", error);
  }
} else {
  console.log("✅ Firebase Admin SDK đã được khởi tạo trước đó.");
}

console.log("Số lượng ứng dụng đã khởi tạo:", admin.apps.length); // In số lượng ứng dụng Firebase đã khởi tạo

module.exports = admin;
