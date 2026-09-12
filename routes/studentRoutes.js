const express = require("express");
const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");
const { getDashboardStats } = require("../controllers/studentController");

const router = express.Router();

router.get(
  "/dashboard",
  authenticateToken,
  authorizeRoles("STUDENT"),
  getDashboardStats
);

module.exports = router;