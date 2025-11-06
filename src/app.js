const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const routes = require("../src/routes/index");
// const responseHandler = require("../src/utils/responseMiddleware.js");
const responseHandler = require("../src/utils/responseMiddleware.js");

const cookieParser = require("cookie-parser");
// const { errorHandler } = require("../src/utils/errorMiddleware.js");
const errorHandler = require("../src/utils/errorMiddleware.js");

// const isProduction = process.env.NODE_ENV === 'production';

dotenv.config();

const app = express();

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());

app.use(express.urlencoded({ extended: true })); // Support URL-encoded bodies
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5175",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://192.168.29.90:3000",
      "http://192.168.29.74:3000",
      "http://10.160.5.101:3000",
      "http://10.160.5.101:3001",
    ], // Replace with your frontend URL
    credentials: true, // Allow cookies to be sent
  })
);

// app.use(
//   cors({
//     origin: true,
//     credentials: true,
//   })
// );
app.use(responseHandler);
app.use("/uploads", express.static("uploads"));
app.use("/api", routes);

app.use(errorHandler);

module.exports = app;
