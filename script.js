const BASE_STORE_KEY = 'et_expenses';
const listEl = document.getElementById('expenseList');
const formEl = document.getElementById('expenseForm');
const amountEl = document.getElementById('amount');
const categoryEl = document.getElementById('category');
const dateEl = document.getElementById('date');
const noteEl = document.getElementById('note');
const totalSpentEl = document.getElementById('totalSpent');
const totalCountEl = document.getElementById('totalCount');
const categorySummaryEl = document.getElementById('categorySummary');
const viewDateEl = document.getElementById('viewDate');
const viewMonthEl = document.getElementById('viewMonth');
const filterCategoryEl = document.getElementById('filterCategory');
const searchTextEl = document.getElementById('searchText');
const clearAllEl = document.getElementById('clearAll');
const currencySelectEl = document.getElementById('currencySelect');
const printBtnEl = document.getElementById('printBtn');
const importFileEl = document.getElementById('importFile');
const budgetsGridEl = document.getElementById('budgetsGrid');
const pieCanvasEl = document.getElementById('pieChart');
const barCanvasEl = document.getElementById('barChart');
const chartLegendEl = document.getElementById('chartLegend');
const printAreaEl = document.getElementById('printArea');
const totalBudgetEl = document.getElementById('totalBudget');
const totalBudgetStatusEl = document.getElementById('totalBudgetStatus');
const budgetsTableBody = document.getElementById('budgetsTableBody'); // Added missing body selector

// modal dialog elements (General Confirmation)
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalCancel = document.getElementById('modalCancel');
const modalOK = document.getElementById('modalOK');

// budget modal elements (Category Budget Editor)
const budgetModal = document.getElementById('budgetModal');
const budgetModalTitle = document.getElementById('budgetModalTitle');
const budgetModalInput = document.getElementById('budgetModalInput');
const budgetModalCancel = document.getElementById('budgetModalCancel');
const budgetModalSave = document.getElementById('budgetModalSave');
const budgetModalCat = document.getElementById('budgetModalCat');
const budgetModalPrev = document.getElementById('budgetModalPrev');

// holds last computed pie segments for hover detection
let pieSegments = [];

const currencyKey = 'et_currency';
const budgetsKey = 'et_budgets';
const totalBudgetKey = 'et_total_budget';
const profilesKey = 'et_profiles';
const currentProfileKey = 'et_current_profile';

const categoryColors = {
  Food: '#FFD60A',
  Transport: '#10B981',
  Shopping: '#6A0DAD',
  Bills: '#2563EB',
  Health: '#EF4444',
  Entertainment: '#22D3EE',
  Other: '#374151'
};

// --- Modal Dialog (General Confirmation) ---
function showModal(title, message) {
  return new Promise((resolve) => {
    modalTitle.textContent = title || '';
    modalMessage.textContent = message || '';
    modalOverlay.hidden = false;
    
    const handleOK = () => {
      modalOverlay.hidden = true;
      cleanup();
      resolve(true);
    };
    
    const handleCancel = () => {
      modalOverlay.hidden = true;
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      modalOK.removeEventListener('click', handleOK);
      modalCancel.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeydown);
    };
    
    const handleKeydown = (e) => {
      if (e.key === 'Enter') handleOK();
      if (e.key === 'Escape') handleCancel();
    };
    
    modalOK.addEventListener('click', handleOK);
    modalCancel.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeydown);
  });
}

// --- Budget Modal (Category Editor) ---
function showBudgetModal(categoryName, currentBudget) {
  if (!budgetModal || !budgetModalInput) return;
  budgetModalTitle.textContent = `Set Budget for ${categoryName}`;
  budgetModalInput.value = Number(currentBudget || 0).toFixed(2);
  budgetModalCat.value = categoryName;
  
  budgetModal.hidden = false;
  // Focus and select the input for quick editing
  setTimeout(() => budgetModalInput.select(), 100);
}

function hideBudgetModal() {
  if (budgetModal) budgetModal.hidden = true;
}

// --- Helpers: profile-aware store key (non-breaking) ---
function getCurrentProfile() {
  // returns current profile name (string). Defaults to "default"
  try {
    return localStorage.getItem(currentProfileKey) || 'default';
  } catch {
    return 'default';
  }
}
function setCurrentProfile(name) {
  try {
    localStorage.setItem(currentProfileKey, name || 'default');
  } catch {}
}
function getStoreKey() {
  // namespaced store key so future multi-profile is possible without breaking old data
  const p = getCurrentProfile();
  return `${BASE_STORE_KEY}_${p}`;
}

// --- Date helpers ---
function todayISO() {
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

// --- Safe localStorage wrappers ---
function safeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// --- Expense storage ---
function loadExpenses() {
  try {
    const raw = localStorage.getItem(getStoreKey());
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function saveExpenses(items) {
  try {
    localStorage.setItem(getStoreKey(), JSON.stringify(items || []));
  } catch {}
}

// --- Currency helpers ---
function guessCurrency() {
  const locale = navigator.language || 'en-US';
  if (locale.startsWith('en-IN')) return 'INR';
  if (locale.startsWith('en-GB')) return 'GBP';
  if (locale.startsWith('en-US')) return 'USD';
  // Check for common Euro countries
  if (locale.endsWith('-FR') || locale.endsWith('-DE') || locale.endsWith('-ES')) return 'EUR';
  return 'INR';
}
function getCurrency() {
  try {
    return localStorage.getItem(currencyKey) || guessCurrency();
  } catch {
    return guessCurrency();
  }
}
function setCurrency(code) {
  try {
    localStorage.setItem(currencyKey, code);
  } catch {}
}
function currency(n) {
  const cur = getCurrency();
  const num = Number(n || 0);
  try {
    return new Intl.NumberFormat(navigator.language, { style: 'currency', currency: cur }).format(num);
  } catch {
    const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : '₹';
    return sym + num.toFixed(2);
  }
}

// --- Category styling helpers ---
function categoryClass(name) {
  const k = (name || '').toLowerCase();
  if (k === 'food') return 'badge-food';
  if (k === 'transport') return 'badge-transport';
  if (k === 'shopping') return 'badge-shopping';
  if (k === 'bills') return 'badge-bills';
  if (k === 'health') return 'badge-health';
  if (k === 'entertainment') return 'badge-entertainment';
  return 'badge-other';
}

// --- Core operations ---
function addExpense(item) {
  if (!item || !item.amount || !item.date || !item.category) return;
  const items = loadExpenses();
  items.push(item);
  saveExpenses(items);
}

function updateExpense(id, patch) {
  const items = loadExpenses();
  const idx = items.findIndex(x => x.id === id);
  if (idx === -1) return false;
  items[idx] = { ...items[idx], ...patch };
  saveExpenses(items);
  return true;
}

function deleteExpense(id) {
  const items = loadExpenses().filter(x => x.id !== id);
  saveExpenses(items);
}

// --- Filtering and rendering flow ---
function filterItems(items) {
  const dateFilter = viewDateEl?.value || '';
  const monthFilter = viewMonthEl?.value || '';
  const catFilter = filterCategoryEl?.value || '';
  const search = (searchTextEl?.value || '').trim().toLowerCase();
  
  return (items || []).filter(x => {
    // Priority: Date filter (overrides month if set)
    const byDate = dateFilter ? x.date === dateFilter : true;
    
    // Month filter (only applied if date filter is NOT set)
    const byMonth = !dateFilter && monthFilter ? (x.date || '').slice(0, 7) === monthFilter : true;
    
    const byCat = catFilter ? x.category === catFilter : true;
    
    const bySearch = search
      ? ((x.note || '').toLowerCase().includes(search) || (x.category || '').toLowerCase().includes(search))
      : true;
      
    return (byDate && byMonth) && byCat && bySearch;
  });
}

// Debounce helper for input-heavy events
function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Row HTML (escaped)
function escapeHTML(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function rowHTML(x) {
  const dateStr = escapeHTML(x.date || '');
  const cls = categoryClass(x.category);
  return `
    <tr data-id="${escapeHTML(x.id)}">
      <td>${dateStr}</td>
      <td><span class="category-badge ${cls}">${escapeHTML(x.category)}</span></td>
      <td>${x.note ? escapeHTML(x.note) : ''}</td>
      <td class="right">${currency(Number(x.amount))}</td>
      <td class="right">
        <button class="action-btn" data-action="edit" title="Edit">Edit</button>
        <button class="action-btn" data-action="delete" title="Delete">Delete</button>
      </td>
    </tr>
  `;
}

// Main render function (keeps consistent ordering)
function render() {
  try {
    // The main expense list rendering uses filtered items
    const filteredItems = filterItems(loadExpenses()).sort((a, b) => b.ts - a.ts);
    listEl.innerHTML = filteredItems.map(rowHTML).join('');
    const total = filteredItems.reduce((s, x) => s + Number(x.amount || 0), 0);
    if (totalSpentEl) totalSpentEl.textContent = currency(total);
    if (totalCountEl) totalCountEl.textContent = (filteredItems.length || 0) + ' items';
    
    // Category summary uses filtered items
    renderCategorySummary(filteredItems);
    
    // Charts and Budgets should use items filtered by the selected month
    renderCharts();
    renderBudgets();
  } catch (err) {
    // graceful fallback
    console.error('render error', err);
  }
}

// category summary
function renderCategorySummary(items) {
  try {
    const sums = {};
    (items || []).forEach(x => {
      const k = x.category || 'Other';
      sums[k] = (sums[k] || 0) + Number(x.amount || 0);
    });
    const entries = Object.entries(sums).sort((a, b) => b[1] - a[1]);
    categorySummaryEl.innerHTML = entries
      .map(([name, val]) => {
        const cls = categoryClass(name);
        return `
        <div class="category-card">
          <span class="category-badge ${cls}">${escapeHTML(name)}</span>
          <span class="card-value">${currency(val)}</span>
        </div>
      `;
      })
      .join('') || '<div class="category-card">No data</div>';
  } catch (err) {
    categorySummaryEl.innerHTML = '';
    console.error('renderCategorySummary', err);
  }
}

// ---------------- CHART HELPERS (HiDPI-friendly) ----------------
function sizeCanvasForDisplay(canvas) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  return (canvas.getContext && canvas.getContext('2d')) ? canvas.getContext('2d') : null;
}

function renderCharts() {
  try {
    if (!pieCanvasEl || !barCanvasEl) return;
    // ensure canvases scaled
    sizeCanvasForDisplay(pieCanvasEl);
    sizeCanvasForDisplay(barCanvasEl);

    const items = loadExpenses();
    const month = (viewMonthEl?.value) || toMonthStr(new Date());
    const monthItems = items.filter(x => (x.date || '').slice(0, 7) === month);
    const byCat = {};
    monthItems.forEach(x => {
      byCat[x.category || 'Other'] = (byCat[x.category || 'Other'] || 0) + Number(x.amount || 0);
    });
    const catEntries = Object.entries(byCat);
    // draw pie and keep segment info to support hover tooltip
    pieSegments = drawPieChart(pieCanvasEl, catEntries) || [];
    // renderLegend is intentionally not called (legend hidden); tooltip shows details on hover

    // spent vs remaining (for the selected month)
    const totalSpent = monthItems.reduce((s, x) => s + Number(x.amount || 0), 0);
    const totalBudget = Number(loadTotalBudget() || 0);
    
    // Remaining is calculated here, but the chart is responsible for visual clamped to 0
    const remaining = totalBudget > 0 ? totalBudget - totalSpent : 0; 
    
    drawSpentRemainingBar(barCanvasEl, totalSpent, remaining, totalBudget);
  } catch (err) {
    console.error('renderCharts error', err);
  }
}

function renderLegend(entries) {
  // ... (unchanged)
}

// convert Date or month to 'YYYY-MM'
function toMonthStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
function daysInMonth(monthStr) {
  // ... (unchanged)
}

// Draw pie chart (simple canvas)
function drawPieChart(canvas, entries) {
  if (!canvas || !canvas.getContext) return [];
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.scale(dpr, dpr);
  // clear using css size
  const cw = parseInt(canvas.style.width || canvas.width / dpr, 10);
  const ch = parseInt(canvas.style.height || canvas.height / dpr, 10);
  ctx.clearRect(0, 0, cw, ch);
  const total = (entries || []).reduce((s, [, v]) => s + v, 0);
  if (total <= 0) {
    // draw "no data"
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px system-ui, Arial';
    ctx.fillText('No data', 10, 20);
    ctx.restore();
    return [];
  }
  const cx = cw / 2;
  const cy = ch / 2;
  const radius = Math.min(cx, cy) - 20;
  let start = -Math.PI / 2; // base starting angle (top)
  const colors = (entries || []).map(([name]) => categoryColors[name] || '#999999');
  const segments = [];
  entries.forEach(([name, val], i) => {
    const angle = (val / total) * Math.PI * 2;
    const end = start + angle;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    // store segment with normalized start/end relative to base
    const base = -Math.PI / 2;
    const twoPi = Math.PI * 2;
    const startRel = ((start - base) % twoPi + twoPi) % twoPi;
    const endRel = ((end - base) % twoPi + twoPi) % twoPi;
    segments.push({ name, value: val, color: colors[i % colors.length], start, end, startRel, endRel, cx, cy, radius });
    start = end;
  });
  ctx.restore();
  return segments;
}

// Draw a simple two-bar chart showing Spent vs Remaining (with optional totalBudget)
function drawSpentRemainingBar(canvas, spent, remaining, totalBudget) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.scale(dpr, dpr);
  const cw = parseInt(canvas.style.width || canvas.width / dpr, 10);
  const ch = parseInt(canvas.style.height || canvas.height / dpr, 10);
  ctx.clearRect(0, 0, cw, ch);

  // top area for total budget
  const topPadding = totalBudget && totalBudget > 0 ? 40 : 20;
  const sidePadding = 32;
  const bottomPadding = 48;
  const w = cw - sidePadding * 2;
  const h = ch - topPadding - bottomPadding;

  const max = Math.max(1, (totalBudget && totalBudget > 0) ? totalBudget : (spent + Math.max(0, remaining)));
  const barW = 70;
  const centerX = sidePadding + w / 2;
  const barGap = 40;

  const leftX = centerX - barW - barGap / 2;
  const rightX = centerX + barGap / 2;

  const spentH = Math.round((spent / max) * h);
  // **Modification**: Visually, the remaining bar height is clamped to 0 if spent > budget.
  const visualRemaining = Math.max(0, remaining); 
  const remainH = Math.round((visualRemaining / max) * h);
  const chartBaseY = topPadding + h;

  // draw total budget label at top
  if (totalBudget && totalBudget > 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px system-ui, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Total: ${currency(totalBudget)}`, cw / 2, 18);
  }

  // y-axis line
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sidePadding, topPadding);
  ctx.lineTo(sidePadding, chartBaseY);
  ctx.stroke();

  // x-axis line
  ctx.beginPath();
  ctx.moveTo(sidePadding, chartBaseY);
  ctx.lineTo(cw - sidePadding, chartBaseY);
  ctx.stroke();

  // spent bar
  const spentY = chartBaseY - spentH;
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(leftX, spentY, barW, spentH);

  // remaining bar
  const remY = chartBaseY - remainH;
  // If budget exceeded, remaining is 0 height and we use a fallback color on the label
  ctx.fillStyle = remaining >= 0 ? '#10B981' : '#F59E0B'; 
  ctx.fillRect(rightX, remY, barW, remainH);

  // bar labels and values
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 13px system-ui, Arial';
  ctx.textAlign = 'center';

  // spent label and value
  ctx.fillText('Spent', leftX + barW / 2, chartBaseY + 20);
  ctx.font = '12px system-ui, Arial';
  ctx.fillText(currency(spent), leftX + barW / 2, chartBaseY + 35);

  // remaining label and value
  ctx.font = 'bold 13px system-ui, Arial';
  ctx.fillText('Remaining', rightX + barW / 2, chartBaseY + 20);
  ctx.font = '12px system-ui, Arial';
  // **Modification**: Display the label for remaining as 0.0 if it's negative
  ctx.fillText(currency(Math.max(0, remaining)), rightX + barW / 2, chartBaseY + 35);

  ctx.restore();
}

// ---- Budgets handling ----

// Load budgets from localStorage
function loadBudgets() {
  try {
    const raw = localStorage.getItem(budgetsKey);
    const obj = raw ? JSON.parse(raw) : {};
    return typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

// Save budgets to localStorage
function saveBudgets(b) {
  try {
    localStorage.setItem(budgetsKey, JSON.stringify(b));
  } catch {}
}

// Load total budget from localStorage
function loadTotalBudget() {
  try {
    return Number(localStorage.getItem(totalBudgetKey)) || 0;
  } catch {
    return 0;
  }
}

// Save total budget to localStorage
function saveTotalBudget(v) {
  try {
    localStorage.setItem(totalBudgetKey, String(Number(v) || 0));
  } catch {}
}

// Determines the budget status string and color
function getBudgetStatus(budget, used) {
  const remaining = budget - used;
  let status = "Not set";
  let color = "#6B7280";
  let progressColor = categoryColors.Other;

  if (budget > 0) {
    if (used > budget) {
      status = "Exceeded";
      color = "#EF4444"; // Red
      progressColor = "#EF4444";
    } else if (used / budget >= 0.9) {
      status = "Near limit";
      color = "#F59E0B"; // Yellow/Orange
      progressColor = "#F59E0B";
    } else {
      status = "OK";
      color = "#10B981"; // Green
      progressColor = "#10B981";
    }
  } else if (used > 0) {
     status = "Tracking";
     color = "#2563EB"; // Blue
     progressColor = "#2563EB";
  }

  // **Modification**: Return the actual remaining for calculation, 
  // but ensure display uses Math.max(0, remaining) for UI elements.
  return { status, color, remaining, progressColor };
}

// Render budgets as table for large screens
function renderBudgetsTable() {
  const tbody = document.getElementById('budgetsTableBody');
  if (!tbody) return;

  const cats = [
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Health",
    "Entertainment",
    "Other"
  ];

  const budgets = loadBudgets();
  const month = viewMonthEl?.value || toMonthStr(new Date());
  const expenses = loadExpenses().filter(x => x.date.slice(0, 7) === month);

  const spend = {};
  expenses.forEach(x => {
    const c = x.category || "Other";
    spend[c] = (spend[c] || 0) + Number(x.amount || 0);
  });

  const rowsHtml = cats.map(name => {
    const budget = Number(budgets[name] || 0);
    const used = Number(spend[name] || 0);
    const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 
                (used > 0 ? 100 : 0); // show full bar if tracking spent without budget
    
    const { status, color, remaining, progressColor } = getBudgetStatus(budget, used);

    // Progress Bar HTML
    const progressBarHtml = `
        <div class="progress" style="background:#e5e7eb; border-radius: 8px; height: 10px;">
          <div style="width: ${pct}%; background-color: ${progressColor}; height: 100%; border-radius: 8px;"></div>
        </div>
    `;

    return `
      <tr data-cat="${escapeHTML(name)}">
        <td class="col-category">
          <span class="legend-dot" style="background-color:${categoryColors[name] || '#999999'};"></span>
          ${escapeHTML(name)}
        </td>
        <td class="col-progress">${progressBarHtml}</td>
        <td class="col-status" style="color: ${color}; font-weight: 600;">${status}</td>
        <td class="col-spent right currency">${currency(used)}</td>
        <td class="col-remaining right currency">${currency(Math.max(0, remaining))}</td>
        <td class="col-budget right currency">${currency(budget)}</td>
        <td class="col-edit right">
          <button class="action-btn" data-action="edit-budget" data-cat="${escapeHTML(name)}" title="Edit Budget">Edit</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rowsHtml;
}

// Render budgets as cards for small screens
function renderBudgetsGrid() {
  if (!budgetsGridEl) return;

  const cats = [
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Health",
    "Entertainment",
    "Other"
  ];

  const budgets = loadBudgets();
  const month = viewMonthEl?.value || toMonthStr(new Date());
  const expenses = loadExpenses().filter(x => x.date.slice(0, 7) === month);

  const spend = {};
  expenses.forEach(x => {
    const c = x.category || "Other";
    spend[c] = (spend[c] || 0) + Number(x.amount || 0);
  });

  const cardsHtml = cats.map(name => {
    const budget = Number(budgets[name] || 0);
    const used = Number(spend[name] || 0);
    const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 
                (used > 0 ? 100 : 0);
    
    const { status, color, remaining, progressColor } = getBudgetStatus(budget, used);

    return `
      <div class="budget-card" data-cat="${escapeHTML(name)}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;">
          <strong style="color: ${categoryColors[name] || '#999'};">${escapeHTML(name)}</strong>
          <button class="action-btn icon-btn" data-action="edit-budget" data-cat="${escapeHTML(name)}" title="Set Budget">⚙️</button>
        </div>
        
        <div class="progress" style="background:#e5e7eb; border-radius: 8px; height: 10px; margin: 0.5em 0;">
          <div style="width: ${pct}%; background-color: ${progressColor}; height: 100%; border-radius: 8px;"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
          <span>Budget: <span class="currency">${currency(budget)}</span></span>
          <span>Spent: <span class="currency">${currency(used)}</span></span>
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 0.5em;">
          <span style="font-weight: 600; color: ${color};">${status}</span>
          <span>Remaining: <span class="currency">${currency(Math.max(0, remaining))}</span></span>
        </div>
      </div>
    `;
  }).join("");

  budgetsGridEl.innerHTML = cardsHtml;
}

// Main budgets render function, chooses layout based on screen width
function renderBudgets() {
  // NOTE: Swapping visibility via display: none/grid/block still needs to happen
  // to follow the index.html's responsive design containers.
  const width = window.innerWidth || document.documentElement.clientWidth;
  const budgetsContainer = document.querySelector(".budgets-container");
  const tableWrapper = document.querySelector(".budgets-table-wrapper");

  if (budgetsContainer) {
    if (width >= 768) {
      if (budgetsGridEl) budgetsGridEl.hidden = true;
      if (tableWrapper) tableWrapper.hidden = false;
      renderBudgetsTable();
    } else {
      if (budgetsGridEl) budgetsGridEl.hidden = false;
      if (tableWrapper) tableWrapper.hidden = true;
      renderBudgetsGrid();
    }
  }

  // Update total budget input and status (unchanged logic, just moved for structure)
  const totalBudget = Number(loadTotalBudget() || 0);
  if (totalBudgetEl) totalBudgetEl.value = totalBudget;

  const month = viewMonthEl?.value || toMonthStr(new Date());
  const expenses = loadExpenses().filter(x => x.date.slice(0, 7) === month);
  
  const totalSpent = expenses.reduce((sum, x) => sum + Number(x.amount || 0), 0);

  if (totalBudgetStatusEl) {
    let status = "Not set";
    let color = "#6B7280";
    if (totalBudget > 0) {
      if (totalSpent > totalBudget) {
        status = "Exceeded";
        color = "#EF4444";
      } else if (totalSpent / totalBudget > 0.9) {
        status = "Near limit";
        color = "#F59E0B";
      } else {
        status = "OK";
        color = "#10B981";
      }
    } else if (totalSpent > 0) {
      status = "Tracking";
      color = "#2563EB";
    }
    
    // **Modification**: Calculate remaining but don't clamp it here, as it's not displayed directly in the status message.
    // const remaining = totalBudget - totalSpent; 

    totalBudgetStatusEl.innerHTML = `${status} 
      (<span style="font-weight: 700;">${currency(totalSpent)}</span>/ 
      <span style="font-weight: 700;">${currency(totalBudget)}</span>)`;
    totalBudgetStatusEl.style.color = 'inherit'; // Color is now inside the span, reset parent
  }
}

// --- Event Listeners for Budget Modal and Table Actions ---

// Event listener for opening the Budget Modal from table/grid
function handleBudgetEditClick(e) {
  const btn = e.target.closest('button[data-action="edit-budget"]');
  if (!btn) return;
  const cat = btn.getAttribute('data-cat');
  const budgets = loadBudgets();
  const currentBudget = budgets[cat] || 0;
  showBudgetModal(cat, currentBudget);
}

if (budgetsGridEl) {
  budgetsGridEl.addEventListener('click', handleBudgetEditClick);
}

if (budgetsTableBody) {
  budgetsTableBody.addEventListener('click', handleBudgetEditClick);
}

// Budget Modal Save Button
budgetModalSave?.addEventListener('click', () => {
  const cat = budgetModalCat.value;
  const newBudget = Number(budgetModalInput.value);
  if (cat) {
    const budgets = loadBudgets();
    budgets[cat] = newBudget;
    saveBudgets(budgets);
    hideBudgetModal();
    renderBudgets();
    renderCharts();
  }
});

// Budget Modal Cancel Button or Overlay Click
budgetModalCancel?.addEventListener('click', hideBudgetModal);
budgetModal?.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
    // Check if click was directly on the overlay backdrop
    if (e.target.classList.contains('modal-overlay')) {
        hideBudgetModal();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !budgetModal.hidden) {
        hideBudgetModal();
    }
});


// --- utilities ---
function cryptoRandomId() {
  try {
    const arr = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'id_' + Math.random().toString(36).slice(2, 10);
  }
}

// --- Toast notifications ---
function showToast(message, type = 'success', duration = 2400) {
  try {
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'error' ? 'error' : 'success');
    t.textContent = message || '';
    document.body.appendChild(t);
    // allow CSS transition
    requestAnimationFrame(() => t.classList.add('show'));
    const hide = () => {
      t.classList.remove('show');
      setTimeout(() => { try { t.remove(); } catch {} }, 260);
    };
    setTimeout(hide, duration);
    return {
      dismiss() { hide(); }
    };
  } catch (e) { console.warn('toast failed', e); }
}

// --- Import / Export helpers ---
// Export current profile expenses as JSON (download)
function exportExpenses({ filename = 'expenses.json', merge = false } = {}) {
  const data = loadExpenses();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Export CSV (simple)
function exportCSV({ filename = 'expenses.csv' } = {}) {
  const rows = loadExpenses();
  const cols = ['id', 'date', 'category', 'note', 'amount', 'ts'];
  const lines = [cols.join(',')].concat(rows.map(r => {
    return cols.map(c => {
      const v = r[c] === undefined || r[c] === null ? '' : String(r[c]).replace(/"/g, '""');
      return `"${v}"`;
    }).join(',');
  }));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Import (merge or replace)
async function importJSONFile(file, { merge = true } = {}) {
  if (!file) return { ok: false, reason: 'no-file' };
  try {
    const text = await file.text();
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return { ok: false, reason: 'invalid-format' };
    // validate minimal shape
    const valid = arr.every(it => it && typeof it === 'object' && it.date && it.category && it.amount !== undefined);
    if (!valid) return { ok: false, reason: 'invalid-items' };
    if (merge) {
      const existing = loadExpenses();
      // avoid id collisions: keep existing ids and only add new unique ids
      const existingIds = new Set(existing.map(x => x.id));
      const toAdd = arr.map(it => ({ ...it, id: it.id || cryptoRandomId(), ts: it.ts || Date.now() }))
                       .filter(it => !existingIds.has(it.id));
      saveExpenses(existing.concat(toAdd));
    } else {
      // replace
      const normalized = arr.map(it => ({ ...it, id: it.id || cryptoRandomId(), ts: it.ts || Date.now() }));
      saveExpenses(normalized);
    }
    render();
    return { ok: true };
  } catch (err) {
    console.error('import error', err);
    return { ok: false, reason: 'parse-error' };
  }
}

// Build print area (keeps your original appearance)
function buildPrintArea() {
  if (!printAreaEl) return;
  const month = (viewMonthEl?.value) || toMonthStr(new Date());
  const monthName = new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const items = loadExpenses().filter(x => (x.date || '').slice(0, 7) === month);
  renderCharts(); // ensure charts ready
  const pieImg = (pieCanvasEl && pieCanvasEl.toDataURL) ? pieCanvasEl.toDataURL('image/png') : '';
  const barImg = (barCanvasEl && barCanvasEl.toDataURL) ? barCanvasEl.toDataURL('image/png') : '';
  const cats = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other'];
  const b = loadBudgets();
  const spend = {};
  items.forEach(x => { spend[x.category || 'Other'] = (spend[x.category || 'Other'] || 0) + Number(x.amount || 0); });
  
  const rows = cats.map(c => {
    const budget = Number(b[c] || 0);
    const used = Number(spend[c] || 0);
    const { status, remaining } = getBudgetStatus(budget, used);
    
    return `
      <tr>
        <td>${escapeHTML(c)}</td>
        <td class="text-right">${currency(used)}</td>
        <td class="text-right">${currency(budget)}</td>
        <td class="text-right">${currency(Math.max(0, remaining))}</td>
        <td class="text-center">${status}</td>
      </tr>
    `;
  }).join('');
  
  const totalBudget = Number(loadTotalBudget() || 0);
  const totalSpent = cats.reduce((s, c) => s + Number(spend[c] || 0), 0);
  const remaining = totalBudget - totalSpent;
  
  // Generate receipt barcode (simulated as alphanumeric)
  const receiptCode = 'ANV' + Date.now().toString().slice(-10);
  const reportDate = new Date();
  
  // Create QR code data (will be generated in print)
  const qrData = `Anivio Report|Period:${month}|Spent:${totalSpent}|Budget:${totalBudget}`;
  
  printAreaEl.innerHTML = `
    <div class="receipt-container">
      
      <div class="receipt-header-premium">
        <div class="receipt-brand-section">
          <div class="receipt-brand-name">⬢ ANIVIO ⬢</div>
          <div class="receipt-brand-tagline">SMART EXPENSE INTELLIGENCE</div>
        </div>
      </div>

      <div class="receipt-divider-thick"></div>

      <div class="receipt-top-section">
        <div class="receipt-left-info">
          <div class="receipt-row">
            <span class="receipt-row-label">Receipt ID:</span>
            <span class="receipt-row-value">${receiptCode}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-row-label">Period:</span>
            <span class="receipt-row-value">${escapeHTML(monthName)}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-row-label">Generated:</span>
            <span class="receipt-row-value">${reportDate.toLocaleDateString()}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-row-label">Time:</span>
            <span class="receipt-row-value">${reportDate.toLocaleTimeString()}</span>
          </div>
        </div>
        <div class="receipt-qr-code" id="qrContainer"></div>
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-section">
        <div class="receipt-section-title">📊 FINANCIAL SUMMARY</div>
        <div class="summary-box-premium">
          <div class="summary-row-double">
            <div class="summary-item">
              <div class="summary-label">Total Spent</div>
              <div class="summary-value" style="color: #EF4444;">${currency(totalSpent)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Budget</div>
              <div class="summary-value" style="color: #6B7280;">${currency(totalBudget)}</div>
            </div>
          </div>
          <div class="summary-row-double">
            <div class="summary-item">
              <div class="summary-label">Remaining</div>
              <div class="summary-value" style="color: ${remaining >= 0 ? '#10B981' : '#EF4444'};">${currency(Math.max(0, remaining))}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Utilization</div>
              <div class="summary-value" style="color: #6A0DAD;">${totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%</div>
            </div>
          </div>
        </div>
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-section">
        <div class="receipt-section-title">💰 CATEGORY BREAKDOWN</div>
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 25%;">Category</th>
              <th style="width: 18%; text-align: right;">Spent</th>
              <th style="width: 18%; text-align: right;">Budget</th>
              <th style="width: 18%; text-align: right;">Remaining</th>
              <th style="width: 12%; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td style="font-weight: bold;">TOTAL</td>
              <td class="text-right" style="font-weight: bold;">${currency(totalSpent)}</td>
              <td class="text-right" style="font-weight: bold;">${currency(totalBudget)}</td>
              <td class="text-right" style="font-weight: bold;">${currency(Math.max(0, remaining))}</td>
              <td class="text-center" style="font-weight: bold;">-</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="receipt-divider"></div>

      ${pieImg ? `
      <div class="receipt-section">
        <div class="receipt-section-title">📈 EXPENSE DISTRIBUTION</div>
        <div style="text-align: center; margin: 15px 0;">
          <img src="${pieImg}" alt="Category Distribution" style="max-width: 100%; height: auto; max-height: 180px;"/>
        </div>
      </div>
      <div class="receipt-divider"></div>
      ` : ''}

      ${barImg ? `
      <div class="receipt-section">
        <div class="receipt-section-title">📊 SPENT vs REMAINING</div>
        <div style="text-align: center; margin: 15px 0;">
          <img src="${barImg}" alt="Spent vs Remaining" style="max-width: 100%; height: auto; max-height: 180px;"/>
        </div>
      </div>
      <div class="receipt-divider"></div>
      ` : ''}

      <div class="receipt-footer-premium">
        <div style="text-align: center; margin-bottom: 12px;">
          <div style="font-size: 12px; font-weight: bold; letter-spacing: 1px;">✦ ANIVIO EXPENSE MANAGEMENT ✦</div>
          <div style="font-size: 9px; margin-top: 4px; color: #666;">Smart spending insights for better financial control</div>
        </div>
        <div style="font-size: 8px; color: #999; margin: 8px 0;">
          This document is automatically generated by Anivio.<br/>
          Please verify all data for accuracy before archiving.
        </div>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 2px dashed #000; text-align: center;">
          <div style="font-size: 9px; letter-spacing: 3px;">═══════════════════════════════</div>
        </div>
      </div>

    </div>
  `;

  // Generate QR code after DOM is ready
  setTimeout(() => {
    const qrContainer = document.getElementById('qrContainer');
    if (qrContainer) {
      qrContainer.innerHTML = ''; // clear
      try {
        // QRCode is loaded via CDN in index.html, this assumes it is available
        new QRCode(qrContainer, {
          text: qrData,
          width: 100,
          height: 100,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch (e) {
        console.log('QR Code generation skipped (library may not be available or initialized)');
      }
    }
  }, 100);
}

// --- UI Event wiring ---
// form submit (add or update)
formEl?.addEventListener('submit', e => {
  e.preventDefault();
  const amount = parseFloat(amountEl.value);
  const category = categoryEl.value;
  const date = dateEl.value;
  const note = (noteEl.value || '').trim();
  if (!amount || amount <= 0) {
    showToast('Please enter a valid amount.', 'error');
    return;
  }
  if (!category) {
    showToast('Please choose a category.', 'error');
    return;
  }
  if (!date) {
    showToast('Please select a date.', 'error');
    return;
  }

  // check for an "editing" attribute on the form that stores id
  const editingId = formEl.getAttribute('data-edit-id');
  if (editingId) {
    // update
    const ok = updateExpense(editingId, {
      amount: Number(amount.toFixed(2)),
      category,
      date,
      note
    });
    if (!ok) showToast('Unable to update item (not found).', 'error');
    else showToast('Expense updated successfully!', 'success');
    
    // Reset form state from edit mode
    formEl.removeAttribute('data-edit-id');
    const submitBtn = formEl.querySelector('button[type="submit"]');
    if(submitBtn) submitBtn.textContent = 'Add';
  } else {
    // add new
    const id = cryptoRandomId();
    const ts = Date.now();
    addExpense({ id, amount: Number(amount.toFixed(2)), category, date, note, ts });
    showToast('Expense added successfully!', 'success');
  }

  // reset fields
  amountEl.value = '';
  noteEl.value = '';
  categoryEl.selectedIndex = 0;
  dateEl.value = todayISO();
  render();
});

// list click: edit/delete
listEl?.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  const row = btn.closest('tr');
  const id = row?.getAttribute('data-id');
  if (!id) return;

  if (action === 'delete') {
    showModal('Delete Expense', 'Are you sure you want to delete this expense?').then(ok => {
      if (!ok) return;
      deleteExpense(id);
      render();
      showToast('Expense deleted.', 'success');
    });
    return;
  }

  if (action === 'edit') {
    // load item and populate form for editing
    const item = loadExpenses().find(x => x.id === id);
    if (!item) return;
    amountEl.value = item.amount || '';
    categoryEl.value = item.category || '';
    dateEl.value = item.date || todayISO();
    noteEl.value = item.note || '';
    formEl.setAttribute('data-edit-id', id);
    
    // Update button text to indicate editing
    const submitBtn = formEl.querySelector('button[type="submit"]');
    if(submitBtn) submitBtn.textContent = 'Update';
    
    // Scroll and focus amount for convenience
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    amountEl.focus();
    return;
  }
});

// filters & search (debounced)
const debouncedRender = debounce(render, 180);
viewDateEl?.addEventListener('change', debouncedRender);
viewMonthEl?.addEventListener('change', debouncedRender);
filterCategoryEl?.addEventListener('change', debouncedRender);
searchTextEl?.addEventListener('input', debounce(() => {
  debouncedRender();
}, 300));

// clear all
clearAllEl?.addEventListener('click', async () => {
  const ok = await showModal('Delete All Expenses', 'Delete all expenses for this profile? This cannot be undone.');
  if (!ok) return;
  saveExpenses([]);
  render();
  // show toast success and close header menu (if open) after the action completes
  try { showToast('All expenses cleared', 'success'); } catch (e) {}
  try { if (window.closeHeaderMenu) window.closeHeaderMenu(); } catch (e) {}
});

// currency change
currencySelectEl?.addEventListener('change', e => {
  try {
    setCurrency(e.target.value);
    render();
  } catch {}
});

// print / download
printBtnEl?.addEventListener('click', () => {
  buildPrintArea();
  // allow small delay to render images and QR code before printing
  setTimeout(() => window.print(), 250);
});

// import file (merge by default)
importFileEl?.addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  // ask user whether to merge or replace
  const doMerge = await showModal('Import Data', 'Click OK to merge imported data with existing expenses. Click Cancel to replace existing data.');
  const result = await importJSONFile(file, { merge: doMerge });
  if (!result.ok) {
    await showModal('Import Failed', 'Import failed: ' + (result.reason || 'unknown'));
  } else {
      await showModal('Success', 'Import successful.');
      render();
      try { showToast('Import successful', 'success'); } catch (e) {}
  }
  // clear input
  importFileEl.value = '';
});

totalBudgetEl?.addEventListener('input', e => {
  const val = Number(e.target.value || 0);
  saveTotalBudget(val);
  renderBudgets();
});

// keyboard shortcuts (optional conveniences)
window.addEventListener('keydown', e => {
  // ctrl+e -> export JSON
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    exportExpenses({ filename: `expenses_${getCurrentProfile()}.json` });
  }
  // ctrl+shift+c -> export CSV
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    exportCSV({ filename: `expenses_${getCurrentProfile()}.csv` });
  }
});

// handle window resize to re-render retina-scaled charts
let resizeTimer;
window.addEventListener('resize', debounce(() => {
  renderCharts();
  renderBudgets(); // Re-render budgets on resize to switch views
}, 200));

// pie chart hover tooltip handling (unchanged)
const pieTooltipEl = document.getElementById('pieTooltip');
function hidePieTooltip() {
  if (pieTooltipEl) pieTooltipEl.style.display = 'none';
}
function handlePieMove(e) {
  try {
    if (!pieCanvasEl || !pieSegments || !pieSegments.length) {
      hidePieTooltip();
      return;
    }
    const rect = pieCanvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = mx - cx;
    const dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = Math.min(cx, cy) - 20;
    if (dist > radius) {
      hidePieTooltip();
      return;
    }
    let ang = Math.atan2(dy, dx);
    const base = -Math.PI / 2;
    const twoPi = Math.PI * 2;
    let pointerRel = ang - base;
    while (pointerRel < 0) pointerRel += twoPi;
    while (pointerRel >= twoPi) pointerRel -= twoPi;

    let found = null;
    for (const s of pieSegments) {
      const sr = s.startRel;
      const er = s.endRel;
      if (sr <= er) {
        if (pointerRel >= sr && pointerRel < er) { found = s; break; }
      } else {
        // wrapped segment
        if (pointerRel >= sr || pointerRel < er) { found = s; break; }
      }
    }
    if (!found) {
      hidePieTooltip();
      return;
    }
    if (pieTooltipEl) {
      pieTooltipEl.textContent = `${found.name} ${currency(found.value)}`;
      pieTooltipEl.style.display = 'block';
      // position relative to canvas
      pieTooltipEl.style.left = (mx) + 'px';
      pieTooltipEl.style.top = (my) + 'px';
    }
  } catch (err) {
    console.error('pie hover error', err);
  }
}
if (pieCanvasEl) {
  pieCanvasEl.addEventListener('mousemove', handlePieMove);
  pieCanvasEl.addEventListener('mouseleave', hidePieTooltip);
}

// --- Initialization ---
function init() {
  const today = todayISO();
  
  // ensure date defaults for *adding* new expense
  try {
    dateEl.value = today;
  } catch {}

  // **Modification**: Set the expense list filter to the current day on load.
  if (viewDateEl) viewDateEl.value = today;
  
  // Set month to current month, which will be the fallback if the date filter is cleared by user
  if (viewMonthEl) viewMonthEl.value = toMonthStr(new Date());
  
  if (currencySelectEl) currencySelectEl.value = getCurrency();

  // ensure profiles exist (non-breaking)
  if (!safeGet(profilesKey, null)) {
    safeSet(profilesKey, ['default']);
    setCurrentProfile('default');
  }

  // Mobile nav toggle (hamburger)
  try {
    const navToggle = document.getElementById('navToggle');
    const headerActions = document.getElementById('headerActions') || document.querySelector('.header-actions');
    let navBackdrop = document.querySelector('.nav-backdrop');

    if (!navBackdrop) {
      navBackdrop = document.createElement('div');
      navBackdrop.className = 'nav-backdrop';
      document.body.appendChild(navBackdrop);
    }

    function openMenu() {
      if (!navToggle || !headerActions) return;
      navToggle.classList.add('active');
      headerActions.classList.add('active');
      navToggle.setAttribute('aria-expanded', 'true');
      headerActions.setAttribute('aria-hidden', 'false');
      navBackdrop.classList.add('active');
    }

    function closeMenu() {
      if (!navToggle || !headerActions) return;
      navToggle.classList.remove('active');
      headerActions.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
      headerActions.setAttribute('aria-hidden', 'true');
      navBackdrop.classList.remove('active');
    }

    function toggleMenu() {
      if (headerActions && headerActions.classList.contains('active')) closeMenu();
      else openMenu();
    }

    // Toggle button click
    if (navToggle) {
      navToggle.hidden = false;
      navToggle.addEventListener('click', (e) => {
        // Prevent this click from bubbling to document (which would close the menu)
        e.stopPropagation(); 
        toggleMenu();
      });
    }

    // Header Actions container click
    if (headerActions) {
      headerActions.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = e.target;
        if (t.matches('a, button[data-close], [data-close="true"]')) {
           closeMenu();
        }
      });
    }

    // Backdrop click -> Close
    if (navBackdrop) {
      navBackdrop.addEventListener('click', closeMenu);
    }

    // Document click -> Close (if clicking outside and menu is open)
    document.addEventListener('click', (e) => {
      if (headerActions && headerActions.classList.contains('active')) {
        closeMenu();
      }
    });

    // Make available globally
    window.openHeaderMenu = openMenu;
    window.closeHeaderMenu = closeMenu;

    // Handle resize (switch between mobile/desktop view)
    window.addEventListener('resize', debounce(() => {
       const w = window.innerWidth;
       if (w >= 1025) {
         // Desktop: ensure menu is visible
         if (navToggle) navToggle.hidden = true;
         if (headerActions) {
            headerActions.classList.remove('active');
            headerActions.setAttribute('aria-hidden', 'false');
         }
         if (navBackdrop) navBackdrop.classList.remove('active');
       } else {
         // Mobile: show hamburger
         if (navToggle) navToggle.hidden = false;
         // On resize down, ensure menu state remains but actions container is hidden by default
         if (headerActions && !navToggle.classList.contains('active')) headerActions.setAttribute('aria-hidden', 'true');
       }
    }, 100));
    
    // Run resize check once
    window.dispatchEvent(new Event('resize'));

  } catch (err) {
    console.warn('nav toggle init error', err);
  }

  render();
}

// initial call
init();

// Expose small API for future SaaS hooks (global)
window.ExpenseTracker = {
  exportJSON: exportExpenses,
  exportCSV,
  importJSONFile,
  setProfile: (name) => { setCurrentProfile(name); render(); },
  getProfiles: () => safeGet(profilesKey, ['default']),
  addProfile: (name) => {
    try {
      const p = safeGet(profilesKey, ['default']) || [];
      if (!p.includes(name)) {
        p.push(name);
        safeSet(profilesKey, p);
      }
      setCurrentProfile(name);
      render();
    } catch {}
  },
  getRawExpenses: () => loadExpenses(),
};