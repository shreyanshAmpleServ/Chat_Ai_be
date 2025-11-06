const { registerUser, loginUser } = require("../services/authService");

const register = async (req, res, next) => {
  try {
    const { email, password, username = null, company } = req.body;
    console.log("Register Data :", req.body);
    const user = await registerUser(email, password, username, company);
    res.status(201).success("User registered successfully", user);
  } catch (error) {
    console.log("Auth Error", error);
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const data = await loginUser(email, password);

    // Set token in HTTP-Only cookie
    res.cookie("authToken", data.token, {
      httpOnly: true,
      secure: false, // Set `true` in production for HTTPS
      // sameSite: 'Lax',
      sameSite: "Strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // Cookie  valid for 30 days
    });
    res.status(200).success("Login successful", data);
  } catch (error) {
    console.log("Auth Error", error);
    next(error);
  }
};
const logout = (req, res, next) => {
  try {
    // Clear the authToken cookie by setting its maxAge to 0
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: false, // Set `true` in production for HTTPS
      // sameSite: 'Lax',
      sameSite: "Strict",
    });

    res.status(200).success("Logout successful", null);
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, logout };
