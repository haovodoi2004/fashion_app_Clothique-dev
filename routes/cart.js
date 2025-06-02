const cartController = require("../controllers/cartController");
const middlewareController = require("../controllers/middlewareController");
const route = require("express").Router();

// Add to cart
route.post(
  "/add-to-cart",
  middlewareController.verifyToken,
  cartController.addToCart
);

// Remove from cart
route.delete(
  "/delete-cart/:cartItemId",
  middlewareController.verifyToken,
  cartController.removeFromCart
);

// Get cart
route.get(
  "/",
  middlewareController.verifyToken,
  cartController.getCart
);

// Update cart item
route.put(
  "/update-cart",
  middlewareController.verifyToken,
  cartController.updateCartItem
);

// Update cart item
route.delete(
  "/clear-cart",
  middlewareController.verifyToken,
  cartController.clearCart
);

// Get cart total
route.get(
  "/get-cart-total",
  middlewareController.verifyToken,
  cartController.getCartTotal
);

module.exports = route;