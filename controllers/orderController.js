const Product = require("../models/Product");
const Transaction = require("../models/Transaction");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Variant = require("../models/Variant");
const Cart = require("../models/Cart");
const User = require("../models/User");
const Coupon = require("../models/Coupon");
const axios = require("axios");
const crypto = require("crypto");

// Thêm import thông báo
const {
  sendNotificationForUser,
} = require("../controllers/notificationController");
const { getGHNServiceId, getExpectedDeliveryTime } = require("../utils/util");

const orderController = {
  // Create a new order
  createOrder: async (req, res) => {
    try {
      const {
        shippingAddressId,
        cartItems,
        paymentMethod,
        shippingFee = 25000,
        couponCode,
      } = req.body;
      const userId = req.user.id;

      // Kiểm tra phương thức thanh toán hợp lệ
      const validPaymentMethods = ["COD", "MoMo"];
      if (!validPaymentMethods.includes(paymentMethod)) {
        return res
          .status(400)
          .json({ message: "Phương thức thanh toán không hợp lệ!" });
      }

      // Lấy địa chỉ giao hàng từ User
      const user = await User.findById(userId).populate("addresses");
      const shippingAddress = user.addresses.find(
        (addr) => addr._id.toString() === shippingAddressId
      );
      if (!shippingAddress) {
        return res
          .status(400)
          .json({ message: "Địa chỉ giao hàng không hợp lệ!" });
      }

      let foundCart = await Cart.find({ userId }).populate("variantId");

      if (!foundCart) {
        return res
          .status(400)
          .json({ message: "Giỏ hàng của bạn đang trống!" });
      }

      // Lọc ra những sản phẩm được chọn từ giỏ hàng
      let selectedCartItems = foundCart.filter((item) =>
        cartItems.includes(item._id.toString())
      );

      // Kiểm tra nếu có sản phẩm không thuộc giỏ hàng
      if (selectedCartItems.length !== cartItems.length) {
        return res
          .status(400)
          .json({ message: "Một số sản phẩm bạn chọn không hợp lệ!" });
      }

      // Tính tổng tiền
      const totalAmount = selectedCartItems.reduce(
        (sum, item) => sum + item.variantId.salePrice * item.quantity,
        0
      );

      console.log("total ammount: ", totalAmount);

      let discountAmount = 0;
      let appliedCoupon = null;

      if (couponCode) {
        const coupon = await Coupon.findOne({
          code: couponCode,
          isHidden: false,
        });

        if (!coupon) {
          return res
            .status(400)
            .json({ message: "Mã giảm giá không hợp lệ hoặc đã bị ẩn!" });
        }

        const now = new Date();
        if (now < coupon.validFrom || now > coupon.validUntil) {
          return res.status(400).json({ message: "Mã giảm giá đã hết hạn!" });
        }

        if (totalAmount < coupon.minOrderValue) {
          return res.status(400).json({
            message: `Đơn hàng chưa đạt giá trị tối thiểu ${coupon.minOrderValue.toLocaleString(
              "vi-VN"
            )}đ để áp dụng mã này!`,
          });
        }

        if (coupon.usedCount >= coupon.maxUses) {
          return res
            .status(400)
            .json({ message: "Mã giảm giá đã hết lượt sử dụng!" });
        }

        const userUsageCount = coupon.usersUsed.filter((user) =>
          user.userId.equals(req.user.id)
        ).length;
        if (userUsageCount >= coupon.maxUsesPerUser) {
          return res.status(400).json({
            message: "Bạn đã sử dụng mã giảm giá này quá số lần cho phép!",
          });
        }

        console.log(coupon);

        // Tính toán giá trị giảm giá (KHÔNG khai báo lại let)
        if (coupon.discountType === "percentage") {
          discountAmount = totalAmount * (coupon.discountValue / 100);
          if (
            coupon.maxDiscountAmount !== null &&
            discountAmount > coupon.maxDiscountAmount
          ) {
            discountAmount = coupon.maxDiscountAmount;
          }
        } else if (coupon.discountType === "fixed") {
          discountAmount = coupon.discountValue;
        }

        appliedCoupon = coupon._id;
      }

      console.log("discount Amount: ", discountAmount);

      const finalTotal = totalAmount - discountAmount + shippingFee;
      console.log("final total: ", finalTotal);

      // Tạo mã đơn hàng cho MoMo (nếu cần)
      const momoOrderId =
        paymentMethod === "MoMo" ? `momo_${Date.now()}_${userId}` : null;

      // Tạo đơn hàng mới
      const newOrder = await Order.create({
        userId,
        totalAmount: finalTotal,
        shippingAddress,
        paymentMethod,
        orderStatus: "Pending",
        paymentStatus: paymentMethod === "COD" ? "Paid" : "Pending",
        shippingFee: shippingFee,
        orderItems: [],
        history: [
          {
            status: "Pending",
            description: "Tạo đơn hàng thành công.",
            changedBy: "user",
          },
        ],
        momoOrderId,
        couponId: appliedCoupon,
        discountAmount: discountAmount,
      });

      // Tạo danh sách OrderItems mới
      const createdOrderItems = await OrderItem.insertMany(
        selectedCartItems.map((item) => ({
          orderId: newOrder._id,
          productId: item.variantId.productId,
          variantId: item.variantId._id,
          quantity: item.quantity,
          salePrice: item.variantId.salePrice,
          importPrice: item.variantId.importPrice,
          profit: (item.variantId.salePrice - item.variantId.importPrice) * item.quantity,
        }))
      );

      // Cập nhật lại Order với danh sách OrderItem vừa tạo
      const orderItemIds = createdOrderItems.map((item) => item._id);
      await Order.findByIdAndUpdate(newOrder._id, { orderItems: orderItemIds });

      let momoResult;
      let notificationMessage;

      // Nếu chọn MoMo, tạo Transaction
      let transaction = null;
      if (paymentMethod === "MoMo") {
        transaction = await Transaction.create({
          orderId: newOrder._id,
          userId,
          paymentMethod,
          paymentStatus: "Pending",
          history: [
            {
              status: "Pending",
              changedAt: new Date(),
              note: "Giao dịch khởi tạo",
            },
          ],
        });

        await Order.findByIdAndUpdate(newOrder._id, {
          transactionId: transaction._id,
        });

        try {
          const momoResponse = await createMoMoPayment(
            newOrder.totalAmount,
            newOrder.momoOrderId
          );
          // Nếu gọi MoMo thành công, cập nhật trạng thái thanh toán
          if (momoResponse && momoResponse.payUrl) {
            momoResult = momoResponse;
            // Giả định rằng sau khi gọi createMoMoPayment, bạn có thể kiểm tra trạng thái thanh toán
            const updatedTransaction = await Transaction.findById(
              transaction._id
            );
            notificationMessage =
              updatedTransaction.paymentStatus === "Paid"
                ? "Đơn hàng của bạn với phương thức thanh toán momo đã được đặt thành công!"
                : "Đơn hàng của bạn với phương thức thanh toán momo đã được đặt thành công nhưng chưa thanh toán!";
          } else {
            throw new Error("Không nhận được URL thanh toán từ MoMo");
          }
        } catch (error) {
          console.error("Lỗi thanh toán MoMo:", error.message);
          await Transaction.findByIdAndUpdate(transaction._id, {
            paymentStatus: "Failed",
          });
          return res
            .status(500)
            .json({ message: "Lỗi khi tạo thanh toán MoMo" });
        }
      } else {
        notificationMessage =
          "Đơn hàng của bạn đã được đặt thành công với phương thức thanh toán sau khi nhận hàng!";
      }

      // Nếu là COD, gọi API GHN ngay lập tức
      let trackingCode = null;
      if (paymentMethod === "COD") {
        try {
          trackingCode = await createGHNOrder(
            shippingAddress,
            totalAmount,
            paymentMethod
          );

          const service_id = await getGHNServiceId(
            3440,
            shippingAddress.districtId
          );

          const expectedDeliveryTime = await getExpectedDeliveryTime({
            fromDistrict: 3440, // Quận gốc
            fromWard: "13010", // Mã phường gốc
            toDistrict: shippingAddress.districtId, // Quận đích (lấy từ shippingAddress)
            toWard: shippingAddress.wardCode, // Mã phường đích (lấy từ shippingAddress)
            serviceId: service_id, // service_id đã lấy trước đó từ GHN
          });

          await Order.findByIdAndUpdate(newOrder._id, {
            GHNOrderCode: trackingCode,
            expectedDeliveryTime: expectedDeliveryTime,
          });
        } catch (error) {
          console.error("Lỗi GHN:", error.response?.data || error.message);
          return res.status(500).json({
            message: "Lỗi khi tạo đơn hàng GHN!",
            error: error.response?.data || error.message,
          });
        }
      }

      // Giảm số lượng tồn kho
      await Promise.all(
        selectedCartItems.map((item) =>
          Variant.findByIdAndUpdate(item.variantId._id, {
            $inc: { stock: -item.quantity },
          })
        )
      );

      // Xóa các sản phẩm đã được chọn trong giỏ hàng sau khi đặt hàng thành công
      await Cart.deleteMany({
        userId,
        _id: { $in: cartItems },
      });
       const io = req.app.get("io");
      const userr = await User.findById(userId);
      const username = userr.username || userr.email || 'Người dùng không xác định';
      const notification = {
        userId,
        username,
        type: "order",
        title: "Đơn hàng mới",
        message: `Người dùng ${username} vừa tạo đơn #${newOrder._id}`,
        timestamp: new Date().toISOString(),
        data: { orderId: newOrder._id.toString() },
      };

      // Emit event 'newNotification' tới room 'admin'
      io.to("admin").emit("newNotification", notification);

      // (Tuỳ chọn) Lưu vào collection Notification nếu muốn truy vấn sau
      await Notification.create({
        userId,
        username,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        data: notification.data,
        read: false,
        timestamp: new Date(),
      });
      const notificationResult = await sendNotificationForUser(userId, {
        type: "order",
        title: "Thông báo đặt hàng", // Thêm title
        message: notificationMessage,
        username,
        data: { orderId: newOrder._id }, // Thêm data để điều hướng khi nhấn thông báo
      });

      if (!notificationResult.success) {
        console.error(`[Order] Gửi thông báo thất bại: ${notificationResult.error}, ${userr}, ${userId}`);
      }

      if (appliedCoupon) {
        // Cập nhật usedCount và usersUsed
        await Coupon.findByIdAndUpdate(appliedCoupon, {
          $inc: { usedCount: 1 },
          $addToSet: { usersUsed: { userId: req.user.id } },
        });
      }

      // Gửi thông báo cho user đặt hàng thành công
      sendNotificationForUser(userId, {
        type: "order",
        message: "Đơn hàng của bạn đã được đặt thành công!",
      });

      res.status(201).json({
        message: notificationMessage,
        orderId: newOrder._id,
        trackingCode,
        transaction,
        momoResult,
      });
    } catch (error) {
      console.error("Lỗi:", error.message);
      res.status(500).json({
        message: "Lỗi khi tạo đơn hàng!",
        error: error.message,
      });
    }
  },

  // Confirm order and update product variant sold quantity
  confirmOrder: async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId).populate(
        "orderItems"
      );

      if (!order) {
        return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
      }

      if (order.orderStatus !== "Delivered") {
        return res.status(400).json({
          message:
            "Chỉ đơn hàng ở trạng thái 'Delivered' mới có thể xác nhận hoàn tất.",
        });
      }

      // Cập nhật trạng thái đơn hàng thành "Completed"
      order.orderStatus = "Completed";
      order.history.push({
        status: "Completed",
        description: "Người dùng đã xác nhận đã nhận hàng và hoàn tất đơn",
        changedBy: "user",
      });

      // Cập nhật số lượng đã bán cho từng variant của orderItems
      for (const item of order.orderItems) {
        const variant = await Variant.findById(item.variantId); // Tìm variant của sản phẩm
        console.log("Biến thể: ", variant);

        if (variant) {
          variant.soldQuantity += item.quantity; // Tăng số lượng bán của variant
          await variant.save(); // Lưu cập nhật vào variant
        }
      }

      await order.save(); // Lưu đơn hàng đã cập nhật
      res.json({
        message:
          "Đơn hàng đã được xác nhận hoàn tất và số lượng bán của biến thể sản phẩm đã được cập nhật",
        order,
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi hệ thống", error: err });
    }
  },

  // Cancel order
  cancelOrder: async (req, res) => {
    try {
      const { orderId } = req.body;

      // Kiểm tra token hợp lệ
      const userId = req.user?.id; // Giả định middleware đã thêm user vào req
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Bạn cần đăng nhập để thực hiện hành động này!" });
      }

      // 1️⃣ Tìm đơn hàng
      const order = await Order.findById(orderId).populate("orderItems");
      if (!order) {
        return res.status(404).json({ message: "Đơn hàng không tồn tại!" });
      }

      // Kiểm tra quyền sở hữu đơn hàng
      if (order.userId.toString() !== userId) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền hủy đơn hàng này!" });
      }

      // 2️⃣ Kiểm tra trạng thái đơn hàng
      if (order.orderStatus !== "Pending") {
        return res.status(400).json({
          message: "Chỉ có thể hủy đơn hàng khi còn ở trạng thái Chờ xác nhận!",
        });
      }

      // 3️⃣ Nếu đã thanh toán bằng MoMo, tiến hành hoàn tiền
      if (order.paymentMethod === "MoMo" && order.paymentStatus === "Paid") {
        let momoRefundResponse;
        try {
          const accessKey = process.env.MOMO_ACCESS_KEY;
          const secretKey = process.env.MOMO_SECRET_KEY;
          const partnerCode = "MOMO";
          const orderIdStr = `${Date.now()}_${order._id}`;
          const requestId = Date.now().toString();
          const description = "Hoàn tiền đơn hàng đã hủy";
          const lang = "vi";
          const transId = order.transId;
          const rawData = `accessKey=${accessKey}&amount=${order.totalAmount}&description=${description}&orderId=${orderIdStr}&partnerCode=${partnerCode}&requestId=${requestId}&transId=${transId}`;
          const signature = crypto
            .createHmac("sha256", secretKey)
            .update(rawData)
            .digest("hex");
          momoRefundResponse = await axios.post(
            "https://test-payment.momo.vn/v2/gateway/api/refund",
            {
              partnerCode,
              orderId: orderIdStr,
              requestId,
              amount: order.totalAmount,
              transId,
              lang,
              description,
              signature: signature,
            },
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error(
            "❌ MoMo Refund API Error:",
            error?.response?.data || error.message
          );
          return res.status(500).json({
            message: "Không thể hoàn tiền MoMo!",
            error: error?.response?.data || error.message,
          });
        }

        if (momoRefundResponse.data.resultCode !== 0) {
          return res.status(400).json({
            message: "Hoàn tiền MoMo thất bại!",
            error: momoRefundResponse.data,
          });
        }
      }

      // 5️⃣ Gọi API GHN để hủy đơn
      if (order.GHNOrderCode) {
        let ghnResponse;
        try {
          ghnResponse = await axios.post(
            "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/switch-status/cancel",
            { order_codes: [order.GHNOrderCode] },
            {
              headers: {
                "Content-Type": "application/json",
                Token: process.env.GHN_DEV_TOKEN,
                ShopId: process.env.SHOP_ID,
              },
            }
          );
        } catch (error) {
          console.error(
            "❌ GHN API Error:",
            error?.response?.data || error.message
          );
          return res.status(500).json({
            message: "Lỗi từ GHN, không thể hủy đơn hàng!",
            error: error?.response?.data || error.message,
          });
        }

        if (ghnResponse.data.code !== 200) {
          return res.status(400).json({
            message: "Hủy đơn hàng thất bại từ GHN!",
            error: ghnResponse.data,
          });
        }
      } else {
        console.log("⚠️ Đơn hàng không có GHNOrderCode, bỏ qua hủy trên GHN.");
      }

      // 7️⃣ Cộng lại số lượng sản phẩm vào kho
      try {
        for (const item of order.orderItems) {
          await Variant.findByIdAndUpdate(item.variantId, {
            $inc: { stock: item.quantity },
          });
        }
      } catch (error) {
        console.error("❌ Lỗi khi cập nhật kho:", error);
        return res
          .status(500)
          .json({ message: "Lỗi khi hoàn lại số lượng sản phẩm vào kho!" });
      }

      const now = new Date().toLocaleString("vi-VN");

      if (order.paymentMethod === "MoMo") {
        if (order.paymentStatus === "Paid") {
          order.orderStatus = "Cancelled";
          order.paymentStatus = "Refunded";
          order.history.push({
            status: "Refunded",
            changedBy: "user",
            description: `Đơn hàng đã bị hủy và hoàn tiền thành công.`,
          });

          await Transaction.findOneAndUpdate(
            { orderId: order._id },
            {
              $push: {
                history: {
                  status: "Cancelled",
                  note: "Đơn hàng đã bị hủy.",
                  changedBy: "user",
                  changedAt: new Date(),
                },
              },
            }
          );

          await Transaction.findOneAndUpdate(
            { orderId: order._id },
            {
              paymentStatus: "Refunded",
              $push: {
                history: {
                  status: "Refunded",
                  note: "Đơn hàng đã hoàn tiền thành công.",
                  changedBy: "user",
                  changedAt: new Date(),
                },
              },
            },
            { new: true }
          );
        } else {
          order.orderStatus = "Cancelled";
          order.paymentStatus = "Cancelled";
          order.history.push({
            status: "Cancelled",
            changedBy: "user",
            description: `Đơn hàng đã bị hủy.`,
          });

          await Transaction.findOneAndUpdate(
            { orderId: order._id },
            {
              paymentStatus: "Cancelled",
              $push: {
                history: {
                  status: "Cancelled",
                  note: "Hóa đơn đã bị hủy.",
                  changedBy: "user",
                },
              },
            },
            { new: true }
          );
        }
      } else {
        order.orderStatus = "Cancelled";
        order.paymentStatus = "Cancelled";
        order.history.push({
          status: "Cancelled",
          changedBy: "user",
          description: `Đơn hàng đã bị hủy.`,
        });

        await Transaction.findOneAndUpdate(
          { orderId: order._id },
          {
            paymentStatus: "Cancelled",
            $push: {
              history: {
                status: "Cancelled",
                note: "Hóa đơn đã bị hủy.",
                changedBy: "user",
              },
            },
          },
          { new: true }
        );
      }

      await order.save();

      // Gửi thông báo cho user khi hủy đơn hàng thành công
      const userr = await User.findById(order.userId);
      const username =
        userr.username || userr.email || "Người dùng không xác định";
      const notificationResult = await sendNotificationForUser(order.userId, {
        type: "order",
        title: "Thông báo đơn hàng",
        message: "Bạn đã hủy đơn hàng thành công.",
        username,
        data: { orderId: order._id.toString() },
      });
      if (!notificationResult.success) {
        console.error(
          `[Order] Gửi thông báo thất bại: ${notificationResult.error}, ${userr}, ${order.userId}`
        );
      }

      return res.status(200).json({
        message:
          "Đơn hàng đã được hủy! Số lượng sản phẩm đã được hoàn lại kho.",
        order,
      });
    } catch (error) {
      console.error("❌ Lỗi hệ thống:", error);
      return res
        .status(500)
        .json({ message: "Lỗi server, vui lòng thử lại sau!" });
    }
  },

  // Get all orders
  getAllOrders: async (req, res) => {
    try {
      const userId = req.user.id;
      let orders = await Order.find({ userId })
        .populate({
          path: "orderItems",
          populate: [
            { path: "productId", select: "name image" },
            { path: "variantId", select: "size color salePrice images" },
          ],
        })
        .sort({ createdAt: -1 });
      res.json({ orders });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get order detail
  getOrderDetail: async (req, res) => {
    try {
      const { orderId } = req.params;
      const order = await Order.findById(orderId).populate("orderItems");
      if (!order) {
        return res.status(404).json({ message: "Đơn hàng không tồn tại!" });
      }
      res.json({ order });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get all orders for admin
  getAllOrdersForAdmin: async (req, res) => {
    try {
      const {
        startDate,
        endDate,
        name,
        minPrice,
        maxPrice,
        orderStatus,
        paymentMethod,
        page = 1,
        limit = 10,
      } = req.query;

      const query = {};

      // Lọc theo thời gian (startDate và endDate)
      if (startDate || endDate) {
        query.createdAt = {};

        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Set tới hết ngày endDate
          query.createdAt.$lte = end;
        } else if (startDate) {
          const now = new Date(); // Nếu chỉ có startDate, thì endDate là hôm nay
          now.setHours(23, 59, 59, 999);
          query.createdAt.$lte = now;
        }
      }

      // Lọc theo tên người mua
      if (name) {
        const removeDiacritics = (str) => {
          return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D");
        };

        const normalizedInput = removeDiacritics(name).toLowerCase();

        const users = await User.find().select("name _id").lean(); // chỉ lấy name và _id để nhẹ

        const matchedUserIds = users
          .filter((user) =>
            removeDiacritics(user.name).toLowerCase().includes(normalizedInput)
          )
          .map((user) => user._id);

        if (matchedUserIds.length === 0) {
          return res.json({ orders: [], currentPage: page, totalPages: 0 });
        }

        query.userId = { $in: matchedUserIds };
      }

      // Lọc theo khoảng giá (minPrice và maxPrice)
      if (minPrice || maxPrice) {
        query.totalAmount = {};

        if (minPrice) {
          query.totalAmount.$gte = parseFloat(minPrice); // Nếu có giá từ, lọc từ minPrice
        } else if (!minPrice) {
          query.totalAmount.$gte = 0;
        }

        if (maxPrice) {
          query.totalAmount.$lte = parseFloat(maxPrice); // Nếu có giá đến, lọc tới maxPrice
        } else if (minPrice) {
          // Nếu chỉ có minPrice thì giá đến là vô hạn
          query.totalAmount.$lte = Number.MAX_SAFE_INTEGER;
        }
      }

      // Lọc theo trạng thái đơn hàng
      if (orderStatus) {
        query.orderStatus = orderStatus;
      }

      // Lọc theo phương thức thanh toán
      if (paymentMethod) {
        query.paymentMethod = paymentMethod;
      }

      const totalCount = await Order.countDocuments(query);

      const orders = await Order.find(query)
        .populate({
          path: "orderItems",
          populate: [
            { path: "productId", select: "name image" },
            { path: "variantId", select: "size color price images" },
          ],
        })
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      res.json({
        orders,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Update order status
  updateOrderStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const order = await Order.findById(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn hàng",
        });
      }

      // Nếu đơn hàng đã bị hủy
      if (order.orderStatus === "Cancelled") {
        return res.status(400).json({
          success: false,
          message: "Đơn hàng đã bị hủy, không thể cập nhật trạng thái",
        });
      }

      // Kiểm tra nếu là thanh toán MOMO mà chưa thanh toán hoặc đã hủy
      if (
        order.paymentMethod.toLowerCase() === "momo" &&
        (order.paymentStatus === "Pending" ||
          order.paymentStatus === "Cancelled")
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Đơn hàng chưa được thanh toán qua MOMO, không thể cập nhật trạng thái",
        });
      }

      let newStatus = "";
      let historyDescription = "";

      switch (order.orderStatus) {
        case "Pending":
          newStatus = "Processing";
          historyDescription = "Đang chuẩn bị hàng";
          break;
        case "Processing":
          newStatus = "Shipped";
          historyDescription = "Đang giao hàng";
          break;
        case "Shipped":
          newStatus = "Delivered";
          historyDescription = "Đã giao hàng";

          // Cập nhật deliveredAt khi trạng thái là "Delivered"
          order.deliveredAt = new Date(); // Cập nhật thời gian giao hàng
          break;
        case "Delivered":
          return res.status(400).json({
            success: false,
            message: "Đơn hàng đã được giao, không thể cập nhật thêm",
          });
        default:
          return res.status(400).json({
            success: false,
            message: "Trạng thái đơn hàng không hợp lệ",
          });
      }

      order.orderStatus = newStatus;

      order.history.push({
        status: newStatus,
        changedAt: new Date(),
        changedBy: "Hệ thống",
        description: `Trạng thái đơn hàng được cập nhật thành "${historyDescription}".`,
      });

      if (newStatus === "Delivered" && order.paymentMethod === "COD") {
        const newTransaction = new Transaction({
          orderId: order._id,
          userId: order.userId,
          paymentMethod: "COD",
          paymentStatus: "Paid",
          history: [
            {
              status: "Paid",
              changedAt: new Date(),
              note: "Thanh toán khi nhận hàng thành công.",
            },
          ],
        });

        await newTransaction.save();

        order.paymentStatus = "Paid";

        order.history.push({
          status: "Paid",
          changedAt: new Date(),
          changedBy: "Hệ thống",
          description: "Thanh toán khi nhận hàng thành công.",
        });

        // sendNotificationForUser(order.userId.toString(), {
        //   type: "order",
        //   message: "Thanh toán của bạn đã được xác nhận thành công!",
        // });

        const userr = await User.findById(order.userId);
        const username =
          userr.username || userr.email || "Người dùng không xác định";
        const notificationResult = await sendNotificationForUser(order.userId, {
          type: "order",
          title: "Thông báo đơn hàng",
          message: "Thanh toán của bạn đã được xác nhận thành công!",
          username,
          data: { orderId: order._id.toString() },
        });
        if (!notificationResult.success) {
          console.error(
            `[Order] Gửi thông báo thất bại: ${notificationResult.error}, ${userr}, ${order.userId}`
          );
        }
      }

      await order.save();

      sendNotificationForUser(order.userId.toString(), {
        type: "order",
        message: `Đơn hàng của bạn đã chuyển sang trạng thái: ${order.orderStatus}`,
      });

      res.json({
        success: true,
        message: `Đơn hàng đã chuyển sang trạng thái: ${order.orderStatus}`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Lỗi cập nhật trạng thái đơn hàng",
        error: error.message,
      });
    }
  },

  // Pay with MoMo
  payWithMoMo: async (req, res) => {
    try {
      const { orderId } = req.body;
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Đơn hàng không tồn tại" });
      }

      // 🛠 Nếu đơn hàng chưa thanh toán -> Tạo lại `momoOrderId` mới để tránh trùng lặp
      const newMomoOrderId = `momo_${Date.now()}${order.userId}`;
      order.momoOrderId = newMomoOrderId;
      await order.save(); // Cập nhật lại trong DB

      // 📌 Gọi API MoMo để tạo link thanh toán mới
      const paymentUrl = await createMoMoPayment(
        order.totalAmount,
        newMomoOrderId
      );
      if (!paymentUrl) {
        return res
          .status(500)
          .json({ message: "Không thể tạo thanh toán MoMo" });
      }
      // ✅ Gửi thông báo cho người dùng về việc khởi tạo thanh toán
      sendNotificationForUser(order.userId.toString(), {
        type: "order",
        message: "Đã khởi tạo thanh toán MoMo, vui lòng hoàn tất giao dịch.",
      });
      return res.json({ paymentUrl });
    } catch (error) {
      console.error("Lỗi tạo thanh toán MoMo:", error);
      return res.status(500).json({ message: "Lỗi server" });
    }
  },
};

const createGHNOrder = async (shippingAddress, totalAmount, paymentMethod) => {
  const ghnResponse = await axios.post(
    "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create",
    {
      payment_type_id: 2,
      note: "Tintest 123",
      required_note: "KHONGCHOXEMHANG",
      from_name: "TinTest124",
      from_phone: "0987654321",
      from_address: "72 Thành Thái, Phường 14, Quận 10, Hồ Chí Minh, Vietnam",
      from_ward_name: "Phường 14",
      from_district_name: "Quận 10",
      from_province_name: "HCM",
      return_phone: "0332190444",
      return_address: "39 NTT",
      return_district_id: null,
      return_ward_code: "",
      client_order_code: "",
      to_name: shippingAddress.name,
      to_phone: shippingAddress.phoneNumber,
      to_address: shippingAddress.addressDetail,
      to_ward_code: shippingAddress.wardCode,
      to_district_id: shippingAddress.districtId,
      cod_amount: paymentMethod === "COD" ? totalAmount : 0,
      content: "Theo New York Times",
      weight: 200,
      length: 1,
      width: 19,
      height: 10,
      deliver_station_id: null,
      insurance_value: 5000000,
      service_id: 0,
      service_type_id: 2,
      coupon: null,
      pick_shift: [2],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Token: process.env.GHN_DEV_TOKEN,
        ShopId: process.env.SHOP_ID,
      },
    }
  );
  return ghnResponse.data.data.order_code;
};

const createMoMoPayment = async (amount, id) => {
  console.log(amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error("Số tiền không hợp lệ");
  }

  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const partnerCode = "MOMO";
  const orderInfo = "Thanh toán đơn hàng";
  const redirectUrl = `${process.env.NGROK_API}`;
  const ipnUrl = `${process.env.NGROK_API}/v1/webhook/momoCallback`;
  const requestType = "payWithMethod";
  const orderId = id;
  const requestId = Date.now().toString() + "";
  const extraData = "";
  const orderGroupId = "";
  const autoCapture = true;
  const lang = "vi";

  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  const requestBody = {
    partnerCode,
    partnerName: "Test",
    storeId: "MomoTestStore",
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang,
    requestType,
    autoCapture,
    extraData,
    orderGroupId,
    signature,
  };

  const options = {
    method: "POST",
    url: "https://test-payment.momo.vn/v2/gateway/api/create",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(JSON.stringify(requestBody)),
    },
    data: requestBody,
  };

  try {
    const response = await axios(options);
    return response.data;
  } catch (error) {
    console.error("Lỗi khi tạo thanh toán MoMo:", error);
    throw new Error("Không thể tạo thanh toán MoMo");
  }
};

module.exports = orderController;
