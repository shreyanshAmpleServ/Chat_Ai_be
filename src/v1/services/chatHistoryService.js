const chatHistoryModal = require("../models/chatHistory");
const BCRYPT_COST = 8;
const bcrypt = require("bcryptjs");

const askQuestion = async (data) => {
  return await chatHistoryModal.askQuestion(data);
};

const getChatDetail = async (id) => {
  return await chatHistoryModal.getChatDetail(id);
};

const getChatHistory = async (
  search,
  page,
  size,
  startDate,
  endDate,
  is_active
) => {
  return await chatHistoryModal.getChatHistory(
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
  getChatHistory,
};
