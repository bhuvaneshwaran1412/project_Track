const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../config/db");
const { logActivity } = require("../models/activityModel");
const {
  createFileRecord,
  getFilesByProject,
  getFileById
} = require("../models/fileModel");

// Configure disk storage for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.body.projectId || req.params.projectId || "general";
    const uploadDir = path.join(__dirname, "..", "uploads", String(projectId));

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate safe timestamped filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${uniqueSuffix}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB limit
  }
});

const verifyProjectMembership = async (projectId, userId) => {
  const [memberships] = await db.execute(
    `SELECT project_member_id
     FROM project_members
     WHERE project_id = ? AND user_id = ? AND member_status = 'ACTIVE'`,
    [projectId, userId]
  );

  return memberships.length > 0;
};

const uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please select a file to upload."
    });
  }

  const projectId = Number(req.body.projectId);

  if (!projectId) {
    // Clean up uploaded file if project ID is missing
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(400).json({
      success: false,
      message: "Valid project ID is required."
    });
  }

  try {
    const isMember = await verifyProjectMembership(projectId, req.user.userId);

    if (!isMember) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    // Store relative or normalized local path in s3_object_key
    const localKey = path.relative(path.join(__dirname, ".."), req.file.path).replace(/\\/g, "/");

    const fileId = await createFileRecord({
      projectId,
      uploadedBy: req.user.userId,
      fileName: req.file.originalname,
      s3ObjectKey: localKey,
      fileSize: req.file.size
    });

    await logActivity(
      projectId,
      req.user.userId,
      "FILE_UPLOADED",
      `${req.user.name} uploaded document "${req.file.originalname}"`
    );

    return res.status(201).json({
      success: true,
      message: "File uploaded successfully.",
      file: {
        fileId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: new Date()
      }
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Upload file error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to upload file."
    });
  }
};

const getProjectFiles = async (req, res) => {
  const projectId = Number(req.params.projectId);

  if (!projectId) {
    return res.status(400).json({
      success: false,
      message: "Valid project ID is required."
    });
  }

  try {
    const isMember = await verifyProjectMembership(projectId, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    const files = await getFilesByProject(projectId);

    return res.status(200).json({
      success: true,
      files
    });
  } catch (error) {
    console.error("Get project files error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load project files."
    });
  }
};

const downloadFile = async (req, res) => {
  const fileId = Number(req.params.fileId);

  if (!fileId) {
    return res.status(400).json({
      success: false,
      message: "Valid file ID is required."
    });
  }

  try {
    const file = await getFileById(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found."
      });
    }

    const isMember = await verifyProjectMembership(file.project_id, req.user.userId);

    if (!isMember && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to download this file."
      });
    }

    const absolutePath = path.isAbsolute(file.s3_object_key)
      ? file.s3_object_key
      : path.join(__dirname, "..", file.s3_object_key);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File does not exist on disk."
      });
    }

    return res.download(absolutePath, file.file_name);
  } catch (error) {
    console.error("Download file error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to download file."
    });
  }
};

module.exports = {
  upload,
  uploadFile,
  getProjectFiles,
  downloadFile
};

