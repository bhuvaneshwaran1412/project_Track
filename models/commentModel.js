const db = require("../config/db");

const addComment = async (taskId, userId, commentText) => {
  const [result] = await db.execute(
    `INSERT INTO task_comments (task_id, user_id, comment_text)
     VALUES (?, ?, ?)`,
    [Number(taskId), Number(userId), commentText.trim()]
  );

  return result.insertId;
};

const getCommentsByTask = async (taskId) => {
  const [comments] = await db.execute(
    `SELECT
      c.comment_id,
      c.task_id,
      c.user_id,
      c.comment_text,
      c.created_at,
      u.full_name AS user_name,
      u.role AS user_role
     FROM task_comments c
     INNER JOIN users u ON c.user_id = u.user_id
     WHERE c.task_id = ?
     ORDER BY c.created_at ASC`,
    [Number(taskId)]
  );

  return comments;
};

module.exports = {
  addComment,
  getCommentsByTask
};

