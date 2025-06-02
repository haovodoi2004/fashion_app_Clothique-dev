const express = require('express');
const favouriteController = require('../controllers/favourtieController');
const middlewareController = require('../controllers/middlewareController');
const router = express.Router();

router.post("/toggle", middlewareController.verifyToken, favouriteController.toggleFavourite);
router.get("/", middlewareController.verifyToken, favouriteController.getUserFavourites);
router.get("/check/:id", middlewareController.verifyToken, favouriteController.checkFavourite);
router.delete("/:productId", middlewareController.verifyToken, favouriteController.removeFavourite);

module.exports = router;
