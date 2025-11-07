const express = require("express");
const createConnectionController = require("../controller/dbConnection");
const { authenticateAiToken } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post(
  "/node-aiva-query",
  authenticateAiToken,
  createConnectionController
);

module.exports = router;
