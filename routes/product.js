const middlewareController = require("../controllers/middlewareController");
const productController = require("../controllers/productController");

const router = require("express").Router();

// Add product
router.post(
  "/add-product",
  middlewareController.verifyTokenAndAdmin,
  productController.addProduct
);

// Get all products
router.get(
  "/",
  middlewareController.verifyToken,
  productController.getAllProducts
);
// Get all products
router.get(
  "/getAllProductsForAdmin",
  middlewareController.verifyTokenAndAdmin,
  productController.getAllProductsForAdmin
);

// Get detail products
router.get(
  "/check-edit/:id",
  middlewareController.verifyTokenAndAdmin,
  productController.checkEditProduct
);

// Get detail products
router.get(
  "/product-detail/:id",
  middlewareController.verifyToken,
  productController.getProductDetail
);

// Update product
router.post(
  "/update-product/:id",
  middlewareController.verifyTokenAndAdmin,
  productController.updateProduct
);

// Delete product
router.post(
  "/hide-product/:id",
  middlewareController.verifyTokenAndAdmin,
  productController.hideProduct
);

// Tìm kiếm sản phẩm với bộ lọc theo từ khóa, danh mục, giá, đánh giá
router.get(
  "/search",
  middlewareController.verifyToken,
  productController.searchProducts
);

module.exports = router;
