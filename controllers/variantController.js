const Variant = require("../models/Variant");
const Product = require("../models/Product");
const path = require("path");
const fs = require("fs");
const upload = require("./upload");

const variantController = {
  getVariantsByProductId: async (req, res) => {
    try {
      const { productId } = req.params;
      const variants = await Variant.find({ productId });
      res.status(200).json(variants);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  addVariant: async (req, res) => {
    try {
      const { productId, size, color, importPrice, salePrice, stock } =
        req.body;

      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({ message: "Sản phẩm không tồn tại!" });
      }

      if (
        !size ||
        !color ||
        importPrice == null ||
        salePrice == null ||
        stock == null
      ) {
        return res
          .status(400)
          .json({ message: "Vui lòng điền đầy đủ thông tin!" });
      }

      const newVariant = new Variant({
        productId,
        size,
        color,
        importPrice,
        salePrice,
        stock,
        images: [],
      });

      await newVariant.save();

      await Product.findByIdAndUpdate(productId, {
        $push: {
          variants: newVariant._id,
          history: {
            field: "variant",
            action: "add",
            oldValue: null,
            newValue: {
              variantId: newVariant._id,
              size,
              color,
              importPrice,
              salePrice,
              stock,
            },
            changedAt: new Date(),
          },
        },
      });

      res
        .status(201)
        .json({ message: "Thêm biến thể thành công!", newVariant });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  updateVariant: async (req, res) => {
    try {
      const { id } = req.params; // ID của variant
      const { size, color, importPrice, salePrice, stock } = req.body;

      const variant = await Variant.findById(id);
      if (!variant) {
        return res.status(404).json({ message: "Biến thể không tồn tại!" });
      }

      if (
        !size ||
        !color ||
        importPrice == null ||
        salePrice == null ||
        stock == null
      ) {
        return res
          .status(400)
          .json({ message: "Vui lòng điền đầy đủ thông tin!" });
      }

      // Lưu dữ liệu cũ để ghi vào lịch sử
      const oldData = {
        size: variant.size,
        color: variant.color,
        importPrice: variant.importPrice,
        salePrice: variant.salePrice,
        stock: variant.stock,
      };

      // Cập nhật biến thể
      await Variant.findByIdAndUpdate(id, {
        size,
        color,
        importPrice,
        salePrice,
        stock,
      });

      // Lưu lịch sử cập nhật vào `Product`
      await Product.findByIdAndUpdate(variant.productId, {
        $push: {
          history: {
            field: "variant",
            action: "update",
            oldValue: oldData,
            newValue: { size, color, importPrice, salePrice, stock },
            changedAt: new Date(),
          },
        },
      });

      res.status(200).json({ message: "Cập nhật biến thể thành công!" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  deleteVariant: async (req, res) => {
    try {
      const variant = await Variant.findById(req.params.id);
      if (!variant) {
        return res.status(404).json({ message: "Không tìm thấy biến thể!" });
      }

      // Xóa tất cả ảnh trong thư mục uploads nếu variant có images
      if (Array.isArray(variant.images) && variant.images.length > 0) {
        variant.images.forEach((imageUrl) => {
          const imagePath = path.join(
            __dirname,
            "../uploads",
            path.basename(imageUrl)
          );
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`✅ Đã xóa ảnh: ${imagePath}`);
          } else {
            console.log(`⚠️ Không tìm thấy ảnh: ${imagePath}`);
          }
        });
      }

      // Xóa biến thể khỏi database
      await Variant.findByIdAndDelete(req.params.id);

      res.status(200).json({ message: "Xóa biến thể thành công!" });
    } catch (error) {
      console.error("❌ Lỗi khi xóa biến thể:", error);
      res.status(500).json({ error: error.message });
    }
  },
  uploadImages: async (req, res) => {
    try {
      const variantId = req.params.id;
      const imagePath = `/uploads/${req.file.filename}`; // Đường dẫn ảnh

      // Cập nhật biến thể với ảnh mới
      const variant = await Variant.findByIdAndUpdate(
        variantId,
        { $push: { images: imagePath } },
        { new: true }
      );

      if (!variant) {
        return res.status(404).json({ message: "Không tìm thấy biến thể" });
      }

      // Ghi lịch sử vào Product
      await Product.findByIdAndUpdate(variant.productId, {
        $push: {
          history: {
            field: "variant",
            action: "add",
            oldValue: null, // Không có giá trị cũ
            newValue: imagePath, // Giá trị mới là ảnh mới thêm
            changedAt: new Date(),
          },
        },
      });

      res.json({ message: "Ảnh đã được thêm!", variant });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },
  deleteImage: async (req, res) => {
    try {
      const { variantId, imageUrl } = req.body;

      // Tìm biến thể và sản phẩm chứa biến thể đó
      const variant = await Variant.findById(variantId);
      if (!variant) {
        return res.status(404).json({ message: "Không tìm thấy biến thể!" });
      }

      const product = await Product.findOne({ variants: variantId });
      if (!product) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy sản phẩm chứa biến thể!" });
      }

      // Kiểm tra ảnh có tồn tại trong danh sách không
      if (!variant.images.includes(imageUrl)) {
        return res
          .status(400)
          .json({ message: "Ảnh không tồn tại trong biến thể!" });
      }

      // Thêm lịch sử vào product.history
      product.history.push({
        field: "variant",
        action: "delete-image",
        oldValue: imageUrl,
        newValue: null,
        changedAt: new Date(),
      });

      // Xóa ảnh khỏi biến thể
      variant.images = variant.images.filter((img) => img !== imageUrl);
      await variant.save();
      await product.save(); // Lưu thay đổi lịch sử vào product

      // Xác định đường dẫn ảnh trên server
      let imagePath = path.join(__dirname, "..", imageUrl);
      if (!fs.existsSync(imagePath)) {
        imagePath = path.join(__dirname, "../public", imageUrl);
      }

      // Kiểm tra và xóa ảnh
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
          console.log("✅ Xóa ảnh thành công!");
        } catch (unlinkError) {
          console.error("❌ Lỗi khi xóa file:", unlinkError);
          return res
            .status(500)
            .json({ message: "Lỗi khi xóa file!", error: unlinkError.message });
        }
      } else {
        console.log("⚠️ Không tìm thấy ảnh trên server!");
      }

      res.json({ success: true, message: "Xóa ảnh thành công!" });
    } catch (error) {
      console.error("❌ Lỗi khi xóa ảnh:", error);
      return res
        .status(500)
        .json({ message: "Lỗi server khi xóa ảnh!", error: error.message });
    }
  },
  getColorVariant: async (req, res) => {
    try {
      const variants = await Variant.find({}, "color"); // Chỉ lấy trường 'color'

      // Lọc danh sách màu từ variants và loại bỏ giá trị trùng lặp
      const colors = [...new Set(variants.map((variant) => variant.color))];

      res.status(200).json({ colors });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  getSizeVariant: async (req, res) => {
    try {
      const variants = await Variant.find({}, "size"); // Chỉ lấy trường 'color'

      // Lọc danh sách màu từ variants và loại bỏ giá trị trùng lặp
      const sizes = [...new Set(variants.map((variant) => variant.size))];

      res.status(200).json({ sizes });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = variantController;
