const middlewareController = require("../controllers/middlewareController");
const userController = require("../controllers/userControllers");
const router = require("express").Router();
const User = require("../models/User");
// ===================== User =====================

router.get(
  "/detail/:id",
  middlewareController.verifyToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select("-password");
      if (!user) {
        return res.status(404).send("Không tìm thấy người dùng!");
      }
      res.render("userDetail", { user });
    } catch (error) {
      res.status(500).send("Lỗi server!");
    }
  }
);

router.get("/user", middlewareController.verifyToken, async (req, res) => {
  try {
    const users = await User.find().select("-password");

    const now = new Date();
    const updatedUsers = users.map((user) => {
      const lastActive = new Date(user.lastActive);
      const diffMinutes = (now - lastActive) / (1000 * 60);

      return {
        ...user.toObject(),
        status: diffMinutes < 10, // "Hoạt động" nếu hoạt động trong 10 phút gần nhất
      };
    });

    res.render("user", { users: updatedUsers });
  } catch (error) {
    res.status(500).send("Lỗi server!");
  }
});

// Get Info
router.get(
  "/info",
  middlewareController.verifyToken,
  middlewareController.updateLastActive,
  userController.getUserInfo
);

// Add address
router.post(
  "/add-address",
  middlewareController.verifyToken,
  userController.addAddress
);

// Get addresses
router.get(
  "/addresses",
  middlewareController.verifyToken,
  userController.getAddresses
);

// Remove address
router.post(
  "/remove-address",
  middlewareController.verifyToken,
  userController.removeAddress
);

// Update address
router.post(
  "/update-address",
  middlewareController.verifyToken,
  userController.updateAdress
);

// router.post(
//   "/set-default-address",
//   middlewareController.verifyToken,
//   userController.setDefaultAddress
// );

// ===================== Admin =====================
// Get all users
router.get(
  "/",
  middlewareController.verifyTokenAndAdmin,
  userController.getAllUsers
);

// Delete user
router.delete(
  "/:id",
  middlewareController.verifyTokenAndAdmin,
  userController.deleteUser
);

module.exports = router;
