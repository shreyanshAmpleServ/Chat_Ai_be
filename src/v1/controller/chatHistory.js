const chatHistoryService = require("../services/chatHistoryService");
const CustomError = require("../../utils/CustomError");
const moment = require("moment");
const {} = require("../../utils/uploadBackblaze");

const sanitizeData = (data) => {
  const { repeatPassword, role_id, ...sanitizedData } = data; // Exclude repeatPassword
  return {
    ...sanitizedData,
    role_id: role_id ? parseInt(role_id, 10) : undefined, // Convert role_id to an integer
  };
};

const askQuestion = async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string")
      return res.status(400).json({ error: "question is required" });
    const user = await chatHistoryService.askQuestion({
      ...req.body,
      userId: req.user.id,
      db_api: req.user.db_api,
      token: req.token,
    });

    // If chatHistoryService.askQuestion returns an error object, handle it here
    if (user && user.success === false) {
      return res.status(user.status || 400).json({
        success: false,
        message: user.message,
        status: user.status || 400,
      });
    }

    res.status(201).success("User created successfully", user);
  } catch (error) {
    next(error);
  }
};

const getChatDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 10, cursor = null } = req.query;
    const Chats = await chatHistoryService.getChatDetail({
      chatId: Number(id),
      limit: parseInt(limit, 10),
      cursor: cursor || null,
    });
    if (!Chats) throw new CustomError("Chats not found", 404);
    res.status(200).success(null, Chats);
  } catch (error) {
    next(error);
  }
};
const getChatHistory = async (req, res, next) => {
  try {
    const { page, size, search, startDate, endDate, is_active } = req.query;
    const users = await chatHistoryService.getChatHistory(
      Number(req.user.id),
      search,
      Number(page),
      Number(size),
      moment(startDate),
      moment(endDate),
      is_active
    );
    res.status(200).success(null, users);
  } catch (error) {
    next(error);
  }
};
const deletChatHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const users = await chatHistoryService.deletChatHistory(Number(id));
    res.status(200).success("Chat deleted successfully", true);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  askQuestion,
  getChatDetail,
  deletChatHistory,
  getChatHistory,
};
