const db = require("../config/db");
const { logActivity } = require("../models/activityModel");

const verifyProjectMembership = async (projectId, userId) => {
  const [memberships] = await db.execute(
    `SELECT project_member_id
     FROM project_members
     WHERE project_id = ? AND user_id = ? AND member_status = 'ACTIVE'`,
    [projectId, userId]
  );

  return memberships.length > 0;
};

const createSprint = async (req, res) => {
  const {
    projectId,
    sprintName,
    goal,
    startDate,
    endDate
  } = req.body;

  const numericProjectId = Number(projectId);
  const cleanSprintName = sprintName?.trim();
  const cleanGoal = goal?.trim() || null;

  if (!numericProjectId || !cleanSprintName || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: "Project, sprint name, start date, and end date are required."
    });
  }

  if (new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({
      success: false,
      message: "Sprint end date cannot be earlier than the start date."
    });
  }

  try {
    const isMember = await verifyProjectMembership(
      numericProjectId,
      req.user.userId
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    const [result] = await db.execute(
      `INSERT INTO sprints
       (project_id, sprint_name, goal, start_date, end_date)
       VALUES (?, ?, ?, ?, ?)`,
      [
        numericProjectId,
        cleanSprintName,
        cleanGoal,
        startDate,
        endDate
      ]
    );

    await logActivity(
      numericProjectId,
      req.user.userId,
      "SPRINT_CREATED",
      `${req.user.name} created sprint "${cleanSprintName}"`
    );

    return res.status(201).json({
      success: true,
      message: "Sprint created successfully.",
      sprintId: result.insertId
    });
  } catch (error) {
    console.error("Create sprint error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create sprint."
    });
  }
};

const getSprints = async (req, res) => {
  const projectId = Number(req.params.projectId);

  try {
    const isMember = await verifyProjectMembership(projectId, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    const [sprints] = await db.execute(
      `SELECT
        sprint_id,
        sprint_name,
        goal,
        start_date,
        end_date,
        status,
        created_at
       FROM sprints
       WHERE project_id = ?
       ORDER BY start_date ASC`,
      [projectId]
    );

    return res.status(200).json({
      success: true,
      sprints
    });
  } catch (error) {
    console.error("Get sprints error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load sprints."
    });
  }
};

const assignBacklogItemToSprint = async (req, res) => {
  const sprintId = Number(req.params.sprintId);
  const backlogId = Number(req.body.backlogId);

  if (!sprintId || !backlogId) {
    return res.status(400).json({
      success: false,
      message: "Sprint and backlog item are required."
    });
  }

  try {
    const [sprints] = await db.execute(
      `SELECT sprint_name, project_id
       FROM sprints
       WHERE sprint_id = ?`,
      [sprintId]
    );

    if (sprints.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sprint not found."
      });
    }

    const projectId = sprints[0].project_id;
    const sprintName = sprints[0].sprint_name;

    const isMember = await verifyProjectMembership(projectId, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    const [backlogItems] = await db.execute(
      `SELECT backlog_id, title
       FROM backlog_items
       WHERE backlog_id = ? AND project_id = ?`,
      [backlogId, projectId]
    );

    if (backlogItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Backlog item does not belong to this sprint's project."
      });
    }

    await db.execute(
      `UPDATE backlog_items
       SET sprint_id = ?, status = 'IN_SPRINT'
       WHERE backlog_id = ?`,
      [sprintId, backlogId]
    );

    await logActivity(
      projectId,
      req.user.userId,
      "BACKLOG_ASSIGNED",
      `${req.user.name} assigned "${backlogItems[0].title}" to sprint "${sprintName}"`
    );

    return res.status(200).json({
      success: true,
      message: "Backlog item assigned to sprint successfully."
    });
  } catch (error) {
    console.error("Assign backlog item error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to assign backlog item to sprint."
    });
  }
};

const updateSprintStatus = async (req, res) => {
  const sprintId = Number(req.params.sprintId);
  const status = req.body.status?.toUpperCase();

  if (!["PLANNED", "ACTIVE", "COMPLETED"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid sprint status."
    });
  }

  try {
    const [sprints] = await db.execute(
      `SELECT sprint_name, project_id
       FROM sprints
       WHERE sprint_id = ?`,
      [sprintId]
    );

    if (sprints.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sprint not found."
      });
    }

    const projectId = sprints[0].project_id;
    const sprintName = sprints[0].sprint_name;

    const isMember = await verifyProjectMembership(
      projectId,
      req.user.userId
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    await db.execute(
      `UPDATE sprints
       SET status = ?
       WHERE sprint_id = ?`,
      [status, sprintId]
    );

    await logActivity(
      projectId,
      req.user.userId,
      "SPRINT_STATUS_UPDATED",
      `${req.user.name} marked sprint "${sprintName}" as ${status}`
    );

    return res.status(200).json({
      success: true,
      message: `Sprint status changed to ${status}.`
    });
  } catch (error) {
    console.error("Update sprint status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update sprint status."
    });
  }
};

const getSprintBurndown = async (req, res) => {
  const sprintId = Number(req.params.sprintId);

  if (!sprintId) {
    return res.status(400).json({
      success: false,
      message: "Valid sprint ID is required."
    });
  }

  try {
    const [sprints] = await db.execute(
      `SELECT sprint_id, project_id, sprint_name, goal, start_date, end_date, status
       FROM sprints
       WHERE sprint_id = ?`,
      [sprintId]
    );

    if (sprints.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sprint not found."
      });
    }

    const sprint = sprints[0];
    const isMember = await verifyProjectMembership(sprint.project_id, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    // Get all backlog items in this sprint
    const [backlogItems] = await db.execute(
      `SELECT backlog_id, title, story_points, status
       FROM backlog_items
       WHERE sprint_id = ?`,
      [sprintId]
    );

    // Get all tasks in this sprint
    const [tasks] = await db.execute(
      `SELECT t.task_id, t.title, t.status, t.created_at, b.story_points
       FROM tasks t
       LEFT JOIN backlog_items b ON t.backlog_id = b.backlog_id
       WHERE t.sprint_id = ?`,
      [sprintId]
    );

    const totalStoryPoints = backlogItems.reduce((sum, item) => sum + (Number(item.story_points) || 0), 0);
    const totalTasks = tasks.length;

    // Generate date range
    const start = new Date(sprint.start_date);
    const end = new Date(sprint.end_date);
    const dateLabels = [];
    const idealBurn = [];
    const actualBurn = [];

    const dayDiff = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const pointsBaseline = totalStoryPoints > 0 ? totalStoryPoints : Math.max(1, totalTasks);

    const completedTasksCount = tasks.filter((t) => t.status === "COMPLETED").length;
    const completedStoryPoints = tasks
      .filter((t) => t.status === "COMPLETED")
      .reduce((sum, t) => sum + (Number(t.story_points) || 1), 0);

    const remainingPointsNow = Math.max(0, pointsBaseline - (totalStoryPoints > 0 ? completedStoryPoints : completedTasksCount));

    for (let i = 0; i <= dayDiff; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const label = currentDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      dateLabels.push(label);

      // Ideal line linear descent
      const idealRemaining = Math.max(0, Math.round((pointsBaseline - (i * (pointsBaseline / dayDiff))) * 10) / 10);
      idealBurn.push(idealRemaining);

      // Actual line
      const today = new Date();
      if (currentDate <= today || sprint.status === "COMPLETED") {
        if (i === dayDiff && sprint.status === "COMPLETED") {
          actualBurn.push(0);
        } else if (i === 0) {
          actualBurn.push(pointsBaseline);
        } else {
          const progressFactor = Math.min(1, i / Math.max(1, dayDiff));
          const currentActual = Math.max(0, Math.round((pointsBaseline - ((pointsBaseline - remainingPointsNow) * progressFactor)) * 10) / 10);
          actualBurn.push(currentActual);
        }
      }
    }

    return res.status(200).json({
      success: true,
      burndown: {
        sprintId: sprint.sprint_id,
        sprintName: sprint.sprint_name,
        startDate: sprint.start_date,
        endDate: sprint.end_date,
        status: sprint.status,
        totalStoryPoints,
        totalTasks,
        completedTasks: completedTasksCount,
        metricType: totalStoryPoints > 0 ? "Story Points" : "Tasks",
        dateLabels,
        idealBurn,
        actualBurn
      }
    });
  } catch (error) {
    console.error("Get sprint burndown error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to calculate sprint burndown."
    });
  }
};

module.exports = {
  createSprint,
  getSprints,
  assignBacklogItemToSprint,
  updateSprintStatus,
  getSprintBurndown
};