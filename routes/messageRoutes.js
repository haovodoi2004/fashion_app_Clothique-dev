const express = require("express");
const router = express.Router();
const { chatController } = require("../controllers/chatController");  // Import controller

router.get("/");


module.exports = router;
