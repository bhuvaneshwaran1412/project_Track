const express = require("express");
const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");
const {
  createSprint,
  getSprints,
  assignBacklogItemToSprint,
  updateSprintStatus,
  getSprintBurndown
} = require("../controllers/sprintController");

const router = express.Router();

router.use(authenticateToken, authorizeRoles("STUDENT", "ADMIN"));

router.post("/", createSprint);
router.get("/:projectId", getSprints);
router.patch("/:sprintId/backlog", assignBacklogItemToSprint);
router.patch("/:sprintId/status", updateSprintStatus);
router.get("/:sprintId/burndown", getSprintBurndown);

module.exports = router;