const express = require("express");
const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");
const {
  createProject,
  getMyProjects,
  getProjectProgress,
  getProjectActivities,
  getProjectAnalytics
} = require("../controllers/projectController");

const router = express.Router();

router.use(authenticateToken, authorizeRoles("STUDENT", "ADMIN"));

router.post("/", createProject);
router.get("/", getMyProjects);
router.get("/:projectId/progress", getProjectProgress);
router.get("/:projectId/activities", getProjectActivities);
router.get("/:projectId/analytics", getProjectAnalytics);

module.exports = router;