// utils/cronJobs.js
const cron = require("node-cron")
const Order = require('../models/Order');  // Import Order model
const Variant = require('../models/Variant');  // Import Variant model (nếu cần)

cron.schedule('0 0 * * *', async () => {  // Cron job chạy mỗi ngày lúc 00:00
  try {
    const orders = await Order.find({ orderStatus: 'Delivered' });
    const currentDate = new Date();

    for (let order of orders) {
      const deliveryDate = new Date(order.deliveredAt);

      // Kiểm tra nếu đơn hàng đã giao hơn 7 ngày
      const daysPassed = (currentDate - deliveryDate) / (1000 * 3600 * 24);
      if (daysPassed >= 7) {
        // Cập nhật trạng thái đơn hàng thành "Completed"
        order.orderStatus = 'Completed';
        order.history.push({
          status: 'Completed',
          description: 'Đơn hàng đã được xác nhận hoàn tất tự động sau 7 ngày',
          changedBy: 'system',  // Hoặc 'cron job'
        });

        // Cập nhật số lượng variant đã bán (nếu cần)
        if (order.orderItems) {
          for (let item of order.orderItems) {
            const variant = await Variant.findById(item.variantId);
            if (variant) {
              variant.soldQuantity += item.quantity;  // Cập nhật số lượng đã bán
              await variant.save();
            }
          }
        }

        // Lưu lại đơn hàng đã được cập nhật
        await order.save();
      }
    }
  } catch (error) {
    console.error('Cron job failed:', error);
  }
});
