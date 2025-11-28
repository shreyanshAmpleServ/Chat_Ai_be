const jwt = require("jsonwebtoken");
require("dotenv").config();
const jwtSecret = process.env.JWT_SECRET;
const userModel = require("../models/userModel"); // Import your user model to fetch user details from DB or cache

function cleanSpaces(str) {
  if (typeof str !== "string") return str;
  return str.trim();
}
const authenticateToken = async (req, res, next) => {
  // const token = req.cookies?.authToken; // Get the token from the cookie
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  // console.log("Authenticating token:", token);
  if (!token) {
    return res.error("Access denied. No token provided.", 403); // Using res.error for error response
  }

  try {
    const decoded = jwt.verify(token, jwtSecret); // Decode the JWT token
    const userId = decoded.userId; // Extract userId from the decoded token

    // Fetch the user from the database or cache using the userId
    const user = await userModel.findUserById(userId); // This assumes a `findUserById` method in your user model

    if (!user) {
      return res.error("User not found", 403); // Using res.error for user not found
    }
    req.token = token;
    if (user.db_api) {
      req.user = { id: user.id, email: user.email, db_api: user.db_api };
    } else {
      req.user = { id: user.id, email: user.email };
    }
    // ✅ OPTIMIZED: Get or reuse existing connection
    // req.dbConnection = connectionPool.getOrCreateConnection(
    //   decoded.userId,
    //   decoded.dbConfig.kind,
    //   decoded.dbConfig
    // );

    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    return res.error(
      error.message || "Invalid or expired token",
      error.status || 403
    ); // Using res.error for invalid token
  }
};
const authenticateAiToken = async (req, res, next) => {
  // const token = req.cookies?.authToken; // Get the token from the cookie
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.error("Access denied. No token provided.", 403); // Using res.error for error response
  }

  try {
    const decoded = jwt.verify(token, jwtSecret); // Decode the JWT token
    const userId = decoded.userId; // Extract userId from the decoded token

    // Fetch the user from the database or cache using the userId
    const user = await userModel.findUserById(userId); // This assumes a `findUserById` method in your user model

    if (!user) {
      return res.error("User not found", 403); // Using res.error for user not found
    }

    req.user = { id: user.id, email: user.email };
    // ✅ OPTIMIZED: Get or reuse existing connection
    // req.dbConnection = connectionPool.getOrCreateConnection(
    //   decoded.userId,
    //   decoded.dbConfig.kind,
    //   decoded.dbConfig
    // );
    req.dbConfig = {
      kind: cleanSpaces(user?.databaseType) ?? "mssql",
      host: cleanSpaces(user?.databaseHost) ?? "SAP10",
      server: cleanSpaces(user?.server) ?? "SAP10",
      port: cleanSpaces(user?.databasePort) ?? 1433,
      user: cleanSpaces(user?.databaseUsername) ?? "sa",
      username: cleanSpaces(user?.databaseUsername) ?? "sa",
      password: cleanSpaces(user?.databasePassword) ?? "SQL@2020",
      database: cleanSpaces(user?.databaseName) ?? "SBO_SM_2020ForFM40",
      ssl: false,
      encrypt: false,
      trustServerCertificate:
        cleanSpaces(user?.trust_server_certificate) ?? true,
    };

    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    return res.error(
      error.message || "Invalid or expired token",
      error.status || 403
    ); // Using res.error for invalid token
  }
};

module.exports = { authenticateToken, authenticateAiToken };
