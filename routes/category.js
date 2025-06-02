const categoryController = require("../controllers/categoryController");
const middlewareController = require("../controllers/middlewareController");

const route = require("express").Router();

// Add category
route.post(
  "/add-category",
  middlewareController.verifyTokenAndAdmin,
  categoryController.addCategory
);

// Get all categories
route.get(
  "/",
  middlewareController.verifyToken,
  categoryController.getAllCategories
);

// Update category
route.put(
  "/update-category/:id",
  middlewareController.verifyTokenAndAdmin,
  categoryController.updateCategory
);

// Delete category
route.delete(
  "/delete-category/:id",
  middlewareController.verifyTokenAndAdmin,
  categoryController.deleteCategory
);

module.exports = route;
