const express = require("express");
const router = express.Router();
const addressController = require("../controllers/addressController");
const middlewareController = require("../controllers/middlewareController");

router.get(
  "/provinces",
  middlewareController.verifyToken,
  addressController.getProvinces
);
router.get(
  "/districts",
  middlewareController.verifyToken,
  addressController.getDistrictsByProvinceId
);
router.get(
  "/wards",
  middlewareController.verifyToken,
  addressController.getWardByDistrictId
);

module.exports = router;
