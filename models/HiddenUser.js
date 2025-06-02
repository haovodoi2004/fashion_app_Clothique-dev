const mongoose = require("mongoose");

const HiddenUserSchema = new mongoose.Schema({
  adminId: String,
  userId: String,
});

module.exports = mongoose.model("HiddenUser", HiddenUserSchema);