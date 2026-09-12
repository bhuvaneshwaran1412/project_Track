const db = require("../config/db");

const getAllStudents = async (req, res) => {
  try {
    const [students] = await db.execute(
      `SELECT
        user_id,
        full_name,
        registration_number,
        email,
        department,
        year_of_study,
        role,
        status,
        created_at
       FROM users
       WHERE role = 'STUDENT'
       ORDER BY created_at DESC`
    );

    return res.status(200).json({
      success: true,
      students
    });
  } catch (error) {
    console.error("Get all students error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load students list."
    });
  }
};

const updateStudentStatus = async (req, res) => {
  const userId = Number(req.params.userId);
  const { status } = req.body;

  const cleanStatus = status?.toUpperCase();

  if (!userId || !["ACTIVE", "INACTIVE"].includes(cleanStatus)) {
    return res.status(400).json({
      success: false,
      message: "Valid student ID and status ('ACTIVE' or 'INACTIVE') are required."
    });
  }

  try {
    const [existingUsers] = await db.execute(
      `SELECT user_id, full_name, role, status FROM users WHERE user_id = ? AND role = 'STUDENT'`,
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found."
      });
    }

    await db.execute(
      `UPDATE users SET status = ? WHERE user_id = ? AND role = 'STUDENT'`,
      [cleanStatus, userId]
    );

    return res.status(200).json({
      success: true,
      message: `Student account ${cleanStatus === "ACTIVE" ? "activated" : "deactivated"} successfully.`,
      user: {
        userId,
        status: cleanStatus
      }
    });
  } catch (error) {
    console.error("Update student status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update student status."
    });
  }
};

const getAllProjects = async (req, res) => {
  try {
    const [projects] = await db.execute(
      `SELECT
        p.project_id,
        p.project_name,
        p.description,
        p.guide_name,
        p.start_date,
        p.end_date,
        p.status,
        p.project_code,
        p.created_at,
        p.owner_id,
        u.full_name AS owner_name,
        u.email AS owner_email,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.project_id AND pm.member_status = 'ACTIVE') AS member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.project_id) AS total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.project_id AND t.status = 'COMPLETED') AS completed_tasks
       FROM projects p
       INNER JOIN users u ON p.owner_id = u.user_id
       ORDER BY p.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      projects
    });
  } catch (error) {
    console.error("Get all projects error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load projects list."
    });
  }
};

const getPlatformStats = async (req, res) => {
  try {
    const [studentResult] = await db.execute(
      `SELECT
        COUNT(*) AS totalStudents,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS activeStudents
       FROM users
       WHERE role = 'STUDENT'`
    );

    const [projectResult] = await db.execute(
      `SELECT
        COUNT(*) AS totalProjects,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS activeProjects,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completedProjects
       FROM projects`
    );

    const [taskResult] = await db.execute(
      `SELECT
        COUNT(*) AS totalTasks,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completedTasks,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) AS inProgressTasks,
        COUNT(CASE WHEN status = 'TODO' THEN 1 END) AS todoTasks
       FROM tasks`
    );

    const [sprintResult] = await db.execute(
      `SELECT
        COUNT(*) AS totalSprints,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS activeSprints
       FROM sprints`
    );

    return res.status(200).json({
      success: true,
      stats: {
        totalStudents: Number(studentResult[0].totalStudents) || 0,
        activeStudents: Number(studentResult[0].activeStudents) || 0,
        totalProjects: Number(projectResult[0].totalProjects) || 0,
        activeProjects: Number(projectResult[0].activeProjects) || 0,
        completedProjects: Number(projectResult[0].completedProjects) || 0,
        totalTasks: Number(taskResult[0].totalTasks) || 0,
        completedTasks: Number(taskResult[0].completedTasks) || 0,
        inProgressTasks: Number(taskResult[0].inProgressTasks) || 0,
        todoTasks: Number(taskResult[0].todoTasks) || 0,
        totalSprints: Number(sprintResult[0].totalSprints) || 0,
        activeSprints: Number(sprintResult[0].activeSprints) || 0
      }
    });
  } catch (error) {
    console.error("Platform stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load platform statistics."
    });
  }
};

module.exports = {
  getAllStudents,
  updateStudentStatus,
  getAllProjects,
  getPlatformStats
};

