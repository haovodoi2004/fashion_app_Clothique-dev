const route = require("express").Router();
const orderController = require("../controllers/orderController");
const middlewareController = require("../controllers/middlewareController");

// Create a new order
route.post(
  "/createOrder",
  middlewareController.verifyToken,
  orderController.createOrder
);

// Get all orders
route.get(
  "/getAllOrders",
  middlewareController.verifyToken,
  orderController.getAllOrders
);

// Get order detail
route.get(
  "/getOrderDetail/:orderId",
  middlewareController.verifyToken,
  orderController.getOrderDetail
);

// Cancel an order
route.post(
  "/cancelOrder",
  middlewareController.verifyToken,
  orderController.cancelOrder
);

// Confirm an order
route.post(
  "/confirmOrder/:orderId",
  middlewareController.verifyToken,
  orderController.confirmOrder
);

// Get all orders for admin
route.get(
  "/getAllOrdersAdmin",
  middlewareController.verifyTokenAndAdmin,
  orderController.getAllOrdersForAdmin
);

// Update GHN status
route.post(
  "/updateOrderStatus/:id",
  middlewareController.verifyTokenAndAdmin,
  orderController.updateOrderStatus
);

// Pay with MoMo
route.post(
  "/momo",
  middlewareController.verifyToken,
  orderController.payWithMoMo
);

module.exports = route;
