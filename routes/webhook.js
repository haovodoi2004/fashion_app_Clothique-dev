const express = require("express");
const route = express.Router();
const axios = require("axios");
const Order = require("../models/Order"); // Model đơn hàng
const Transaction = require("../models/Transaction"); // Model đơn hàng
// Import hàm gửi notification từ socketManager
const {
  sendNotificationForUser,
} = require("../controllers/notificationController");
const { getGHNServiceId, getExpectedDeliveryTime } = require("../utils/util");

// Endpoint nhận callback từ GHN
route.post("/ghn", async (req, res) => {
  try {
    console.log("GHN Webhook Received:", req.body);

    const { OrderCode, Status } = req.body;

    // Kiểm tra dữ liệu nhận được từ webhook
    if (!OrderCode || !Status) {
      console.warn("Webhook GHN: Thiếu OrderCode hoặc Status");
      return res.status(400).json({ message: "Dữ liệu không hợp lệ!" });
    }

    // Tìm đơn hàng theo trackingCode
    const order = await Order.findOne({ trackingCode: OrderCode });

    if (!order) {
      console.warn(`Webhook GHN: Không tìm thấy đơn hàng với mã ${OrderCode}`);
      return res.status(404).json({ message: "Không tìm thấy đơn hàng!" });
    }

    // Kiểm tra xem trạng thái có thay đổi không
    if (order.orderStatus === Status) {
      console.log(
        `Webhook GHN: Đơn hàng ${OrderCode} đã có trạng thái ${Status}, không cần cập nhật.`
      );
      return res
        .status(200)
        .json({ message: "Trạng thái đơn hàng không thay đổi." });
    }

    // Cập nhật trạng thái đơn hàng
    order.orderStatus = Status;
    await order.save();

    console.log(`Webhook GHN: Cập nhật đơn hàng ${OrderCode} thành ${Status}`);
    res.json({ message: "Cập nhật trạng thái đơn hàng thành công!" });
  } catch (error) {
    console.error("GHN Webhook Error:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
});

route.get("/ghn", (req, res) => {
  console.log("giao hàng nhanh ok nhé!");
});

route.post("/momoCallback", async (req, res) => {
  console.log("MoMo Callback received:", req.body);

  const { orderId, resultCode, message, transId } = req.body;

  const order = await Order.findOne({ momoOrderId: orderId });
  if (!order) {
    return res.status(404).json({ message: "Đơn hàng không tồn tại" });
  }

  const service_id = await getGHNServiceId(
    3440,
    order.shippingAddress.districtId
  );

  const expectedDeliveryTime = await getExpectedDeliveryTime({
    fromDistrict: 3440, // Quận gốc
    fromWard: "13010", // Phường gốc
    toDistrict: order.shippingAddress.districtId,
    toWard: order.shippingAddress.wardCode,
    serviceId: service_id,
  });

  try {
    // Tìm transaction dựa trên orderId
    const transaction = await Transaction.findOne({ orderId: order._id });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    // Giả sử order có thuộc tính userId được dùng để gửi notification qua socket
    const userId = order.userId.toString();
    if (resultCode === 0) {
      // ✅ Thanh toán thành công
      transaction.paymentStatus = "Paid";
      transaction.history.push({
        status: "Paid",
        note: "Đã thanh toán",
        changedBy: "System",
      });
      await transaction.save();

      // Cập nhật trạng thái đơn hàng
      order.paymentStatus = "Paid";
      order.history.push({
        status: "Paid",
        changedBy: "System",
        description: `Đơn hàng đã thanh toán thành công.`,
      });
      order.transId = transId; // Lưu transactionId của MoMo

      console.log(`✅ Order ${orderId} đã thanh toán thành công`);
      // Gửi thông báo đến FE khi thanh toán thành công (nếu userId tồn tại)
      if (userId) {
        sendNotificationForUser(userId, {
          message: "Thanh toán qua MoMo thành công",
          data: { orderId: order._id, transId: transId },
        });
      }
      // 🛠️ **Tạo đơn GHN sau khi thanh toán thành công**

      const ghnResponse = await axios.post(
        "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create",
        {
          payment_type_id: 2,
          note: "Tintest 123",
          required_note: "KHONGCHOXEMHANG",
          from_name: "TinTest124",
          from_phone: "0987654321",
          from_address:
            "72 Thành Thái, Phường 14, Quận 10, Hồ Chí Minh, Vietnam",
          from_ward_name: "Phường 14",
          from_district_name: "Quận 10",
          from_province_name: "HCM",
          return_phone: "0332190444",
          return_address: "39 NTT",
          return_district_id: null,
          return_ward_code: "",
          client_order_code: "",
          to_name: order.shippingAddress.name,
          to_phone: order.shippingAddress.phoneNumber,
          to_address: order.shippingAddress.addressDetail,
          to_ward_code: order.shippingAddress.wardCode,
          to_district_id: order.shippingAddress.districtId,
          cod_amount: 0,
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

      const trackingCode = ghnResponse.data.data.order_code;

      // Lưu mã vận đơn vào đơn hàng
      order.GHNOrderCode = trackingCode; // Lưu mã vận đơn vào đơn hàng
      order.expectedDeliveryTime = expectedDeliveryTime;
      await order.save();
      return res.status(200).json({
        message: "Payment successful & GHN order created",
        trackingCode,
      });
    } else {
      // ❌ Thanh toán thất bại
      transaction.paymentStatus = "Pending";
      await transaction.save();

      console.log(`❌ Order ${orderId} thất bại: ${message}`);
      // Gửi thông báo đến FE khi thanh toán thất bại (nếu userId tồn tại)
      if (userId) {
        sendNotificationForUser(userId, {
          message: "Thanh toán qua MoMo thất bại, vui lòng thử lại",
          data: { orderId: order._id },
        });
      }
      return res.status(400).json({ message: "Payment failed" });
    }
  } catch (error) {
    console.error("Lỗi xử lý callback MoMo:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

route.get("/momoCallback", (req, res) => {
  console.log("IPN URL:", process.env.NGROK_API);
  return res.send("ok");
});

module.exports = route;
