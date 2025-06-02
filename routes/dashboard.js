const express = require("express");
const router = express.Router();
const middlewareController = require("../controllers/middlewareController");
const dashboardController = require("../controllers/dashboardController");
// case "delete-image":
//   fieldName = "Xóa ảnh";
//   oldValue = formatVariantHistory(h.oldValue, "delete-image");
//   newValue = "Ảnh đã bị xóa";
//   break;
// Middleware to save the current path
router.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// Go to the dashboard page
router.get(
  "/",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getDashboardPage
);

router.get(
  "/top-products",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getTopProducts
);

router.get(
  "/lookUpProductSales",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getLookUpProductSales
);

// Go to the products page
router.get(
  "/products",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getProductsPage
);

// Go to view product page
router.get(
  "/products/view/:productId",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getViewProductPage
);

// Go to the products page
router.get(
  "/categories",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getCategoriesPage
);

// Go to edit product page
router.get(
  "/products/edit/:productId",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getEditProductPage
);

// Go to users page
router.get(
  "/users",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getUsersPage
);

// Go to orders page
router.get(
  "/orders",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getOrdersPage
);

// Go to view order page
router.get(
  "/orders/view/:id",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getViewOrderPage
);

// Go to transaction page
router.get(
  "/transactions",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getTransactionPage
);

// Go to view transaction page
router.get(
  "/transactions/view/:id",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getViewTransactionPage
);

// Go to transaction page
router.get(
  "/coupons",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getCouponPage
);

// Go to view comments page
router.get(
  "/comment",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getAllComments
);

// Delete comments
router.delete(
  "/comment/delete/:commentId",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.deleteComment
);

// Reply comments
router.post(
  "/comment/reply/:commentId",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.replyComment
);

router.delete(
  "/comment/reply/:commentId/:replyId",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.deleteReply
);

router.patch(
  "/comment/reply/edit/:commentId/:replyId",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.editReply
);
router.get(
  "/chat",
  middlewareController.verifyTokenAndAdmin,
  dashboardController.getChatPage
);

router.patch(
  "/comment/hide/:commentId", 
  middlewareController.verifyTokenAndAdmin, 
  dashboardController.toggleCommentVisibility
);

// Logout
router.get("/logout", dashboardController.logout);

module.exports = router;
