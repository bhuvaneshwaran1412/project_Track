const express = require("express");
const {
  registerStudent,
  loginUser
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", loginUser);

module.exports = router;