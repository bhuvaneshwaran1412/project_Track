const express = require("express");
const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");
const {
  requestToJoinProject,
  getProjectMembers,
  getJoinRequests,
  reviewJoinRequest
} = require("../controllers/teamController");

const router = express.Router();

router.use(authenticateToken, authorizeRoles("STUDENT"));

router.post("/join", requestToJoinProject);
router.get("/:projectId/members", getProjectMembers);
router.get("/:projectId/requests", getJoinRequests);
router.patch("/:projectId/requests/:requestId", reviewJoinRequest);

module.exports = router;