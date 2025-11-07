const express = require("express");
const authRoutesv1 = require("../v1/routes/authRoutes");
const chatHistory = require("../v1/routes/chatHistory");
const dbConnectionExecution = require("../v1/routes/dbConnectionExecution");

const router = express.Router();

// Version 1 API
router.use("/v1", authRoutesv1); // Base path: /v1
router.use("/v1", chatHistory); // Base path: /v1
router.use("/v1", dbConnectionExecution); // Base path: /v1

module.exports = router;
