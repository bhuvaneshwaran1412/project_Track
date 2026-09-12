const db = require("../config/db");

const logActivity = async (projectId, userId, actionType, description) => {
  try {
    if (!projectId || !userId || !actionType || !description) return;

    await db.execute(
      `INSERT INTO activity_logs (project_id, user_id, action_type, description)
       VALUES (?, ?, ?, ?)`,
      [Number(projectId), Number(userId), actionType, description]
    );
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};

const getRecentActivitiesByProject = async (projectId, limit = 30) => {
  const [activities] = await db.execute(
    `SELECT
      a.activity_id,
      a.project_id,
      a.user_id,
      a.action_type,
      a.description,
      a.created_at,
      u.full_name AS user_name
     FROM activity_logs a
     INNER JOIN users u ON a.user_id = u.user_id
     WHERE a.project_id = ?
     ORDER BY a.created_at DESC
     LIMIT ?`,
    [Number(projectId), String(limit)]
  );

  return activities;
};

module.exports = {
  logActivity,
  getRecentActivitiesByProject
};

