const db = require("../config/db");

const createFileRecord = async ({ projectId, uploadedBy, fileName, s3ObjectKey, fileSize }) => {
  const [result] = await db.execute(
    `INSERT INTO project_files (project_id, uploaded_by, file_name, s3_object_key, file_size)
     VALUES (?, ?, ?, ?, ?)`,
    [projectId, uploadedBy, fileName, s3ObjectKey, fileSize || 0]
  );
  return result.insertId;
};

const getFilesByProject = async (projectId) => {
  const [files] = await db.execute(
    `SELECT
      f.file_id,
      f.project_id,
      f.uploaded_by,
      f.file_name,
      f.s3_object_key,
      f.file_size,
      f.uploaded_at,
      u.full_name AS uploaded_by_name
     FROM project_files f
     INNER JOIN users u ON f.uploaded_by = u.user_id
     WHERE f.project_id = ?
     ORDER BY f.uploaded_at DESC`,
    [projectId]
  );
  return files;
};

const getFileById = async (fileId) => {
  const [files] = await db.execute(
    `SELECT
      f.file_id,
      f.project_id,
      f.uploaded_by,
      f.file_name,
      f.s3_object_key,
      f.file_size,
      f.uploaded_at,
      u.full_name AS uploaded_by_name
     FROM project_files f
     INNER JOIN users u ON f.uploaded_by = u.user_id
     WHERE f.file_id = ?`,
    [fileId]
  );
  return files[0] || null;
};

module.exports = {
  createFileRecord,
  getFilesByProject,
  getFileById
};

