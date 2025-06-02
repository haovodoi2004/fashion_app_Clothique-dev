const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Variant = require("../models/Variant");
const Coupon = require("../models/Coupon");

const cartController = {
  // Add to cart
  addToCart: async (req, res) => {
    try {
      const { productId, variantId, quantity } = req.body;
      const userId = req.user.id;

      const product = await Product.findById(productId);
      if (!product)
        return res.status(404).json({ message: "Sản phẩm không tồn tại" });

      let cartItem = await Cart.findOne({ userId, productId, variantId });

      if (cartItem) {
        const variantProduct = await Variant.findById(cartItem.variantId);
        if (cartItem.quantity + quantity > variantProduct.stock) {
          return res.status(400).json({ message: "Số lượng không đủ" });
        }
        cartItem.quantity += quantity;
      } else {
        cartItem = new Cart({ userId, productId, variantId, quantity });
      }

      await cartItem.save();
      res
        .status(200)
        .json({ message: "Thêm vào giỏ hàng thành công", cartItem });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Remove from cart
  removeFromCart: async (req, res) => {
    try {
      const { cartItemId } = req.params;
      const userId = req.user.id;

      const cartItem = await Cart.findOne({ _id: cartItemId, userId });

      if (!cartItem)
        return res
          .status(404)
          .json({ message: "Sản phẩm không tồn tại trong giỏ" });

      await Cart.deleteOne({ _id: cartItemId, userId });

      res
        .status(200)
        .json({ message: "Xóa sản phẩm khỏi giỏ hàng thành công" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Get the cart
  getCart: async (req, res) => {
    try {
      const userId = req.user.id;
      const cart = await Cart.find({ userId })
        .populate("productId", "name description category")
        .populate("variantId", "size color salePrice stock images")
        .exec();
      return res.status(200).json({ cart });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Update the cart item
  updateCartItem: async (req, res) => {
    try {
      const { cartItemId, quantity } = req.body;

      if (quantity < 1)
        return res.status(400).json({ message: "Số lượng phải >= 1" });

      const cartItem = await Cart.findById(cartItemId);
      if (!cartItem)
        return res
          .status(404)
          .json({ message: "Sản phẩm không tồn tại trong giỏ" });

      const variantProduct = await Variant.findById(cartItem.variantId);

      if (quantity > variantProduct.stock) {
        return res.status(400).json({ message: "Số lượng không đủ" });
      }

      cartItem.quantity = quantity;
      await cartItem.save();
      res.status(200).json({ message: "Cập nhật thành công", cartItem });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Clear the cart
  clearCart: async (req, res) => {
    try {
      const userId = req.user.id;
      await Cart.deleteMany({ userId });
      res.status(200).json({ message: "Đã xóa toàn bộ giỏ hàng" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Get the total price of the cart
  getCartTotal: async (req, res) => {
    try {
      const userId = req.user.id;
      const { orderItems, shippingFee = 25000, couponCode } = req.body;

      const cart = await Cart.find({ userId }).populate("variantId", "salePrice");

      const selectedItems = cart.filter((item) =>
        orderItems.includes(item._id.toString())
      );

      const total = selectedItems.reduce(
        (sum, item) => sum + item.variantId.price * item.quantity,
        0
      );

      const totalWithShipping = total + shippingFee;


      let discountAmount = 0;

      // Áp dụng coupon nếu có
      if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode });

        // Kiểm tra tồn tại
        if (!coupon) {
          return res
            .status(400)
            .json({ message: "Mã giảm giá không tồn tại." });
        }

        // Kiểm tra thời gian hiệu lực
        const now = new Date();
        if (now < coupon.validFrom || now > coupon.validUntil) {
          return res
            .status(400)
            .json({ message: "Mã giảm giá đã hết hạn hoặc chưa có hiệu lực." });
        }

        // Kiểm tra tổng số lượt dùng
        if (coupon.usedCount >= coupon.maxUses) {
          return res
            .status(400)
            .json({ message: "Mã giảm giá đã hết lượt sử dụng." });
        }

        // Kiểm tra người dùng đã dùng chưa
        const hasUsed = coupon.usersUsed.some(
          (entry) => entry.userId.toString() === userId
        );
        if (hasUsed && coupon.maxUsesPerUser <= 1) {
          return res
            .status(400)
            .json({ message: "Bạn đã sử dụng mã này rồi." });
        }

        // Kiểm tra đơn hàng đủ điều kiện
        if (total < coupon.minOrderValue) {
          return res.status(400).json({
            message: `Đơn hàng phải từ ${coupon.minOrderValue.toLocaleString()}đ mới được áp dụng mã.`,
          });
        }

        // Tính tiền giảm
        if (coupon.discountType === "percentage") {
          discountAmount = (total * coupon.discountValue) / 100;
        } else {
          discountAmount = coupon.discountValue;
        }
      }

      const finalTotal = totalWithShipping - discountAmount;

      res.status(200).json({
        total,
        shippingFee,
        totalWithShipping,
        discountAmount,
        finalTotal,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = cartController;
