const path = require("path");
const multer = require("multer");
const db = require("../config/db");
const {
  uploadFileToS3,
  getFileFromS3,
  deleteFileFromS3
} = require("../config/s3Service");
const { logActivity } = require("../models/activityModel");
const {
  createFileRecord,
  getFilesByProject,
  getFileById
} = require("../models/fileModel");

const upload = multer({
  storage: multer.memoryStorage(),
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

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid project ID is required."
    });
  }

  let s3ObjectKey;
  let fileRecordCreated = false;

  try {
    const isMember = await verifyProjectMembership(projectId, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    ({ s3ObjectKey } = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      projectId
    ));

    const fileId = await createFileRecord({
      projectId,
      uploadedBy: req.user.userId,
      fileName: req.file.originalname,
      s3ObjectKey,
      fileSize: req.file.size
    });
    fileRecordCreated = true;

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
    if (s3ObjectKey && !fileRecordCreated) {
      try {
        await deleteFileFromS3(s3ObjectKey);
      } catch (cleanupError) {
        console.error("Unable to clean up S3 upload:", cleanupError);
      }
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

    if (file.s3_object_key.startsWith("uploads/")) {
      const absolutePath = path.resolve(__dirname, "..", file.s3_object_key);
      const uploadsRoot = path.resolve(__dirname, "..", "uploads") + path.sep;

      if (!absolutePath.startsWith(uploadsRoot)) {
        return res.status(400).json({
          success: false,
          message: "Invalid file location."
        });
      }

      return res.download(absolutePath, file.file_name, (error) => {
        if (error && !res.headersSent) {
          console.error("Download legacy local file error:", error);
          res.status(404).json({
            success: false,
            message: "File does not exist on disk."
          });
        }
      });
    }

    const s3Object = await getFileFromS3(file.s3_object_key);
    if (s3Object.ContentType) {
      res.type(s3Object.ContentType);
    }
    res.attachment(file.file_name);
    s3Object.Body.on("error", (error) => {
      console.error("S3 file stream error:", error);
      res.destroy(error);
    });
    return s3Object.Body.pipe(res);
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
