const express = require("express");
const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");
const {
  createTask,
  getTasks,
  getMyTasks,
  updateTaskStatus,
  getTaskDetails,
  getTaskComments,
  addTaskComment
} = require("../controllers/taskController");

const router = express.Router();

router.use(authenticateToken, authorizeRoles("STUDENT", "ADMIN"));

router.post("/", createTask);
router.get("/my-tasks", getMyTasks);
router.get("/details/:taskId", getTaskDetails);
router.get("/:taskId/comments", getTaskComments);
router.post("/:taskId/comments", addTaskComment);
router.patch("/:taskId/status", updateTaskStatus);
router.get("/:projectId", getTasks);

module.exports = router;