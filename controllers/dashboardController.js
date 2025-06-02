const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const Order = require("../models/Order");
const Transaction = require("../models/Transaction");
const Comment = require("../models/Comment");
const OrderItem = require("../models/OrderItem");
const Coupon = require("../models/Coupon");
const axios = require("axios");

const formatProductHistory = async (history) => {
  const categoryIds = history
    .filter((h) => h.field === "category")
    .map((h) => [h.oldValue, h.newValue])
    .flat()
    .filter((id) => id);

  const categories = await Category.find({ _id: { $in: categoryIds } });
  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat._id.toString()] = cat.name;
    return acc;
  }, {});

  return history.map((h) => {
    let fieldName = "";
    let oldValue = h.oldValue;
    let newValue = h.newValue;

    switch (h.field) {
      case "name":
        fieldName = "Tên sản phẩm";
        break;
      case "description":
        fieldName = "Mô tả";
        break;
      case "category":
        fieldName = "Danh mục";
        oldValue = categoryMap[h.oldValue] || "Không có";
        newValue = categoryMap[h.newValue] || "Không có";
        break;
      case "variant":
        fieldName = "Biến thể";
        oldValue = formatVariantHistory(h.oldValue);
        newValue = formatVariantHistory(h.newValue);
        break;
      default:
        fieldName = h.field;
    }

    let actionText = "";
    switch (h.action) {
      case "add":
        actionText = "Thêm mới";
        break;
      case "update":
        actionText = "Cập nhật";
        break;
      case "delete":
        actionText = "Xóa";
        break;
      case "delete-image":
        actionText = "Xóa ảnh";
        break;
      default:
        actionText = h.action;
    }

    return {
      ...h,
      field: fieldName,
      action: actionText,
      oldValue,
      newValue,
      changedAt: h.changedAt,
    };
  });
};

const formatVariantHistory = (variant) => {
  if (!variant) return "Không có dữ liệu";

  // Nếu variant là string (đường dẫn ảnh)
  if (typeof variant === "string") {
    return variant;
  }

  // Nếu variant là object
  if (typeof variant === "object") {
    let details = [];
    if (variant.size) details.push(`Size: ${variant.size}`);
    if (variant.color) details.push(`Màu: ${variant.color}`);
    if (variant.price) details.push(`Giá: ${variant.price} VNĐ`);
    if (variant.stock) details.push(`Kho: ${variant.stock}`);
    if (Array.isArray(variant.images) && variant.images.length > 0) {
      details.push(`Ảnh: ${variant.images.length} ảnh`);
    }

    return details.length ? details.join(", ") : "Không có thông tin biến thể";
  }

  return "Không có dữ liệu";
};

const dashboardController = {
  // Go to the dashboard page
  getDashboardPage: async (req, res) => {
    try {
      // --- 1. Doanh thu từ các Transaction đã thanh toán ---
      const revenueAgg = await Transaction.aggregate([
        { $match: { paymentStatus: "Paid" } },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: "$order" },
        {
          $group: {
            _id: { $month: "$createdAt" },
            totalRevenue: { $sum: "$order.totalAmount" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // --- 2. Số đơn hàng đã hoàn thành ---
      const ordersAgg = await Order.aggregate([
        { $match: { orderStatus: "Completed" } },
        {
          $group: {
            _id: { $month: "$createdAt" },
            totalOrders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // --- 3. Lợi nhuận từ OrderItem ---
      //    (Chỉ lấy OrderItem của các đơn đã hoàn thành nếu cần)
      const completedOrderIds = (
        await Order.find({ orderStatus: "Completed" }).select("_id")
      ).map((o) => o._id);

      const profitAgg = await OrderItem.aggregate([
        { $match: { orderId: { $in: completedOrderIds } } },
        {
          $group: {
            _id: { $month: "$createdAt" },
            totalProfit: { $sum: "$profit" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // --- 4. Format ra mảng 12 tháng ---
      const revenueData = Array(12).fill(0);
      const orderData = Array(12).fill(0);
      const profitData = Array(12).fill(0);

      revenueAgg.forEach((r) => {
        revenueData[r._id - 1] = r.totalRevenue;
      });
      ordersAgg.forEach((o) => {
        orderData[o._id - 1] = o.totalOrders;
      });
      profitAgg.forEach((p) => {
        profitData[p._id - 1] = p.totalProfit;
      });

      // --- 5. Render với duy nhất 1 object chartData ---
      res.render("dashboard", {
        revenueData: JSON.stringify(revenueData),
        orderData: JSON.stringify(orderData),
        profitData: JSON.stringify(profitData),
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Lỗi server");
    }
  },
  getTopProducts: async (req, res) => {
    try {
      const { type = "bestSelling", limit = 5, from, to } = req.query;

      const fromDate = from ? new Date(from) : new Date("2000-01-01");
      const toDate = to ? new Date(to) : new Date();

      const products = await Product.aggregate([
        {
          $lookup: {
            from: "variants",
            localField: "_id",
            foreignField: "productId",
            as: "variants",
          },
        },
        {
          $unwind: { path: "$variants", preserveNullAndEmptyArrays: true },
        },
        {
          $lookup: {
            from: "orderitems",
            localField: "variants._id",
            foreignField: "variantId",
            as: "orderItems",
          },
        },
        { $unwind: { path: "$orderItems", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "orders",
            localField: "orderItems.orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { order: { $exists: false } },
              {
                "order.createdAt": { $gte: fromDate, $lte: toDate },
                "order.orderStatus": "Completed",
              },
            ],
          },
        },
        {
          $group: {
            _id: "$_id",
            name: { $first: "$name" },
            totalSold: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$order", null] },
                      { $eq: ["$order.orderStatus", "Completed"] },
                    ],
                  },
                  "$orderItems.quantity",
                  0,
                ],
              },
            },
            revenue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$order", null] },
                      { $eq: ["$order.orderStatus", "Completed"] },
                    ],
                  },
                  {
                    $multiply: ["$variants.salePrice", "$orderItems.quantity"],
                  },
                  0,
                ],
              },
            },
            profit: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$order", null] },
                      { $eq: ["$order.orderStatus", "Completed"] },
                    ],
                  },
                  {
                    $multiply: [
                      {
                        $subtract: [
                          "$variants.salePrice",
                          "$variants.importPrice",
                        ],
                      },
                      "$orderItems.quantity",
                    ],
                  },
                  0,
                ],
              },
            },
            stock: { $sum: "$variants.stock" },
          },
        },
        {
          $sort:
            type === "lowStock"
              ? { stock: 1 }
              : { totalSold: type === "bestSelling" ? -1 : 1 },
        },
        { $limit: parseInt(limit) },
      ]);

      res.json({ success: true, data: products });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Lỗi server" });
    }
  },
  getLookUpProductSales: async (req, res) => {
    try {
      const { name, from, to } = req.query;
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Thiếu tên sản phẩm" });
      }

      const fromDate = from ? new Date(from) : new Date("2000-01-01");
      const toDate = to ? new Date(to) : new Date();

      const results = await Product.aggregate([
        {
          $match: {
            name: { $regex: name, $options: "i" }, // tìm gần đúng không phân biệt hoa thường
          },
        },
        {
          $lookup: {
            from: "variants",
            localField: "_id",
            foreignField: "productId",
            as: "variants",
          },
        },
        { $unwind: "$variants" },
        {
          $lookup: {
            from: "orderitems",
            localField: "variants._id",
            foreignField: "variantId",
            as: "orderItems",
          },
        },
        { $unwind: "$orderItems" },
        {
          $lookup: {
            from: "orders",
            localField: "orderItems.orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: "$order" },
        {
          $match: {
            "order.createdAt": { $gte: fromDate, $lte: toDate },
            "order.orderStatus": "Completed",
          },
        },
        {
          $group: {
            _id: {
              productId: "$_id",
              day: {
                $dateToString: { format: "%Y-%m-%d", date: "$order.createdAt" },
              },
            },
            name: { $first: "$name" },
            stock: { $first: "$variants.stock" },
            totalSold: { $sum: "$orderItems.quantity" },
            revenue: {
              $sum: {
                $multiply: ["$variants.salePrice", "$orderItems.quantity"],
              },
            },
            profit: {
              $sum: {
                $multiply: [
                  {
                    $subtract: ["$variants.salePrice", "$variants.importPrice"],
                  },
                  "$orderItems.quantity",
                ],
              },
            },
          },
        },
        {
          $sort: { "_id.day": 1 },
        },
      ]);
      res.json({ success: true, data: results });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Lỗi server" });
    }
  },
  // Go to the products page
  getProductsPage: async (req, res) => {
    try {
      const products = await Product.find()
        .populate("category", "name")
        .populate(
          "variants",
          "size color importPrice salePrice stock images soldQuantity"
        )
        .sort({ createdAt: -1 }) // Sắp xếp từ mới nhất đến cũ nhất
        .lean();

      const categories = await Category.find();

      res.render("products", { categories });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server" });
    }
  },
  getEditProductPage: async (req, res) => {
    try {
      const { productId } = req.params;
      const product = await Product.findById(productId).populate("variants");

      if (!product) {
        return res.status(404).send("Sản phẩm không tồn tại");
      }

      if (product.isHidden) {
        return res.send(`
          <html>
            <head>
              <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            </head>
            <body>
              <script>
                Swal.fire({
                  icon: 'warning',
                  title: 'Không thể chỉnh sửa',
                  text: 'Sản phẩm này đã bị ẩn, không thể chỉnh sửa!',
                  confirmButtonText: 'Quay lại'
                }).then(() => {
                  window.history.back();
                });
              </script>
            </body>
          </html>
        `);
      }

      // Kiểm tra xem có OrderItem nào chứa product này không
      const item = await OrderItem.findOne({ productId });

      if (item) {
        return res.send(`
          <html>
            <head>
              <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            </head>
            <body>
              <script>
                Swal.fire({
                  icon: 'error',
                  title: 'Không thể chỉnh sửa',
                  text: 'Sản phẩm này đã có người mua, không thể chỉnh sửa!',
                  confirmButtonText: 'Quay lại'
                }).then(() => {
                  window.history.back();
                });
              </script>
            </body>
          </html>
        `);
      }

      const categories = await Category.find();
      res.render("edit-product", { product, categories });
    } catch (error) {
      console.error(error);
      res.status(500).send("Lỗi server");
    }
  },
  // Go to view product page
  getViewProductPage: async (req, res) => {
    try {
      const { productId } = req.params;
      const product = await Product.findById(productId)
        .populate("category")
        .populate("variants");

      if (!product) {
        return res.status(404).send("Không tìm thấy sản phẩm!");
      }

      const formattedHistory = await formatProductHistory(product.history);

      res.render("productDetail", { product, history: formattedHistory });
    } catch (error) {
      console.error("Lỗi khi lấy chi tiết sản phẩm:", error);
      res.status(500).send("Lỗi server!");
    }
  },
  // Go to categories page
  getCategoriesPage: async (req, res) => {
    try {
      const categories = await Category.find().sort({ createdAt: -1 }).lean();
      res.render("categories", { categories });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server" });
    }
  },
  // Go to users page
  getUsersPage: async (req, res) => {
    try {
      const users = await User.find({ admin: { $ne: true } }).select(
        "-password"
      );

      res.render("users", { users });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách người dùng:", error);
      res.status(500).send("Lỗi máy chủ");
    }
  },
  // Go to chat page
  getChatPage: async (req, res) => {
    try {
      res.render("chat");
    } catch (error) {
      console.error("Lỗi khi lấy danh sách người dùng:", error);
      res.status(500).send("Lỗi máy chủ");
    }
  },
  // Go to orders page
  getOrdersPage: async (req, res) => {
    try {
      function formatToVietnamese(amount) {
        if (amount >= 1000000) {
          const million = Math.floor(amount / 1000000);
          return `${million} triệu VNĐ`;
        }
        return "";
      }
      const orders = await Order.find()
        .populate("userId", "name")
        .sort({ createdAt: -1 });
      res.render("orders", { orders, formatToVietnamese });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách đơn hàng:", error);
      res.status(500).send("Lỗi máy chủ");
    }
  },
  // Go to view order page
  getViewOrderPage: async (req, res) => {
    try {
      function formatToVietnamese(amount) {
        if (amount >= 1000000) {
          const million = Math.floor(amount / 1000000);
          return `${million} triệu VNĐ`;
        }
        return "";
      }

      const { id } = req.params;
      const order = await Order.findById(id)
        .populate({
          path: "orderItems",
          populate: [
            {
              path: "productId", // Populate productId để lấy thông tin sản phẩm
              select: "name description category",
            },
            {
              path: "variantId", // Populate variantId để lấy ảnh
              select: "size color price images stock",
            },
          ],
        })
        .populate("userId", "email name")
        .lean();

      res.render("orderDetail", { order, formatToVietnamese });
    } catch (error) {
      console.error("Lỗi khi lấy dữ liệu đơn hàng:", error);
      res.status(500).send("Lỗi máy chủ");
    }
  },
  // Go to transaction page
  getTransactionPage: async (req, res) => {
    try {
      const transactions = await Transaction.find()
        .populate("orderId")
        .sort({ createdAt: -1 });

      res.render("transactions", { transactions });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách hóa đơn:", error);
      res.status(500).send("Lỗi máy chủ");
    }
  },
  // Go to view transaction page
  getViewTransactionPage: async (req, res) => {
    try {
      const { id } = req.params;

      const transaction = await Transaction.findById(id)
        .populate("userId") // Populate người dùng
        .populate({
          path: "orderId", // Populate đơn hàng
          populate: {
            path: "orderItems", // Populate các mục trong đơn
            populate: [
              { path: "productId", model: "Product" },
              { path: "variantId", model: "Variant" },
            ],
          },
        });

      res.render("transactionDetail", { transaction });
    } catch (error) {
      console.error("Lỗi khi lấy thông tin hóa đơn:", error);
      res.status(500).send("Lỗi máy chủ");
    }
  },
  getCouponPage: async (req, res) => {
    try {
      const coupons = await Coupon.find().sort({ createdAt: -1 });

      res.render("coupons", { coupons });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách hóa đơn:", error);
      res.status(500).send("Lỗi máy chủ");
    }
  },
  // Go to comments page
  getCommentsPage: (req, res) => {
    res.render("comments", { title: "Quản lý bình luận", username: "123" });
  },
  // Logout
  logout: (req, res) => {
    res.clearCookie("accessToken"); // Xóa token
    res.redirect("/v1/auth/login"); // Quay về trang đăng nhập
  },

  // Lấy danh sách tất cả bình luận
  getAllComments: async (req, res) => {
    try {
      const comments = await Comment.find({ parentId: null })
        .populate("productId", "name")
        .populate("userId", "name")
        .populate({
          path: "replies",
          populate: { path: "userId", select: "name" },
        })
        .sort({ createdAt: -1 })
        .lean();

      res.render("comment", { comments });
    } catch (error) {
      console.error("Lỗi khi lấy bình luận:", error);
      res.status(500).json({ message: "Lỗi server!", error: error.message });
    }
  },
  // Xóa bình luận
  deleteComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const comment = await Comment.findById(commentId);

      if (!comment) {
        return res.status(404).json({ message: "Không tìm thấy bình luận!" });
      }

      await comment.deleteOne();
      res.status(200).json({ message: "Bình luận đã được xóa thành công!" }); // Trả về JSON thay vì redirect
    } catch (error) {
      res.status(500).json({ message: "Lỗi server!", error: error.message });
    }
  },

  // API: Admin trả lời bình luận
  replyComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const adminId = req.user.id;

      if (!content.trim()) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập nội dung phản hồi!" });
      }

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Không tìm thấy bình luận!" });
      }

      // ✅ Thêm phản hồi và lấy lại `_id`
      const newReply = { userId: adminId, content };
      comment.replies.push(newReply);
      await comment.save();

      // ✅ Lấy phản hồi mới nhất vừa thêm
      const latestReply = comment.replies[comment.replies.length - 1];

      res.status(201).json({ message: "Phản hồi đã gửi!", reply: latestReply });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server!", error: error.message });
    }
  },

  // Xóa phản hồi của admin
  deleteReply: async (req, res) => {
    try {
      const { commentId, replyId } = req.params;

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Không tìm thấy bình luận!" });
      }

      // ✅ Tìm và xóa phản hồi theo `_id`
      comment.replies = comment.replies.filter(
        (reply) => reply._id.toString() !== replyId
      );
      await comment.save();

      res.status(200).json({ message: "Phản hồi đã được xóa!" });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server!", error: error.message });
    }
  },

  toggleCommentVisibility: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { hidden } = req.body;

      const updated = await Comment.findByIdAndUpdate(
        commentId,
        { hidden },
        { new: true }
      );
      if (!updated) {
        return res.status(404).json({ message: "Không tìm thấy bình luận." });
      }

      res.json({
        message: hidden ? "Đã ẩn bình luận." : "Đã hiển thị bình luận.",
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server.", error: err.message });
    }
  },

  // Cập nhật phản hồi của admin
  editReply: async (req, res) => {
    try {
      const { commentId, replyId } = req.params;
      const { content } = req.body;

      if (!content.trim()) {
        return res.status(400).json({ message: "Vui lòng nhập nội dung mới!" });
      }

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Không tìm thấy bình luận!" });
      }

      // ✅ Tìm phản hồi trong mảng và cập nhật nội dung
      const replyIndex = comment.replies.findIndex(
        (reply) => reply._id.toString() === replyId
      );
      if (replyIndex === -1) {
        return res.status(404).json({ message: "Không tìm thấy phản hồi!" });
      }

      comment.replies[replyIndex].content = content;
      await comment.save();

      res.status(200).json({
        message: "Phản hồi đã được cập nhật!",
        updatedContent: content,
      });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server!", error: error.message });
    }
  },
};

module.exports = dashboardController;
