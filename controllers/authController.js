const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const registerStudent = async (req, res) => {
  const {
    fullName,
    registrationNumber,
    email,
    department,
    year,
    password,
    confirmPassword
  } = req.body;

  const cleanFullName = fullName?.trim();
  const cleanRegistrationNumber = registrationNumber?.trim().toUpperCase();
  const cleanEmail = email?.trim().toLowerCase();
  const cleanDepartment = department?.trim();
  const yearOfStudy = Number(year);

  if (
    !cleanFullName ||
    !cleanRegistrationNumber ||
    !cleanEmail ||
    !cleanDepartment ||
    !yearOfStudy ||
    !password ||
    !confirmPassword
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required."
    });
  }

  const registrationPattern = /^\d{2}[A-Z]{3}\d{4}$/;

  if (!registrationPattern.test(cleanRegistrationNumber)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid VIT registration number, for example 24MIS0167."
    });
  }

  if (!cleanEmail.endsWith("@vitstudent.ac.in")) {
    return res.status(400).json({
      success: false,
      message: "Please use your VIT student email address."
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must contain at least 6 characters."
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Password and confirm password do not match."
    });
  }

  try {
    const [existingUsers] = await db.execute(
      `SELECT user_id
       FROM users
       WHERE registration_number = ? OR email = ?`,
      [cleanRegistrationNumber, cleanEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account already exists with this registration number or email."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `INSERT INTO users
       (full_name, registration_number, email, department, year_of_study, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cleanFullName,
        cleanRegistrationNumber,
        cleanEmail,
        cleanDepartment,
        yearOfStudy,
        passwordHash
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully. You can now log in.",
      userId: result.insertId
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "An account already exists with this registration number or email."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create your account. Please try again."
    });
  }
};

const loginUser = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required."
    });
  }

  try {
    const [users] = await db.execute(
      `SELECT user_id, full_name, email, role, status, password_hash
       FROM users
       WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const user = users[0];

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Contact the administrator."
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        role: user.role,
        name: user.full_name
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.user_id,
        name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in. Please try again."
    });
  }
};

module.exports = {
  registerStudent,
  loginUser
};