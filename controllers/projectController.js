const db = require("../config/db");
const { logActivity, getRecentActivitiesByProject } = require("../models/activityModel");

const generateProjectCode = () => {
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  return `SPM-${randomNumber}`;
};

const createProject = async (req, res) => {
  const {
    projectName,
    description,
    guideName,
    startDate,
    endDate
  } = req.body;

  const cleanProjectName = projectName?.trim();
  const cleanDescription = description?.trim() || null;
  const cleanGuideName = guideName?.trim() || null;

  if (!cleanProjectName || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: "Project name, start date, and expected end date are required."
    });
  }

  if (new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({
      success: false,
      message: "Expected end date cannot be earlier than start date."
    });
  }

  let connection;

  try {
    connection = await db.getConnection();

    let projectCode;
    let codeExists = true;

    while (codeExists) {
      projectCode = generateProjectCode();

      const [existingProject] = await connection.execute(
        "SELECT project_id FROM projects WHERE project_code = ?",
        [projectCode]
      );

      codeExists = existingProject.length > 0;
    }

    await connection.beginTransaction();

    const [projectResult] = await connection.execute(
      `INSERT INTO projects
       (project_name, description, owner_id, guide_name, start_date, end_date, project_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanProjectName,
        cleanDescription,
        req.user.userId,
        cleanGuideName,
        startDate,
        endDate,
        projectCode
      ]
    );

    await connection.execute(
      `INSERT INTO project_members (project_id, user_id, project_role)
       VALUES (?, ?, ?)`,
      [projectResult.insertId, req.user.userId, "Team Lead"]
    );

    await connection.commit();

    await logActivity(
      projectResult.insertId,
      req.user.userId,
      "PROJECT_CREATED",
      `${req.user.name} created project "${cleanProjectName}" (${projectCode})`
    );

    return res.status(201).json({
      success: true,
      message: "Project created successfully.",
      project: {
        id: projectResult.insertId,
        name: cleanProjectName,
        projectCode
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Create project error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create the project. Please try again."
    });
  } finally {
    if (connection) connection.release();
  }
};

const getMyProjects = async (req, res) => {
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
        pm.project_role
      FROM projects p
      INNER JOIN project_members pm ON p.project_id = pm.project_id
      WHERE pm.user_id = ? AND pm.member_status = 'ACTIVE'
      ORDER BY p.created_at DESC`,
      [req.user.userId]
    );

    return res.status(200).json({
      success: true,
      projects
    });
  } catch (error) {
    console.error("Get projects error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load projects."
    });
  }
};

const verifyProjectMembership = async (projectId, userId) => {
  const [memberships] = await db.execute(
    `SELECT project_member_id
     FROM project_members
     WHERE project_id = ? AND user_id = ? AND member_status = 'ACTIVE'`,
    [projectId, userId]
  );

  return memberships.length > 0;
};

const getProjectProgress = async (req, res) => {
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

    const [taskStats] = await db.execute(
      `SELECT
        COUNT(*) AS totalTasks,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completedTasks,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) AS inProgressTasks,
        COUNT(CASE WHEN status = 'TODO' THEN 1 END) AS todoTasks
       FROM tasks
       WHERE project_id = ?`,
      [projectId]
    );

    const total = Number(taskStats[0].totalTasks) || 0;
    const completed = Number(taskStats[0].completedTasks) || 0;
    const inProgress = Number(taskStats[0].inProgressTasks) || 0;
    const todo = Number(taskStats[0].todoTasks) || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      progress: {
        projectId,
        totalTasks: total,
        completedTasks: completed,
        inProgressTasks: inProgress,
        todoTasks: todo,
        percentage
      }
    });
  } catch (error) {
    console.error("Get project progress error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to calculate project progress."
    });
  }
};

const getProjectActivities = async (req, res) => {
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

    const activities = await getRecentActivitiesByProject(projectId, 30);

    return res.status(200).json({
      success: true,
      activities
    });
  } catch (error) {
    console.error("Get project activities error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load project activity feed."
    });
  }
};

const getProjectAnalytics = async (req, res) => {
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

    // 1. Team member workload and contribution breakdown
    const [memberContributions] = await db.execute(
      `SELECT
        u.user_id,
        u.full_name,
        pm.project_role,
        COUNT(t.task_id) AS total_tasks,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END) AS completed_tasks,
        COUNT(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 END) AS in_progress_tasks,
        COUNT(CASE WHEN t.status = 'TODO' THEN 1 END) AS todo_tasks,
        COALESCE(SUM(CASE WHEN t.status = 'COMPLETED' THEN b.story_points ELSE 0 END), 0) AS completed_story_points
       FROM project_members pm
       INNER JOIN users u ON pm.user_id = u.user_id
       LEFT JOIN tasks t ON t.assigned_to = u.user_id AND t.project_id = pm.project_id
       LEFT JOIN backlog_items b ON t.backlog_id = b.backlog_id
       WHERE pm.project_id = ? AND pm.member_status = 'ACTIVE'
       GROUP BY u.user_id, u.full_name, pm.project_role`,
      [projectId]
    );

    // 2. Task Priority distribution
    const [priorityStats] = await db.execute(
      `SELECT
        COUNT(CASE WHEN priority = 'HIGH' THEN 1 END) AS high,
        COUNT(CASE WHEN priority = 'MEDIUM' THEN 1 END) AS medium,
        COUNT(CASE WHEN priority = 'LOW' THEN 1 END) AS low
       FROM tasks
       WHERE project_id = ?`,
      [projectId]
    );

    // 3. Sprints summary for this project
    const [sprintSummaries] = await db.execute(
      `SELECT
        s.sprint_id,
        s.sprint_name,
        s.status,
        COUNT(t.task_id) AS total_tasks,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END) AS completed_tasks,
        COALESCE(SUM(b.story_points), 0) AS total_story_points,
        COALESCE(SUM(CASE WHEN t.status = 'COMPLETED' THEN b.story_points ELSE 0 END), 0) AS completed_story_points
       FROM sprints s
       LEFT JOIN tasks t ON s.sprint_id = t.sprint_id
       LEFT JOIN backlog_items b ON t.backlog_id = b.backlog_id
       WHERE s.project_id = ?
       GROUP BY s.sprint_id, s.sprint_name, s.status
       ORDER BY s.start_date ASC`,
      [projectId]
    );

    return res.status(200).json({
      success: true,
      analytics: {
        memberContributions,
        priorityBreakdown: {
          high: Number(priorityStats[0].high) || 0,
          medium: Number(priorityStats[0].medium) || 0,
          low: Number(priorityStats[0].low) || 0
        },
        sprintSummaries
      }
    });
  } catch (error) {
    console.error("Get project analytics error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to calculate project analytics."
    });
  }
};

module.exports = {
  createProject,
  getMyProjects,
  getProjectProgress,
  getProjectActivities,
  getProjectAnalytics
};