const express = require("express");
const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");
const {
  upload,
  uploadFile,
  getProjectFiles,
  downloadFile
} = require("../controllers/fileController");

const router = express.Router();

router.use(authenticateToken);

router.post("/", authorizeRoles("STUDENT"), upload.single("file"), uploadFile);
router.get("/download/:fileId", downloadFile);
router.get("/:projectId", authorizeRoles("STUDENT", "ADMIN"), getProjectFiles);

module.exports = router;

