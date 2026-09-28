/* =========================================================
   Job Application Tracker — Frontend Logic
   Talks only to the existing Spring Boot APIs:
     GET    /api/applications
     GET    /api/applications/{id}
     POST   /api/applications
     PUT    /api/applications/{id}
     DELETE /api/applications/{id}
     GET    /api/applications/search?company=
     GET    /api/applications/role?role=
     GET    /api/applications/location?location=
     GET    /api/applications/status?status=
     GET    /api/applications/search/advanced?company=&role=&location=&status=
     GET    /api/dashboard/stats
   No mock data. No invented endpoints.
   ========================================================= */

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

const API_BASE = "/api/applications";
const DASHBOARD_STATS_URL = "/api/dashboard/stats";

// Must match the backend's ApplicationStatus enum exactly.
const STATUS_ORDER = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];

const STATUS_LABELS = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const STATUS_BADGE_CLASS = {
  APPLIED: "badge-applied",
  SCREENING: "badge-screening",
  INTERVIEW: "badge-interview",
  OFFER: "badge-offer",
  REJECTED: "badge-rejected",
  WITHDRAWN: "badge-withdrawn",
};

// Holds whatever the applications table is currently showing,
// so edit/delete actions can look a row up by id without a refetch.
let currentApplications = [];

// Set while the confirm dialog is open, so its "Delete" button
// knows which application id to act on.
let pendingDeleteId = null;

// ---------------------------------------------------------
// Small helpers
// ---------------------------------------------------------

function formatSalary(salary) {
  if (salary === null || salary === undefined || salary === "") {
    return "—";
  }
  return "₹" + Number(salary).toLocaleString("en-IN");
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const parsed = new Date(dateString + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusBadgeHtml(status) {
  const label = STATUS_LABELS[status] || status || "Unknown";
  const cls = STATUS_BADGE_CLASS[status] || "badge-applied";
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

// Wraps fetch() so every API call handles non-2xx responses and
// network failures the same way. Callers get either parsed JSON
// (or null for a 204) or a thrown Error with a readable message.
async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    throw new Error("Could not reach the server. Check that the backend is running.");
  }

  if (response.status === 204) {
    return null; // DELETE success — no body
  }

  if (response.status === 404) {
    throw new Error("That application could not be found. It may have already been deleted.");
  }

  if (response.status === 400) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || "Please check the form — some fields are invalid.");
  }

  if (!response.ok) {
    throw new Error(`Something went wrong on the server (status ${response.status}).`);
  }

  return response.json();
}

// ---------------------------------------------------------
// Toasts
// ---------------------------------------------------------

function showToast(message, type = "success") {
  const stack = document.getElementById("toastStack");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function showError(message) {
  showToast(message, "error");
}

// ---------------------------------------------------------
// View switching (Dashboard / Applications / Add-Edit Form)
// ---------------------------------------------------------

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((section) => {
    section.hidden = section.id !== viewId;
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.view === viewId);
  });

  const titles = {
    "dashboard-view": ["Dashboard", "A quick look at where every application stands."],
    "applications-view": ["Applications", "Search, filter, and manage every application you've logged."],
    "form-view": [null, null], // set by openAddForm / openEditForm instead
  };

  if (titles[viewId] && titles[viewId][0]) {
    document.getElementById("pageTitle").textContent = titles[viewId][0];
    document.getElementById("pageSubtitle").textContent = titles[viewId][1];
  }

  if (viewId === "dashboard-view") {
    loadDashboardStats();
    loadApplications();
  }
  if (viewId === "applications-view") {
    loadApplications();
  }
}

document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
  link.addEventListener("click", () => {
    if (link.id === "navAddApplication") {
      openAddForm();
    } else {
      switchView(link.dataset.view);
    }
  });
});

document.querySelectorAll(".link-btn[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

document.getElementById("topbarAddBtn").addEventListener("click", openAddForm);

// ---------------------------------------------------------
// Dashboard statistics — GET /api/dashboard/stats
// ---------------------------------------------------------

async function loadDashboardStats() {
  const grid = document.getElementById("statsGrid");
  try {
    const stats = await apiRequest(DASHBOARD_STATS_URL);
    renderStats(stats);
  } catch (err) {
    grid.innerHTML = "";
    showError(err.message);
  }
}

function renderStats(stats) {
  const grid = document.getElementById("statsGrid");

  // Total is not returned by the backend — sum the per-status counts ourselves.
  const total = STATUS_ORDER.reduce((sum, key) => sum + (stats[key] || 0), 0);

  const cards = [
    { label: "Total Applications", value: total, total: true },
    ...STATUS_ORDER.map((key) => ({ label: STATUS_LABELS[key], value: stats[key] || 0 })),
  ];

  grid.innerHTML = cards
    .map(
      (card) => `
      <div class="stat-card ${card.total ? "stat-total" : ""}">
        <div class="stat-value">${card.value}</div>
        <div class="stat-label">${escapeHtml(card.label)}</div>
      </div>`
    )
    .join("");
}

// ---------------------------------------------------------
// Applications list — GET /api/applications (and search/filter variants)
// ---------------------------------------------------------

async function loadApplications() {
  await fetchAndRenderApplications(API_BASE);
}

async function fetchAndRenderApplications(url, resultLabel = null) {
  const loadingEl = document.getElementById("applicationsLoadingState");
  const emptyEl = document.getElementById("applicationsEmptyState");
  const tbody = document.getElementById("applicationsTableBody");
  const resultCountEl = document.getElementById("resultCount");

  loadingEl.hidden = false;
  emptyEl.hidden = true;
  tbody.innerHTML = "";

  try {
    const applications = await apiRequest(url);
    currentApplications = applications;
    renderApplications(applications);
    renderRecentApplications(applications);

    if (resultLabel) {
      resultCountEl.hidden = false;
      resultCountEl.textContent = `${applications.length} result${applications.length === 1 ? "" : "s"} for ${resultLabel}`;
    } else {
      resultCountEl.hidden = true;
    }
  } catch (err) {
    showError(err.message);
    tbody.innerHTML = "";
    emptyEl.hidden = false;
    emptyEl.textContent = "Couldn't load applications. Try again in a moment.";
  } finally {
    loadingEl.hidden = true;
  }
}

function renderApplications(applications) {
  const tbody = document.getElementById("applicationsTableBody");
  const emptyEl = document.getElementById("applicationsEmptyState");

  if (!applications || applications.length === 0) {
    tbody.innerHTML = "";
    emptyEl.textContent = "No applications match this view.";
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;

  tbody.innerHTML = applications
    .map(
      (app) => `
      <tr>
        <td class="cell-company">${escapeHtml(app.company)}</td>
        <td>${escapeHtml(app.role)}</td>
        <td class="cell-muted">${escapeHtml(app.location)}</td>
        <td>${statusBadgeHtml(app.status)}</td>
        <td class="cell-muted">${formatDate(app.dateApplied)}</td>
        <td class="cell-muted">${formatSalary(app.salary)}</td>
        <td>
          <div class="actions-cell">
            <button class="icon-action-btn" title="Edit" aria-label="Edit ${escapeHtml(app.company)}" onclick="openEditForm(${app.id})">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button class="icon-action-btn danger" title="Delete" aria-label="Delete ${escapeHtml(app.company)}" onclick="confirmDeleteApplication(${app.id})">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}

function renderRecentApplications(applications) {
  const tbody = document.getElementById("recentTableBody");
  const emptyEl = document.getElementById("recentEmptyState");

  const recent = [...applications]
    .sort((a, b) => (b.dateApplied || "").localeCompare(a.dateApplied || ""))
    .slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = "";
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  tbody.innerHTML = recent
    .map(
      (app) => `
      <tr>
        <td class="cell-company">${escapeHtml(app.company)}</td>
        <td>${escapeHtml(app.role)}</td>
        <td>${statusBadgeHtml(app.status)}</td>
        <td class="cell-muted">${formatDate(app.dateApplied)}</td>
      </tr>`
    )
    .join("");
}

// ---------------------------------------------------------
// Search — GET /api/applications/search?company=
// ---------------------------------------------------------

const companySearchInput = document.getElementById("companySearchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
let searchDebounceTimer = null;

companySearchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  const term = companySearchInput.value.trim();
  clearSearchBtn.hidden = term.length === 0;

  searchDebounceTimer = setTimeout(() => {
    if (term.length === 0) {
      loadApplications();
      return;
    }
    searchApplications(term);
  }, 300);
});

clearSearchBtn.addEventListener("click", () => {
  companySearchInput.value = "";
  clearSearchBtn.hidden = true;
  loadApplications();
});

async function searchApplications(company) {
  const url = `${API_BASE}/search?company=${encodeURIComponent(company)}`;
  await fetchAndRenderApplications(url, `company "${company}"`);
}

// ---------------------------------------------------------
// Advanced filtering — GET /api/applications/search/advanced
// ---------------------------------------------------------

const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");
const filterPanel = document.getElementById("filterPanel");

toggleFiltersBtn.addEventListener("click", () => {
  const isOpen = !filterPanel.hidden;
  filterPanel.hidden = isOpen;
  toggleFiltersBtn.setAttribute("aria-expanded", String(!isOpen));
});

document.getElementById("applyFiltersBtn").addEventListener("click", filterApplications);
document.getElementById("clearFiltersBtn").addEventListener("click", () => {
  document.getElementById("filterRole").value = "";
  document.getElementById("filterLocation").value = "";
  document.getElementById("filterStatus").value = "";
  companySearchInput.value = "";
  clearSearchBtn.hidden = true;
  loadApplications();
});

async function filterApplications() {
  const params = new URLSearchParams();

  const company = companySearchInput.value.trim();
  const role = document.getElementById("filterRole").value.trim();
  const location = document.getElementById("filterLocation").value.trim();
  const status = document.getElementById("filterStatus").value;

  // Only include params that actually have a value.
  if (company) params.set("company", company);
  if (role) params.set("role", role);
  if (location) params.set("location", location);
  if (status) params.set("status", status);

  if ([...params].length === 0) {
    loadApplications();
    return;
  }

  const url = `${API_BASE}/search/advanced?${params.toString()}`;
  await fetchAndRenderApplications(url, "the selected filters");
}

// ---------------------------------------------------------
// Add / Edit form — POST /api/applications, PUT /api/applications/{id}
// ---------------------------------------------------------

const applicationForm = document.getElementById("applicationForm");
const formHeading = document.getElementById("formHeading");
const submitFormBtn = document.getElementById("submitFormBtn");

function openAddForm() {
  applicationForm.reset();
  document.getElementById("applicationId").value = "";
  formHeading.textContent = "Add Application";
  submitFormBtn.textContent = "Save Application";
  document.getElementById("fieldStatus").value = "APPLIED";
  clearFormErrors();

  document.getElementById("pageTitle").textContent = "Add Application";
  document.getElementById("pageSubtitle").textContent = "Log a new application to start tracking it.";
  switchView("form-view");
}

function openEditForm(id) {
  const app = currentApplications.find((a) => a.id === id);
  if (!app) {
    showError("Couldn't find that application — try refreshing the list.");
    return;
  }

  clearFormErrors();
  document.getElementById("applicationId").value = app.id;
  document.getElementById("fieldCompany").value = app.company || "";
  document.getElementById("fieldRole").value = app.role || "";
  document.getElementById("fieldLocation").value = app.location || "";
  document.getElementById("fieldStatus").value = app.status || "APPLIED";
  document.getElementById("fieldDateApplied").value = app.dateApplied || "";
  document.getElementById("fieldSalary").value = app.salary ?? "";

  formHeading.textContent = `Edit — ${app.company}`;
  submitFormBtn.textContent = "Update Application";

  document.getElementById("pageTitle").textContent = "Edit Application";
  document.getElementById("pageSubtitle").textContent = "The backend replaces the full record, so all fields are resent.";
  switchView("form-view");
}

document.getElementById("cancelFormBtn").addEventListener("click", () => switchView("applications-view"));

function clearFormErrors() {
  document.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
  document.querySelectorAll(".form-field").forEach((el) => el.classList.remove("has-error"));
}

// Mirrors the backend's @NotBlank checks so the person gets instant
// feedback instead of waiting on a round trip for a 400.
function validateForm() {
  clearFormErrors();
  let isValid = true;

  const requiredFields = [
    ["fieldCompany", "errorCompany", "Company is required."],
    ["fieldRole", "errorRole", "Role is required."],
    ["fieldLocation", "errorLocation", "Location is required."],
  ];

  requiredFields.forEach(([fieldId, errorId, message]) => {
    const field = document.getElementById(fieldId);
    if (!field.value.trim()) {
      document.getElementById(errorId).textContent = message;
      field.closest(".form-field").classList.add("has-error");
      isValid = false;
    }
  });

  return isValid;
}

applicationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateForm()) return;

  const id = document.getElementById("applicationId").value;
  const salaryValue = document.getElementById("fieldSalary").value;

  // Matches the JobApplication entity fields exactly. id is never sent.
  const payload = {
    company: document.getElementById("fieldCompany").value.trim(),
    role: document.getElementById("fieldRole").value.trim(),
    location: document.getElementById("fieldLocation").value.trim(),
    status: document.getElementById("fieldStatus").value,
    dateApplied: document.getElementById("fieldDateApplied").value || null,
    salary: salaryValue === "" ? null : Number(salaryValue),
  };

  await saveApplication(id, payload);
});

async function saveApplication(id, payload) {
  submitFormBtn.disabled = true;
  submitFormBtn.textContent = "Saving…";

  try {
    if (id) {
      await apiRequest(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showToast("Application updated.");
    } else {
      await apiRequest(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showToast("Application added.");
    }

    applicationForm.reset();
    switchView("applications-view");
    loadDashboardStats();
  } catch (err) {
    showError(err.message);
  } finally {
    submitFormBtn.disabled = false;
    submitFormBtn.textContent = id ? "Update Application" : "Save Application";
  }
}

// ---------------------------------------------------------
// Delete — DELETE /api/applications/{id}
// ---------------------------------------------------------

const confirmBackdrop = document.getElementById("confirmBackdrop");

function confirmDeleteApplication(id) {
  const app = currentApplications.find((a) => a.id === id);
  pendingDeleteId = id;
  document.getElementById("confirmMessage").textContent = app
    ? `This will permanently remove the application to ${app.company}.`
    : "This action can't be undone.";
  confirmBackdrop.hidden = false;
}

document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirmDialog);
confirmBackdrop.addEventListener("click", (event) => {
  if (event.target === confirmBackdrop) closeConfirmDialog();
});

function closeConfirmDialog() {
  confirmBackdrop.hidden = true;
  pendingDeleteId = null;
}

document.getElementById("confirmOkBtn").addEventListener("click", async () => {
  if (pendingDeleteId === null) return;
  const id = pendingDeleteId;
  closeConfirmDialog();
  await deleteApplication(id);
});

async function deleteApplication(id) {
  try {
    await apiRequest(`${API_BASE}/${id}`, { method: "DELETE" }); // 204 No Content on success
    showToast("Application deleted.");
    loadApplications();
    loadDashboardStats();
  } catch (err) {
    showError(err.message);
  }
}

// ---------------------------------------------------------
// Initial load
// ---------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardStats();
  loadApplications();
});
