const Category = require("../models/Category");

const categoryController = {
  // Add category
  addCategory: async (req, res) => {
    try {
      const { name } = req.body;

      if (!name) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập đầy đủ thông tin!" });
      }

      const newCategory = new Category({ name });
      await newCategory.save();

      res.status(200).json({ message: "Thêm danh mục thành công!" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Get all categories
  getAllCategories: async (req, res) => {
    try {
      const categories = await Category.find();

      res.status(200).json({ categories });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Update category
  updateCategory: async (req, res) => {
    try {
      const { name } = req.body;
      const { id } = req.params;

      if (!name) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập đầy đủ thông tin!" });
      }

      const category = await Category.findById(id);

      if (!category) {
        return res.status(404).json({ message: "Danh mục không tồn tại!" });
      }

      category.name = name;

      await category.save();

      res.status(200).json({ message: "Cập nhật danh mục thành công!" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Delete category
  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;

      const category = await Category.findById(id);

      if (!category) {
        return res.status(404).json({ message: "Danh mục không tồn tại!" });
      }

      await Category.findByIdAndDelete(id);

      res.status(200).json({ message: "Xóa danh mục thành công!" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = categoryController;