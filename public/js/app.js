const formMessage = document.getElementById("formMessage");

function showMessage(type, message) {
  if (!formMessage) return;

  formMessage.innerHTML = `
    <div class="alert alert-${type}" role="alert">
      ${message}
    </div>
  `;
}

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!registerForm.checkValidity()) {
      registerForm.classList.add("was-validated");
      return;
    }

    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
      showMessage("danger", "Password and confirm password must match.");
      return;
    }

    const submitButton = registerForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Creating account...";

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: document.getElementById("fullName").value,
          registrationNumber: document.getElementById("registrationNumber").value,
          email: document.getElementById("email").value,
          department: document.getElementById("department").value,
          year: document.getElementById("year").value,
          password,
          confirmPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage("danger", data.message || "Registration failed.");
        return;
      }

      showMessage("success", data.message);
      registerForm.reset();
      registerForm.classList.remove("was-validated");
    } catch (error) {
      showMessage("danger", "Cannot connect to the server. Please try again.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Create Account";
    }
  });
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!loginForm.checkValidity()) {
      loginForm.classList.add("was-validated");
      return;
    }

    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Logging in...";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: document.getElementById("email").value,
          password: document.getElementById("password").value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage("danger", data.message || "Login failed.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      if (data.user.role === "ADMIN") {
        window.location.href = "admin-dashboard.html";
      } else {
        window.location.href = "student-dashboard.html";
      }
    } catch (error) {
      showMessage("danger", "Cannot connect to the server. Please try again.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Login";
    }
  });
}

const logoutButton = document.getElementById("logoutButton");
// Dashboard Statistics & User Welcome
const studentName = document.getElementById("studentName");
const dashboardMessage = document.getElementById("dashboardMessage");

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
  });
}

if (studentName && dashboardMessage) {
  const token = localStorage.getItem("token");
  const activeSprintCount = document.getElementById("activeSprintCount");
  const tasksAssignedCount = document.getElementById("tasksAssignedCount");
  const tasksCompletedCount = document.getElementById("tasksCompletedCount");

  if (!token) {
    window.location.href = "login.html";
  } else {
    fetch("/api/student/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(data.message);
        }

        studentName.textContent = data.user.name;

        if (activeSprintCount) {
          activeSprintCount.textContent = data.stats.activeSprintCount || 0;
        }

        if (tasksAssignedCount) {
          tasksAssignedCount.textContent = data.stats.tasksAssignedCount || 0;
        }

        if (tasksCompletedCount) {
          tasksCompletedCount.textContent = data.stats.tasksCompletedCount || 0;
        }

        dashboardMessage.innerHTML = `
          <div class="alert alert-success alert-dismissible fade show" role="alert">
            ${data.message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;
      })
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "login.html";
      });
  }
}

// Create Project Page
const createProjectForm = document.getElementById("createProjectForm");

if (createProjectForm) {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
  }

  createProjectForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!createProjectForm.checkValidity()) {
      createProjectForm.classList.add("was-validated");
      return;
    }

    const submitButton = createProjectForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Creating project...";

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectName: document.getElementById("projectName").value,
          description: document.getElementById("description").value,
          guideName: document.getElementById("guideName").value,
          startDate: document.getElementById("startDate").value,
          endDate: document.getElementById("endDate").value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage("danger", data.message || "Could not create the project.");
        return;
      }

      showMessage(
        "success",
        `Project created successfully! Your shareable Project Code is: <strong class="font-monospace fs-5">${data.project.projectCode}</strong>. Redirecting to dashboard...`
      );

      createProjectForm.reset();

      setTimeout(() => {
        window.location.href = "student-dashboard.html";
      }, 2500);
    } catch (error) {
      showMessage("danger", "Cannot connect to the server. Please try again.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Create Project";
    }
  });
}

// Project List on Dashboard
const projectList = document.getElementById("projectList");
const projectCount = document.getElementById("projectCount");

function escapeHtml(value) {
  const temporaryElement = document.createElement("div");
  temporaryElement.textContent = value || "";
  return temporaryElement.innerHTML;
}

function formatDate(dateValue) {
  if (!dateValue) return "Not specified";

  return new Date(dateValue).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

if (projectList && projectCount) {
  const token = localStorage.getItem("token");

  fetch("/api/projects", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        throw new Error(data.message);
      }

      projectCount.textContent = data.projects.length;

      if (data.projects.length === 0) {
        projectList.innerHTML = `
          <div class="text-center py-5">
            <h3 class="h5 fw-bold mb-2">No projects yet</h3>
            <p class="text-secondary mb-4">
              Create your first academic project or join an existing one with a Project Code.
            </p>
            <div class="d-flex justify-content-center gap-2">
              <a href="create-project.html" class="btn btn-primary">
                + Create Project
              </a>
              <a href="team-management.html" class="btn btn-outline-primary">
                Join with Code
              </a>
            </div>
          </div>
        `;
        return;
      }

      projectList.innerHTML = `
        <div class="row g-4">
          ${data.projects.map((project) => `
            <div class="col-md-6">
              <div class="card h-100 project-card shadow-sm border">
                <div class="card-body d-flex flex-column">
                  <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <h3 class="h5 fw-bold mb-0 text-primary">
                      ${escapeHtml(project.project_name)}
                    </h3>
                    <span class="badge ${project.status === "ACTIVE" ? "text-bg-success" : "text-bg-secondary"}">
                      ${escapeHtml(project.status)}
                    </span>
                  </div>

                  <p class="text-secondary small mb-3 flex-grow-1">
                    ${escapeHtml(project.description || "No description provided.")}
                  </p>

                  <div class="bg-light p-2 rounded mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="small text-secondary">Project Code:</span>
                      <span class="code-copy-badge copy-project-code-btn" data-code="${escapeHtml(project.project_code)}" title="Click to copy">
                        📋 ${escapeHtml(project.project_code)}
                      </span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="small text-secondary">My Role:</span>
                      <span class="badge ${project.project_role === "Team Lead" ? "text-bg-primary" : "text-bg-info"}">
                        ${escapeHtml(project.project_role)}
                      </span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                      <span class="small text-secondary">Expected End:</span>
                      <span class="small fw-semibold">${formatDate(project.end_date)}</span>
                    </div>
                  </div>

                  <!-- Project Task Progress Bar -->
                  <div class="mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="small text-secondary fw-semibold">Task Progress:</span>
                      <span class="small fw-bold text-primary" id="dashboard-progress-text-${project.project_id}">
                        Loading...
                      </span>
                    </div>
                    <div class="progress" style="height: 8px;">
                      <div
                        id="dashboard-progress-bar-${project.project_id}"
                        class="progress-bar bg-primary"
                        role="progressbar"
                        style="width: 0%;"
                        aria-valuenow="0"
                        aria-valuemin="0"
                        aria-valuemax="100"
                      ></div>
                    </div>
                  </div>

                  <div class="border-top pt-3 d-flex flex-wrap gap-1">
                    <a href="team-management.html?projectId=${project.project_id}" class="btn btn-sm btn-outline-secondary flex-fill" title="Manage Team">
                      👥 Team
                    </a>
                    <a href="backlog.html?projectId=${project.project_id}" class="btn btn-sm btn-outline-primary flex-fill" title="Product Backlog">
                      📋 Backlog
                    </a>
                    <a href="sprints.html?projectId=${project.project_id}" class="btn btn-sm btn-outline-primary flex-fill" title="Sprints">
                      ⚡ Sprints
                    </a>
                    <a href="tasks.html?projectId=${project.project_id}" class="btn btn-sm btn-outline-primary flex-fill" title="Task Management">
                      ✅ Tasks
                    </a>
                    <a href="kanban.html?projectId=${project.project_id}" class="btn btn-sm btn-outline-success flex-fill" title="Kanban Board">
                      📋 Kanban
                    </a>
                    <a href="project-files.html?projectId=${project.project_id}" class="btn btn-sm btn-outline-info flex-fill" title="Project Files">
                      📁 Files
                    </a>
                    <a href="analytics.html?projectId=${project.project_id}" class="btn btn-sm btn-primary flex-fill" title="Agile Analytics & Burndown">
                      📊 Analytics
                    </a>
                  </div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      `;

      // Fetch and display progress for each project
      data.projects.forEach(async (project) => {
        try {
          const progRes = await fetch(`/api/projects/${project.project_id}/progress`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const progData = await progRes.json();
          if (progData.success) {
            const p = progData.progress;
            const textEl = document.getElementById(`dashboard-progress-text-${project.project_id}`);
            const barEl = document.getElementById(`dashboard-progress-bar-${project.project_id}`);
            if (textEl && barEl) {
              textEl.textContent = `${p.percentage}% (${p.completedTasks}/${p.totalTasks} done)`;
              barEl.style.width = `${p.percentage}%`;
              barEl.setAttribute("aria-valuenow", p.percentage);
              if (p.percentage === 100) {
                barEl.className = "progress-bar bg-success";
              }
            }
          }
        } catch (e) {
          const textEl = document.getElementById(`dashboard-progress-text-${project.project_id}`);
          if (textEl) textEl.textContent = "0% (0/0 done)";
        }
      });

      // Copy project code event listener
      document.querySelectorAll(".copy-project-code-btn").forEach((badge) => {
        badge.addEventListener("click", () => {
          const code = badge.dataset.code;
          navigator.clipboard.writeText(code).then(() => {
            const originalText = badge.innerHTML;
            badge.innerHTML = "✓ Copied!";
            setTimeout(() => {
              badge.innerHTML = originalText;
            }, 1800);
          });
        });
      });
    })
    .catch(() => {
      projectList.innerHTML = `
        <div class="alert alert-danger mb-0">
          Unable to load projects. Please refresh the page.
        </div>
      `;
    });
}

// Team Management
const joinProjectForm = document.getElementById("joinProjectForm");
const managedProjectSelect = document.getElementById("managedProjectSelect");
const joinRequestsList = document.getElementById("joinRequestsList");
const teamMembersList = document.getElementById("teamMembersList");
const projectCodeDisplay = document.getElementById("projectCodeDisplay");
const activeProjectCode = document.getElementById("activeProjectCode");
const copyProjectCodeBtn = document.getElementById("copyProjectCodeBtn");

if (joinProjectForm && managedProjectSelect) {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
  }

  const requestOptions = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  let allOwnedProjects = [];

  const loadManagedProjects = async () => {
    const response = await fetch("/api/projects", requestOptions);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    allOwnedProjects = data.projects.filter(
      (project) => project.project_role === "Team Lead"
    );

    if (allOwnedProjects.length === 0) {
      managedProjectSelect.innerHTML = `
        <option value="">You are not a Team Lead for any projects yet</option>
      `;
      return;
    }

    managedProjectSelect.innerHTML = `
      <option value="">Select a project</option>
      ${allOwnedProjects.map((project) => `
        <option value="${project.project_id}">
          ${escapeHtml(project.project_name)} (${escapeHtml(project.project_code)})
        </option>
      `).join("")}
    `;

    // Check URL query param for pre-selection
    const urlProjectId = new URLSearchParams(window.location.search).get("projectId");
    if (urlProjectId && allOwnedProjects.some((p) => String(p.project_id) === String(urlProjectId))) {
      managedProjectSelect.value = urlProjectId;
      await loadTeamDetails(urlProjectId);
    }
  };

  const loadTeamDetails = async (projectId) => {
    if (!projectId) {
      joinRequestsList.innerHTML = `<p class="text-secondary mb-0">Select a project to view requests.</p>`;
      teamMembersList.innerHTML = `<p class="text-secondary mb-0">Select a project to view members.</p>`;
      if (projectCodeDisplay) projectCodeDisplay.classList.add("d-none");
      return;
    }

    // Display project code
    const currentProject = allOwnedProjects.find((p) => String(p.project_id) === String(projectId));
    if (currentProject && projectCodeDisplay && activeProjectCode) {
      activeProjectCode.textContent = currentProject.project_code;
      projectCodeDisplay.classList.remove("d-none");
    }

    joinRequestsList.innerHTML = `<p class="text-secondary mb-0">Loading requests...</p>`;
    teamMembersList.innerHTML = `<p class="text-secondary mb-0">Loading members...</p>`;

    const [requestsResponse, membersResponse] = await Promise.all([
      fetch(`/api/team/${projectId}/requests`, requestOptions),
      fetch(`/api/team/${projectId}/members`, requestOptions)
    ]);

    const requestsData = await requestsResponse.json();
    const membersData = await membersResponse.json();

    if (!requestsData.success || !membersData.success) {
      throw new Error("Unable to load team details.");
    }

    if (requestsData.requests.length === 0) {
      joinRequestsList.innerHTML = `
        <div class="alert alert-light border py-2 px-3 mb-0 small text-secondary">
          No pending join requests. Teammates can join using your project code.
        </div>
      `;
    } else {
      joinRequestsList.innerHTML = requestsData.requests.map((request) => `
        <div class="border rounded p-3 mb-2 bg-light">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <p class="fw-bold mb-0">${escapeHtml(request.full_name)}</p>
              <p class="small text-secondary mb-0">
                ${escapeHtml(request.registration_number)} · ${escapeHtml(request.email)}
                ${request.department ? `· ${escapeHtml(request.department)}` : ""}
              </p>
            </div>
            <span class="badge text-bg-warning">Pending</span>
          </div>
          <div class="d-flex gap-2">
            <button
              class="btn btn-success btn-sm review-request-button"
              data-request-id="${request.request_id}"
              data-action="ACCEPT"
            >
              ✓ Accept Member
            </button>
            <button
              class="btn btn-outline-danger btn-sm review-request-button"
              data-request-id="${request.request_id}"
              data-action="REJECT"
            >
              ✕ Reject
            </button>
          </div>
        </div>
      `).join("");
    }

    teamMembersList.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Member Name</th>
              <th>Registration No.</th>
              <th>Role</th>
              <th>Joined Date</th>
            </tr>
          </thead>
          <tbody>
            ${membersData.members.map((member) => `
              <tr>
                <td>
                  <strong>${escapeHtml(member.full_name)}</strong>
                  <div class="small text-secondary">${escapeHtml(member.email)}</div>
                </td>
                <td><code class="text-dark">${escapeHtml(member.registration_number)}</code></td>
                <td>
                  <span class="badge ${member.project_role === "Team Lead" ? "text-bg-primary" : "text-bg-secondary"}">
                    ${escapeHtml(member.project_role)}
                  </span>
                </td>
                <td>${formatDate(member.joined_date)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll(".review-request-button").forEach((button) => {
      button.addEventListener("click", async () => {
        const response = await fetch(
          `/api/team/${projectId}/requests/${button.dataset.requestId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ action: button.dataset.action })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          showMessage("danger", data.message || "Unable to review request.");
          return;
        }

        showMessage("success", data.message);
        loadTeamDetails(projectId);
      });
    });
  };

  if (copyProjectCodeBtn) {
    copyProjectCodeBtn.addEventListener("click", () => {
      if (activeProjectCode && activeProjectCode.textContent) {
        navigator.clipboard.writeText(activeProjectCode.textContent).then(() => {
          const orig = copyProjectCodeBtn.textContent;
          copyProjectCodeBtn.textContent = "✓ Copied!";
          setTimeout(() => {
            copyProjectCodeBtn.textContent = orig;
          }, 1800);
        });
      }
    });
  }

  joinProjectForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!joinProjectForm.checkValidity()) {
      joinProjectForm.classList.add("was-validated");
      return;
    }

    const code = document.getElementById("projectCode").value.trim().toUpperCase();

    const response = await fetch("/api/team/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ projectCode: code })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage("danger", data.message || "Unable to send join request.");
      return;
    }

    showMessage("success", data.message);
    joinProjectForm.reset();
    joinProjectForm.classList.remove("was-validated");
  });

  managedProjectSelect.addEventListener("change", () => {
    loadTeamDetails(managedProjectSelect.value).catch(() => {
      showMessage("danger", "Unable to load team details.");
    });
  });

  loadManagedProjects().catch(() => {
    managedProjectSelect.innerHTML = `
      <option value="">Unable to load your projects</option>
    `;
  });
}

// Backlog Management
const backlogForm = document.getElementById("backlogForm");
const backlogProjectSelect = document.getElementById("backlogProjectSelect");
const backlogItemsList = document.getElementById("backlogItemsList");

function escapeBacklogHtml(value) {
  const element = document.createElement("div");
  element.textContent = value || "";
  return element.innerHTML;
}

if (backlogForm && backlogProjectSelect && backlogItemsList) {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const loadProjectsForBacklog = async () => {
    const response = await fetch("/api/projects", {
      headers: authHeaders
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    if (data.projects.length === 0) {
      backlogProjectSelect.innerHTML = `
        <option value="">No projects found — create a project first</option>
      `;
      return;
    }

    backlogProjectSelect.innerHTML = `
      <option value="">Select a project</option>
      ${data.projects.map((project) => `
        <option value="${project.project_id}">
          ${escapeBacklogHtml(project.project_name)}
          (${escapeBacklogHtml(project.project_code)})
        </option>
      `).join("")}
    `;

    // Check URL query param for pre-selection
    const urlProjectId = new URLSearchParams(window.location.search).get("projectId");
    if (urlProjectId && data.projects.some((p) => String(p.project_id) === String(urlProjectId))) {
      backlogProjectSelect.value = urlProjectId;
      await loadBacklogItems(urlProjectId);
    }
  };

  const loadBacklogItems = async (projectId) => {
    if (!projectId) {
      backlogItemsList.innerHTML = `
        <p class="text-secondary mb-0">
          Select a project to view backlog items.
        </p>
      `;
      return;
    }

    backlogItemsList.innerHTML = `
      <p class="text-secondary mb-0">Loading backlog items...</p>
    `;

    const response = await fetch(`/api/backlog/${projectId}`, {
      headers: authHeaders
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    if (data.items.length === 0) {
      backlogItemsList.innerHTML = `
        <div class="text-center py-5 border rounded bg-light">
          <h3 class="h6 fw-bold mb-2">No backlog items yet</h3>
          <p class="text-secondary small mb-0">
            Use the form on the left to add your first user story with estimated story points.
          </p>
        </div>
      `;
      return;
    }

    const totalPoints = data.items.reduce((sum, item) => sum + (Number(item.story_points) || 0), 0);

    backlogItemsList.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="small text-secondary">Total: <strong>${data.items.length} items</strong> (${totalPoints} story points)</span>
        <a href="sprints.html?projectId=${projectId}" class="btn btn-sm btn-outline-primary">
          ⚡ Plan in Sprints →
        </a>
      </div>
      <div class="d-flex flex-column gap-3">
        ${data.items.map((item) => `
          <div class="border rounded p-3 bg-white shadow-sm">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
              <h3 class="h6 fw-bold mb-0 text-primary">
                ${escapeBacklogHtml(item.title)}
              </h3>
              <div class="d-flex gap-1">
                <span class="badge ${
                  item.priority === "HIGH"
                    ? "badge-priority-high"
                    : item.priority === "MEDIUM"
                      ? "badge-priority-medium"
                      : "badge-priority-low"
                }">
                  ${escapeBacklogHtml(item.priority)}
                </span>
                <span class="badge ${item.status === "IN_SPRINT" ? "text-bg-primary" : "text-bg-secondary"}">
                  ${item.status === "IN_SPRINT" ? "In Sprint" : "Backlog"}
                </span>
              </div>
            </div>

            ${
              item.description
                ? `
                  <p class="small text-secondary mb-2">
                    ${escapeBacklogHtml(item.description)}
                  </p>
                `
                : ""
            }

            ${
              item.user_story
                ? `
                  <div class="p-2 rounded bg-light small mb-2 text-dark border-start border-primary border-3">
                    <strong>User Story:</strong> ${escapeBacklogHtml(item.user_story)}
                  </div>
                `
                : ""
            }

            <div class="d-flex justify-content-between align-items-center small text-secondary border-top pt-2 mt-2">
              <span>
                <strong>Effort:</strong> <span class="badge bg-dark">${item.story_points} pts</span>
              </span>
              <span>Added by ${escapeBacklogHtml(item.created_by_name || "Team Member")}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  };

  backlogProjectSelect.addEventListener("change", () => {
    loadBacklogItems(backlogProjectSelect.value).catch(() => {
      backlogItemsList.innerHTML = `
        <div class="alert alert-danger mb-0">
          Unable to load backlog items.
        </div>
      `;
    });
  });

  backlogForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const projectId = backlogProjectSelect.value;

    if (!projectId) {
      showMessage("danger", "Select a project before adding a backlog item.");
      return;
    }

    if (!backlogForm.checkValidity()) {
      backlogForm.classList.add("was-validated");
      return;
    }

    const submitButton = backlogForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Adding item...";

    try {
      const response = await fetch("/api/backlog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          title: document.getElementById("backlogTitle").value,
          description: document.getElementById("backlogDescription").value,
          userStory: document.getElementById("userStory").value,
          priority: document.getElementById("priority").value,
          storyPoints: document.getElementById("storyPoints").value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage("danger", data.message || "Unable to add backlog item.");
        return;
      }

      showMessage("success", data.message);
      backlogForm.reset();
      backlogForm.classList.remove("was-validated");

      await loadBacklogItems(projectId);
    } catch (error) {
      showMessage("danger", "Unable to add backlog item. Please try again.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Add to Backlog";
    }
  });

  loadProjectsForBacklog().catch(() => {
    backlogProjectSelect.innerHTML = `
      <option value="">Unable to load projects</option>
    `;
  });
}

// Sprint Management
const sprintForm = document.getElementById("sprintForm");
const sprintProjectSelect = document.getElementById("sprintProjectSelect");
const sprintList = document.getElementById("sprintList");

function escapeSprintHtml(value) {
  const element = document.createElement("div");
  element.textContent = value || "";
  return element.innerHTML;
}

function displaySprintDate(dateValue) {
  if (!dateValue) return "Not specified";

  return new Date(dateValue).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

if (sprintForm && sprintProjectSelect && sprintList) {
  const token = localStorage.getItem("token");
  let availableBacklogItems = [];
  let allProjectBacklogItems = [];

  if (!token) {
    window.location.href = "login.html";
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const loadProjectsForSprints = async () => {
    const response = await fetch("/api/projects", {
      headers: authHeaders
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    if (data.projects.length === 0) {
      sprintProjectSelect.innerHTML = `
        <option value="">No projects found — create a project first</option>
      `;
      return;
    }

    sprintProjectSelect.innerHTML = `
      <option value="">Select a project</option>
      ${data.projects.map((project) => `
        <option value="${project.project_id}">
          ${escapeSprintHtml(project.project_name)}
          (${escapeSprintHtml(project.project_code)})
        </option>
      `).join("")}
    `;

    // Check URL query param for pre-selection
    const urlProjectId = new URLSearchParams(window.location.search).get("projectId");
    if (urlProjectId && data.projects.some((p) => String(p.project_id) === String(urlProjectId))) {
      sprintProjectSelect.value = urlProjectId;
      await loadAvailableBacklogItems(urlProjectId);
      await loadSprints(urlProjectId);
    }
  };

  const loadAvailableBacklogItems = async (projectId) => {
    const response = await fetch(`/api/backlog/${projectId}`, {
      headers: authHeaders
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    allProjectBacklogItems = data.items;
    availableBacklogItems = data.items.filter(
      (item) => item.status === "BACKLOG"
    );
  };

  const loadSprints = async (projectId) => {
    if (!projectId) {
      sprintList.innerHTML = `
        <p class="text-secondary mb-0">
          Select a project to view sprints.
        </p>
      `;
      return;
    }

    sprintList.innerHTML = `
      <p class="text-secondary mb-0">Loading sprints...</p>
    `;

    const response = await fetch(`/api/sprints/${projectId}`, {
      headers: authHeaders
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    if (data.sprints.length === 0) {
      sprintList.innerHTML = `
        <div class="text-center py-5 border rounded bg-light">
          <h3 class="h6 fw-bold mb-2">No sprints created yet</h3>
          <p class="text-secondary small mb-0">
            Use the form on the left to create your first sprint iteration.
          </p>
        </div>
      `;
      return;
    }

    sprintList.innerHTML = `
      <div class="d-flex flex-column gap-4">
        ${data.sprints.map((sprint) => {
          const assignedItems = allProjectBacklogItems.filter(
            (b) => Number(b.sprint_id) === Number(sprint.sprint_id)
          );
          const sprintPoints = assignedItems.reduce(
            (sum, item) => sum + (Number(item.story_points) || 0),
            0
          );

          return `
            <div class="card border rounded shadow-sm">
              <div class="card-body p-4">
                <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <div>
                    <h3 class="h6 fw-bold mb-1 text-primary">
                      ${escapeSprintHtml(sprint.sprint_name)}
                    </h3>
                    <span class="small text-secondary">
                      📅 ${displaySprintDate(sprint.start_date)} to ${displaySprintDate(sprint.end_date)}
                    </span>
                  </div>
                  <span class="badge ${
                    sprint.status === "ACTIVE"
                      ? "text-bg-primary"
                      : sprint.status === "COMPLETED"
                        ? "text-bg-success"
                        : "text-bg-secondary"
                  }">
                    ${escapeSprintHtml(sprint.status)}
                  </span>
                </div>

                <p class="small text-secondary mb-3">
                  <strong>Goal:</strong> ${escapeSprintHtml(sprint.goal || "No specific goal defined.")}
                </p>

                <!-- Sprint Status Action -->
                <div class="d-flex gap-2 mb-3">
                  ${
                    sprint.status === "PLANNED"
                      ? `
                        <button
                          class="btn btn-success btn-sm update-sprint-status-button"
                          data-sprint-id="${sprint.sprint_id}"
                          data-status="ACTIVE"
                        >
                          ▶ Start Sprint
                        </button>
                      `
                      : sprint.status === "ACTIVE"
                        ? `
                          <button
                            class="btn btn-outline-success btn-sm update-sprint-status-button"
                            data-sprint-id="${sprint.sprint_id}"
                            data-status="COMPLETED"
                          >
                            ✓ Complete Sprint
                          </button>
                        `
                        : `
                          <span class="badge text-bg-success py-2 px-3">
                            ✓ Sprint Completed
                          </span>
                        `
                  }
                  <a href="tasks.html?projectId=${projectId}&sprintId=${sprint.sprint_id}" class="btn btn-outline-primary btn-sm ms-auto">
                    Manage Tasks →
                  </a>
                </div>

                <!-- Assigned Backlog Items in this Sprint -->
                <div class="border-top pt-3 mt-2">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="small fw-bold text-uppercase text-secondary">
                      Assigned Backlog Stories (${assignedItems.length} items · ${sprintPoints} pts)
                    </span>
                  </div>

                  ${
                    assignedItems.length === 0
                      ? `
                        <p class="small text-secondary fst-italic mb-3">
                          No backlog items assigned to this sprint yet.
                        </p>
                      `
                      : `
                        <div class="list-group list-group-flush mb-3">
                          ${assignedItems.map((item) => `
                            <div class="list-group-item px-0 py-2 d-flex justify-content-between align-items-center">
                              <div>
                                <span class="fw-semibold small">${escapeSprintHtml(item.title)}</span>
                                <span class="badge bg-light text-dark border ms-1">${item.story_points} pts</span>
                              </div>
                              <span class="badge ${
                                item.priority === "HIGH"
                                  ? "badge-priority-high"
                                  : item.priority === "MEDIUM"
                                    ? "badge-priority-medium"
                                    : "badge-priority-low"
                              }">
                                ${escapeSprintHtml(item.priority)}
                              </span>
                            </div>
                          `).join("")}
                        </div>
                      `
                  }

                  <!-- Assign Backlog Item to this Sprint -->
                  <div class="input-group input-group-sm">
                    <select
                      class="form-select backlog-assignment-select"
                      data-sprint-id="${sprint.sprint_id}"
                    >
                      <option value="">Assign a backlog user story (${availableBacklogItems.length} available)</option>
                      ${availableBacklogItems.map((item) => `
                        <option value="${item.backlog_id}">
                          ${escapeSprintHtml(item.title)} (${item.story_points} pts - ${item.priority})
                        </option>
                      `).join("")}
                    </select>

                    <button
                      class="btn btn-primary assign-backlog-button"
                      data-sprint-id="${sprint.sprint_id}"
                    >
                      + Assign
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    document.querySelectorAll(".update-sprint-status-button").forEach((button) => {
      button.addEventListener("click", async () => {
        const response = await fetch(
          `/api/sprints/${button.dataset.sprintId}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              status: button.dataset.status
            })
          }
        );

        const result = await response.json();

        if (!response.ok) {
          showMessage("danger", result.message || "Unable to update sprint.");
          return;
        }

        showMessage("success", result.message);
        await loadSprints(projectId);
      });
    });

    document.querySelectorAll(".assign-backlog-button").forEach((button) => {
      button.addEventListener("click", async () => {
        const sprintId = button.dataset.sprintId;

        const select = document.querySelector(
          `.backlog-assignment-select[data-sprint-id="${sprintId}"]`
        );

        const backlogId = select.value;

        if (!backlogId) {
          showMessage("danger", "Select a backlog item first.");
          return;
        }

        const response = await fetch(`/api/sprints/${sprintId}/backlog`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ backlogId })
        });

        const result = await response.json();

        if (!response.ok) {
          showMessage("danger", result.message || "Unable to assign item.");
          return;
        }

        showMessage("success", result.message);

        await loadAvailableBacklogItems(projectId);
        await loadSprints(projectId);
      });
    });
  };

  sprintProjectSelect.addEventListener("change", async () => {
    const projectId = sprintProjectSelect.value;

    if (!projectId) {
      sprintList.innerHTML = `<p class="text-secondary mb-0">Select a project to view sprints.</p>`;
      return;
    }

    try {
      await loadAvailableBacklogItems(projectId);
      await loadSprints(projectId);
    } catch (error) {
      sprintList.innerHTML = `
        <div class="alert alert-danger mb-0">
          Unable to load project sprints.
        </div>
      `;
    }
  });

  sprintForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const projectId = sprintProjectSelect.value;

    if (!projectId) {
      showMessage("danger", "Select a project before creating a sprint.");
      return;
    }

    if (!sprintForm.checkValidity()) {
      sprintForm.classList.add("was-validated");
      return;
    }

    const submitButton = sprintForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Creating sprint...";

    try {
      const response = await fetch("/api/sprints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          sprintName: document.getElementById("sprintName").value,
          goal: document.getElementById("sprintGoal").value,
          startDate: document.getElementById("sprintStartDate").value,
          endDate: document.getElementById("sprintEndDate").value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage("danger", data.message || "Unable to create sprint.");
        return;
      }

      showMessage("success", data.message);
      sprintForm.reset();
      sprintForm.classList.remove("was-validated");

      await loadSprints(projectId);
    } catch (error) {
      showMessage("danger", "Unable to create sprint. Please try again.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Create Sprint";
    }
  });

  loadProjectsForSprints().catch(() => {
    sprintProjectSelect.innerHTML = `
      <option value="">Unable to load projects</option>
    `;
  });
}

// Task Management
const taskForm = document.getElementById("taskForm");
const taskProjectSelect = document.getElementById("taskProjectSelect");
const taskSprintSelect = document.getElementById("taskSprintSelect");
const taskBacklogSelect = document.getElementById("taskBacklogSelect");
const assignedToSelect = document.getElementById("assignedTo");
const taskList = document.getElementById("taskList");
const myTaskList = document.getElementById("myTaskList");

function escapeTaskHtml(value) {
  const element = document.createElement("div");
  element.textContent = value || "";
  return element.innerHTML;
}

if (
  taskForm &&
  taskProjectSelect &&
  taskSprintSelect &&
  taskBacklogSelect &&
  assignedToSelect &&
  taskList
) {
  const token = localStorage.getItem("token");
  let projectSprints = [];
  let projectBacklogItems = [];

  if (!token) {
    window.location.href = "login.html";
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const statusBadgeClass = {
    TODO: "secondary",
    IN_PROGRESS: "warning",
    COMPLETED: "success"
  };

  const loadProjectsForTasks = async () => {
    const response = await fetch("/api/projects", {
      headers: authHeaders
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    if (data.projects.length === 0) {
      taskProjectSelect.innerHTML = `
        <option value="">No projects found</option>
      `;
      return;
    }

    taskProjectSelect.innerHTML = `
      <option value="">Select a project</option>
      ${data.projects.map((project) => `
        <option value="${project.project_id}">
          ${escapeTaskHtml(project.project_name)}
          (${escapeTaskHtml(project.project_code)})
        </option>
      `).join("")}
    `;

    // Check URL query parameters for pre-selection
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get("projectId");
    const urlSprintId = urlParams.get("sprintId");

    if (urlProjectId && data.projects.some((p) => String(p.project_id) === String(urlProjectId))) {
      taskProjectSelect.value = urlProjectId;
      await handleProjectSelection(urlProjectId, urlSprintId);
    }
  };

  const loadTasks = async (projectId) => {
    const response = await fetch(`/api/tasks/${projectId}`, {
      headers: authHeaders
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    if (data.tasks.length === 0) {
      taskList.innerHTML = `
        <div class="text-center py-5 border rounded bg-light">
          <h3 class="h6 fw-bold mb-2">No tasks created yet</h3>
          <p class="text-secondary small mb-0">
            Use the form on the left to break down sprint backlog items into actionable tasks.
          </p>
        </div>
      `;
      return;
    }

    taskList.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>Task</th>
              <th>Priority</th>
              <th>Assigned To</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${data.tasks.map((task) => `
              <tr>
                <td>
                  <strong class="card-title-clickable open-task-modal-btn" data-task-id="${task.task_id}" title="Click to view details & comments">${escapeTaskHtml(task.title)}</strong>
                  <div class="small text-secondary">
                    ⚡ ${escapeTaskHtml(task.sprint_name)} · 📋 ${escapeTaskHtml(task.backlog_title || "")}
                  </div>
                </td>
                <td>
                  <span class="badge ${
                    task.priority === "HIGH"
                      ? "badge-priority-high"
                      : task.priority === "MEDIUM"
                        ? "badge-priority-medium"
                        : "badge-priority-low"
                  }">
                    ${escapeTaskHtml(task.priority)}
                  </span>
                </td>
                <td>
                  <div class="small fw-semibold">${escapeTaskHtml(task.assigned_to_name)}</div>
                </td>
                <td>
                  <span class="badge text-bg-${statusBadgeClass[task.status] || "secondary"}">
                    ${escapeTaskHtml(task.status)}
                  </span>
                </td>
                <td>
                  <span class="small">${new Date(task.deadline).toLocaleDateString("en-IN")}</span>
                </td>
                <td>
                  <button class="btn btn-sm btn-outline-primary open-task-modal-btn" data-task-id="${task.task_id}">
                    💬 Details
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    taskList.querySelectorAll(".open-task-modal-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const taskId = btn.dataset.taskId;
        if (typeof openTaskDetailsModal === "function") {
          openTaskDetailsModal(taskId);
        }
      });
    });
  };

  const updateBacklogOptions = () => {
    const selectedSprintId = Number(taskSprintSelect.value);

    if (!selectedSprintId) {
      taskBacklogSelect.innerHTML = `
        <option value="">Select a sprint first</option>
      `;
      return;
    }

    const sprintBacklogItems = projectBacklogItems.filter(
      (item) => Number(item.sprint_id) === selectedSprintId
    );

    if (sprintBacklogItems.length === 0) {
      taskBacklogSelect.innerHTML = `
        <option value="">No backlog items assigned to this sprint (Assign them in Sprints page)</option>
      `;
      return;
    }

    taskBacklogSelect.innerHTML = `
      <option value="">Select a backlog item</option>
      ${sprintBacklogItems.map((item) => `
        <option value="${item.backlog_id}">
          ${escapeTaskHtml(item.title)} (${item.story_points} points)
        </option>
      `).join("")}
    `;
  };

  const loadMyTasks = async () => {
    if (!myTaskList) return;

    try {
      const response = await fetch("/api/tasks/my-tasks", {
        headers: authHeaders
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      if (data.tasks.length === 0) {
        myTaskList.innerHTML = `
          <div class="alert alert-light border py-3 text-center mb-0 small text-secondary">
            You currently have no tasks assigned to you.
          </div>
        `;
        return;
      }

      myTaskList.innerHTML = `
        <div class="d-flex flex-column gap-3">
          ${data.tasks.map((task) => `
            <div class="border rounded p-3 bg-white shadow-sm">
              <div class="d-flex justify-content-between align-items-start gap-3 mb-1">
                <div>
                  <h3 class="h6 fw-bold mb-1 text-primary">${escapeTaskHtml(task.title)}</h3>
                  <p class="small text-secondary mb-2">
                    📁 <strong>${escapeTaskHtml(task.project_name)}</strong> · ⚡ ${escapeTaskHtml(task.sprint_name)}
                    ${task.backlog_title ? `· 📋 ${escapeTaskHtml(task.backlog_title)}` : ""}
                    · 📅 Due <strong>${new Date(task.deadline).toLocaleDateString("en-IN")}</strong>
                  </p>
                </div>
                <span class="badge text-bg-${statusBadgeClass[task.status] || "secondary"} align-self-start">
                  ${escapeTaskHtml(task.status)}
                </span>
              </div>

              ${
                task.description
                  ? `<p class="small text-secondary mb-2">${escapeTaskHtml(task.description)}</p>`
                  : ""
              }

              <div class="d-flex align-items-center gap-2 border-top pt-2 mt-2">
                <span class="small fw-semibold text-secondary">Update Status:</span>
                <select
                  class="form-select form-select-sm w-auto d-inline-block update-my-task-status"
                  data-task-id="${task.task_id}"
                >
                  <option value="TODO" ${task.status === "TODO" ? "selected" : ""}>⏳ To Do</option>
                  <option value="IN_PROGRESS" ${task.status === "IN_PROGRESS" ? "selected" : ""}>⚙ In Progress</option>
                  <option value="COMPLETED" ${task.status === "COMPLETED" ? "selected" : ""}>✓ Completed</option>
                </select>
              </div>
            </div>
          `).join("")}
        </div>
      `;

      document.querySelectorAll(".update-my-task-status").forEach((select) => {
        select.addEventListener("change", async () => {
          const response = await fetch(
            `/api/tasks/${select.dataset.taskId}/status`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ status: select.value })
            }
          );

          const result = await response.json();

          if (!response.ok) {
            showMessage("danger", result.message || "Unable to update task.");
            return;
          }

          showMessage("success", result.message);
          await loadMyTasks();
          if (taskProjectSelect.value) {
            await loadTasks(taskProjectSelect.value);
          }
        });
      });
    } catch (error) {
      myTaskList.innerHTML = `
        <div class="alert alert-danger mb-0">
          Unable to load your tasks.
        </div>
      `;
    }
  };

  const loadProjectProgressForTasks = async (projectId) => {
    const progContainer = document.getElementById("tasksProjectProgressContainer");
    const progText = document.getElementById("tasksProjectProgressText");
    const progBar = document.getElementById("tasksProjectProgressBar");
    const taskKanbanLink = document.getElementById("taskKanbanLink");

    if (taskKanbanLink) {
      taskKanbanLink.href = projectId ? `kanban.html?projectId=${projectId}` : "kanban.html";
    }

    if (!progContainer || !progText || !progBar) return;

    if (!projectId) {
      progContainer.classList.add("d-none");
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/progress`, {
        headers: authHeaders
      });
      const data = await response.json();
      if (data.success) {
        const p = data.progress;
        progContainer.classList.remove("d-none");
        progText.textContent = `${p.percentage}% (${p.completedTasks} of ${p.totalTasks} tasks done)`;
        progBar.style.width = `${p.percentage}%`;
        progBar.setAttribute("aria-valuenow", p.percentage);
        if (p.percentage === 100) {
          progBar.className = "progress-bar bg-success";
        } else {
          progBar.className = "progress-bar bg-primary";
        }
      }
    } catch (e) {
      progContainer.classList.add("d-none");
    }
  };

  const handleProjectSelection = async (projectId, preSelectedSprintId) => {
    if (!projectId) {
      taskSprintSelect.innerHTML = `<option value="">Select a project first</option>`;
      taskBacklogSelect.innerHTML = `<option value="">Select a sprint first</option>`;
      assignedToSelect.innerHTML = `<option value="">Select a project first</option>`;
      taskList.innerHTML = `<p class="text-secondary mb-0">Select a project to view tasks.</p>`;
      projectSprints = [];
      projectBacklogItems = [];
      await loadProjectProgressForTasks(null);
      return;
    }

    taskList.innerHTML = `
      <p class="text-secondary mb-0">Loading project information...</p>
    `;

    try {
      const [sprintsResponse, backlogResponse, membersResponse] =
        await Promise.all([
          fetch(`/api/sprints/${projectId}`, { headers: authHeaders }),
          fetch(`/api/backlog/${projectId}`, { headers: authHeaders }),
          fetch(`/api/team/${projectId}/members`, { headers: authHeaders })
        ]);

      const sprintsData = await sprintsResponse.json();
      const backlogData = await backlogResponse.json();
      const membersData = await membersResponse.json();

      if (
        !sprintsData.success ||
        !backlogData.success ||
        !membersData.success
      ) {
        throw new Error("Unable to load project information.");
      }

      projectSprints = sprintsData.sprints;
      projectBacklogItems = backlogData.items;

      taskSprintSelect.innerHTML = `
        <option value="">Select a sprint</option>
        ${projectSprints.map((sprint) => `
          <option value="${sprint.sprint_id}">
            ${escapeTaskHtml(sprint.sprint_name)}
            (${escapeTaskHtml(sprint.status)})
          </option>
        `).join("")}
      `;

      assignedToSelect.innerHTML = `
        <option value="">Select a team member</option>
        ${membersData.members.map((member) => `
          <option value="${member.user_id}">
            ${escapeTaskHtml(member.full_name)}
            (${escapeTaskHtml(member.project_role)})
          </option>
        `).join("")}
      `;

      taskBacklogSelect.innerHTML = `
        <option value="">Select a sprint first</option>
      `;

      if (preSelectedSprintId && projectSprints.some((s) => String(s.sprint_id) === String(preSelectedSprintId))) {
        taskSprintSelect.value = preSelectedSprintId;
        updateBacklogOptions();
      }

      await loadTasks(projectId);
      await loadProjectProgressForTasks(projectId);
    } catch (error) {
      taskList.innerHTML = `
        <div class="alert alert-danger mb-0">
          Unable to load project information.
        </div>
      `;
    }
  };

  taskProjectSelect.addEventListener("change", async () => {
    await handleProjectSelection(taskProjectSelect.value);
  });

  taskSprintSelect.addEventListener("change", updateBacklogOptions);

  taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const projectId = taskProjectSelect.value;

    if (!projectId) {
      showMessage("danger", "Select a project before creating a task.");
      return;
    }

    if (!taskForm.checkValidity()) {
      taskForm.classList.add("was-validated");
      return;
    }

    const submitButton = taskForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Creating task...";

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          sprintId: taskSprintSelect.value,
          backlogId: taskBacklogSelect.value,
          assignedTo: assignedToSelect.value,
          title: document.getElementById("taskTitle").value,
          description: document.getElementById("taskDescription").value,
          priority: document.getElementById("taskPriority").value,
          deadline: document.getElementById("taskDeadline").value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage("danger", data.message || "Unable to create task.");
        return;
      }

      showMessage("success", data.message);
      taskForm.reset();
      taskForm.classList.remove("was-validated");

      await loadTasks(projectId);
      await loadMyTasks();
      await loadProjectProgressForTasks(projectId);
    } catch (error) {
      showMessage("danger", "Unable to create task. Please try again.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Create Task";
    }
  });

  loadProjectsForTasks().catch(() => {
    taskProjectSelect.innerHTML = `
      <option value="">Unable to load projects</option>
    `;
  });

  loadMyTasks();
}

// ==========================================
// Kanban Board Management
// ==========================================
const kanbanProjectSelect = document.getElementById("kanbanProjectSelect");
const kanbanSprintFilter = document.getElementById("kanbanSprintFilter");
const kanbanRefreshBtn = document.getElementById("kanbanRefreshBtn");
const kanbanProgressContainer = document.getElementById("kanbanProgressContainer");
const kanbanProgressPercentText = document.getElementById("kanbanProgressPercentText");
const kanbanProgressDetailsText = document.getElementById("kanbanProgressDetailsText");
const kanbanProgressBar = document.getElementById("kanbanProgressBar");
const kanbanTodoCountBadge = document.getElementById("kanbanTodoCountBadge");
const kanbanInProgressCountBadge = document.getElementById("kanbanInProgressCountBadge");
const kanbanCompletedCountBadge = document.getElementById("kanbanCompletedCountBadge");
const kanbanPlaceholder = document.getElementById("kanbanPlaceholder");
const kanbanColumnsRow = document.getElementById("kanbanColumnsRow");
const todoList = document.getElementById("todoList");
const inProgressList = document.getElementById("inProgressList");
const completedList = document.getElementById("completedList");
const todoCountBadge = document.getElementById("todoCountBadge");
const inProgressCountBadge = document.getElementById("inProgressCountBadge");
const completedCountBadge = document.getElementById("completedCountBadge");
const createTaskQuickLink = document.getElementById("createTaskQuickLink");
const kanbanMessage = document.getElementById("kanbanMessage");

if (
  kanbanProjectSelect &&
  kanbanSprintFilter &&
  todoList &&
  inProgressList &&
  completedList
) {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  let allKanbanTasks = [];
  let sortableInstances = [];

  function showKanbanMessage(type, message) {
    if (!kanbanMessage) return;
    kanbanMessage.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }

  function escapeKanbanHtml(value) {
    const div = document.createElement("div");
    div.textContent = value || "";
    return div.innerHTML;
  }

  function formatKanbanDate(dateValue) {
    if (!dateValue) return "No deadline";
    return new Date(dateValue).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short"
    });
  }

  // Load Projects for Kanban Dropdown
  const loadKanbanProjects = async () => {
    const response = await fetch("/api/projects", { headers: authHeaders });
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    if (data.projects.length === 0) {
      kanbanProjectSelect.innerHTML = `<option value="">No projects found</option>`;
      return;
    }

    kanbanProjectSelect.innerHTML = `
      <option value="">Select a project</option>
      ${data.projects.map((project) => `
        <option value="${project.project_id}">
          ${escapeKanbanHtml(project.project_name)} (${escapeKanbanHtml(project.project_code)})
        </option>
      `).join("")}
    `;

    // Check query params for pre-selection
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get("projectId");
    if (urlProjectId && data.projects.some((p) => String(p.project_id) === String(urlProjectId))) {
      kanbanProjectSelect.value = urlProjectId;
      await handleKanbanProjectSelect(urlProjectId);
    }
  };

  // Load Sprints for Filter Dropdown
  const loadKanbanSprints = async (projectId) => {
    try {
      const response = await fetch(`/api/sprints/${projectId}`, { headers: authHeaders });
      const data = await response.json();

      if (!data.success) throw new Error(data.message);

      kanbanSprintFilter.disabled = false;
      kanbanSprintFilter.innerHTML = `
        <option value="">All Sprints</option>
        ${data.sprints.map((sprint) => `
          <option value="${sprint.sprint_id}">
            ${escapeKanbanHtml(sprint.sprint_name)} (${escapeKanbanHtml(sprint.status)})
          </option>
        `).join("")}
      `;
    } catch (e) {
      kanbanSprintFilter.disabled = true;
      kanbanSprintFilter.innerHTML = `<option value="">All Sprints</option>`;
    }
  };

  // Load and Render Project Progress
  const loadKanbanProgress = async (projectId) => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/progress`, {
        headers: authHeaders
      });
      const data = await response.json();

      if (data.success && kanbanProgressContainer) {
        const p = data.progress;
        kanbanProgressContainer.classList.remove("d-none");
        kanbanProgressPercentText.textContent = `${p.percentage}%`;
        kanbanProgressDetailsText.textContent = `(${p.completedTasks} of ${p.totalTasks} tasks completed)`;
        kanbanProgressBar.style.width = `${p.percentage}%`;
        kanbanProgressBar.setAttribute("aria-valuenow", p.percentage);

        if (p.percentage === 100) {
          kanbanProgressBar.className = "progress-bar bg-success progress-bar-striped progress-bar-animated";
        } else {
          kanbanProgressBar.className = "progress-bar bg-primary progress-bar-striped progress-bar-animated";
        }

        if (kanbanTodoCountBadge) kanbanTodoCountBadge.textContent = p.todoTasks;
        if (kanbanInProgressCountBadge) kanbanInProgressCountBadge.textContent = p.inProgressTasks;
        if (kanbanCompletedCountBadge) kanbanCompletedCountBadge.textContent = p.completedTasks;
      }
    } catch (e) {
      console.error("Error loading kanban progress:", e);
    }
  };

  // Load Tasks from API
  const loadKanbanTasks = async (projectId) => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/tasks/${projectId}`, { headers: authHeaders });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      allKanbanTasks = data.tasks || [];
      renderBoard();
      await loadKanbanProgress(projectId);
    } catch (error) {
      showKanbanMessage("danger", "Unable to load tasks for this project.");
    }
  };

  // Render Single Kanban Card HTML
  const createKanbanCardHtml = (task) => {
    const priorityClass =
      task.priority === "HIGH"
        ? "badge-priority-high"
        : task.priority === "MEDIUM"
          ? "badge-priority-medium"
          : "badge-priority-low";

    let actionButtonsHtml = "";

    if (task.status === "TODO") {
      actionButtonsHtml = `
        <button class="btn btn-sm btn-outline-warning w-100 move-btn" data-task-id="${task.task_id}" data-target-status="IN_PROGRESS" title="Move to In Progress">
          Start Task →
        </button>
      `;
    } else if (task.status === "IN_PROGRESS") {
      actionButtonsHtml = `
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary flex-fill move-btn" data-task-id="${task.task_id}" data-target-status="TODO" title="Move back to To Do">
            ← To Do
          </button>
          <button class="btn btn-sm btn-success flex-fill move-btn" data-task-id="${task.task_id}" data-target-status="COMPLETED" title="Mark as Completed">
            Done ✓
          </button>
        </div>
      `;
    } else if (task.status === "COMPLETED") {
      actionButtonsHtml = `
        <button class="btn btn-sm btn-outline-secondary w-100 move-btn" data-task-id="${task.task_id}" data-target-status="IN_PROGRESS" title="Reopen task to In Progress">
          ← Reopen Task
        </button>
      `;
    }

    return `
      <div class="kanban-card" data-task-id="${task.task_id}">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
          <span class="badge ${priorityClass}">
            ${escapeKanbanHtml(task.priority)}
          </span>
          <span class="small text-secondary fw-semibold">
            📅 ${formatKanbanDate(task.deadline)}
          </span>
        </div>

        <h3 class="h6 fw-bold mb-1 card-title-clickable open-task-modal-btn" data-task-id="${task.task_id}" title="Click to view details & discussion">
          ${escapeKanbanHtml(task.title)}
        </h3>

        ${
          task.description
            ? `<p class="small text-secondary mb-2" style="font-size: 0.825rem; line-height: 1.35;">${escapeKanbanHtml(task.description)}</p>`
            : ""
        }

        <div class="d-flex flex-wrap gap-1 mb-2">
          <span class="badge text-bg-light border small text-secondary">
            ⚡ ${escapeKanbanHtml(task.sprint_name)}
          </span>
          ${
            task.backlog_title
              ? `<span class="badge text-bg-light border small text-secondary text-truncate" style="max-width: 170px;" title="${escapeKanbanHtml(task.backlog_title)}">
                  📋 ${escapeKanbanHtml(task.backlog_title)}
                </span>`
              : ""
          }
        </div>

        <div class="d-flex align-items-center justify-content-between pt-2 border-top mb-2">
          <div class="small text-secondary">
            <span class="fw-semibold">👤 ${escapeKanbanHtml(task.assigned_to_name)}</span>
          </div>
          <button class="btn btn-sm btn-link text-decoration-none p-0 small text-primary open-task-modal-btn" data-task-id="${task.task_id}">
            💬 Discussion
          </button>
        </div>

        <!-- Quick Directional Buttons -->
        <div class="mt-2">
          ${actionButtonsHtml}
        </div>
      </div>
    `;
  };

  // Render Full Kanban Board
  const renderBoard = () => {
    const selectedSprintId = kanbanSprintFilter.value;

    let filteredTasks = allKanbanTasks;
    if (selectedSprintId) {
      filteredTasks = allKanbanTasks.filter(
        (t) => String(t.sprint_id) === String(selectedSprintId)
      );
    }

    const todoTasks = filteredTasks.filter((t) => t.status === "TODO");
    const inProgressTasks = filteredTasks.filter((t) => t.status === "IN_PROGRESS");
    const completedTasks = filteredTasks.filter((t) => t.status === "COMPLETED");

    // Update column count badges
    if (todoCountBadge) todoCountBadge.textContent = todoTasks.length;
    if (inProgressCountBadge) inProgressCountBadge.textContent = inProgressTasks.length;
    if (completedCountBadge) completedCountBadge.textContent = completedTasks.length;

    // Render cards into column containers
    todoList.innerHTML =
      todoTasks.length > 0
        ? todoTasks.map(createKanbanCardHtml).join("")
        : `<div class="kanban-empty-placeholder">No tasks in To Do</div>`;

    inProgressList.innerHTML =
      inProgressTasks.length > 0
        ? inProgressTasks.map(createKanbanCardHtml).join("")
        : `<div class="kanban-empty-placeholder">No tasks In Progress</div>`;

    completedList.innerHTML =
      completedTasks.length > 0
        ? completedTasks.map(createKanbanCardHtml).join("")
        : `<div class="kanban-empty-placeholder">No completed tasks</div>`;

    // Reattach directional button listeners
    document.querySelectorAll(".move-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();
        const taskId = button.dataset.taskId;
        const targetStatus = button.dataset.targetStatus;
        await updateTaskStatusDirect(taskId, targetStatus);
      });
    });

    // Attach Task Modal open listeners
    document.querySelectorAll(".open-task-modal-btn").forEach((elem) => {
      elem.addEventListener("click", (e) => {
        e.stopPropagation();
        const taskId = elem.dataset.taskId;
        if (typeof openTaskDetailsModal === "function") {
          openTaskDetailsModal(taskId);
        }
      });
    });

    // Re-initialize SortableJS
    setupSortableJS();
  };

  // Direct Status Update API Call
  const updateTaskStatusDirect = async (taskId, newStatus) => {
    const projectId = kanbanProjectSelect.value;
    if (!projectId || !taskId) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();

      if (!response.ok) {
        showKanbanMessage("danger", result.message || "Unable to update task status.");
        return;
      }

      showKanbanMessage(
        "success",
        `Task status updated to ${newStatus === "IN_PROGRESS" ? "In Progress" : newStatus === "COMPLETED" ? "Completed" : "To Do"}.`
      );

      await loadKanbanTasks(projectId);
    } catch (error) {
      showKanbanMessage("danger", "Network error updating task status.");
    }
  };

  // SortableJS Setup for Drag and Drop
  const setupSortableJS = () => {
    sortableInstances.forEach((inst) => {
      try {
        inst.destroy();
      } catch (e) {}
    });
    sortableInstances = [];

    if (typeof Sortable === "undefined") {
      console.warn("SortableJS is not defined.");
      return;
    }

    [todoList, inProgressList, completedList].forEach((columnContainer) => {
      if (!columnContainer) return;

      const instance = new Sortable(columnContainer, {
        group: "kanban-tasks-shared",
        animation: 180,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        filter: ".kanban-empty-placeholder, button, a",
        preventOnFilter: false,
        onEnd: async (evt) => {
          const itemEl = evt.item;
          const taskId = itemEl.dataset.taskId;
          const targetStatus = evt.to.dataset.status;
          const fromStatus = evt.from.dataset.status;

          if (!taskId || !targetStatus) return;

          if (fromStatus === targetStatus) {
            return; // Dropped in the same column
          }

          const projectId = kanbanProjectSelect.value;

          try {
            const response = await fetch(`/api/tasks/${taskId}/status`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ status: targetStatus })
            });

            const result = await response.json();

            if (!response.ok) {
              showKanbanMessage("danger", result.message || "Failed to update task status.");
              await loadKanbanTasks(projectId);
              return;
            }

            showKanbanMessage(
              "success",
              `Task moved to ${targetStatus === "IN_PROGRESS" ? "In Progress" : targetStatus === "COMPLETED" ? "Completed" : "To Do"}.`
            );

            await loadKanbanTasks(projectId);
          } catch (error) {
            showKanbanMessage("danger", "Failed to update task status.");
            await loadKanbanTasks(projectId);
          }
        }
      });

      sortableInstances.push(instance);
    });
  };

  // Handle Project Dropdown Selection
  const handleKanbanProjectSelect = async (projectId) => {
    if (!projectId) {
      if (kanbanPlaceholder) kanbanPlaceholder.classList.remove("d-none");
      if (kanbanColumnsRow) kanbanColumnsRow.classList.add("d-none");
      if (kanbanProgressContainer) kanbanProgressContainer.classList.add("d-none");
      if (createTaskQuickLink) createTaskQuickLink.href = "tasks.html";
      kanbanSprintFilter.disabled = true;
      kanbanSprintFilter.innerHTML = `<option value="">All Sprints</option>`;
      allKanbanTasks = [];
      return;
    }

    if (kanbanPlaceholder) kanbanPlaceholder.classList.add("d-none");
    if (kanbanColumnsRow) kanbanColumnsRow.classList.remove("d-none");
    if (createTaskQuickLink) createTaskQuickLink.href = `tasks.html?projectId=${projectId}`;

    await loadKanbanSprints(projectId);
    await loadKanbanTasks(projectId);
  };

  // Event Listeners
  kanbanProjectSelect.addEventListener("change", async () => {
    await handleKanbanProjectSelect(kanbanProjectSelect.value);
  });

  kanbanSprintFilter.addEventListener("change", () => {
    renderBoard();
  });

  if (kanbanRefreshBtn) {
    kanbanRefreshBtn.addEventListener("click", async () => {
      if (kanbanProjectSelect.value) {
        await loadKanbanTasks(kanbanProjectSelect.value);
        showKanbanMessage("info", "Kanban board refreshed.");
      }
    });
  }

  // Initial Load
  loadKanbanProjects().catch(() => {
    kanbanProjectSelect.innerHTML = `<option value="">Unable to load projects</option>`;
  });
}

// ==========================================
// Project Files Management
// ==========================================
const fileProjectSelect = document.getElementById("fileProjectSelect");
const fileUploadForm = document.getElementById("fileUploadForm");
const fileInput = document.getElementById("fileInput");
const uploadSubmitBtn = document.getElementById("uploadSubmitBtn");
const fileList = document.getElementById("fileList");
const filesCountBadge = document.getElementById("filesCountBadge");
const fileMessage = document.getElementById("fileMessage");

if (fileProjectSelect && fileUploadForm && fileList) {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  function showFileMessage(type, message) {
    if (!fileMessage) return;
    fileMessage.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }

  function escapeFileHtml(value) {
    const div = document.createElement("div");
    div.textContent = value || "";
    return div.innerHTML;
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  const loadProjectsForFiles = async () => {
    const response = await fetch("/api/projects", { headers: authHeaders });
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    if (data.projects.length === 0) {
      fileProjectSelect.innerHTML = `<option value="">No projects found</option>`;
      return;
    }

    fileProjectSelect.innerHTML = `
      <option value="">Select a project</option>
      ${data.projects.map((project) => `
        <option value="${project.project_id}">
          ${escapeFileHtml(project.project_name)} (${escapeFileHtml(project.project_code)})
        </option>
      `).join("")}
    `;

    // Check query params for pre-selection
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get("projectId");
    if (urlProjectId && data.projects.some((p) => String(p.project_id) === String(urlProjectId))) {
      fileProjectSelect.value = urlProjectId;
      await loadProjectFiles(urlProjectId);
    }
  };

  const loadProjectFiles = async (projectId) => {
    if (!projectId) {
      fileList.innerHTML = `<p class="text-secondary mb-0">Select a project to view uploaded files.</p>`;
      if (filesCountBadge) filesCountBadge.textContent = "0 files";
      return;
    }

    fileList.innerHTML = `<p class="text-secondary mb-0">Loading project files...</p>`;

    try {
      const response = await fetch(`/api/files/${projectId}`, { headers: authHeaders });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      const files = data.files || [];
      if (filesCountBadge) filesCountBadge.textContent = `${files.length} file${files.length === 1 ? "" : "s"}`;

      if (files.length === 0) {
        fileList.innerHTML = `
          <div class="text-center py-5 border rounded bg-light">
            <h3 class="h6 fw-bold mb-1">No files uploaded yet</h3>
            <p class="text-secondary small mb-0">
              Upload project documentation, architectural diagrams, or code artifacts above.
            </p>
          </div>
        `;
        return;
      }

      fileList.innerHTML = `
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Document</th>
                <th>Size</th>
                <th>Uploaded By</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${files.map((file) => `
                <tr>
                  <td>
                    <div class="fw-semibold text-break">📄 ${escapeFileHtml(file.file_name)}</div>
                  </td>
                  <td>
                    <span class="badge text-bg-light border text-secondary">${formatFileSize(file.file_size)}</span>
                  </td>
                  <td>
                    <span class="small">👤 ${escapeFileHtml(file.uploaded_by_name)}</span>
                  </td>
                  <td>
                    <span class="small text-secondary">${new Date(file.uploaded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-outline-primary download-file-btn" data-file-id="${file.file_id}" data-file-name="${escapeFileHtml(file.file_name)}">
                      ⬇️ Download
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;

      // Download file handler
      document.querySelectorAll(".download-file-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const fileId = btn.dataset.fileId;
          const fileName = btn.dataset.fileName;
          const originalText = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = "⏳ Downloading...";

          try {
            const downloadRes = await fetch(`/api/files/download/${fileId}`, {
              headers: authHeaders
            });

            if (!downloadRes.ok) {
              const err = await downloadRes.json().catch(() => ({}));
              showFileMessage("danger", err.message || "Failed to download file.");
              return;
            }

            const blob = await downloadRes.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
          } catch (err) {
            showFileMessage("danger", "Network error while downloading file.");
          } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
          }
        });
      });
    } catch (error) {
      fileList.innerHTML = `
        <div class="alert alert-danger mb-0">
          Unable to load project files.
        </div>
      `;
    }
  };

  fileProjectSelect.addEventListener("change", async () => {
    await loadProjectFiles(fileProjectSelect.value);
  });

  fileUploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const projectId = fileProjectSelect.value;
    if (!projectId) {
      showFileMessage("danger", "Please select a project before uploading a file.");
      return;
    }

    if (!fileInput.files || fileInput.files.length === 0) {
      showFileMessage("danger", "Please choose a file to upload.");
      return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);

    uploadSubmitBtn.disabled = true;
    uploadSubmitBtn.innerHTML = "⏳ Uploading...";

    try {
      const response = await fetch("/api/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        showFileMessage("danger", data.message || "Failed to upload file.");
        return;
      }

      showFileMessage("success", data.message);
      fileUploadForm.reset();
      await loadProjectFiles(projectId);
    } catch (err) {
      showFileMessage("danger", "Network error uploading file.");
    } finally {
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.innerHTML = "📤 Upload File";
    }
  });

  loadProjectsForFiles().catch(() => {
    fileProjectSelect.innerHTML = `<option value="">Unable to load projects</option>`;
  });
}

// ==========================================
// Admin Dashboard Management
// ==========================================
const adminName = document.getElementById("adminName");
const adminLogoutButton = document.getElementById("adminLogoutButton");
const adminRefreshBtn = document.getElementById("adminRefreshBtn");
const adminTotalStudents = document.getElementById("adminTotalStudents");
const adminActiveStudentsSubtext = document.getElementById("adminActiveStudentsSubtext");
const adminTotalProjects = document.getElementById("adminTotalProjects");
const adminActiveProjectsSubtext = document.getElementById("adminActiveProjectsSubtext");
const adminActiveSprints = document.getElementById("adminActiveSprints");
const adminTotalSprintsSubtext = document.getElementById("adminTotalSprintsSubtext");
const adminCompletedTasks = document.getElementById("adminCompletedTasks");
const adminTotalTasksSubtext = document.getElementById("adminTotalTasksSubtext");
const studentSearchInput = document.getElementById("studentSearchInput");
const adminStudentsTableBody = document.getElementById("adminStudentsTableBody");
const projectSearchInput = document.getElementById("projectSearchInput");
const adminProjectsTableBody = document.getElementById("adminProjectsTableBody");
const adminMessage = document.getElementById("adminMessage");

if (
  adminStudentsTableBody &&
  adminProjectsTableBody &&
  adminTotalStudents
) {
  const token = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");
  let user = null;

  try {
    user = JSON.parse(storedUser);
  } catch (e) {}

  if (!token || !user || user.role !== "ADMIN") {
    window.location.href = "login.html";
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  if (adminName && user) {
    adminName.textContent = user.name || "Admin";
  }

  if (adminLogoutButton) {
    adminLogoutButton.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "login.html";
    });
  }

  function showAdminMessage(type, message) {
    if (!adminMessage) return;
    adminMessage.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }

  function escapeAdminHtml(value) {
    const div = document.createElement("div");
    div.textContent = value || "";
    return div.innerHTML;
  }

  let allStudentsList = [];
  let allProjectsList = [];

  // Load Platform Stats
  const loadAdminStats = async () => {
    try {
      const response = await fetch("/api/admin/stats", { headers: authHeaders });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      const s = data.stats;
      if (adminTotalStudents) adminTotalStudents.textContent = s.totalStudents;
      if (adminActiveStudentsSubtext) adminActiveStudentsSubtext.textContent = `${s.activeStudents} active accounts`;

      if (adminTotalProjects) adminTotalProjects.textContent = s.totalProjects;
      if (adminActiveProjectsSubtext) adminActiveProjectsSubtext.textContent = `${s.activeProjects} active projects`;

      if (adminActiveSprints) adminActiveSprints.textContent = s.activeSprints;
      if (adminTotalSprintsSubtext) adminTotalSprintsSubtext.textContent = `${s.totalSprints} total sprints`;

      if (adminCompletedTasks) adminCompletedTasks.textContent = s.completedTasks;
      if (adminTotalTasksSubtext) adminTotalTasksSubtext.textContent = `${s.completedTasks} / ${s.totalTasks} tasks completed`;
    } catch (err) {
      console.error("Error loading admin stats:", err);
    }
  };

  // Render Students Table
  const renderStudentsTable = () => {
    const query = (studentSearchInput?.value || "").toLowerCase().trim();

    const filtered = allStudentsList.filter((st) => {
      const matchName = (st.full_name || "").toLowerCase().includes(query);
      const matchEmail = (st.email || "").toLowerCase().includes(query);
      const matchReg = (st.registration_number || "").toLowerCase().includes(query);
      const matchDept = (st.department || "").toLowerCase().includes(query);
      return matchName || matchEmail || matchReg || matchDept;
    });

    if (filtered.length === 0) {
      adminStudentsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-secondary">
            No students found matching your search.
          </td>
        </tr>
      `;
      return;
    }

    adminStudentsTableBody.innerHTML = filtered.map((st) => `
      <tr>
        <td>
          <div class="fw-bold text-dark">${escapeAdminHtml(st.full_name)}</div>
        </td>
        <td>
          <span class="font-monospace text-secondary">${escapeAdminHtml(st.registration_number || "N/A")}</span>
        </td>
        <td>
          <span class="small">${escapeAdminHtml(st.email)}</span>
        </td>
        <td>
          <div class="small">${escapeAdminHtml(st.department || "General")} ${st.year_of_study ? `· Year ${st.year_of_study}` : ""}</div>
        </td>
        <td>
          <span class="badge ${st.status === "ACTIVE" ? "text-bg-success" : "text-bg-danger"}">
            ${escapeAdminHtml(st.status)}
          </span>
        </td>
        <td>
          ${
            st.status === "ACTIVE"
              ? `<button class="btn btn-sm btn-outline-danger toggle-student-btn" data-user-id="${st.user_id}" data-target-status="INACTIVE">
                  Deactivate
                </button>`
              : `<button class="btn btn-sm btn-outline-success toggle-student-btn" data-user-id="${st.user_id}" data-target-status="ACTIVE">
                  Activate
                </button>`
          }
        </td>
      </tr>
    `).join("");

    // Toggle status click listeners
    document.querySelectorAll(".toggle-student-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = btn.dataset.userId;
        const targetStatus = btn.dataset.targetStatus;
        const actionLabel = targetStatus === "ACTIVE" ? "activate" : "deactivate";

        if (!confirm(`Are you sure you want to ${actionLabel} this student account?`)) {
          return;
        }

        try {
          const response = await fetch(`/api/admin/students/${userId}/status`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: targetStatus })
          });

          const data = await response.json();

          if (!response.ok) {
            showAdminMessage("danger", data.message || `Failed to ${actionLabel} account.`);
            return;
          }

          showAdminMessage("success", data.message);
          await loadAdminStudents();
          await loadAdminStats();
        } catch (err) {
          showAdminMessage("danger", "Network error updating student account status.");
        }
      });
    });
  };

  // Load Students
  const loadAdminStudents = async () => {
    try {
      const response = await fetch("/api/admin/students", { headers: authHeaders });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      allStudentsList = data.students || [];
      renderStudentsTable();
    } catch (err) {
      adminStudentsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-danger">
            Unable to load students.
          </td>
        </tr>
      `;
    }
  };

  // Render Projects Table
  const renderProjectsTable = () => {
    const query = (projectSearchInput?.value || "").toLowerCase().trim();

    const filtered = allProjectsList.filter((p) => {
      const matchCode = (p.project_code || "").toLowerCase().includes(query);
      const matchName = (p.project_name || "").toLowerCase().includes(query);
      const matchOwner = (p.owner_name || "").toLowerCase().includes(query);
      const matchGuide = (p.guide_name || "").toLowerCase().includes(query);
      return matchCode || matchName || matchOwner || matchGuide;
    });

    if (filtered.length === 0) {
      adminProjectsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-secondary">
            No projects found matching your search.
          </td>
        </tr>
      `;
      return;
    }

    adminProjectsTableBody.innerHTML = filtered.map((p) => {
      const totalT = Number(p.total_tasks) || 0;
      const compT = Number(p.completed_tasks) || 0;
      const pct = totalT > 0 ? Math.round((compT / totalT) * 100) : 0;

      return `
        <tr>
          <td>
            <span class="badge text-bg-light border font-monospace">${escapeAdminHtml(p.project_code)}</span>
          </td>
          <td>
            <div class="fw-bold text-dark">${escapeAdminHtml(p.project_name)}</div>
            ${p.description ? `<div class="small text-secondary text-truncate" style="max-width: 250px;">${escapeAdminHtml(p.description)}</div>` : ""}
          </td>
          <td>
            <div class="small fw-semibold">👤 ${escapeAdminHtml(p.owner_name)}</div>
            <div class="small text-secondary">${escapeAdminHtml(p.owner_email)}</div>
          </td>
          <td>
            <span class="small text-secondary">${escapeAdminHtml(p.guide_name || "Not assigned")}</span>
          </td>
          <td>
            <span class="badge text-bg-info text-white">${p.member_count || 1} members</span>
          </td>
          <td style="min-width: 140px;">
            <div class="small fw-semibold mb-1">${pct}% (${compT}/${totalT})</div>
            <div class="progress" style="height: 6px;">
              <div class="progress-bar ${pct === 100 ? "bg-success" : "bg-primary"}" style="width: ${pct}%;"></div>
            </div>
          </td>
          <td>
            <span class="badge ${p.status === "ACTIVE" ? "text-bg-success" : "text-bg-secondary"}">
              ${escapeAdminHtml(p.status)}
            </span>
          </td>
        </tr>
      `;
    }).join("");
  };

  // Load Projects
  const loadAdminProjects = async () => {
    try {
      const response = await fetch("/api/admin/projects", { headers: authHeaders });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      allProjectsList = data.projects || [];
      renderProjectsTable();
    } catch (err) {
      adminProjectsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-danger">
            Unable to load projects.
          </td>
        </tr>
      `;
    }
  };

  if (studentSearchInput) {
    studentSearchInput.addEventListener("input", renderStudentsTable);
  }

  if (projectSearchInput) {
    projectSearchInput.addEventListener("input", renderProjectsTable);
  }

  if (adminRefreshBtn) {
    adminRefreshBtn.addEventListener("click", async () => {
      await Promise.all([loadAdminStats(), loadAdminStudents(), loadAdminProjects()]);
      showAdminMessage("info", "Platform data refreshed.");
    });
  }

  // Initial Load
  loadAdminStats();
  loadAdminStudents();
  loadAdminProjects();
}

// ==========================================
// Task Details & Discussion Modal
// ==========================================
const taskDetailsModalEl = document.getElementById("taskDetailsModal");
let taskModalInstance = null;

const modalTaskTitle = document.getElementById("modalTaskTitle");
const modalTaskDescription = document.getElementById("modalTaskDescription");
const modalTaskPriority = document.getElementById("modalTaskPriority");
const modalTaskStatus = document.getElementById("modalTaskStatus");
const modalTaskSprint = document.getElementById("modalTaskSprint");
const modalTaskBacklog = document.getElementById("modalTaskBacklog");
const modalTaskAssignee = document.getElementById("modalTaskAssignee");
const modalTaskDeadline = document.getElementById("modalTaskDeadline");
const modalTaskMessage = document.getElementById("modalTaskMessage");
const modalCommentsList = document.getElementById("modalCommentsList");
const modalCommentsCount = document.getElementById("modalCommentsCount");
const taskCommentForm = document.getElementById("taskCommentForm");
const taskCommentInput = document.getElementById("taskCommentInput");
const postCommentBtn = document.getElementById("postCommentBtn");

const modalMoveTodoBtn = document.getElementById("modalMoveTodoBtn");
const modalMoveInProgressBtn = document.getElementById("modalMoveInProgressBtn");
const modalMoveCompletedBtn = document.getElementById("modalMoveCompletedBtn");

let activeModalTaskId = null;

function showModalMessage(type, message) {
  if (!modalTaskMessage) return;
  modalTaskMessage.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show mb-3" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const loadTaskComments = async (taskId) => {
  const token = localStorage.getItem("token");
  if (!token || !modalCommentsList) return;

  try {
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success) {
      modalCommentsList.innerHTML = `<p class="text-danger small mb-0">Unable to load comments.</p>`;
      return;
    }

    const comments = data.comments || [];
    if (modalCommentsCount) {
      modalCommentsCount.textContent = `${comments.length} comment${comments.length === 1 ? "" : "s"}`;
    }

    if (comments.length === 0) {
      modalCommentsList.innerHTML = `<p class="text-secondary small mb-0">No comments yet. Start the discussion!</p>`;
      return;
    }

    modalCommentsList.innerHTML = comments.map(c => `
      <div class="comment-bubble">
        <div class="comment-header">
          <span class="fw-semibold small text-dark">👤 ${escapeHtml(c.user_name)}</span>
          <span class="small text-secondary" style="font-size: 0.75rem;">${formatRelativeTime(c.created_at)}</span>
        </div>
        <p class="comment-text">${escapeHtml(c.comment_text)}</p>
      </div>
    `).join("");

    modalCommentsList.scrollTop = modalCommentsList.scrollHeight;
  } catch (e) {
    modalCommentsList.innerHTML = `<p class="text-danger small mb-0">Error loading comments.</p>`;
  }
};

const openTaskDetailsModal = async (taskId) => {
  const token = localStorage.getItem("token");
  if (!token || !taskDetailsModalEl) return;

  activeModalTaskId = taskId;
  if (!taskModalInstance && typeof bootstrap !== "undefined") {
    taskModalInstance = new bootstrap.Modal(taskDetailsModalEl);
  }

  if (modalTaskMessage) modalTaskMessage.innerHTML = "";
  if (taskCommentForm) taskCommentForm.reset();

  if (modalTaskTitle) modalTaskTitle.textContent = "Loading task details...";
  if (modalTaskDescription) modalTaskDescription.textContent = "";

  taskModalInstance?.show();

  try {
    const res = await fetch(`/api/tasks/details/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success) {
      showModalMessage("danger", data.message || "Failed to load task details.");
      return;
    }

    const task = data.task;
    if (modalTaskTitle) modalTaskTitle.textContent = task.title;
    if (modalTaskDescription) modalTaskDescription.textContent = task.description || "No description provided.";
    if (modalTaskPriority) {
      modalTaskPriority.textContent = task.priority;
      modalTaskPriority.className = `badge ${task.priority === "HIGH" ? "bg-danger" : task.priority === "MEDIUM" ? "bg-warning text-dark" : "bg-info text-dark"}`;
    }
    if (modalTaskStatus) {
      modalTaskStatus.textContent = task.status === "IN_PROGRESS" ? "IN PROGRESS" : task.status;
      modalTaskStatus.className = `badge ${task.status === "COMPLETED" ? "bg-success" : task.status === "IN_PROGRESS" ? "bg-warning text-dark" : "bg-secondary"}`;
    }
    if (modalTaskSprint) modalTaskSprint.textContent = task.sprint_name || "Unassigned";
    if (modalTaskBacklog) modalTaskBacklog.textContent = `${task.backlog_title || "General"} (${task.story_points || 0} pts)`;
    if (modalTaskAssignee) modalTaskAssignee.textContent = task.assigned_to_name || "Unassigned";
    if (modalTaskDeadline) modalTaskDeadline.textContent = task.deadline ? new Date(task.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No deadline";

    await loadTaskComments(taskId);
  } catch (err) {
    showModalMessage("danger", "Network error loading task.");
  }
};

// Comment submission
if (taskCommentForm) {
  taskCommentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token || !activeModalTaskId) return;

    const commentText = taskCommentInput.value.trim();
    if (!commentText) return;

    postCommentBtn.disabled = true;
    postCommentBtn.innerHTML = "⏳ Posting...";

    try {
      const res = await fetch(`/api/tasks/${activeModalTaskId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ commentText })
      });
      const data = await res.json();

      if (!res.ok) {
        showModalMessage("danger", data.message || "Failed to post comment.");
        return;
      }

      taskCommentInput.value = "";
      await loadTaskComments(activeModalTaskId);
    } catch (err) {
      showModalMessage("danger", "Network error posting comment.");
    } finally {
      postCommentBtn.disabled = false;
      postCommentBtn.innerHTML = "💬 Post Comment";
    }
  });
}

// Quick status updates inside modal
const updateModalTaskStatus = async (targetStatus) => {
  const token = localStorage.getItem("token");
  if (!token || !activeModalTaskId) return;

  try {
    const res = await fetch(`/api/tasks/${activeModalTaskId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: targetStatus })
    });
    const data = await res.json();

    if (!res.ok) {
      showModalMessage("danger", data.message || "Failed to update status.");
      return;
    }

    showModalMessage("success", "Task status updated.");
    if (modalTaskStatus) {
      modalTaskStatus.textContent = targetStatus === "IN_PROGRESS" ? "IN PROGRESS" : targetStatus;
      modalTaskStatus.className = `badge ${targetStatus === "COMPLETED" ? "bg-success" : targetStatus === "IN_PROGRESS" ? "bg-warning text-dark" : "bg-secondary"}`;
    }

    if (typeof loadKanbanTasks === "function" && kanbanProjectSelect?.value) {
      loadKanbanTasks(kanbanProjectSelect.value);
    }
  } catch (err) {
    showModalMessage("danger", "Network error updating task status.");
  }
};

if (modalMoveTodoBtn) modalMoveTodoBtn.addEventListener("click", () => updateModalTaskStatus("TODO"));
if (modalMoveInProgressBtn) modalMoveInProgressBtn.addEventListener("click", () => updateModalTaskStatus("IN_PROGRESS"));
if (modalMoveCompletedBtn) modalMoveCompletedBtn.addEventListener("click", () => updateModalTaskStatus("COMPLETED"));

// ==========================================
// Agile Analytics & Burndown Hub
// ==========================================
const analyticsProjectSelect = document.getElementById("analyticsProjectSelect");
const analyticsSprintSelect = document.getElementById("analyticsSprintSelect");
const analyticsContent = document.getElementById("analyticsContent");
const analyticsPlaceholder = document.getElementById("analyticsPlaceholder");
const refreshAnalyticsBtn = document.getElementById("refreshAnalyticsBtn");
const analyticsMessage = document.getElementById("analyticsMessage");

const statSprintStatus = document.getElementById("statSprintStatus");
const statSprintDates = document.getElementById("statSprintDates");
const statTotalStoryPoints = document.getElementById("statTotalStoryPoints");
const statTotalTasks = document.getElementById("statTotalTasks");
const statCompletedTasks = document.getElementById("statCompletedTasks");
const statCompletionPct = document.getElementById("statCompletionPct");
const statTeamSize = document.getElementById("statTeamSize");

const memberContributionTableBody = document.getElementById("memberContributionTableBody");
const activityFeedList = document.getElementById("activityFeedList");
const activityCountBadge = document.getElementById("activityCountBadge");
const burndownMetricBadge = document.getElementById("burndownMetricBadge");
const burndownEmptyState = document.getElementById("burndownEmptyState");

let burndownChartInstance = null;
let priorityChartInstance = null;

if (analyticsProjectSelect && analyticsSprintSelect) {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  function showAnalyticsMessage(type, message) {
    if (!analyticsMessage) return;
    analyticsMessage.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }

  function getActivityIcon(actionType) {
    switch (actionType) {
      case "SPRINT_CREATED":
      case "SPRINT_STATUS_UPDATED":
        return "⚡";
      case "TASK_CREATED":
      case "TASK_STATUS_UPDATED":
        return "✅";
      case "BACKLOG_CREATED":
      case "BACKLOG_ASSIGNED":
        return "📋";
      case "FILE_UPLOADED":
        return "📄";
      case "COMMENT_ADDED":
        return "💬";
      case "MEMBER_JOINED":
        return "👥";
      default:
        return "📌";
    }
  }

  const loadBurndownChart = async (sprintId) => {
    if (!sprintId) return;

    try {
      const res = await fetch(`/api/sprints/${sprintId}/burndown`, { headers: authHeaders });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      const b = data.burndown;
      if (burndownMetricBadge) burndownMetricBadge.textContent = b.metricType;

      if (statSprintStatus) statSprintStatus.textContent = b.status;
      if (statSprintDates) {
        const s = new Date(b.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        const e = new Date(b.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        statSprintDates.textContent = `${s} - ${e}`;
      }
      if (statTotalStoryPoints) statTotalStoryPoints.textContent = `${b.totalStoryPoints} pts`;
      if (statTotalTasks) statTotalTasks.textContent = `${b.totalTasks} sprint tasks`;
      if (statCompletedTasks) statCompletedTasks.textContent = b.completedTasks;
      if (statCompletionPct) {
        const pct = b.totalTasks > 0 ? Math.round((b.completedTasks / b.totalTasks) * 100) : 0;
        statCompletionPct.textContent = `${pct}% completed`;
      }

      const canvas = document.getElementById("burndownChartCanvas");
      if (!canvas || typeof Chart === "undefined") return;

      if (burndownChartInstance) {
        burndownChartInstance.destroy();
      }

      const ctx = canvas.getContext("2d");
      burndownChartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: b.dateLabels,
          datasets: [
            {
              label: `Ideal Burn (${b.metricType})`,
              data: b.idealBurn,
              borderColor: "#94a3b8",
              borderDash: [6, 6],
              borderWidth: 2,
              pointRadius: 3,
              fill: false,
              tension: 0.1
            },
            {
              label: `Actual Remaining (${b.metricType})`,
              data: b.actualBurn,
              borderColor: "#2563eb",
              backgroundColor: "rgba(37, 99, 235, 0.1)",
              borderWidth: 3,
              pointBackgroundColor: "#2563eb",
              pointRadius: 5,
              fill: true,
              tension: 0.2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: { font: { weight: "bold" } }
            },
            tooltip: {
              mode: "index",
              intersect: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: `Remaining ${b.metricType}`,
                font: { weight: "bold" }
              },
              grid: { color: "#f1f5f9" }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    } catch (err) {
      console.error("Burndown chart error:", err);
    }
  };

  const loadProjectActivities = async (projectId) => {
    if (!activityFeedList) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/activities`, { headers: authHeaders });
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      const activities = data.activities || [];
      if (activityCountBadge) activityCountBadge.textContent = `${activities.length} events`;

      if (activities.length === 0) {
        activityFeedList.innerHTML = `
          <li class="text-center py-4 text-secondary small">
            No project activities logged yet.
          </li>
        `;
        return;
      }

      activityFeedList.innerHTML = activities.map(act => `
        <li class="activity-item">
          <div class="activity-icon">${getActivityIcon(act.action_type)}</div>
          <div class="activity-content">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong class="small text-dark">${escapeHtml(act.user_name)}</strong>
              <span class="small text-secondary" style="font-size: 0.75rem;">${formatRelativeTime(act.created_at)}</span>
            </div>
            <p class="small text-secondary mb-0">${escapeHtml(act.description)}</p>
          </div>
        </li>
      `).join("");
    } catch (err) {
      activityFeedList.innerHTML = `<li class="text-danger small py-3">Failed to load activity feed.</li>`;
    }
  };

  const loadProjectAnalytics = async (projectId) => {
    if (!projectId) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/analytics`, { headers: authHeaders });
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      const a = data.analytics;

      // Render Member Contributions
      const members = a.memberContributions || [];
      if (statTeamSize) statTeamSize.textContent = members.length;

      if (members.length === 0) {
        memberContributionTableBody.innerHTML = `
          <tr><td colspan="5" class="text-center py-4 text-secondary">No team members found.</td></tr>
        `;
      } else {
        memberContributionTableBody.innerHTML = members.map(m => {
          const tot = Number(m.total_tasks) || 0;
          const comp = Number(m.completed_tasks) || 0;
          const pct = tot > 0 ? Math.round((comp / tot) * 100) : 0;

          return `
            <tr>
              <td>
                <div class="fw-bold text-dark">👤 ${escapeHtml(m.full_name)}</div>
              </td>
              <td>
                <span class="badge text-bg-light border">${escapeHtml(m.project_role || "Member")}</span>
              </td>
              <td>
                <span class="fw-semibold">${comp}</span> / <span class="text-secondary">${tot} done</span>
              </td>
              <td>
                <span class="badge text-bg-info text-white">${m.completed_story_points || 0} pts</span>
              </td>
              <td style="min-width: 120px;">
                <div class="small fw-semibold mb-1">${pct}%</div>
                <div class="progress" style="height: 6px;">
                  <div class="progress-bar bg-success" style="width: ${pct}%;"></div>
                </div>
              </td>
            </tr>
          `;
        }).join("");
      }

      // Render Priority Balance Chart
      const pCanvas = document.getElementById("priorityChartCanvas");
      if (pCanvas && typeof Chart !== "undefined") {
        if (priorityChartInstance) {
          priorityChartInstance.destroy();
        }

        const pCtx = pCanvas.getContext("2d");
        const pb = a.priorityBreakdown;

        priorityChartInstance = new Chart(pCtx, {
          type: "doughnut",
          data: {
            labels: ["High Priority", "Medium Priority", "Low Priority"],
            datasets: [
              {
                data: [pb.high, pb.medium, pb.low],
                backgroundColor: ["#ef4444", "#f59e0b", "#06b6d4"],
                borderWidth: 2,
                borderColor: "#ffffff"
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom",
                labels: { boxWidth: 12, font: { size: 11 } }
              }
            },
            cutout: "65%"
          }
        });
      }

      await loadProjectActivities(projectId);
    } catch (err) {
      console.error("Project analytics error:", err);
    }
  };

  const loadSprintsForAnalytics = async (projectId) => {
    try {
      const res = await fetch(`/api/sprints/${projectId}`, { headers: authHeaders });
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      const sprints = data.sprints || [];

      if (sprints.length === 0) {
        analyticsSprintSelect.disabled = true;
        analyticsSprintSelect.innerHTML = `<option value="">No sprints created yet</option>`;
        return;
      }

      analyticsSprintSelect.disabled = false;
      analyticsSprintSelect.innerHTML = sprints.map(s => `
        <option value="${s.sprint_id}" ${s.status === "ACTIVE" ? "selected" : ""}>
          ${escapeHtml(s.sprint_name)} (${escapeHtml(s.status)})
        </option>
      `).join("");

      const activeSprint = sprints.find(s => s.status === "ACTIVE") || sprints[0];
      if (activeSprint) {
        analyticsSprintSelect.value = activeSprint.sprint_id;
        await loadBurndownChart(activeSprint.sprint_id);
      }
    } catch (err) {
      analyticsSprintSelect.innerHTML = `<option value="">Unable to load sprints</option>`;
    }
  };

  const handleAnalyticsProjectSelect = async (projectId) => {
    if (!projectId) {
      analyticsContent.classList.add("d-none");
      analyticsPlaceholder.classList.remove("d-none");
      analyticsSprintSelect.disabled = true;
      analyticsSprintSelect.innerHTML = `<option value="">Choose a project first</option>`;
      return;
    }

    analyticsContent.classList.remove("d-none");
    analyticsPlaceholder.classList.add("d-none");

    await Promise.all([
      loadSprintsForAnalytics(projectId),
      loadProjectAnalytics(projectId)
    ]);
  };

  const loadAnalyticsProjects = async () => {
    const res = await fetch("/api/projects", { headers: authHeaders });
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    if (data.projects.length === 0) {
      analyticsProjectSelect.innerHTML = `<option value="">No projects found</option>`;
      return;
    }

    analyticsProjectSelect.innerHTML = `
      <option value="">Select a project</option>
      ${data.projects.map(p => `
        <option value="${p.project_id}">${escapeHtml(p.project_name)} (${escapeHtml(p.project_code)})</option>
      `).join("")}
    `;

    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get("projectId");
    if (urlProjectId && data.projects.some(p => String(p.project_id) === String(urlProjectId))) {
      analyticsProjectSelect.value = urlProjectId;
      await handleAnalyticsProjectSelect(urlProjectId);
    }
  };

  analyticsProjectSelect.addEventListener("change", () => {
    handleAnalyticsProjectSelect(analyticsProjectSelect.value);
  });

  analyticsSprintSelect.addEventListener("change", () => {
    loadBurndownChart(analyticsSprintSelect.value);
  });

  if (refreshAnalyticsBtn) {
    refreshAnalyticsBtn.addEventListener("click", async () => {
      const pid = analyticsProjectSelect.value;
      if (pid) {
        await handleAnalyticsProjectSelect(pid);
        showAnalyticsMessage("info", "Analytics and burndown charts refreshed.");
      }
    });
  }

  loadAnalyticsProjects().catch(() => {
    analyticsProjectSelect.innerHTML = `<option value="">Unable to load projects</option>`;
  });
}