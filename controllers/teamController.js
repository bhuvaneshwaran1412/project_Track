const db = require("../config/db");
const { logActivity } = require("../models/activityModel");

const requestToJoinProject = async (req, res) => {
  const projectCode = req.body.projectCode?.trim().toUpperCase();

  if (!projectCode) {
    return res.status(400).json({
      success: false,
      message: "Project code is required."
    });
  }

  try {
    const [projects] = await db.execute(
      `SELECT project_id, owner_id, status
       FROM projects
       WHERE project_code = ?`,
      [projectCode]
    );

    if (projects.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No project was found with this project code."
      });
    }

    const project = projects[0];

    if (project.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "This project is no longer active."
      });
    }

    if (project.owner_id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You are already the owner of this project."
      });
    }

    const [existingMember] = await db.execute(
      `SELECT project_member_id
       FROM project_members
       WHERE project_id = ? AND user_id = ?`,
      [project.project_id, req.user.userId]
    );

    if (existingMember.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this project."
      });
    }

    const [existingRequest] = await db.execute(
      `SELECT status
       FROM join_requests
       WHERE project_id = ? AND user_id = ?`,
      [project.project_id, req.user.userId]
    );

    if (existingRequest.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Your join request is already ${existingRequest[0].status.toLowerCase()}.`
      });
    }

    await db.execute(
      `INSERT INTO join_requests (project_id, user_id)
       VALUES (?, ?)`,
      [project.project_id, req.user.userId]
    );

    return res.status(201).json({
      success: true,
      message: "Join request sent to the project owner."
    });
  } catch (error) {
    console.error("Join request error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send the join request."
    });
  }
};

const getProjectMembers = async (req, res) => {
  const projectId = Number(req.params.projectId);

  try {
    const [membership] = await db.execute(
      `SELECT project_member_id
       FROM project_members
       WHERE project_id = ? AND user_id = ? AND member_status = 'ACTIVE'`,
      [projectId, req.user.userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project."
      });
    }

    const [members] = await db.execute(
      `SELECT
        u.user_id,
        u.full_name,
        u.registration_number,
        u.email,
        pm.project_role,
        pm.joined_date
       FROM project_members pm
       INNER JOIN users u ON pm.user_id = u.user_id
       WHERE pm.project_id = ? AND pm.member_status = 'ACTIVE'
       ORDER BY pm.joined_date ASC`,
      [projectId]
    );

    return res.status(200).json({
      success: true,
      members
    });
  } catch (error) {
    console.error("Get team members error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load team members."
    });
  }
};

const getJoinRequests = async (req, res) => {
  const projectId = Number(req.params.projectId);

  try {
    const [projects] = await db.execute(
      `SELECT project_id
       FROM projects
       WHERE project_id = ? AND owner_id = ?`,
      [projectId, req.user.userId]
    );

    if (projects.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only the project owner can view join requests."
      });
    }

    const [requests] = await db.execute(
      `SELECT
        jr.request_id,
        jr.status,
        jr.created_at,
        u.full_name,
        u.registration_number,
        u.email,
        u.department,
        u.year_of_study
       FROM join_requests jr
       INNER JOIN users u ON jr.user_id = u.user_id
       WHERE jr.project_id = ? AND jr.status = 'PENDING'
       ORDER BY jr.created_at ASC`,
      [projectId]
    );

    return res.status(200).json({
      success: true,
      requests
    });
  } catch (error) {
    console.error("Get join requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load join requests."
    });
  }
};

const reviewJoinRequest = async (req, res) => {
  const projectId = Number(req.params.projectId);
  const requestId = Number(req.params.requestId);
  const action = req.body.action?.toUpperCase();

  if (!["ACCEPT", "REJECT"].includes(action)) {
    return res.status(400).json({
      success: false,
      message: "Action must be ACCEPT or REJECT."
    });
  }

  let connection;

  try {
    connection = await db.getConnection();

    const [projects] = await connection.execute(
      `SELECT project_id
       FROM projects
       WHERE project_id = ? AND owner_id = ?`,
      [projectId, req.user.userId]
    );

    if (projects.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only the project owner can review join requests."
      });
    }

    const [requests] = await connection.execute(
      `SELECT user_id, status
       FROM join_requests
       WHERE request_id = ? AND project_id = ?`,
      [requestId, projectId]
    );

    if (requests.length === 0 || requests[0].status !== "PENDING") {
      return res.status(404).json({
        success: false,
        message: "Pending join request not found."
      });
    }

    await connection.beginTransaction();

    if (action === "ACCEPT") {
      await connection.execute(
        `INSERT INTO project_members (project_id, user_id, project_role)
         VALUES (?, ?, ?)`,
        [projectId, requests[0].user_id, "Developer"]
      );
    }

    await connection.execute(
      `UPDATE join_requests
       SET status = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE request_id = ?`,
      [action === "ACCEPT" ? "ACCEPTED" : "REJECTED", requestId]
    );

    await connection.commit();

    if (action === "ACCEPT") {
      const [newMembers] = await db.execute("SELECT full_name FROM users WHERE user_id = ?", [requests[0].user_id]);
      const memberName = newMembers.length > 0 ? newMembers[0].full_name : "A new student";
      await logActivity(
        projectId,
        req.user.userId,
        "MEMBER_JOINED",
        `${memberName} joined the project team`
      );
    }

    return res.status(200).json({
      success: true,
      message: `Join request ${action === "ACCEPT" ? "accepted" : "rejected"} successfully.`
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Review join request error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to review the join request."
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  requestToJoinProject,
  getProjectMembers,
  getJoinRequests,
  reviewJoinRequest
};