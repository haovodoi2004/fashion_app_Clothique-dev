const Transaction = require("../models/Transaction");

const transactionController = {
  getAllTransactions: async (req, res) => {
    try {
      const {
        id,
        orderStatus,
        minPrice,
        maxPrice,
        paymentMethod,
        paymentStatus,
        startDate,
        endDate,
        page = 1,
        limit = 10,
      } = req.query;

      const filter = {};

      // 🔍 Lọc theo mã giao dịch (Transaction ID)
      if (id) {
        filter._id = id;
      }

      // Lọc theo phương thức thanh toán
      if (paymentMethod) {
        filter.paymentMethod = paymentMethod;
      }

      // Lọc theo trạng thái thanh toán
      if (paymentStatus) {
        filter.paymentStatus = paymentStatus;
      }

      // Lọc theo ngày (startDate và endDate)
      if (startDate || endDate) {
        filter.createdAt = {};

        if (startDate) {
          filter.createdAt.$gte = new Date(startDate); // startDate >=
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Đặt thời gian kết thúc vào cuối ngày (23:59:59.999)
          filter.createdAt.$lte = end; // endDate <=
        }
      }

      // ✅ Xử lý giá trị mặc định cho minPrice và maxPrice
      const min =
        minPrice !== undefined && minPrice !== "" ? parseFloat(minPrice) : 0;
      const max =
        maxPrice !== undefined && maxPrice !== ""
          ? parseFloat(maxPrice)
          : Infinity;

      // Truy vấn ban đầu
      let query = Transaction.find(filter)
        .populate("userId", "name")
        .populate("orderId")
        .sort({ createdAt: -1 });

      const allTransactions = await query.clone();

      // Nếu không có giao dịch nào
      if (allTransactions.length === 0) {
        return res.status(200).json({ transactions: [], totalPages: 0 });
      }

      // ✅ Lọc theo trạng thái đơn hàng và khoảng giá của orderId.totalAmount
      let filtered = allTransactions.filter((t) => {
        const order = t.orderId;
        if (!order) return false;
        if (orderStatus && order.status !== orderStatus) return false;
        if (order.totalAmount < min || order.totalAmount > max) return false;
        return true;
      });

      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + Number(limit));

      res.status(200).json({
        transactions: paginated,
        totalPages: Math.ceil(filtered.length / limit),
        currentPage: +page,
      });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server!", error: error.message });
    }
  },
  getTransactionById: async (req, res) => {
    try {
      const { id } = req.params;
      const transaction = await Transaction.findById(id)
        .populate({
          path: "orderId",
          populate: {
            path: "orderItems",
            populate: [
              { path: "productId", model: "Product" },
              { path: "variantId", model: "Variant" }, // Thêm variant
            ],
          },
        })
        .populate("userId");

      res.render("transactionDetail", { transaction });
    } catch (error) {
      console.error("Lỗi khi lấy thông tin hóa đơn:", error);
      res.status(500).send("Lỗi máy chủ");
    }
  },
};

module.exports = transactionController;
