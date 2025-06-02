const route = require("express").Router();
const variantController = require("../controllers/variantController");
const middlewareController = require("../controllers/middlewareController");
const upload = require("../controllers/upload");

route.get("/:productId", middlewareController.verifyTokenAndAdmin, variantController.getVariantsByProductId);

route.post("/", middlewareController.verifyTokenAndAdmin, variantController.addVariant);

route.put("/:id", middlewareController.verifyTokenAndAdmin, variantController.updateVariant);

route.delete("/:id", middlewareController.verifyTokenAndAdmin, variantController.deleteVariant);

route.post("/upload-image/:id", middlewareController.verifyTokenAndAdmin, upload.single("image"), variantController.uploadImages);

route.post("/delete-image", variantController.deleteImage);

route.get("/get/colors", variantController.getColorVariant);

route.get("/get/sizes", variantController.getSizeVariant);

module.exports = route;