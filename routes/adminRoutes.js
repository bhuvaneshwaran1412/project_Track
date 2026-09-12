const express = require("express");
const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");
const {
  getAllStudents,
  updateStudentStatus,
  getAllProjects,
  getPlatformStats
} = require("../controllers/adminController");

const router = express.Router();

// Restrict entire admin router strictly to ADMIN role
router.use(authenticateToken, authorizeRoles("ADMIN"));

router.get("/stats", getPlatformStats);
router.get("/students", getAllStudents);
router.patch("/students/:userId/status", updateStudentStatus);
router.get("/projects", getAllProjects);

module.exports = router;

