const express = require("express");
const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");
const {
  createBacklogItem,
  getBacklogItems
} = require("../controllers/backlogController");

const router = express.Router();

router.use(authenticateToken, authorizeRoles("STUDENT"));

router.post("/", createBacklogItem);
router.get("/:projectId", getBacklogItems);

module.exports = router;