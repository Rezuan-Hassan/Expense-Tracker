/**
 * AuraFinance - Premium Local-First Personal Wealth & Analytics Controller
 * Implements premium skeuomorphic layouts, custom spline canvas charts, and robust API mapping.
 */

// Global Application State Manager
const AppState = {
  activePanel: "dashboard",
  appPin: "",
  pinEnabled: false,
  currencySymbol: "$",
  dateFormat: "YYYY-MM-DD",
  
  // Expenses list state
  expenses: [],
  expenseTotalCount: 0,
  expensePage: 1,
  expenseLimit: 10,
  expenseTotalPages: 1,
  selectedExpenseIds: new Set(),
  
  // Categories mapping
  categories: [],
  
  // Custom spline rendering parameters
  chartTrends: []
};

// -------------------------------------------------------------
// CORE ROUTINES & SERVICE WORKER INITIALIZERS
// -------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  initLiveClock();
  setupNavigation();
  setupSecurityLock();
  setupSettingsHandlers();
  setupDataImportHandlers();
  
  // Setup CRUD trigger events
  document.getElementById("addExpenseBtn").addEventListener("click", () => openExpenseModal());
  document.getElementById("addIncomeBtn").addEventListener("click", () => openIncomeModal());
  document.getElementById("addBudgetBtn").addEventListener("click", () => openBudgetModal());
  document.getElementById("addCategoryBtn").addEventListener("click", () => openCategoryModal());
  document.getElementById("addRecurringBtn").addEventListener("click", () => openRecurringModal());
  document.getElementById("addGoalBtn").addEventListener("click", () => openGoalModal());
  
  document.getElementById("lockAppBtn").addEventListener("click", () => lockAppSession());
  document.getElementById("refreshLogsBtn").addEventListener("click", () => loadLogs());
  document.getElementById("undoActionBtn").addEventListener("click", () => triggerUndoDelete());
  
  // Pagination actions
  document.getElementById("expensePrevPageBtn").addEventListener("click", () => changeExpensePage(-1));
  document.getElementById("expenseNextPageBtn").addEventListener("click", () => changeExpensePage(1));
  
  // Selection select-all checkbox
  document.getElementById("expenseSelectAllCheckbox").addEventListener("change", toggleSelectAllExpenses);
  
  // Filter adjustments
  document.getElementById("expenseSearchInput").addEventListener("input", debounce(() => {
    AppState.expensePage = 1;
    loadExpenses();
  }, 300));
  document.getElementById("expenseCategoryFilter").addEventListener("change", () => {
    AppState.expensePage = 1;
    loadExpenses();
  });
  document.getElementById("expensePriorityFilter").addEventListener("change", () => {
    AppState.expensePage = 1;
    loadExpenses();
  });
  
  document.getElementById("incomeSearchInput").addEventListener("input", debounce(() => {
    loadIncome();
  }, 300));
  document.getElementById("incomeSourceTypeFilter").addEventListener("change", () => {
    loadIncome();
  });
  
  // Read setup configuration
  checkSecurityConfiguration();
});

function initLiveClock() {
  const clockEl = document.getElementById("liveClock");
  const updateClock = () => {
    const now = new Date();
    // Beautiful formatted output
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const sec = pad(now.getSeconds());
    clockEl.innerHTML = `<i class="fa-solid fa-clock"></i> ${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
  };
  updateClock();
  setInterval(updateClock, 1000);
}

// Single-page navigation controller
function setupNavigation() {
  const menuItems = document.querySelectorAll(".nav-item");
  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      menuItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      
      const targetPanel = item.getAttribute("data-panel");
      navigateToPanel(targetPanel);
    });
  });
}

function navigateToPanel(panelId) {
  AppState.activePanel = panelId;
  
  // Header adjustments
  const titleEl = document.getElementById("pageTitle");
  const subtitleEl = document.getElementById("pageSubtitle");
  
  const panelTitles = {
    dashboard: { t: "Dashboard Overview", s: "Local financial tracking and real-time cash forecasts" },
    expenses: { t: "Expense Records Ledger", s: "Manage your spending, tag categories, and duplicate logs" },
    income: { t: "Income Streams", s: "Monitor salary payouts, contractor deposits, and dividends" },
    budgets: { t: "Budget Allocations", s: "Set dynamic limits by category to guard against overspending" },
    categories: { t: "Categories System", s: "Personalize transaction folders with custom color profiles" },
    recurring: { t: "Recurring Subscriptions", s: "Establish recurring automatic billing and pay schedules" },
    goals: { t: "Savings Targets", s: "Track progress towards cars, laptop hardware, and holiday plans" },
    logs: { t: "System Audit Logs", s: "Detailed activity history and local ledger validation logs" },
    settings: { t: "System Configurations", s: "Alter theme preferences, set PIN lock security, or create backups" }
  };
  
  if (panelTitles[panelId]) {
    titleEl.textContent = panelTitles[panelId].t;
    subtitleEl.textContent = panelTitles[panelId].s;
  }
  
  // Show active view panel
  const panels = document.querySelectorAll(".page-panel");
  panels.forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${panelId}`).classList.add("active");
  
  // Synchronize dynamic panels
  refreshPanelData(panelId);
}

function refreshPanelData(panelId) {
  switch (panelId) {
    case "dashboard":
      loadDashboardSummary();
      break;
    case "overview":
      loadOverviewData();
      break;
    case "expenses":
      loadExpenses();
      break;
    case "income":
      loadIncome();
      break;
    case "budgets":
      loadBudgets();
      break;
    case "categories":
      loadCategories();
      break;
    case "recurring":
      loadRecurring();
      break;
    case "goals":
      loadGoals();
      break;
    case "logs":
      loadLogs();
      break;
    case "settings":
      loadSettings();
      break;
  }
}

// -------------------------------------------------------------
// REST CLIENT WRAPPERS (AUTH PIN ATTACHED)
// -------------------------------------------------------------

async function fetchAPI(url, options = {}) {
  // Inject the custom local security header
  if (!options.headers) {
    options.headers = {};
  }
  options.headers["X-App-PIN"] = AppState.appPin;
  if (options.body && !(options.body instanceof FormData)) {
    options.headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, options);
    
    // Auto-lock validation from backend
    if (response.status === 401) {
      const errData = await response.json();
      if (errData.locked) {
        showToast("Session security lock engaged", "error");
        lockAppSession();
        throw new Error("Lock screen active");
      }
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try { errorJson = JSON.parse(errorText); } catch (e) {}
      const errMsg = errorJson ? errorJson.error : `HTTP error! status: ${response.status}`;
      throw new Error(errMsg);
    }
    
    // If it's a file download (like Exports)
    const contentType = response.headers.get("content-type");
    if (contentType && (contentType.includes("csv") || contentType.includes("octet-stream") || contentType.includes("json") && response.headers.get("content-disposition"))) {
      return response;
    }
    
    return await response.json();
  } catch (err) {
    if (err.message !== "Lock screen active") {
      showToast(err.message, "error");
    }
    throw err;
  }
}

// -------------------------------------------------------------
// LOCAL PIN LOCK SYSTEM
// -------------------------------------------------------------

let inputPinDigits = "";

function setupSecurityLock() {
  // If user hits Escape or locks manually, slide down the overlay
}

async function checkSecurityConfiguration() {
  try {
    // Read settings without custom pin (bootstrap request)
    const res = await fetch("/api/settings");
    const settings = await res.json();
    AppState.pinEnabled = settings.pin_enabled;
    AppState.currencySymbol = settings.currency_symbol || "$";
    AppState.dateFormat = settings.date_format || "YYYY-MM-DD";
    
    // Populate categories to cache
    await loadCategoriesCache();
    
    if (AppState.pinEnabled) {
      document.getElementById("lockScreen").classList.remove("unlocked");
      document.getElementById("lockScreenMessage").textContent = "Enter Security PIN to Unlock Session";
    } else {
      document.getElementById("lockScreen").classList.add("unlocked");
      // Load initial dashboard metrics
      loadDashboardSummary();
    }
  } catch (e) {
    console.error("Initialization error", e);
  }
}

function pressPinNum(num) {
  if (inputPinDigits.length >= 4) return;
  inputPinDigits += num;
  updatePinDots();
  
  if (inputPinDigits.length === 4) {
    // Attempt login validation
    validateSessionPin();
  }
}

function deletePinDigit() {
  if (inputPinDigits.length === 0) return;
  inputPinDigits = inputPinDigits.slice(0, -1);
  updatePinDots();
}

function clearPin() {
  inputPinDigits = "";
  updatePinDots();
}

function updatePinDots() {
  const dots = [1, 2, 3, 4];
  dots.forEach(d => {
    const dot = document.getElementById(`pin-dot-${d}`);
    if (d <= inputPinDigits.length) {
      dot.classList.add("filled");
    } else {
      dot.classList.remove("filled");
    }
  });
  document.getElementById("pinErrorMessage").textContent = "";
}

async function validateSessionPin() {
  try {
    const res = await fetch("/api/security/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: inputPinDigits })
    });
    
    if (res.ok) {
      AppState.appPin = inputPinDigits;
      document.getElementById("lockScreen").classList.add("unlocked");
      showToast("Identity confirmed. Access granted.");
      // Load app dashboard
      loadDashboardSummary();
      clearPin();
    } else {
      throw new Error("Invalid Vault PIN code");
    }
  } catch (err) {
    document.getElementById("pinErrorMessage").textContent = "Incorrect Passcode. Try again.";
    clearPin();
    showToast("Access Denied", "error");
  }
}

function lockAppSession() {
  inputPinDigits = "";
  updatePinDots();
  document.getElementById("lockScreen").classList.remove("unlocked");
  showToast("Vault session locked.", "warning");
}

// -------------------------------------------------------------
// DASHBOARD COMPILATION & SUMMARY STATS
// -------------------------------------------------------------

async function loadDashboardSummary() {
  try {
    const overviewData = await fetchAPI("/api/overview");
    const fmt = (val) => formatCurrency(val);
    
    // Update the 6 new cards on the dashboard
    document.getElementById("cardMonthIncome").textContent = fmt(overviewData.monthly.income);
    document.getElementById("cardMonthExpense").textContent = fmt(overviewData.monthly.expenses);
    document.getElementById("cardMonthSavings").textContent = fmt(overviewData.monthly.savings);
    
    document.getElementById("cardYearIncome").textContent = fmt(overviewData.yearly.income);
    document.getElementById("cardYearExpense").textContent = fmt(overviewData.yearly.expenses);
    document.getElementById("cardYearSavings").textContent = fmt(overviewData.yearly.savings);
    
    // Savings visual deficit formatting
    document.getElementById("cardMonthSavings").style.color = overviewData.monthly.savings < 0 ? "var(--color-magenta)" : "";
    document.getElementById("cardYearSavings").style.color = overviewData.yearly.savings < 0 ? "var(--color-magenta)" : "";

    const data = await fetchAPI("/api/summary");
    
    // Save trend data to cache and run chart renderer
    AppState.chartTrends = data.daily_trends || [];
    renderSplineChart();
    
    // Load dashboard list sections
    renderRecentTableOnDashboard();
    renderBudgetsOnDashboard();
  } catch (err) {
    console.error(err);
  }
}

async function renderRecentTableOnDashboard() {
  try {
    const data = await fetchAPI("/api/expenses?page=1&limit=5");
    const body = document.querySelector("#dashboardRecentTable tbody");
    body.innerHTML = "";
    
    if (data.expenses.length === 0) {
      body.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No recent expenses logged.</td></tr>`;
      return;
    }
    
    data.expenses.forEach(exp => {
      const cat = AppState.categories.find(c => c.name === exp.category) || { color: "#5C5C5C" };
      body.innerHTML += `
        <tr>
          <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(exp.title)}</td>
          <td>
            <span class="category-badge" style="background: ${cat.color};">
              <i class="fa-solid fa-${escapeHtml(cat.icon || 'tag')}"></i> ${escapeHtml(exp.category)}
            </span>
          </td>
          <td>${formatDateDisplay(exp.date)}</td>
          <td style="font-weight: 800; color: var(--color-magenta);">${formatCurrency(exp.amount)}</td>
        </tr>
      `;
    });
  } catch (e) {
    console.error(e);
  }
}

async function renderBudgetsOnDashboard() {
  try {
    const budgets = await fetchAPI("/api/budgets");
    const container = document.getElementById("dashboardBudgetsList");
    container.innerHTML = "";
    
    if (budgets.length === 0) {
      container.innerHTML = `<p style="text-align:center; color:var(--text-secondary); font-size:13px;">No category limits specified yet.</p>`;
      return;
    }
    
    // Display top 3 budgets
    const displayList = budgets.slice(0, 3);
    
    // Fetch expenses to calculate spending
    const expensesRes = await fetchAPI("/api/expenses?limit=1000");
    const expenses = expensesRes.expenses || [];
    const nowPrefix = new Date().toISOString().substring(0, 7); // YYYY-MM
    
    displayList.forEach(bud => {
      const spent = expenses
        .filter(e => e.category === bud.category && e.date.startsWith(nowPrefix))
        .reduce((sum, e) => sum + parseFloat(e.amount), 0.0);
        
      const limit = parseFloat(bud.limit);
      const remaining = limit - spent;
      const overspent = remaining < 0;
      const percent = Math.min((spent / limit) * 100, 100);
      
      const catObj = AppState.categories.find(c => c.name === bud.category) || { color: "var(--color-teal-deep)" };
      
      container.innerHTML += `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px;">
            <span style="font-weight:700; color:var(--text-primary);">${escapeHtml(bud.category)}</span>
            <span style="font-weight:600; color:${overspent ? 'var(--color-magenta)' : 'var(--text-secondary)'}">
              ${formatCurrency(spent)} / ${formatCurrency(limit)}
            </span>
          </div>
          <div class="skeuo-progress-track" style="height: 10px;">
            <div class="skeuo-progress-fill ${overspent ? 'magenta' : ''}" style="width: ${percent}%; background: ${overspent ? '' : catObj.color};"></div>
          </div>
        </div>
      `;
    });
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// DYNAMIC SPLINE HTML CANVAS CHART DRAWING ENGINE ("Sachviers")
// -------------------------------------------------------------

function renderSplineChart() {
  const canvas = document.getElementById("chartCanvas");
  if (!canvas) return;
  
  // Set real screen resolutions to prevent pixelation on Retina displays
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  
  const width = rect.width;
  const height = rect.height;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 40;
  const paddingBottom = 40;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  // Clean canvas context
  ctx.clearRect(0, 0, width, height);
  
  const trends = AppState.chartTrends;
  if (trends.length === 0) {
    ctx.fillStyle = "var(--text-secondary)";
    ctx.font = "14px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Gathering offline ledger statistics...", width / 2, height / 2);
    return;
  }
  
  // Calculate boundary ranges
  const maxIncome = Math.max(...trends.map(t => parseFloat(t.income)), 500);
  const maxExpense = Math.max(...trends.map(t => parseFloat(t.expenses)), 500);
  const maxVal = Math.max(maxIncome, maxExpense) * 1.15; // 15% head clearance
  
  // Draw Background faint grid lines (evenly spaced horizontal lines)
  const gridLines = 4;
  ctx.strokeStyle = "rgba(185, 175, 160, 0.25)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "var(--text-secondary)";
  ctx.font = "10px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "right";
  
  for (let i = 0; i <= gridLines; i++) {
    const yVal = (maxVal / gridLines) * i;
    const y = paddingTop + chartHeight - (yVal / maxVal) * chartHeight;
    
    // Draw grid row line
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    
    // Draw Y axis labels
    ctx.fillText(formatCurrency(yVal, 0), paddingLeft - 10, y + 3);
  }
  
  // Plot horizontal dates along X-axis
  ctx.textAlign = "center";
  const labelInterval = Math.max(Math.floor(trends.length / 5), 1);
  for (let i = 0; i < trends.length; i++) {
    if (i % labelInterval === 0 || i === trends.length - 1) {
      const x = paddingLeft + (i / (trends.length - 1)) * chartWidth;
      const dt = new Date(trends[i].date);
      const label = `${dt.getMonth() + 1}/${dt.getDate()}`;
      ctx.fillText(label, x, height - paddingBottom + 18);
    }
  }
  
  // Helper to map coordinates
  const getCoordinates = (field) => {
    return trends.map((t, idx) => {
      const x = paddingLeft + (idx / (trends.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (parseFloat(t[field]) / maxVal) * chartHeight;
      return { x, y };
    });
  };
  
  const incomePoints = getCoordinates("income");
  const expensePoints = getCoordinates("expenses");
  
  // Custom Spline bezier drawer
  const drawSplineWave = (points, strokeColor, gradStart, gradStop, fillColor) => {
    if (points.length < 2) return;
    
    // Draw Area gradient block under the spline
    ctx.beginPath();
    ctx.moveTo(points[0].x, paddingTop + chartHeight);
    ctx.lineTo(points[0].x, points[0].y);
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, p1.x, p1.y);
    }
    
    ctx.lineTo(points[points.length - 1].x, paddingTop + chartHeight);
    ctx.closePath();
    
    // Create fill gradient
    const fillGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
    fillGrad.addColorStop(0, gradStart);
    fillGrad.addColorStop(1, gradStop);
    ctx.fillStyle = fillGrad;
    ctx.fill();
    
    // Draw the top line path
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, p1.x, p1.y);
    }
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    
    // Draw glossy 3D beads/marbles on significant peaks or standard intervals
    points.forEach((p, idx) => {
      if (idx % Math.max(Math.floor(points.length / 8), 1) === 0 || idx === points.length - 1) {
        drawGlossyBead(ctx, p.x, p.y, 6.5, strokeColor);
      }
    });
  };
  
  // Render Income Wave
  drawSplineWave(
    incomePoints,
    "var(--color-teal-light)",
    "rgba(41, 164, 166, 0.15)",
    "rgba(41, 164, 166, 0.0)",
    "teal"
  );
  
  // Render Expense Wave
  drawSplineWave(
    expensePoints,
    "var(--color-magenta)",
    "rgba(168, 19, 96, 0.15)",
    "rgba(168, 19, 96, 0.0)",
    "magenta"
  );
}

function drawGlossyBead(ctx, x, y, radius, color) {
  // Draw perfect glossy spherical bead with speculative reflection highlight
  ctx.beginPath();
  const grad = ctx.createRadialGradient(x - radius/3, y - radius/3, 1, x, y, radius);
  grad.addColorStop(0, "#FFFFFF");
  grad.addColorStop(0.2, color);
  grad.addColorStop(1, darkenHexColor(color, 30));
  
  ctx.fillStyle = grad;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Specular white light reflection point on top-left quadrant
  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.arc(x - radius/2.5, y - radius/2.5, radius/5, 0, Math.PI * 2);
  ctx.fill();
}

function darkenHexColor(hex, percent) {
  // Safe color darkener for 3D sphere gradient stop
  let num = parseInt(hex.replace("#",""), 16),
  amt = Math.round(2.55 * percent),
  r = (num >> 16) - amt,
  b = ((num >> 8) & 0x00FF) - amt,
  g = (num & 0x0000FF) - amt;
  return "#" + (0x1000000 + (r<0?0:r)*0x10000 + (b<0?0:b)*0x100 + (g<0?0:g)).toString(16).slice(1);
}

// Draw charts on window resized dynamically
window.addEventListener("resize", () => {
  renderSplineChart();
  if (AppState.activePanel === "overview") {
    if (activeOverviewTab === "monthly") {
      renderMonthlyOverviewCharts();
    } else {
      renderYearlyOverviewCharts();
    }
  }
});

// -------------------------------------------------------------
// EXPENSES LEDGER MANAGEMENT & CRUD
// -------------------------------------------------------------

async function loadExpenses() {
  try {
    const search = document.getElementById("expenseSearchInput").value;
    const category = document.getElementById("expenseCategoryFilter").value;
    const priority = document.getElementById("expensePriorityFilter").value;
    
    const query = `/api/expenses?page=${AppState.expensePage}&limit=${AppState.expenseLimit}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&priority=${encodeURIComponent(priority)}`;
    const data = await fetchAPI(query);
    
    AppState.expenses = data.expenses;
    AppState.expenseTotalCount = data.total_count;
    AppState.expenseTotalPages = data.pages;
    
    // Draw list
    renderExpensesTable();
    
    // Clear selections on reload
    AppState.selectedExpenseIds.clear();
    document.getElementById("expenseSelectAllCheckbox").checked = false;
    toggleBulkDeleteBtn();
  } catch (e) {
    console.error(e);
  }
}

function renderExpensesTable() {
  const body = document.getElementById("expensesTableBody");
  body.innerHTML = "";
  
  const textCount = document.getElementById("expensePaginationText");
  textCount.textContent = `Showing ${(AppState.expensePage - 1) * AppState.expenseLimit + 1} - ${Math.min(AppState.expensePage * AppState.expenseLimit, AppState.expenseTotalCount)} of ${AppState.expenseTotalCount} items`;
  
  if (AppState.expenses.length === 0) {
    body.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary);">No matching expense records found.</td></tr>`;
    return;
  }
  
  AppState.expenses.forEach(exp => {
    const isSelected = AppState.selectedExpenseIds.has(exp.id);
    const catObj = AppState.categories.find(c => c.name === exp.category) || { color: "#5C5C5C" };
    
    body.innerHTML += `
      <tr class="${isSelected ? 'selected' : ''}">
        <td><input type="checkbox" class="select-row-checkbox expense-row-check" data-id="${exp.id}" ${isSelected ? 'checked' : ''} onchange="toggleSelectExpense('${exp.id}')"></td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(exp.title)}</div>
          ${exp.note ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top:4px;">${escapeHtml(exp.note)}</div>` : ''}
        </td>
        <td style="font-weight: 800; color: var(--color-magenta);">${formatCurrency(exp.amount)}</td>
        <td>
          <span class="category-badge" style="background: ${catObj.color};">
            <i class="fa-solid fa-${escapeHtml(catObj.icon || 'tag')}"></i> ${escapeHtml(exp.category)}
          </span>
        </td>
        <td>${formatDateDisplay(exp.date)}</td>
        <td><span class="priority-indicator ${escapeHtml(exp.priority)}">${capitalize(exp.priority)}</span></td>
        <td>${escapeHtml(exp.payment_method)}</td>
        <td>
          ${(exp.tags || []).map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-fav ${exp.favorite ? 'active' : ''}" onclick="toggleFavoriteExpense('${exp.id}', ${exp.favorite})" title="Favorite"><i class="fa-solid fa-heart"></i></button>
            <button class="btn-imp ${exp.important ? 'active' : ''}" onclick="toggleImportantExpense('${exp.id}', ${exp.important})" title="Important"><i class="fa-solid fa-star"></i></button>
            <button class="btn-icon" onclick="duplicateExpense('${exp.id}')" title="Duplicate"><i class="fa-solid fa-copy"></i></button>
            <button class="btn-icon" onclick="openExpenseModal('${exp.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="btn-icon delete" onclick="deleteExpense('${exp.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </td>
      </tr>
    `;
  });
}

function toggleSelectExpense(id) {
  if (AppState.selectedExpenseIds.has(id)) {
    AppState.selectedExpenseIds.delete(id);
  } else {
    AppState.selectedExpenseIds.add(id);
  }
  
  // Highlight row in CSS
  renderExpensesTable();
  toggleBulkDeleteBtn();
}

function toggleSelectAllExpenses() {
  const isChecked = document.getElementById("expenseSelectAllCheckbox").checked;
  if (isChecked) {
    AppState.expenses.forEach(e => AppState.selectedExpenseIds.add(e.id));
  } else {
    AppState.selectedExpenseIds.clear();
  }
  renderExpensesTable();
  toggleBulkDeleteBtn();
}

function toggleBulkDeleteBtn() {
  const btn = document.getElementById("bulkDeleteExpenseBtn");
  if (AppState.selectedExpenseIds.size > 0) {
    btn.style.display = "inline-flex";
    btn.textContent = `Delete Selected (${AppState.selectedExpenseIds.size})`;
  } else {
    btn.style.display = "none";
  }
}

document.getElementById("bulkDeleteExpenseBtn").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to perform bulk deletion of selected items?")) return;
  try {
    const ids = Array.from(AppState.selectedExpenseIds);
    await fetchAPI("/api/expenses/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids })
    });
    showToast(`Bulk deleted ${ids.length} records successfully.`);
    AppState.expensePage = 1;
    loadExpenses();
  } catch (e) {
    console.error(e);
  }
});

async function openExpenseModal(id = "") {
  // Populate category options inside modal selector
  const catSelect = document.getElementById("expenseCategory");
  catSelect.innerHTML = "";
  AppState.categories.forEach(cat => {
    catSelect.innerHTML += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
  });
  
  if (id) {
    // Edit Mode
    document.getElementById("expenseModalTitle").textContent = "Modify Expense Details";
    try {
      const exp = AppState.expenses.find(e => e.id === id);
      if (!exp) return;
      
      document.getElementById("formExpenseId").value = exp.id;
      document.getElementById("expenseTitle").value = exp.title;
      document.getElementById("expenseAmount").value = exp.amount;
      document.getElementById("expenseCategory").value = exp.category;
      document.getElementById("expenseDate").value = exp.date;
      document.getElementById("expensePriority").value = exp.priority;
      document.getElementById("expensePayment").value = exp.payment_method;
      document.getElementById("expenseStatus").value = exp.status;
      document.getElementById("expenseTags").value = (exp.tags || []).join(", ");
      document.getElementById("expenseNote").value = exp.note || "";
      
      openModal("modalExpense");
    } catch (e) {
      console.error(e);
    }
  } else {
    // Add Mode
    document.getElementById("expenseModalTitle").textContent = "Register New Expense";
    document.getElementById("formExpenseId").value = "";
    document.getElementById("expenseForm").reset();
    document.getElementById("expenseDate").value = new Date().toISOString().substring(0, 10);
    openModal("modalExpense");
  }
}

async function saveExpense(event) {
  event.preventDefault();
  const id = document.getElementById("formExpenseId").value;
  const tagsText = document.getElementById("expenseTags").value;
  const tagList = tagsText.split(",").map(t => t.trim()).filter(t => t.length > 0);
  
  const payload = {
    title: document.getElementById("expenseTitle").value,
    amount: parseFloat(document.getElementById("expenseAmount").value),
    category: document.getElementById("expenseCategory").value,
    date: document.getElementById("expenseDate").value,
    priority: document.getElementById("expensePriority").value,
    payment_method: document.getElementById("expensePayment").value,
    status: document.getElementById("expenseStatus").value,
    tags: tagList,
    note: document.getElementById("expenseNote").value
  };
  
  try {
    if (id) {
      // Update
      await fetchAPI(`/api/expenses/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Expense record details saved.");
    } else {
      // Add
      await fetchAPI("/api/expenses", { method: "POST", body: JSON.stringify(payload) });
      showToast("New expense transaction added.");
    }
    closeModal("modalExpense");
    loadExpenses();
  } catch (e) {
    console.error(e);
  }
}

async function deleteExpense(id) {
  if (!confirm("Are you sure you want to delete this expense record?")) return;
  try {
    await fetchAPI(`/api/expenses/${id}`, { method: "DELETE" });
    showToast("Expense removed successfully.");
    
    // Show undo banner
    showUndoBanner();
    
    loadExpenses();
  } catch (e) {
    console.error(e);
  }
}

let undoBannerTimeout = null;
function showUndoBanner() {
  const banner = document.getElementById("undoBanner");
  banner.style.display = "flex";
  
  if (undoBannerTimeout) {
    clearTimeout(undoBannerTimeout);
  }
  
  // Slide out after 10 seconds automatically
  undoBannerTimeout = setTimeout(() => {
    banner.style.display = "none";
  }, 10000);
}

async function triggerUndoDelete() {
  try {
    await fetchAPI("/api/expenses/undo", { method: "POST" });
    showToast("Last transaction restored successfully.");
    document.getElementById("undoBanner").style.display = "none";
    
    if (AppState.activePanel === "expenses") {
      loadExpenses();
    } else if (AppState.activePanel === "dashboard") {
      loadDashboardSummary();
    }
  } catch (e) {
    console.error(e);
  }
}

async function duplicateExpense(id) {
  try {
    await fetchAPI(`/api/expenses/duplicate/${id}`, { method: "POST" });
    showToast("Expense record duplicated.");
    loadExpenses();
  } catch (e) {
    console.error(e);
  }
}

async function toggleFavoriteExpense(id, currentVal) {
  try {
    await fetchAPI(`/api/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify({ favorite: !currentVal })
    });
    loadExpenses();
  } catch (e) {
    console.error(e);
  }
}

async function toggleImportantExpense(id, currentVal) {
  try {
    await fetchAPI(`/api/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify({ important: !currentVal })
    });
    loadExpenses();
  } catch (e) {
    console.error(e);
  }
}

function changeExpensePage(direction) {
  const newPage = AppState.expensePage + direction;
  if (newPage < 1 || newPage > AppState.expenseTotalPages) return;
  AppState.expensePage = newPage;
  loadExpenses();
}

// -------------------------------------------------------------
// INCOME streams MANAGEMENT & CRUD
// -------------------------------------------------------------

async function loadIncome() {
  try {
    const search = document.getElementById("incomeSearchInput").value;
    const type = document.getElementById("incomeSourceTypeFilter").value;
    
    const query = `/api/income?search=${encodeURIComponent(search)}&source_type=${encodeURIComponent(type)}`;
    const incomeList = await fetchAPI(query);
    
    const body = document.getElementById("incomeTableBody");
    body.innerHTML = "";
    
    if (incomeList.length === 0) {
      body.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No income records logged.</td></tr>`;
      return;
    }
    
    incomeList.forEach(inc => {
      const catObj = AppState.categories.find(c => c.name === inc.category) || { color: "#5C5C5C" };
      body.innerHTML += `
        <tr>
          <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(inc.title)}</td>
          <td style="font-weight: 800; color: var(--color-teal-light);">${formatCurrency(inc.amount)}</td>
          <td>
            <span class="category-badge" style="background: ${catObj.color};">
              <i class="fa-solid fa-${escapeHtml(catObj.icon || 'tag')}"></i> ${escapeHtml(inc.category)}
            </span>
          </td>
          <td><span style="font-weight: 600; text-transform: capitalize;">${escapeHtml(inc.source_type)}</span></td>
          <td>${formatDateDisplay(inc.date)}</td>
          <td><span style="font-size:12px; color:var(--text-secondary);">${escapeHtml(inc.note || '')}</span></td>
          <td>
            <div class="table-actions">
              <button class="btn-icon" onclick="openIncomeModal('${inc.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn-icon delete" onclick="deleteIncome('${inc.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `;
    });
  } catch (e) {
    console.error(e);
  }
}

async function openIncomeModal(id = "") {
  const catSelect = document.getElementById("incomeCategory");
  catSelect.innerHTML = "";
  AppState.categories.forEach(cat => {
    catSelect.innerHTML += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
  });
  
  if (id) {
    document.getElementById("incomeModalTitle").textContent = "Modify Income Record";
    try {
      const incList = await fetchAPI("/api/income");
      const inc = incList.find(x => x.id === id);
      if (!inc) return;
      
      document.getElementById("formIncomeId").value = inc.id;
      document.getElementById("incomeTitle").value = inc.title;
      document.getElementById("incomeAmount").value = inc.amount;
      document.getElementById("incomeCategory").value = inc.category;
      document.getElementById("incomeDate").value = inc.date;
      document.getElementById("incomeSourceType").value = inc.source_type;
      document.getElementById("incomeNote").value = inc.note || "";
      
      openModal("modalIncome");
    } catch (e) {
      console.error(e);
    }
  } else {
    document.getElementById("incomeModalTitle").textContent = "Register New Income Flow";
    document.getElementById("formIncomeId").value = "";
    document.getElementById("incomeForm").reset();
    document.getElementById("incomeDate").value = new Date().toISOString().substring(0, 10);
    openModal("modalIncome");
  }
}

async function saveIncome(event) {
  event.preventDefault();
  const id = document.getElementById("formIncomeId").value;
  
  const payload = {
    title: document.getElementById("incomeTitle").value,
    amount: parseFloat(document.getElementById("incomeAmount").value),
    category: document.getElementById("incomeCategory").value,
    date: document.getElementById("incomeDate").value,
    source_type: document.getElementById("incomeSourceType").value,
    note: document.getElementById("incomeNote").value
  };
  
  try {
    if (id) {
      await fetchAPI(`/api/income/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Income record saved successfully.");
    } else {
      await fetchAPI("/api/income", { method: "POST", body: JSON.stringify(payload) });
      showToast("Income stream entry registered.");
    }
    closeModal("modalIncome");
    loadIncome();
  } catch (e) {
    console.error(e);
  }
}

async function deleteIncome(id) {
  if (!confirm("Are you sure you want to remove this income record?")) return;
  try {
    await fetchAPI(`/api/income/${id}`, { method: "DELETE" });
    showToast("Income record deleted.");
    loadIncome();
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// CATEGORY LIMIT BUDGETING & CRUD
// -------------------------------------------------------------

async function loadBudgets() {
  try {
    const budgets = await fetchAPI("/api/budgets");
    const body = document.getElementById("budgetsTableBody");
    body.innerHTML = "";
    
    // Fetch expenses to check limit
    const expensesRes = await fetchAPI("/api/expenses?limit=1000");
    const expenses = expensesRes.expenses || [];
    const nowPrefix = new Date().toISOString().substring(0, 7); // YYYY-MM
    
    if (budgets.length === 0) {
      body.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No category budgets currently configured.</td></tr>`;
      return;
    }
    
    budgets.forEach(bud => {
      // aggregate current month spent
      const spent = expenses
        .filter(e => e.category === bud.category && e.date.startsWith(nowPrefix))
        .reduce((sum, e) => sum + parseFloat(e.amount), 0.0);
        
      const limit = parseFloat(bud.limit);
      const remaining = limit - spent;
      const overspent = remaining < 0;
      const percent = Math.min((spent / limit) * 100, 100);
      
      body.innerHTML += `
        <tr>
          <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(bud.category)}</td>
          <td style="font-weight: 700;">${formatCurrency(limit)}</td>
          <td style="font-weight: 800; color: ${overspent ? 'var(--color-magenta)' : 'var(--text-primary)'}">${formatCurrency(spent)}</td>
          <td style="font-weight: 700; color: ${overspent ? 'var(--color-magenta)' : 'var(--color-teal-light)'}">${formatCurrency(remaining)}</td>
          <td style="text-transform: capitalize;">${escapeHtml(bud.period)}</td>
          <td>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <div class="skeuo-progress-track" style="height: 10px; width: 140px;">
                <div class="skeuo-progress-fill ${overspent ? 'magenta' : ''}" style="width: ${percent}%;"></div>
              </div>
              <span style="font-size:10px; font-weight:600; color:var(--text-secondary);">${percent.toFixed(0)}% consumed</span>
            </div>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn-icon" onclick="openBudgetModal('${bud.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn-icon delete" onclick="deleteBudget('${bud.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `;
    });
  } catch (e) {
    console.error(e);
  }
}

async function openBudgetModal(id = "") {
  const catSelect = document.getElementById("budgetCategory");
  catSelect.innerHTML = "";
  AppState.categories.forEach(cat => {
    catSelect.innerHTML += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
  });
  
  if (id) {
    document.getElementById("budgetModalTitle").textContent = "Modify Budget Limit";
    try {
      const budgets = await fetchAPI("/api/budgets");
      const bud = budgets.find(x => x.id === id);
      if (!bud) return;
      
      document.getElementById("formBudgetId").value = bud.id;
      document.getElementById("budgetCategory").value = bud.category;
      document.getElementById("budgetLimit").value = bud.limit;
      document.getElementById("budgetPeriod").value = bud.period;
      
      openModal("modalBudget");
    } catch (e) {
      console.error(e);
    }
  } else {
    document.getElementById("budgetModalTitle").textContent = "Configure Category Budget";
    document.getElementById("formBudgetId").value = "";
    document.getElementById("budgetForm").reset();
    openModal("modalBudget");
  }
}

async function saveBudget(event) {
  event.preventDefault();
  const id = document.getElementById("formBudgetId").value;
  
  const payload = {
    category: document.getElementById("budgetCategory").value,
    limit: parseFloat(document.getElementById("budgetLimit").value),
    period: document.getElementById("budgetPeriod").value
  };
  
  try {
    if (id) {
      await fetchAPI(`/api/budgets/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Budget details updated.");
    } else {
      await fetchAPI("/api/budgets", { method: "POST", body: JSON.stringify(payload) });
      showToast("Category limit successfully configured.");
    }
    closeModal("modalBudget");
    loadBudgets();
  } catch (e) {
    console.error(e);
  }
}

async function deleteBudget(id) {
  if (!confirm("Are you sure you want to clear this category budget limit?")) return;
  try {
    await fetchAPI(`/api/budgets/${id}`, { method: "DELETE" });
    showToast("Budget allocation removed.");
    loadBudgets();
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// DYNAMIC CATEGORY FOLDERS SYSTEM
// -------------------------------------------------------------

async function loadCategoriesCache() {
  try {
    const list = await fetchAPI("/api/categories");
    AppState.categories = list;
    
    // Refresh filter options globally
    const fCat = document.getElementById("expenseCategoryFilter");
    if (fCat) {
      fCat.innerHTML = `<option value="">All Categories</option>`;
      list.forEach(c => {
        fCat.innerHTML += `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`;
      });
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadCategories() {
  await loadCategoriesCache();
  
  const grid = document.getElementById("categoryGrid");
  grid.innerHTML = "";
  
  AppState.categories.forEach(cat => {
    grid.innerHTML += `
      <div class="skeuo-card category-card">
        <div class="category-card-header">
          <div class="category-icon-wrapper" style="background: ${cat.color};">
            <i class="fa-solid fa-${escapeHtml(cat.icon || 'tag')}"></i>
          </div>
          <div class="table-actions">
            <button class="btn-icon" onclick="openCategoryModal('${cat.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="btn-icon delete" onclick="deleteCategory('${cat.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>
        <div class="category-info">
          <h3>${escapeHtml(cat.name)}</h3>
          <span>${cat.parent ? `Sub of ${escapeHtml(cat.parent)}` : 'Root Folder'}</span>
        </div>
      </div>
    `;
  });
}

async function openCategoryModal(id = "") {
  const pSelect = document.getElementById("categoryParent");
  pSelect.innerHTML = `<option value="">No Parent (Root Category)</option>`;
  AppState.categories.filter(c => !c.parent).forEach(c => {
    pSelect.innerHTML += `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`;
  });
  
  if (id) {
    document.getElementById("categoryModalTitle").textContent = "Modify Category Settings";
    try {
      const cat = AppState.categories.find(c => c.id === id);
      if (!cat) return;
      
      document.getElementById("formCategoryId").value = cat.id;
      document.getElementById("categoryName").value = cat.name;
      document.getElementById("categoryColor").value = cat.color;
      document.getElementById("categoryIcon").value = cat.icon;
      document.getElementById("categoryParent").value = cat.parent || "";
      
      openModal("modalCategory");
    } catch (e) {
      console.error(e);
    }
  } else {
    document.getElementById("categoryModalTitle").textContent = "Establish Custom Category";
    document.getElementById("formCategoryId").value = "";
    document.getElementById("categoryForm").reset();
    openModal("modalCategory");
  }
}

async function saveCategory(event) {
  event.preventDefault();
  const id = document.getElementById("formCategoryId").value;
  
  const payload = {
    name: document.getElementById("categoryName").value,
    color: document.getElementById("categoryColor").value,
    icon: document.getElementById("categoryIcon").value,
    parent: document.getElementById("categoryParent").value || null
  };
  
  try {
    if (id) {
      await fetchAPI(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Category changes saved.");
    } else {
      await fetchAPI("/api/categories", { method: "POST", body: JSON.stringify(payload) });
      showToast("Custom category added successfully.");
    }
    closeModal("modalCategory");
    loadCategories();
  } catch (e) {
    console.error(e);
  }
}

async function deleteCategory(id) {
  if (!confirm("Are you sure you want to remove this category? Active transactions under this name will be reverted to 'Uncategorized'.")) return;
  try {
    await fetchAPI(`/api/categories/${id}`, { method: "DELETE" });
    showToast("Category removed successfully.");
    loadCategories();
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// RECURRING TRANSACTIONS SCHEDULING & CRUD
// -------------------------------------------------------------

async function loadRecurring() {
  try {
    const list = await fetchAPI("/api/recurring");
    const body = document.getElementById("recurringTableBody");
    body.innerHTML = "";
    
    if (list.length === 0) {
      body.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary);">No recurring schedules established.</td></tr>`;
      return;
    }
    
    list.forEach(rec => {
      const isExpense = rec.type === "expense";
      const catObj = AppState.categories.find(c => c.name === rec.category) || { color: "#5C5C5C" };
      body.innerHTML += `
        <tr>
          <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(rec.title)}</td>
          <td style="font-weight: 800; color: ${isExpense ? 'var(--color-magenta)' : 'var(--color-teal-light)'}">${formatCurrency(rec.amount)}</td>
          <td>
            <span style="font-weight:700; color:${isExpense ? 'var(--color-magenta)' : 'var(--color-teal-light)'}">
              ${isExpense ? '<i class="fa-solid fa-arrow-trend-down"></i> Outflow' : '<i class="fa-solid fa-arrow-trend-up"></i> Inflow'}
            </span>
          </td>
          <td>
            <span class="category-badge" style="background: ${catObj.color};">
              <i class="fa-solid fa-${escapeHtml(catObj.icon || 'tag')}"></i> ${escapeHtml(rec.category)}
            </span>
          </td>
          <td style="text-transform: capitalize;">${escapeHtml(rec.frequency)}</td>
          <td><span style="font-weight:600; color:var(--color-gold);">${formatDateDisplay(rec.next_date)}</span></td>
          <td><span style="font-size:12px; color:var(--text-secondary);">${rec.last_generated ? formatDateDisplay(rec.last_generated) : 'Never'}</span></td>
          <td>
            <div class="table-actions">
              <button class="btn-icon" onclick="openRecurringModal('${rec.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn-icon delete" onclick="deleteRecurring('${rec.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `;
    });
  } catch (e) {
    console.error(e);
  }
}

async function openRecurringModal(id = "") {
  const catSelect = document.getElementById("recurringCategory");
  catSelect.innerHTML = "";
  AppState.categories.forEach(cat => {
    catSelect.innerHTML += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
  });
  
  if (id) {
    document.getElementById("recurringModalTitle").textContent = "Modify Recurring Schedule";
    try {
      const list = await fetchAPI("/api/recurring");
      const rec = list.find(x => x.id === id);
      if (!rec) return;
      
      document.getElementById("formRecurringId").value = rec.id;
      document.getElementById("recurringTitle").value = rec.title;
      document.getElementById("recurringAmount").value = rec.amount;
      document.getElementById("recurringType").value = rec.type;
      document.getElementById("recurringCategory").value = rec.category;
      document.getElementById("recurringFrequency").value = rec.frequency;
      document.getElementById("recurringNextDate").value = rec.next_date;
      document.getElementById("recurringPriority").value = rec.priority || "medium";
      document.getElementById("recurringNote").value = rec.note || "";
      
      openModal("modalRecurring");
    } catch (e) {
      console.error(e);
    }
  } else {
    document.getElementById("recurringModalTitle").textContent = "Establish Recurring Cycle";
    document.getElementById("formRecurringId").value = "";
    document.getElementById("recurringForm").reset();
    document.getElementById("recurringNextDate").value = new Date().toISOString().substring(0, 10);
    openModal("modalRecurring");
  }
}

async function saveRecurring(event) {
  event.preventDefault();
  const id = document.getElementById("formRecurringId").value;
  
  const payload = {
    title: document.getElementById("recurringTitle").value,
    amount: parseFloat(document.getElementById("recurringAmount").value),
    type: document.getElementById("recurringType").value,
    category: document.getElementById("recurringCategory").value,
    frequency: document.getElementById("recurringFrequency").value,
    next_date: document.getElementById("recurringNextDate").value,
    priority: document.getElementById("recurringPriority").value,
    note: document.getElementById("recurringNote").value
  };
  
  try {
    if (id) {
      await fetchAPI(`/api/recurring/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Recurring payment plan saved.");
    } else {
      await fetchAPI("/api/recurring", { method: "POST", body: JSON.stringify(payload) });
      showToast("Recurring transaction rules active.");
    }
    closeModal("modalRecurring");
    loadRecurring();
  } catch (e) {
    console.error(e);
  }
}

async function deleteRecurring(id) {
  if (!confirm("Are you sure you want to stop this recurring schedule?")) return;
  try {
    await fetchAPI(`/api/recurring/${id}`, { method: "DELETE" });
    showToast("Recurring schedule disabled.");
    loadRecurring();
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// LONG TERM SAVINGS TARGETS & CRUD
// -------------------------------------------------------------

async function loadGoals() {
  try {
    const goals = await fetchAPI("/api/goals");
    const container = document.getElementById("goalsGrid");
    container.innerHTML = "";
    
    if (goals.length === 0) {
      container.innerHTML = `<p style="text-align: center; width: 100%; color: var(--text-secondary); padding: 40px 0;">No savings targets established yet.</p>`;
      return;
    }
    
    goals.forEach(goal => {
      const cur = parseFloat(goal.current_amount);
      const tar = parseFloat(goal.target_amount);
      const percent = Math.min((cur / tar) * 100, 100);
      
      const catObj = AppState.categories.find(c => c.name === goal.category) || { color: "var(--color-teal-deep)" };
      
      container.innerHTML += `
        <div class="skeuo-card goal-card">
          <div class="category-card-header">
            <h3 style="font-size: 17px; font-weight:800; color: var(--color-teal-deep);">${escapeHtml(goal.title)}</h3>
            <div class="table-actions">
              <button class="btn-icon" onclick="openGoalModal('${goal.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn-icon delete" onclick="deleteGoal('${goal.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
          
          <div class="goal-details">
            <div class="goal-amount">${formatCurrency(cur)} <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">saved</span></div>
            <div class="goal-target">Target: ${formatCurrency(tar)}</div>
          </div>

          <div style="display:flex; flex-direction:column; gap:6px;">
            <div class="skeuo-progress-track">
              <div class="skeuo-progress-fill" style="width: ${percent}%; background: ${catObj.color};"></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:700; color:var(--text-secondary);">
              <span>${percent.toFixed(1)}% Completed</span>
              <span>Deadline: ${goal.target_date ? formatDateDisplay(goal.target_date) : 'Flexible'}</span>
            </div>
          </div>
        </div>
      `;
    });
  } catch (e) {
    console.error(e);
  }
}

async function openGoalModal(id = "") {
  const catSelect = document.getElementById("goalCategory");
  catSelect.innerHTML = "";
  AppState.categories.forEach(cat => {
    catSelect.innerHTML += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
  });
  
  if (id) {
    document.getElementById("goalModalTitle").textContent = "Modify Financial Target";
    try {
      const goals = await fetchAPI("/api/goals");
      const goal = goals.find(x => x.id === id);
      if (!goal) return;
      
      document.getElementById("formGoalId").value = goal.id;
      document.getElementById("goalTitle").value = goal.title;
      document.getElementById("goalTargetAmount").value = goal.target_amount;
      document.getElementById("goalCurrentAmount").value = goal.current_amount;
      document.getElementById("goalCategory").value = goal.category;
      document.getElementById("goalTargetDate").value = goal.target_date;
      
      openModal("modalGoal");
    } catch (e) {
      console.error(e);
    }
  } else {
    document.getElementById("goalModalTitle").textContent = "Configure Financial Target";
    document.getElementById("formGoalId").value = "";
    document.getElementById("goalForm").reset();
    document.getElementById("goalTargetDate").value = new Date().toISOString().substring(0, 10);
    openModal("modalGoal");
  }
}

async function saveGoal(event) {
  event.preventDefault();
  const id = document.getElementById("formGoalId").value;
  
  const payload = {
    title: document.getElementById("goalTitle").value,
    target_amount: parseFloat(document.getElementById("goalTargetAmount").value),
    current_amount: parseFloat(document.getElementById("goalCurrentAmount").value || 0.0),
    category: document.getElementById("goalCategory").value,
    target_date: document.getElementById("goalTargetDate").value
  };
  
  try {
    if (id) {
      await fetchAPI(`/api/goals/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Savings target updated.");
    } else {
      await fetchAPI("/api/goals", { method: "POST", body: JSON.stringify(payload) });
      showToast("Savings target established.");
    }
    closeModal("modalGoal");
    loadGoals();
  } catch (e) {
    console.error(e);
  }
}

async function deleteGoal(id) {
  if (!confirm("Are you sure you want to delete this savings target?")) return;
  try {
    await fetchAPI(`/api/goals/${id}`, { method: "DELETE" });
    showToast("Savings target removed.");
    loadGoals();
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// SYSTEM AUDIT OPERATIONS LOG VIEW
// -------------------------------------------------------------

async function loadLogs() {
  try {
    const list = await fetchAPI("/api/logs");
    const container = document.getElementById("logsListContainer");
    container.innerHTML = "";
    
    if (list.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No audit trail events captured yet.</p>`;
      return;
    }
    
    list.forEach(log => {
      const type = log.action.split("_")[0].toLowerCase();
      let tagClass = "system";
      if (type === "create") tagClass = "create";
      else if (type === "delete") tagClass = "delete";
      else if (type === "update") tagClass = "update";
      
      const timeFmt = new Date(log.timestamp).toLocaleString();
      
      container.innerHTML += `
        <div class="log-item">
          <div class="log-item-details">
            <span class="message">${escapeHtml(log.details)}</span>
            <span class="timestamp">${timeFmt}</span>
          </div>
          <span class="log-item-tag ${tagClass}">${escapeHtml(log.action)}</span>
        </div>
      `;
    });
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// SYSTEM SETTINGS & PIN Vault CONFIG
// -------------------------------------------------------------

async function loadSettings() {
  try {
    const settings = await fetchAPI("/api/settings");
    AppState.pinEnabled = settings.pin_enabled;
    AppState.currencySymbol = settings.currency_symbol || "$";
    AppState.dateFormat = settings.date_format || "YYYY-MM-DD";
    
    // Set UI dropdowns
    document.getElementById("settingsCurrency").value = `${settings.currency}|${settings.currency_symbol}`;
    document.getElementById("settingsDateFormat").value = settings.date_format;
    
    const pinCheck = document.getElementById("settingsPinEnabled");
    pinCheck.checked = settings.pin_enabled;
    
    const pinGroup = document.getElementById("settingsPinGroup");
    pinGroup.style.display = settings.pin_enabled ? "flex" : "none";
    document.getElementById("settingsPinValue").value = "";
    
    // Sync active backups list
    loadBackupsList();
  } catch (e) {
    console.error(e);
  }
}

function setupSettingsHandlers() {
  const pinCheck = document.getElementById("settingsPinEnabled");
  pinCheck.addEventListener("change", () => {
    const pinGroup = document.getElementById("settingsPinGroup");
    pinGroup.style.display = pinCheck.checked ? "flex" : "none";
  });
  
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
  
  // Backup configurations
  document.getElementById("createBackupBtn").addEventListener("click", triggerCreateBackup);
  document.getElementById("exportCsvBtn").addEventListener("click", () => triggerFileExport("csv"));
  document.getElementById("exportJsonBtn").addEventListener("click", () => triggerFileExport("json"));
}

async function saveSettings() {
  const currencySplit = document.getElementById("settingsCurrency").value.split("|");
  const pinEnabled = document.getElementById("settingsPinEnabled").checked;
  const pinVal = document.getElementById("settingsPinValue").value.trim();
  
  if (pinEnabled && pinVal.length > 0 && pinVal.length !== 4) {
    showToast("PIN passcode must be exactly 4 digits", "error");
    return;
  }
  
  const payload = {
    currency: currencySplit[0],
    currency_symbol: currencySplit[1],
    date_format: document.getElementById("settingsDateFormat").value,
    pin_enabled: pinEnabled
  };
  
  if (pinEnabled && pinVal) {
    payload.pin = pinVal;
  }
  
  try {
    await fetchAPI("/api/settings", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    
    showToast("Settings configuration saved successfully.");
    
    // Sync memory variables
    AppState.currencySymbol = payload.currency_symbol;
    AppState.dateFormat = payload.date_format;
    AppState.pinEnabled = payload.pin_enabled;
    
    if (pinEnabled && pinVal) {
      AppState.appPin = pinVal; // update matching header cache
    } else if (!pinEnabled) {
      AppState.appPin = ""; // clear PIN auth headers
    }
    
    loadSettings();
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// BACKUP RESTORE SYSTEM & DATA PORTABILITY (CSV / JSON)
// -------------------------------------------------------------

async function loadBackupsList() {
  try {
    const list = await fetchAPI("/api/data/backups");
    const container = document.getElementById("backupsList");
    container.innerHTML = "";
    
    if (list.length === 0) {
      container.innerHTML = `<p style="font-size:12px; color:var(--text-secondary); text-align:center;">No backups found inside /backups directory.</p>`;
      return;
    }
    
    list.forEach(b => {
      const timeFmt = new Date(b.created_at).toLocaleString();
      const kbSize = (b.size / 1024).toFixed(1);
      
      container.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-pure); padding:10px 16px; border-radius:12px; border:1px solid rgba(185,175,160,0.15);">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:12px; font-weight:700; color:var(--text-primary);">${escapeHtml(b.filename)}</span>
            <span style="font-size:10px; color:var(--text-secondary);">${timeFmt} (${kbSize} KB)</span>
          </div>
          <button class="skeuo-button-gold" style="padding:6px 12px; font-size:10px;" onclick="triggerRestoreBackup('${b.filename}')">Restore</button>
        </div>
      `;
    });
  } catch (e) {
    console.error(e);
  }
}

async function triggerCreateBackup() {
  try {
    const res = await fetchAPI("/api/data/backups", { method: "POST" });
    showToast(`Manual database backup compiled successfully: ${res.filename}`);
    loadBackupsList();
  } catch (e) {
    console.error(e);
  }
}

async function triggerRestoreBackup(filename) {
  if (!confirm(`CAUTION: Restoring database to backup '${filename}' will overwrite current transactions. Do you wish to continue?`)) return;
  try {
    await fetchAPI("/api/data/backups/restore", {
      method: "POST",
      body: JSON.stringify({ filename })
    });
    showToast("Rollback database restoration successful.");
    
    // Refresh current panel views
    loadSettings();
  } catch (e) {
    console.error(e);
  }
}

async function triggerFileExport(formatType) {
  try {
    const url = `/api/data/export/${formatType}`;
    // Since we need PIN locking, we fetch with headers, then download as blob
    const response = await fetch(url, {
      headers: { "X-App-PIN": AppState.appPin }
    });
    
    if (!response.ok) throw new Error("Failed compiling export download file.");
    
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition");
    let filename = `aura_finance_export_${formatType}.${formatType}`;
    if (disposition && disposition.includes("filename=")) {
      filename = disposition.split("filename=")[1].replace(/"/g, "");
    }
    
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    
    showToast(`${formatType.toUpperCase()} file exported and downloaded.`);
  } catch (e) {
    showToast(e.message, "error");
  }
}

function setupDataImportHandlers() {
  const trigger = document.getElementById("triggerImportBtn");
  const input = document.getElementById("dataImportInput");
  
  trigger.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    if (input.files.length === 0) return;
    const file = input.files[0];
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetchAPI("/api/data/import", {
        method: "POST",
        body: formData
      });
      showToast("Data file uploaded and integrated successfully.");
      
      // Refresh current page context
      loadSettings();
    } catch (e) {
      console.error(e);
    } finally {
      input.value = ""; // Reset file selector
    }
  });
}

// -------------------------------------------------------------
// UTILITY & VALUE FORMATTING HELPERS
// -------------------------------------------------------------

function formatCurrency(value, decimals = 2) {
  const num = parseFloat(value) || 0.0;
  const symbol = AppState.currencySymbol;
  return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-"); // YYYY-MM-DD
    if (parts.length !== 3) return dateStr;
    const yyyy = parts[0];
    const mm = parts[1];
    const dd = parts[2];
    
    if (AppState.dateFormat === "MM/DD/YYYY") return `${mm}/${dd}/${yyyy}`;
    if (AppState.dateFormat === "DD/MM/YYYY") return `${dd}/${mm}/${yyyy}`;
    return dateStr; // YYYY-MM-DD default
  } catch (e) {
    return dateStr;
  }
}

function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast skeuo-card ${type === "success" ? "" : type}`;
  
  const icon = type === "success" ? "circle-check" : (type === "warning" ? "triangle-exclamation" : "circle-xmark");
  toast.innerHTML = `
    <i class="fa-solid fa-${icon}" style="color:${type === 'success' ? 'var(--color-teal-light)' : (type === 'warning' ? 'var(--color-gold)' : 'var(--color-magenta)')}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);
  
  // slide away
  setTimeout(() => {
    toast.style.animation = "toast-in 0.3s ease reverse forwards";
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 4000);
}

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// -------------------------------------------------------------
// OVERVIEW CONTROLLER & CANVAS CHARTING ENGINE
// -------------------------------------------------------------

let activeOverviewTab = "monthly";
let cachedOverviewData = null;

function switchOverviewTab(tab) {
  activeOverviewTab = tab;
  
  // Toggle pill button active class
  document.getElementById("pillBtnMonthly").classList.toggle("active", tab === "monthly");
  document.getElementById("pillBtnYearly").classList.toggle("active", tab === "yearly");
  
  // Show/Hide section content
  document.getElementById("overviewMonthlyContent").style.display = tab === "monthly" ? "block" : "none";
  document.getElementById("overviewYearlyContent").style.display = tab === "yearly" ? "block" : "none";
  
  // Re-draw visible charts
  if (tab === "monthly") {
    renderMonthlyOverviewCharts();
  } else {
    renderYearlyOverviewCharts();
  }
}

async function loadOverviewData() {
  try {
    const data = await fetchAPI("/api/overview");
    cachedOverviewData = data;
    
    const fmt = (val) => formatCurrency(val);
    
    // 1. Populate Monthly statistics
    document.getElementById("statMonthIncome").textContent = fmt(data.monthly.income);
    document.getElementById("statMonthExpense").textContent = fmt(data.monthly.expenses);
    document.getElementById("statMonthNetBalance").textContent = fmt(data.monthly.net_balance);
    document.getElementById("statMonthSavings").textContent = fmt(data.monthly.savings);
    document.getElementById("statMonthTopCategory").textContent = data.monthly.top_category;
    document.getElementById("statMonthTopCategory").title = data.monthly.top_category;
    document.getElementById("statMonthTopCategoryAmount").textContent = `Spent: ${fmt(data.monthly.top_category_amount)}`;
    document.getElementById("statMonthTransactions").textContent = data.monthly.transactions;
    
    // Monthly comparison badges
    updateComparisonBadge("badgeMonthIncomeComparison", data.monthly.comparison.income, true);
    updateComparisonBadge("badgeMonthExpenseComparison", data.monthly.comparison.expenses, false);
    updateComparisonBadge("badgeMonthNetComparison", data.monthly.comparison.net_balance, true);
    updateComparisonBadge("badgeMonthSavingsComparison", data.monthly.comparison.savings, true);
    
    // Color styling adjustments
    document.getElementById("statMonthSavings").style.color = data.monthly.savings < 0 ? "var(--color-magenta)" : "";
    document.getElementById("statMonthNetBalance").style.color = data.monthly.net_balance < 0 ? "var(--color-magenta)" : "";

    // 2. Populate Yearly statistics
    document.getElementById("statYearIncome").textContent = fmt(data.yearly.income);
    document.getElementById("statYearExpense").textContent = fmt(data.yearly.expenses);
    document.getElementById("statYearNetBalance").textContent = fmt(data.yearly.net_balance);
    document.getElementById("statYearSavings").textContent = fmt(data.yearly.savings);
    document.getElementById("statYearTopCategory").textContent = data.yearly.top_category;
    document.getElementById("statYearTopCategory").title = data.yearly.top_category;
    document.getElementById("statYearTopCategoryAmount").textContent = `Spent: ${fmt(data.yearly.top_category_amount)}`;
    document.getElementById("statYearTransactions").textContent = data.yearly.transactions;
    
    // Yearly comparison badges
    updateComparisonBadge("badgeYearIncomeComparison", data.yearly.comparison.income, true);
    updateComparisonBadge("badgeYearExpenseComparison", data.yearly.comparison.expenses, false);
    updateComparisonBadge("badgeYearNetComparison", data.yearly.comparison.net_balance, true);
    updateComparisonBadge("badgeYearSavingsComparison", data.yearly.comparison.savings, true);
    
    // Color styling adjustments
    document.getElementById("statYearSavings").style.color = data.yearly.savings < 0 ? "var(--color-magenta)" : "";
    document.getElementById("statYearNetBalance").style.color = data.yearly.net_balance < 0 ? "var(--color-magenta)" : "";

    // Render active tab charts
    if (activeOverviewTab === "monthly") {
      renderMonthlyOverviewCharts();
    } else {
      renderYearlyOverviewCharts();
    }
  } catch (err) {
    console.error(err);
  }
}

function updateComparisonBadge(elementId, comp, higherIsGood) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const sign = comp.diff >= 0 ? "+" : "";
  const pctStr = comp.pct.toFixed(1);
  const diffStr = formatCurrency(Math.abs(comp.diff), 0);
  
  el.textContent = `${sign}${pctStr}% (${sign}${diffStr})`;
  el.className = "comparison-badge";
  
  if (comp.diff === 0) {
    el.classList.add("flat");
  } else if (comp.diff > 0) {
    el.classList.add(higherIsGood ? "up" : "down");
  } else {
    el.classList.add(higherIsGood ? "down" : "up");
  }
}

function renderMonthlyOverviewCharts() {
  if (!cachedOverviewData) return;
  drawTrendsChart("chartMonthTrends", cachedOverviewData.analytics.monthly_trends);
  drawCategoryBreakdownChart("chartMonthCategory", cachedOverviewData.analytics.category_breakdown.month);
}

function renderYearlyOverviewCharts() {
  if (!cachedOverviewData) return;
  drawYearlyTrendsChart("chartYearTrends", cachedOverviewData.analytics.yearly_trends);
  drawCategoryBreakdownChart("chartYearCategory", cachedOverviewData.analytics.category_breakdown.year);
}

function drawTrendsChart(canvasId, trends) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  
  const width = rect.width;
  const height = rect.height;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  ctx.clearRect(0, 0, width, height);
  
  if (!trends || trends.length === 0) {
    ctx.fillStyle = "var(--text-secondary)";
    ctx.font = "13px var(--font-sans)";
    ctx.textAlign = "center";
    ctx.fillText("Gathering trend data...", width / 2, height / 2);
    return;
  }
  
  // Find max value
  const maxIncome = Math.max(...trends.map(t => parseFloat(t.income)), 100);
  const maxExpense = Math.max(...trends.map(t => parseFloat(t.spending)), 100);
  const maxVal = Math.max(maxIncome, maxExpense) * 1.15;
  
  // Draw grid lines
  const gridLines = 4;
  ctx.strokeStyle = "rgba(185, 175, 160, 0.2)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "var(--text-secondary)";
  ctx.font = "9px var(--font-sans)";
  ctx.textAlign = "right";
  
  for (let i = 0; i <= gridLines; i++) {
    const yVal = (maxVal / gridLines) * i;
    const y = paddingTop + chartHeight - (yVal / maxVal) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    ctx.fillText(formatCurrency(yVal, 0), paddingLeft - 8, y + 3);
  }
  
  // Draw X axis labels
  ctx.textAlign = "center";
  const labelInterval = Math.max(Math.floor(trends.length / 6), 1);
  for (let i = 0; i < trends.length; i++) {
    if (i % labelInterval === 0 || i === trends.length - 1) {
      const x = paddingLeft + (i / (trends.length - 1)) * chartWidth;
      ctx.fillText(trends[i].month, x, height - paddingBottom + 16);
    }
  }
  
  // Helper to map coordinates
  const getCoordinates = (field) => {
    return trends.map((t, idx) => {
      const x = paddingLeft + (idx / (trends.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (parseFloat(t[field]) / maxVal) * chartHeight;
      return { x, y };
    });
  };
  
  const incomePoints = getCoordinates("income");
  const expensePoints = getCoordinates("spending");
  
  // Function to draw line/wave
  const drawSplineLine = (points, strokeColor, gradStart, gradStop) => {
    if (points.length < 2) return;
    
    // Draw area fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, paddingTop + chartHeight);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = p0.x + (p1.x - p0.x) / 2;
      ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
    }
    ctx.lineTo(points[points.length - 1].x, paddingTop + chartHeight);
    ctx.closePath();
    
    const fillGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
    fillGrad.addColorStop(0, gradStart);
    fillGrad.addColorStop(1, gradStop);
    ctx.fillStyle = fillGrad;
    ctx.fill();
    
    // Draw top stroke line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = p0.x + (p1.x - p0.x) / 2;
      ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw glossy beads
    points.forEach((p) => {
      drawGlossyBead(ctx, p.x, p.y, 5, strokeColor);
    });
  };
  
  // Draw Income Trend Wave
  drawSplineLine(incomePoints, "var(--color-teal-light)", "rgba(41, 164, 166, 0.12)", "rgba(41, 164, 166, 0.0)");
  
  // Draw Expense Trend Wave
  drawSplineLine(expensePoints, "var(--color-magenta)", "rgba(168, 19, 96, 0.12)", "rgba(168, 19, 96, 0.0)");
}

function drawCategoryBreakdownChart(canvasId, categories) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  
  const width = rect.width;
  const height = rect.height;
  const paddingLeft = 110;
  const paddingRight = 60;
  const paddingTop = 25;
  const paddingBottom = 20;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  ctx.clearRect(0, 0, width, height);
  
  // Limit to top 5 categories to fit cleanly
  const displayCats = categories ? categories.slice(0, 5) : [];
  
  if (displayCats.length === 0) {
    ctx.fillStyle = "var(--text-secondary)";
    ctx.font = "13px var(--font-sans)";
    ctx.textAlign = "center";
    ctx.fillText("No transactions in this period", width / 2, height / 2);
    return;
  }
  
  const maxVal = Math.max(...displayCats.map(c => parseFloat(c.amount)), 1.0);
  const rowHeight = chartHeight / displayCats.length;
  
  displayCats.forEach((cat, idx) => {
    const y = paddingTop + idx * rowHeight + (rowHeight - 14) / 2;
    const barWidth = (parseFloat(cat.amount) / maxVal) * chartWidth;
    
    // Find category details for color mapping
    const catDetails = AppState.categories.find(c => c.name === cat.category) || { color: "var(--color-teal-deep)" };
    const color = catDetails.color;
    
    // Draw Category Label
    ctx.fillStyle = "var(--text-primary)";
    ctx.font = "bold 11px var(--font-sans)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    
    let label = cat.category;
    if (label.length > 14) label = label.slice(0, 12) + "..";
    ctx.fillText(label, paddingLeft - 10, y + 7);
    
    // Draw Bar Track (Recessed Pill background)
    ctx.fillStyle = "rgba(185, 175, 160, 0.15)";
    ctx.beginPath();
    ctx.roundRect(paddingLeft, y, chartWidth, 14, 7);
    ctx.fill();
    
    // Draw Filled Bar with top gloss gradient
    const grad = ctx.createLinearGradient(paddingLeft, y, paddingLeft + barWidth, y);
    grad.addColorStop(0, color);
    grad.addColorStop(1, lightenHexColor(color, 25));
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    ctx.roundRect(paddingLeft, y, Math.max(barWidth, 14), 14, 7);
    ctx.fill();
    
    // Draw gloss overlay on top half of the bar
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.roundRect(paddingLeft, y, Math.max(barWidth, 14), 7, 7);
    ctx.fill();
    
    // Draw value label next to the bar
    ctx.fillStyle = "var(--text-secondary)";
    ctx.font = "bold 10px var(--font-sans)";
    ctx.textAlign = "left";
    ctx.fillText(formatCurrency(cat.amount, 0), paddingLeft + barWidth + 8, y + 7);
  });
}

function drawYearlyTrendsChart(canvasId, trends) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  
  const width = rect.width;
  const height = rect.height;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  ctx.clearRect(0, 0, width, height);
  
  if (!trends || trends.length === 0) {
    ctx.fillStyle = "var(--text-secondary)";
    ctx.font = "13px var(--font-sans)";
    ctx.textAlign = "center";
    ctx.fillText("No year-over-year data", width / 2, height / 2);
    return;
  }
  
  const maxIncome = Math.max(...trends.map(t => parseFloat(t.income)), 100);
  const maxExpense = Math.max(...trends.map(t => parseFloat(t.expenses)), 100);
  const maxVal = Math.max(maxIncome, maxExpense) * 1.15;
  
  // Draw grid lines
  const gridLines = 4;
  ctx.strokeStyle = "rgba(185, 175, 160, 0.2)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "var(--text-secondary)";
  ctx.font = "9px var(--font-sans)";
  ctx.textAlign = "right";
  
  for (let i = 0; i <= gridLines; i++) {
    const yVal = (maxVal / gridLines) * i;
    const y = paddingTop + chartHeight - (yVal / maxVal) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    ctx.fillText(formatCurrency(yVal, 0), paddingLeft - 8, y + 3);
  }
  
  // Draw bars
  const groupWidth = chartWidth / trends.length;
  const barWidth = 18;
  const barSpacing = 4;
  
  ctx.textAlign = "center";
  
  trends.forEach((t, idx) => {
    const groupX = paddingLeft + idx * groupWidth + groupWidth / 2;
    
    // Draw X-axis year label
    ctx.fillStyle = "var(--text-primary)";
    ctx.font = "bold 11px var(--font-sans)";
    ctx.fillText(t.year, groupX, height - paddingBottom + 16);
    
    // Bar heights
    const incomeHeight = (parseFloat(t.income) / maxVal) * chartHeight;
    const expenseHeight = (parseFloat(t.expenses) / maxVal) * chartHeight;
    
    const incX = groupX - barWidth - barSpacing/2;
    const expX = groupX + barSpacing/2;
    
    const incY = paddingTop + chartHeight - incomeHeight;
    const expY = paddingTop + chartHeight - expenseHeight;
    
    // Draw Income Bar
    const incGrad = ctx.createLinearGradient(incX, incY, incX, paddingTop + chartHeight);
    incGrad.addColorStop(0, "var(--color-teal-light)");
    incGrad.addColorStop(1, "var(--color-teal-deep)");
    ctx.fillStyle = incGrad;
    ctx.beginPath();
    ctx.roundRect(incX, incY, barWidth, Math.max(incomeHeight, 4), 4);
    ctx.fill();
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.roundRect(incX, incY, barWidth, 4, 2);
    ctx.fill();
    
    // Draw Expense Bar
    const expGrad = ctx.createLinearGradient(expX, expY, expX, paddingTop + chartHeight);
    expGrad.addColorStop(0, "var(--color-magenta)");
    expGrad.addColorStop(1, darkenHexColor("var(--color-magenta)", 20));
    ctx.fillStyle = expGrad;
    ctx.beginPath();
    ctx.roundRect(expX, expY, barWidth, Math.max(expenseHeight, 4), 4);
    ctx.fill();
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.roundRect(expX, expY, barWidth, 4, 2);
    ctx.fill();
  });
}

function lightenHexColor(hex, percent) {
  let num = parseInt(hex.replace("#",""), 16),
  amt = Math.round(2.55 * percent),
  r = (num >> 16) + amt,
  b = ((num >> 8) & 0x00FF) + amt,
  g = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (r>255?255:r)*0x10000 + (b>255?255:b)*0x100 + (g>255?255:g)).toString(16).slice(1);
}
