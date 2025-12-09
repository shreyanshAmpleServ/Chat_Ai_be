const chatHistoryModal = require("../models/chatHistory");

const askQuestion = async (data) => {
  return await chatHistoryModal.askQuestion(data);
};

const getChatDetail = async (id, limit, beforeId) => {
  return await chatHistoryModal.getChatDetail(id, limit, beforeId);
};
const deletChatHistory = async (id) => {
  return await chatHistoryModal.deletChatHistory(id);
};

const getChatHistory = async (
  userId,
  search,
  page,
  size,
  startDate,
  endDate,
  is_active
) => {
  return await chatHistoryModal.getChatHistory(
    userId,
    search,
    page,
    size,
    startDate,
    endDate,
    is_active
  );
};

module.exports = {
  askQuestion,
  getChatDetail,
  deletChatHistory,
  getChatHistory,
};
