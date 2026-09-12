const db = require("../config/db");

const getDashboardStats = async (req, res) => {
  try {
    const [projectResult] = await db.execute(
      `SELECT COUNT(DISTINCT project_id) AS projectCount
       FROM project_members
       WHERE user_id = ? AND member_status = 'ACTIVE'`,
      [req.user.userId]
    );

    const [sprintResult] = await db.execute(
      `SELECT COUNT(DISTINCT s.sprint_id) AS activeSprintCount
       FROM sprints s
       INNER JOIN project_members pm ON s.project_id = pm.project_id
       WHERE pm.user_id = ?
         AND pm.member_status = 'ACTIVE'
         AND s.status = 'ACTIVE'`,
      [req.user.userId]
    );

    const [assignedResult] = await db.execute(
      `SELECT COUNT(task_id) AS tasksAssignedCount
       FROM tasks
       WHERE assigned_to = ?`,
      [req.user.userId]
    );

    const [completedResult] = await db.execute(
      `SELECT COUNT(task_id) AS tasksCompletedCount
       FROM tasks
       WHERE assigned_to = ? AND status = 'COMPLETED'`,
      [req.user.userId]
    );

    return res.status(200).json({
      success: true,
      message: `Welcome to your student dashboard, ${req.user.name}!`,
      user: req.user,
      stats: {
        projectCount: projectResult[0].projectCount,
        activeSprintCount: sprintResult[0].activeSprintCount,
        tasksAssignedCount: assignedResult[0].tasksAssignedCount,
        tasksCompletedCount: completedResult[0].tasksCompletedCount
      }
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load dashboard statistics."
    });
  }
};

module.exports = {
  getDashboardStats
};