const Product = require("../models/Product");
const Variant = require("../models/Variant");
const OrderItem = require("../models/OrderItem");
const socket = require("../controllers/notificationController");
const productController = {
  // Add product
  addProduct: async (req, res) => {
    try {
      const { name, description, category } = req.body;

      if (!name || !description || !category) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập đầy đủ thông tin!" });
      }

      const newPoduct = new Product({
        name,
        description,
        category,
        variants: [],
      });

      await newPoduct.save();

      res.status(201).json({ message: "Thêm sản phẩm thành công!", newPoduct });
      socket.sendNotificationForUser("admin", {
        type: "product",
        message: `Sản phẩm mới: ${newPoduct.name} đã được thêm thành công!`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Get all products
  getAllProducts: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const products = await Product.find({ isHidden: false })
        .sort({ createdAt: -1 })
        .populate("category", "name")
        .populate({
          path: "variants",
          select: "size color salePrice stock images", // Chỉ lấy salePrice, không lấy importPrice
        })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Product.countDocuments({ isHidden: false });

      res.status(200).json({
        products,
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Get all products for admin
  getAllProductsForAdmin: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const outOfStock = req.query.outOfStock === "true";
      const noVariants = req.query.noVariants === "true";
      const keyword = req.query.keyword || "";
      const category = req.query.category || "";
      const visibility = req.query.visibility || ""; // nếu cần
      const sortBy = req.query.sortBy || "desc";
      const sortOrder = sortBy === "asc" ? 1 : -1;

      const query = {};

      if (outOfStock) {
        query["variants.stock"] = { $lte: 0 };
      }

      if (noVariants) {
        query.$expr = { $eq: [{ $size: "$variants" }, 0] };
      }

      if (keyword) {
        query.name = { $regex: keyword, $options: "i" };
      }

      if (category) {
        query.category = category; // Lưu ý: category cần là ObjectId nếu populate
      }

      if (visibility === "visible") {
        query.isHidden = false;
      } else if (visibility === "hidden") {
        query.isHidden = true;
      }

      const totalCount = await Product.countDocuments(query);
      const products = await Product.find(query)
        .sort({ createdAt: sortOrder })
        .populate("category")
        .populate({
          path: "variants",
          select:
            "size color importPrice salePrice stock soldQuantity images createdAt updatedAt",
        })
        .lean()
        .skip((page - 1) * limit)
        .limit(limit);

      res.json({
        products,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Update product
  updateProduct: async (req, res) => {
    try {
      const { name, description, category } = req.body;
      const { id } = req.params;

      if (!name || !description || !category) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập đầy đủ thông tin!" });
      }

      // Lấy dữ liệu sản phẩm cũ trước khi cập nhật
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ message: "Sản phẩm không tồn tại!" });
      }

      // Tạo danh sách lịch sử thay đổi
      const historyUpdates = [];
      if (name !== product.name) {
        historyUpdates.push({
          field: "name",
          action: "update",
          oldValue: product.name,
          newValue: name,
          changedAt: new Date(),
        });
      }
      if (description !== product.description) {
        historyUpdates.push({
          field: "description",
          action: "update",
          oldValue: product.description,
          newValue: description,
          changedAt: new Date(),
        });
      }
      if (category !== product.category.toString()) {
        historyUpdates.push({
          field: "category",
          action: "update",
          oldValue: product.category,
          newValue: category,
          changedAt: new Date(),
        });
      }

      // Nếu có thay đổi, lưu vào lịch sử
      if (historyUpdates.length > 0) {
        await Product.findByIdAndUpdate(id, {
          name,
          description,
          category,
          $push: { history: { $each: historyUpdates } }, // Thêm vào mảng history
        });
      } else {
        await Product.findByIdAndUpdate(id, { name, description, category });
      }

      res.redirect("/v1/dashboard/products");
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Hidden product
  hideProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const hide = req.body.hide ?? true; // true để ẩn, false để hiện lại

      const product = await Product.findById(id);
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy sản phẩm" });
      }

      // Nếu trạng thái không thay đổi thì không làm gì cả
      if (product.isHidden === hide) {
        return res
          .status(400)
          .json({ success: false, message: "Trạng thái không thay đổi" });
      }

      // Tạo thông tin lịch sử
      const action = hide ? "Ẩn sản phẩm" : "Hiện sản phẩm";
      const historyEntry = {
        field: "isHidden",
        action: "update",
        oldValue: hide ? "Hiển thị" : "Đã ẩn",
        newValue: hide ? "Đã ẩn" : "Hiển thị",
        changedAt: new Date(),
      };

      // Cập nhật sản phẩm và đẩy lịch sử
      await Product.findByIdAndUpdate(id, {
        $set: { isHidden: hide },
        $push: { history: historyEntry },
      });

      res.json({ success: true, message: `${action} thành công!` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Lỗi server" });
    }
  },
  // Get product detail
  getProductDetail: async (req, res) => {
    try {
      const { id } = req.params;

      const product = await Product.findById(id)
        .populate("category", "name")
        .populate({
          path: "variants",
          select: "size color price stock images",
        })
        .lean();

      if (!product) {
        return res.status(404).json({ message: "Sản phẩm không tồn tại!" });
      }

      res.status(200).json(product);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Tìm kiếm sản phẩm theo các tiêu chí (bao gồm variants)
  searchProducts: async (req, res) => {
    try {
      const mongoose = require("mongoose");
      const {
        keyword,
        categoryId,
        minPrice,
        maxPrice,
        minRating,
        size,
        color,
        stock,
      } = req.query;

      let filter = {};
      let variantFilter = {};
      let isFilteringVariants = false;

      if (keyword) {
        filter.name = { $regex: keyword, $options: "i" };
      }

      if (categoryId) {
        filter.category = new mongoose.Types.ObjectId(categoryId);
      }

      if (size) {
        variantFilter.size = { $regex: `^${size.trim()}$`, $options: "i" };
        isFilteringVariants = true;
      }
      if (color) {
        variantFilter.color = { $regex: `^${color.trim()}$`, $options: "i" };
        isFilteringVariants = true;
      }
      if (stock) {
        variantFilter.stock = { $gte: parseInt(stock) };
        isFilteringVariants = true;
      }
      if (minPrice || maxPrice) {
        variantFilter.price = {};
        if (minPrice) variantFilter.price.$gte = parseFloat(minPrice);
        if (maxPrice) variantFilter.price.$lte = parseFloat(maxPrice);
        isFilteringVariants = true;
      }

      let productIds = [];

      if (isFilteringVariants) {
        const variants = await Variant.find(
          variantFilter,
          "productId _id"
        ).lean();

        productIds = variants.map((variant) => variant.productId);

        if (productIds.length === 0) {
          return res.json([]);
        }

        filter._id = { $in: productIds };
      }

      const products = await Product.find(filter)
        .populate({
          path: "variants",
          match: isFilteringVariants ? variantFilter : {},
        })
        .populate("category", "name");

      res.json(products);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Lỗi server!" });
    }
  },
  checkEditProduct: async (req, res) => {
    try {
      const productId = req.params.id;
      // Kiểm tra xem có OrderItem nào chứa product này không
      const item = await OrderItem.findOne({ productId });

      if (item) {
        return res.json({ canEdit: false });
      }

      res.json({ canEdit: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ canEdit: false, error: "Server error" });
    }
  },
};

module.exports = productController;
