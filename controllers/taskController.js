const db = require("../config/db");
const { logActivity } = require("../models/activityModel");
const { addComment, getCommentsByTask } = require("../models/commentModel");

const verifyProjectMembership = async (projectId, userId) => {
  const [memberships] = await db.execute(
    `SELECT project_member_id
     FROM project_members
     WHERE project_id = ? AND user_id = ? AND member_status = 'ACTIVE'`,
    [projectId, userId]
  );

  return memberships.length > 0;
};

const createTask = async (req, res) => {
  const {
    projectId,
    sprintId,
    backlogId,
    assignedTo,
    title,
    description,
    priority,
    deadline
  } = req.body;

  const numericProjectId = Number(projectId);
  const numericSprintId = Number(sprintId);
  const numericBacklogId = Number(backlogId);
  const numericAssignedTo = Number(assignedTo);
  const cleanTitle = title?.trim();
  const cleanDescription = description?.trim() || null;
  const cleanPriority = priority?.toUpperCase();

  if (
    !numericProjectId ||
    !numericSprintId ||
    !numericBacklogId ||
    !numericAssignedTo ||
    !cleanTitle ||
    !cleanPriority ||
    !deadline
  ) {
    return res.status(400).json({
      success: false,
      message: "All task fields are required."
    });
  }

  if (!["LOW", "MEDIUM", "HIGH"].includes(cleanPriority)) {
    return res.status(400).json({
      success: false,
      message: "Select a valid task priority."
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

    const [sprints] = await db.execute(
      `SELECT sprint_id
       FROM sprints
       WHERE sprint_id = ? AND project_id = ?`,
      [numericSprintId, numericProjectId]
    );

    if (sprints.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Selected sprint does not belong to this project."
      });
    }

    const [backlogItems] = await db.execute(
      `SELECT backlog_id
       FROM backlog_items
       WHERE backlog_id = ? AND project_id = ? AND sprint_id = ?`,
      [numericBacklogId, numericProjectId, numericSprintId]
    );

    if (backlogItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Selected backlog item does not belong to this sprint."
      });
    }

    const [assignees] = await db.execute(
      `SELECT project_member_id
       FROM project_members
       WHERE project_id = ? AND user_id = ? AND member_status = 'ACTIVE'`,
      [numericProjectId, numericAssignedTo]
    );

    if (assignees.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Selected student is not an active project member."
      });
    }

    const [result] = await db.execute(
      `INSERT INTO tasks
       (project_id, sprint_id, backlog_id, assigned_to, created_by,
        title, description, priority, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numericProjectId,
        numericSprintId,
        numericBacklogId,
        numericAssignedTo,
        req.user.userId,
        cleanTitle,
        cleanDescription,
        cleanPriority,
        deadline
      ]
    );

    await logActivity(
      numericProjectId,
      req.user.userId,
      "TASK_CREATED",
      `${req.user.name} created task "${cleanTitle}"`
    );

    return res.status(201).json({
      success: true,
      message: "Task created successfully.",
      taskId: result.insertId
    });
  } catch (error) {
    console.error("Create task error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create task."
    });
  }
};

const getTasks = async (req, res) => {
  const projectId = Number(req.params.projectId);

  try {
    const isMember = await verifyProjectMembership(projectId, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    const [tasks] = await db.execute(
      `SELECT
        t.task_id,
        t.title,
        t.description,
        t.priority,
        t.deadline,
        t.status,
        t.created_at,
        s.sprint_id,
        s.sprint_name,
        b.backlog_id,
        b.title AS backlog_title,
        u.user_id AS assigned_user_id,
        u.full_name AS assigned_to_name
       FROM tasks t
       INNER JOIN sprints s ON t.sprint_id = s.sprint_id
       INNER JOIN backlog_items b ON t.backlog_id = b.backlog_id
       INNER JOIN users u ON t.assigned_to = u.user_id
       WHERE t.project_id = ?
       ORDER BY
         CASE t.status
           WHEN 'TODO' THEN 1
           WHEN 'IN_PROGRESS' THEN 2
           WHEN 'COMPLETED' THEN 3
         END,
         t.deadline ASC`,
      [projectId]
    );

    return res.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error("Get tasks error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load tasks."
    });
  }
};
const getMyTasks = async (req, res) => {
  try {
    const [tasks] = await db.execute(
      `SELECT
        t.task_id,
        t.title,
        t.description,
        t.priority,
        t.deadline,
        t.status,
        t.created_at,
        p.project_id,
        p.project_name,
        s.sprint_name,
        b.title AS backlog_title
       FROM tasks t
       INNER JOIN projects p ON t.project_id = p.project_id
       INNER JOIN sprints s ON t.sprint_id = s.sprint_id
       INNER JOIN backlog_items b ON t.backlog_id = b.backlog_id
       WHERE t.assigned_to = ?
       ORDER BY
         CASE t.status
           WHEN 'TODO' THEN 1
           WHEN 'IN_PROGRESS' THEN 2
           WHEN 'COMPLETED' THEN 3
         END,
         t.deadline ASC`,
      [req.user.userId]
    );

    return res.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error("Get my tasks error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load your tasks."
    });
  }
};

const updateTaskStatus = async (req, res) => {
  const taskId = Number(req.params.taskId);
  const { status } = req.body;

  if (!["TODO", "IN_PROGRESS", "COMPLETED"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Select a valid task status."
    });
  }

  try {
    const [tasks] = await db.execute(
      `SELECT task_id, project_id, title, assigned_to FROM tasks WHERE task_id = ?`,
      [taskId]
    );

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    const isMember = await verifyProjectMembership(
      tasks[0].project_id,
      req.user.userId
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    await db.execute(
      `UPDATE tasks SET status = ? WHERE task_id = ?`,
      [status, taskId]
    );

    const statusLabel = status === "IN_PROGRESS" ? "In Progress" : status === "COMPLETED" ? "Completed" : "To Do";
    await logActivity(
      tasks[0].project_id,
      req.user.userId,
      "TASK_STATUS_UPDATED",
      `${req.user.name} moved task "${tasks[0].title}" to ${statusLabel}`
    );

    return res.status(200).json({
      success: true,
      message: "Task status updated."
    });
  } catch (error) {
    console.error("Update task status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update task status."
    });
  }
};

const getTaskDetails = async (req, res) => {
  const taskId = Number(req.params.taskId);

  if (!taskId) {
    return res.status(400).json({
      success: false,
      message: "Valid task ID is required."
    });
  }

  try {
    const [tasks] = await db.execute(
      `SELECT
        t.task_id,
        t.project_id,
        t.sprint_id,
        t.backlog_id,
        t.title,
        t.description,
        t.priority,
        t.deadline,
        t.status,
        t.created_at,
        p.project_name,
        s.sprint_name,
        b.title AS backlog_title,
        b.story_points,
        u.full_name AS assigned_to_name,
        creator.full_name AS created_by_name,
        (SELECT COUNT(*) FROM task_comments WHERE task_id = t.task_id) AS comments_count
       FROM tasks t
       INNER JOIN projects p ON t.project_id = p.project_id
       INNER JOIN sprints s ON t.sprint_id = s.sprint_id
       INNER JOIN backlog_items b ON t.backlog_id = b.backlog_id
       INNER JOIN users u ON t.assigned_to = u.user_id
       INNER JOIN users creator ON t.created_by = creator.user_id
       WHERE t.task_id = ?`,
      [taskId]
    );

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    const task = tasks[0];
    const isMember = await verifyProjectMembership(task.project_id, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    return res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    console.error("Get task details error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load task details."
    });
  }
};

const getTaskComments = async (req, res) => {
  const taskId = Number(req.params.taskId);

  if (!taskId) {
    return res.status(400).json({
      success: false,
      message: "Valid task ID is required."
    });
  }

  try {
    const [tasks] = await db.execute(
      `SELECT project_id FROM tasks WHERE task_id = ?`,
      [taskId]
    );

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    const isMember = await verifyProjectMembership(tasks[0].project_id, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    const comments = await getCommentsByTask(taskId);

    return res.status(200).json({
      success: true,
      comments
    });
  } catch (error) {
    console.error("Get task comments error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load task comments."
    });
  }
};

const addTaskComment = async (req, res) => {
  const taskId = Number(req.params.taskId);
  const { commentText } = req.body;

  if (!taskId || !commentText || !commentText.trim()) {
    return res.status(400).json({
      success: false,
      message: "Comment text cannot be empty."
    });
  }

  try {
    const [tasks] = await db.execute(
      `SELECT project_id, title FROM tasks WHERE task_id = ?`,
      [taskId]
    );

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    const isMember = await verifyProjectMembership(tasks[0].project_id, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    const commentId = await addComment(taskId, req.user.userId, commentText);

    await logActivity(
      tasks[0].project_id,
      req.user.userId,
      "COMMENT_ADDED",
      `${req.user.name} commented on task "${tasks[0].title}"`
    );

    return res.status(201).json({
      success: true,
      message: "Comment posted successfully.",
      commentId,
      comment: {
        comment_id: commentId,
        task_id: taskId,
        user_id: req.user.userId,
        user_name: req.user.name,
        comment_text: commentText.trim(),
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error("Add task comment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to post comment."
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getMyTasks,
  updateTaskStatus,
  getTaskDetails,
  getTaskComments,
  addTaskComment
};