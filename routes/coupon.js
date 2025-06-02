const express = require("express");
const couponController = require("../controllers/couponController");
const middlewareController = require("../controllers/middlewareController");

const route = express.Router();

route.get("/", middlewareController.verifyToken, couponController.getAllCoupon);

route.get('/:id', middlewareController.verifyToken, couponController.getCouponDetails);

route.post(
  "/",
  middlewareController.verifyTokenAndAdmin,
  couponController.addCoupon
);

route.get(
  "/getUsersUsed/:id",
  middlewareController.verifyTokenAndAdmin,
  couponController.getUsersUsed
);

route.put(
  "/:id",
  middlewareController.verifyTokenAndAdmin,
  couponController.editCoupon
);

route.post(
  "/hideCoupon/:id",
  middlewareController.verifyTokenAndAdmin,
  couponController.hideCoupon
);

module.exports = route;
