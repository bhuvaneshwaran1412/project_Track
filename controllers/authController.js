const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminInitiateAuthCommand } = require("@aws-sdk/client-cognito-identity-provider");

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "ap-southeast-2" });

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

    // Sync with Cognito
    if (process.env.COGNITO_USER_POOL_ID) {
      try {
        await cognitoClient.send(new AdminCreateUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username: cleanEmail,
          UserAttributes: [
            { Name: 'email', Value: cleanEmail },
            { Name: 'email_verified', Value: 'true' }
          ],
          MessageAction: 'SUPPRESS'
        }));
        
        await cognitoClient.send(new AdminSetUserPasswordCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username: cleanEmail,
          Password: password,
          Permanent: true
        }));
      } catch (cognitoError) {
        console.error("Cognito sync failed, but local DB user created:", cognitoError);
        // We do not fail the request if Cognito fails for now, to ensure stability
      }
    }

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

    let cognitoSuccess = false;
    if (process.env.COGNITO_CLIENT_ID && process.env.COGNITO_USER_POOL_ID) {
      try {
        await cognitoClient.send(new AdminInitiateAuthCommand({
          AuthFlow: "ADMIN_NO_SRP_AUTH",
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          ClientId: process.env.COGNITO_CLIENT_ID,
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password
          }
        }));
        cognitoSuccess = true;
      } catch (cognitoError) {
        console.warn("Cognito login failed, attempting MySQL fallback...", cognitoError.name);
        // Do not return here, allow it to fall back to MySQL for old users
      }
    }

    if (!cognitoSuccess) {
      const passwordMatches = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password."
        });
      }
      
      // Optional: Since they successfully logged in via MySQL, we could sync them to Cognito here
      // But just letting them log in is enough for now.
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