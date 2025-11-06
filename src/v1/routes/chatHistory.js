const express = require("express");
const chatHistoryController = require("../controller/chatHistory");
const { authenticateToken } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/UploadFileMiddleware");

const router = express.Router();

router.post(
  "/ask-question",
  authenticateToken,
  // upload.single("profile_img"),
  chatHistoryController.askQuestion
); // Create a new user
router.get(
  "/chat-details/:id",
  authenticateToken,
  chatHistoryController.getChatDetail
); // Get user by ID
router.get(
  "/chat-history",
  authenticateToken,
  chatHistoryController.getChatHistory
); // Get user by email
// router.put(
//   "/users/:id",
//   authenticateToken,
//   chatHistoryController.updateUser
// ); // Update user by ID
router.delete(
  "/chat-history/:id",
  authenticateToken,
  chatHistoryController.deletChatHistory
); // Delete user by ID
// router.get("/users", authenticateToken, chatHistoryController.getAllUsers); // Get all users
// router.get("/userByToken", authenticateToken, chatHistoryController.getUserByToken); // Get users by token

module.exports = router;
