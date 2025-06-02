const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const path = require("path");
const jwt = require("jsonwebtoken"); // <-- THÊM DÒNG NÀY
require("dotenv").config(); // Đảm bảo dotenv đã được tải
require("./config/firebase");
const authRoute = require("./routes/auth");
const userRoute = require("./routes/user");
const productRoute = require("./routes/product");
const categoryRoute = require("./routes/category");
const cartRoute = require("./routes/cart");
const variantRoute = require("./routes/variant");
const orderRoute = require("./routes/order");
const favouriteRoute = require("./routes/favourite");
const profileRoute = require("./routes/profile");
const ratingRoutes = require("./routes/rating");
const addressRoutes = require("./routes/address");
const dashboardRoute = require("./routes/dashboard");
const commentRoutes = require("./routes/comment");
const webhookRoute = require("./routes/webhook");
const socket = require("./controllers/notificationController");
const messageRoutes = require("./routes/messageRoutes");
const transactionRoutes = require("./routes/transaction");
const couponRoutes = require("./routes/coupon");
const notifRoutes = require("./routes/notification");

require("./utils/cronJobs");

const { initSocket } = require("./controllers/notificationController");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = initSocket(server);

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("✅ Kết nối CSDL thành công!"))
  .catch((error) => {
    console.log("❌ Kết nối tới Mongodb thất bại!", error);
    process.exit(1);
  });

app.use(cors());
app.use(cookieParser());

// ⭐ MIDDLEWARE: Giải mã JWT và gán vào res.locals cho tất cả view EJS ⭐
app.use((req, res, next) => {
  res.locals.adminId = null;
  res.locals.adminName = null;

  const token = req.cookies.accessToken;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role === "admin") {
        req.user = payload;
        res.locals.adminId = payload.id;
        res.locals.adminName = payload.username;
      }
    } catch (err) {}
  }

  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.set("io", io);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/v1/auth", authRoute);
app.use("/v1/user", userRoute);
app.use("/v1/product", productRoute);
app.use("/v1/category", categoryRoute);
app.use("/v1/cart", cartRoute);
app.use("/v1/variant", variantRoute);
app.use("/v1/order", orderRoute);
app.use("/v1/favourite", favouriteRoute);
app.use("/v1/profile", profileRoute);
app.use("/v1/rating", ratingRoutes);
app.use("/v1/address", addressRoutes);
app.use("/v1/dashboard", dashboardRoute);
app.use("/v1/comment", commentRoutes);
app.use("/v1/webhook", webhookRoute);
app.use("/v1/chat", messageRoutes); // Đăng ký route cho API
app.use("/v1/transaction", transactionRoutes); // Đăng ký route cho API
app.use("/v1/coupon", couponRoutes); // Đăng ký route cho API
app.use("/v1/chat", messageRoutes);
app.use("/v1/transaction", transactionRoutes);
app.use("/v1/notifications", notifRoutes);

// Danh sách users kết nối
let users = {};

// Route mặc định
app.get("/", (req, res) => {
  const accessToken = req.cookies.accessToken;
  if (accessToken) {
    return res.redirect("/v1/dashboard/");
  }
  res.render("login");
});

// Khởi động server
server.listen(process.env.PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${process.env.PORT}`);
});

global.getStatusBadgeColor = (status) => {
  if (!status) return "badge-secondary"; // Tránh lỗi khi status là null hoặc undefined

  const lowerStatus = status.toLowerCase(); // Đưa về chữ thường để tránh lỗi so sánh

  if (lowerStatus.includes("đã bị hủy") || lowerStatus.includes("refunded"))
    return "badge-danger";
  if (lowerStatus.includes("đã đặt") || lowerStatus.includes("pending"))
    return "badge-warning";
  if (lowerStatus.includes("đang giao") || lowerStatus.includes("shipped"))
    return "badge-primary";
  if (
    lowerStatus.includes("đang chuẩn bị") ||
    lowerStatus.includes("processing")
  )
    return "badge-info";
  if (lowerStatus.includes("đã giao") || lowerStatus.includes("paid"))
    return "badge-success";
  if (lowerStatus.includes("toán momo") || lowerStatus.includes("momo"))
    return "badge-momo";

  return "badge-secondary"; // Mặc định nếu không khớp với trạng thái nào
};

global.getStatusColor = (status) => {
  if (!status) return "dot-secondary"; // Tránh lỗi khi status là null hoặc undefined

  const lowerStatus = status.toLowerCase(); // Đưa về chữ thường để tránh lỗi so sánh

  if (lowerStatus.includes("đã bị hủy") || lowerStatus.includes("refunded"))
    return "dot-danger";
  if (lowerStatus.includes("đã đặt") || lowerStatus.includes("pending"))
    return "dot-warning";
  if (lowerStatus.includes("đang giao") || lowerStatus.includes("shipped"))
    return "dot-primary";
  if (
    lowerStatus.includes("đang chuẩn bị") ||
    lowerStatus.includes("processing")
  )
    return "dot-info";
  if (lowerStatus.includes("đã giao") || lowerStatus.includes("paid"))
    return "dot-success";
  if (lowerStatus.includes("toán momo") || lowerStatus.includes("momo"))
    return "dot-momo";

  return "dot-secondary"; // Mặc định nếu không khớp với trạng thái nào
};

global.translateStatus = (status) => {
  switch (status) {
    case "Paid":
      return "Đã thanh toán";
    case "Pending":
      return "Chưa thanh toán";
    case "Failed":
      return "Thất bại";
    case "Cancelled":
      return "Đã hủy"; // Chỉnh sửa đây
    case "Refunded":
      return "Đã hoàn tiền"; // Chỉnh sửa đây
    default:
      return "Không xác định";
  }
};

// Xuất io và users để sử dụng ở file khác
module.exports = { io, users };
