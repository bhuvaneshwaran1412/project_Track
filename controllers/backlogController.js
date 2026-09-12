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

const createBacklogItem = async (req, res) => {
  const {
    projectId,
    title,
    description,
    userStory,
    priority,
    storyPoints
  } = req.body;

  const numericProjectId = Number(projectId);
  const cleanTitle = title?.trim();
  const cleanDescription = description?.trim() || null;
  const cleanUserStory = userStory?.trim() || null;
  const cleanPriority = priority?.toUpperCase();
  const points = Number(storyPoints);

  if (!numericProjectId || !cleanTitle || !cleanPriority || !points) {
    return res.status(400).json({
      success: false,
      message: "Project, title, priority, and story points are required."
    });
  }

  if (!["LOW", "MEDIUM", "HIGH"].includes(cleanPriority)) {
    return res.status(400).json({
      success: false,
      message: "Select a valid priority."
    });
  }

  if (!Number.isInteger(points) || points < 1 || points > 100) {
    return res.status(400).json({
      success: false,
      message: "Story points must be a whole number between 1 and 100."
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
      `INSERT INTO backlog_items
       (project_id, created_by, title, description, user_story, priority, story_points)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        numericProjectId,
        req.user.userId,
        cleanTitle,
        cleanDescription,
        cleanUserStory,
        cleanPriority,
        points
      ]
    );

    await logActivity(
      numericProjectId,
      req.user.userId,
      "BACKLOG_CREATED",
      `${req.user.name} added story "${cleanTitle}" (${points} pts)`
    );

    return res.status(201).json({
      success: true,
      message: "Backlog item created successfully.",
      backlogId: result.insertId
    });
  } catch (error) {
    console.error("Create backlog item error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create backlog item."
    });
  }
};

const getBacklogItems = async (req, res) => {
  const projectId = Number(req.params.projectId);

  try {
    const isMember = await verifyProjectMembership(projectId, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    const [items] = await db.execute(
      `SELECT
        b.backlog_id,
        b.sprint_id,
        b.title,
        b.description,
        b.user_story,
        b.priority,
        b.story_points,
        b.status,
        b.created_at,
        u.full_name AS created_by_name
       FROM backlog_items b
       INNER JOIN users u ON b.created_by = u.user_id
       WHERE b.project_id = ?
       ORDER BY
         CASE b.priority
           WHEN 'HIGH' THEN 1
           WHEN 'MEDIUM' THEN 2
           WHEN 'LOW' THEN 3
         END,
         b.created_at DESC`,
      [projectId]
    );

    return res.status(200).json({
      success: true,
      items
    });
  } catch (error) {
    console.error("Get backlog items error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load backlog items."
    });
  }
};

module.exports = {
  createBacklogItem,
  getBacklogItems
};