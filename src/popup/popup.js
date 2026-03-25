// ============================================================
// Screen Time Buddy — Popup Controller
// ============================================================

const CIRCUMFERENCE = 2 * Math.PI * 52;
const CHARACTER_GOALS = { eagle: 1.5, fox: 3, panda: 4, sloth: 5 };
const CHARACTER_COINS = { eagle: 4, fox: 3, panda: 2, sloth: 1 };

let currentData = null;
let selectedTime = 60;
let editingDomain = null;
let selectedTaskDuration = 15;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  currentData = await getData();
  render();
  bindEvents();
  autoFillCurrentSite();
  setInterval(refreshData, 5000);
}

// ---- Data ----
function getData() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getData' }, (data) => {
      resolve(data);
    });
  });
}

async function refreshData() {
  currentData = await getData();
  render();
}

// ---- Render ----
function render() {
  if (!currentData) return;
  renderHeader();
  renderRing();
  renderCharacterSelector();
  renderSitesList();
  renderTimeGrid();
  renderTasks();
}

function renderHeader() {
  document.getElementById('coinCount').textContent = currentData.coins || 0;
  document.getElementById('streakCount').textContent = currentData.streak || 0;
  const streakBadge = document.getElementById('streakBadge');
  streakBadge.style.display = (currentData.streak > 0) ? 'flex' : 'none';
}

function renderRing() {
  const character = currentData.character || 'fox';
  const goalHours = CHARACTER_GOALS[character] || 3;
  const goalMinutes = goalHours * 60;

  let totalUsed = 0;
  for (const site of Object.values(currentData.sites || {})) {
    if (site.enabled) totalUsed += (site.timeUsed || 0);
  }

  const ratio = Math.min(totalUsed / goalMinutes, 1);
  const dashLength = ratio * CIRCUMFERENCE;

  const ring = document.getElementById('ringProgress');
  ring.setAttribute('stroke-dasharray', `${dashLength} ${CIRCUMFERENCE}`);

  if (ratio < 0.5) ring.style.stroke = 'var(--ring-green)';
  else if (ratio < 0.75) ring.style.stroke = 'var(--ring-yellow)';
  else ring.style.stroke = 'var(--ring-red)';

  const charEl = document.getElementById('ringCharacter');
  charEl.innerHTML = `<img src="../../assets/characters/${character}.svg" alt="${character}">`;

  document.getElementById('totalTimeUsed').textContent = formatTime(totalUsed);
  document.getElementById('goalHours').textContent =
    goalHours < 1 ? `${goalHours * 60}m` : `${goalHours}h`;
}

function renderCharacterSelector() {
  const btns = document.querySelectorAll('.char-btn');
  btns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.char === currentData.character);
  });
}

function renderSitesList() {
  const container = document.getElementById('sitesList');
  const sites = currentData.sites || {};
  const domains = Object.keys(sites);

  document.getElementById('siteCount').textContent =
    `${domains.length} site${domains.length !== 1 ? 's' : ''}`;

  if (domains.length === 0) {
    container.innerHTML = '<div class="empty-state">No sites added yet. Add a website above to start.</div>';
    return;
  }

  container.innerHTML = domains.map(domain => {
    const site = sites[domain];
    const remaining = Math.max(0, site.timeLimit - (site.timeUsed || 0));
    const ratio = site.timeLimit > 0 ? (site.timeUsed || 0) / site.timeLimit : 0;
    const isEditing = editingDomain === domain;

    let badgeClass = '';
    if (ratio >= 1) badgeClass = 'danger';
    else if (ratio >= 0.75) badgeClass = 'warning';

    const currentH = Math.floor(site.timeLimit / 60);
    const currentM = site.timeLimit % 60;

    return `
      <div class="site-item-wrapper ${isEditing ? 'editing' : ''}" data-domain="${domain}">
        <div class="site-row" data-domain="${domain}">
          <img class="site-favicon" src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="">
          <div class="site-info">
            <div class="site-domain">${domain}</div>
            <div class="site-meta">${formatTime(site.timeUsed || 0)} used / ${formatTime(site.timeLimit)} limit</div>
          </div>
          <div class="site-time-badge ${badgeClass}">${formatTime(remaining)}</div>
          <label class="toggle" onclick="event.stopPropagation()">
            <input type="checkbox" ${site.enabled ? 'checked' : ''} data-domain="${domain}">
            <span class="toggle-track"></span>
          </label>
          <button class="site-delete" data-domain="${domain}" title="Remove" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#FF453A" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="edit-panel ${isEditing ? 'open' : ''}" data-domain="${domain}">
          <div class="edit-panel-header">
            <span class="edit-panel-title">Edit daily limit</span>
            <span class="edit-panel-current">Currently: ${formatTime(site.timeLimit)}</span>
          </div>
          <div class="time-picker">
            <div class="time-picker-col">
              <button class="picker-arrow up" data-field="hours" data-domain="${domain}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              </button>
              <div class="picker-value" data-field="hours" data-domain="${domain}">${currentH}</div>
              <button class="picker-arrow down" data-field="hours" data-domain="${domain}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              </button>
              <div class="picker-label">hours</div>
            </div>
            <div class="picker-separator">:</div>
            <div class="time-picker-col">
              <button class="picker-arrow up" data-field="minutes" data-domain="${domain}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              </button>
              <div class="picker-value" data-field="minutes" data-domain="${domain}">${currentM}</div>
              <button class="picker-arrow down" data-field="minutes" data-domain="${domain}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              </button>
              <div class="picker-label">mins</div>
            </div>
          </div>
          <div class="edit-presets">
            <button class="edit-preset ${site.timeLimit === 15 ? 'active' : ''}" data-mins="15" data-domain="${domain}">15m</button>
            <button class="edit-preset ${site.timeLimit === 30 ? 'active' : ''}" data-mins="30" data-domain="${domain}">30m</button>
            <button class="edit-preset ${site.timeLimit === 60 ? 'active' : ''}" data-mins="60" data-domain="${domain}">1h</button>
            <button class="edit-preset ${site.timeLimit === 120 ? 'active' : ''}" data-mins="120" data-domain="${domain}">2h</button>
            <button class="edit-preset ${site.timeLimit === 180 ? 'active' : ''}" data-mins="180" data-domain="${domain}">3h</button>
          </div>
          <div class="edit-actions">
            <button class="btn-ghost btn-sm edit-cancel" data-domain="${domain}">Cancel</button>
            <button class="btn-primary btn-sm edit-save" data-domain="${domain}">Save</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  bindSiteListEvents(container);
}

function bindSiteListEvents(container) {
  container.querySelectorAll('.site-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.toggle') || e.target.closest('.site-delete')) return;
      const domain = row.dataset.domain;
      editingDomain = editingDomain === domain ? null : domain;
      renderSitesList();
    });
  });

  container.querySelectorAll('.toggle input').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      chrome.runtime.sendMessage({
        action: 'toggleSite',
        domain: e.target.dataset.domain,
        enabled: e.target.checked
      }, refreshData);
    });
  });

  container.querySelectorAll('.site-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const domain = e.currentTarget.dataset.domain;
      if (editingDomain === domain) editingDomain = null;
      chrome.runtime.sendMessage({ action: 'removeSite', domain }, refreshData);
    });
  });

  container.querySelectorAll('.picker-arrow').forEach(arrow => {
    arrow.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const domain = btn.dataset.domain;
      const field = btn.dataset.field;
      const isUp = btn.classList.contains('up');
      const wrapper = btn.closest('.site-item-wrapper');
      adjustEditPicker(wrapper, domain, field, isUp);
    });
  });

  container.querySelectorAll('.picker-value').forEach(el => {
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const domain = el.dataset.domain;
      const field = el.dataset.field;
      const wrapper = el.closest('.site-item-wrapper');
      adjustEditPicker(wrapper, domain, field, e.deltaY < 0);
    }, { passive: false });
  });

  container.querySelectorAll('.edit-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const domain = btn.dataset.domain;
      const mins = parseInt(btn.dataset.mins);
      const wrapper = btn.closest('.site-item-wrapper');
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      wrapper.querySelector(`.picker-value[data-field="hours"][data-domain="${domain}"]`).textContent = h;
      wrapper.querySelector(`.picker-value[data-field="minutes"][data-domain="${domain}"]`).textContent = m;
      wrapper.querySelectorAll('.edit-preset').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  container.querySelectorAll('.edit-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editingDomain = null;
      renderSitesList();
    });
  });

  container.querySelectorAll('.edit-save').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const domain = btn.dataset.domain;
      const wrapper = btn.closest('.site-item-wrapper');
      const h = parseInt(wrapper.querySelector(`.picker-value[data-field="hours"][data-domain="${domain}"]`).textContent);
      const m = parseInt(wrapper.querySelector(`.picker-value[data-field="minutes"][data-domain="${domain}"]`).textContent);
      const newLimit = h * 60 + m;
      if (newLimit < 1) return;
      chrome.runtime.sendMessage({ action: 'updateTimeLimit', domain, timeLimit: newLimit }, () => {
        editingDomain = null;
        refreshData();
      });
    });
  });
}

function adjustEditPicker(wrapper, domain, field, isUp) {
  const hoursEl = wrapper.querySelector(`.picker-value[data-field="hours"][data-domain="${domain}"]`);
  const minsEl = wrapper.querySelector(`.picker-value[data-field="minutes"][data-domain="${domain}"]`);
  let h = parseInt(hoursEl.textContent);
  let m = parseInt(minsEl.textContent);

  if (field === 'hours') {
    h = isUp ? Math.min(h + 1, 24) : Math.max(h - 1, 0);
  } else {
    m = isUp ? m + 5 : m - 5;
    if (m >= 60) { m = 0; h = Math.min(h + 1, 24); }
    if (m < 0) { m = 55; h = Math.max(h - 1, 0); }
  }
  if (h === 0 && m < 5) m = 5;

  hoursEl.textContent = h;
  minsEl.textContent = m;

  const total = h * 60 + m;
  wrapper.querySelectorAll('.edit-preset').forEach(p => {
    p.classList.toggle('active', parseInt(p.dataset.mins) === total);
  });

  const changedEl = field === 'hours' ? hoursEl : minsEl;
  changedEl.classList.remove('picker-bump');
  void changedEl.offsetWidth;
  changedEl.classList.add('picker-bump');
}

function renderTimeGrid() {
  const sites = currentData.sites || {};
  const enabled = Object.entries(sites).filter(([, s]) => s.enabled);
  const section = document.getElementById('timeSection');
  const grid = document.getElementById('timeGrid');

  if (enabled.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  const miniCircumference = 2 * Math.PI * 20;

  grid.innerHTML = enabled.map(([domain, site]) => {
    const remaining = Math.max(0, site.timeLimit - (site.timeUsed || 0));
    const ratio = site.timeLimit > 0 ? remaining / site.timeLimit : 0;
    const dash = ratio * miniCircumference;
    let color = 'var(--ring-green)';
    if (ratio < 0.25) color = 'var(--ring-red)';
    else if (ratio < 0.5) color = 'var(--ring-yellow)';

    return `
      <div class="time-circle-item">
        <div class="mini-ring">
          <svg viewBox="0 0 50 50">
            <circle class="ring-bg" cx="25" cy="25" r="20" />
            <circle class="ring-progress" cx="25" cy="25" r="20"
              stroke="${color}"
              stroke-dasharray="${dash} ${miniCircumference}" />
          </svg>
          <div class="mini-ring-icon">
            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="">
          </div>
        </div>
        <div class="time-circle-remaining">${formatTime(remaining)}</div>
        <div class="time-circle-label">${truncate(domain, 10)}</div>
      </div>
    `;
  }).join('');
}

// ---- Tasks ----
function renderTasks() {
  const tasks = currentData.tasks || [];
  const container = document.getElementById('taskList');
  const progressEl = document.getElementById('taskProgress');
  const progressBar = document.getElementById('taskProgressBar');
  const progressFill = document.getElementById('taskProgressFill');

  const completed = tasks.filter(t => t.completed).length;
  progressEl.textContent = `${completed}/${tasks.length}`;

  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state task-empty">No tasks yet. Add one to stay focused.</div>';
    progressBar.classList.remove('visible');
    return;
  }

  progressBar.classList.add('visible');
  const pct = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
  progressFill.style.width = pct + '%';

  container.innerHTML = tasks.map(task => `
    <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
      <button class="task-checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}"></button>
      <div class="task-info">
        <div class="task-title">${task.title}</div>
        <div class="task-duration">${task.durationMinutes}m</div>
      </div>
      <button class="task-delete" data-id="${task.id}">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="#FF453A" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `).join('');

  // Bind task events
  container.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'toggleTask', taskId: cb.dataset.id }, refreshData);
    });
  });
  container.querySelectorAll('.task-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'deleteTask', taskId: btn.dataset.id }, refreshData);
    });
  });
}

// ---- Events ----
function bindEvents() {
  document.getElementById('showAddForm').addEventListener('click', () => {
    document.getElementById('addForm').classList.toggle('open');
  });

  document.getElementById('cancelAdd').addEventListener('click', () => {
    document.getElementById('addForm').classList.remove('open');
    resetForm();
  });

  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedTime = parseInt(pill.dataset.time);
      document.getElementById('addHours').textContent = Math.floor(selectedTime / 60);
      document.getElementById('addMins').textContent = selectedTime % 60;
    });
  });

  bindAddPickerArrow('addHoursUp', 'hours', true);
  bindAddPickerArrow('addHoursDown', 'hours', false);
  bindAddPickerArrow('addMinsUp', 'minutes', true);
  bindAddPickerArrow('addMinsDown', 'minutes', false);

  ['addHours', 'addMins'].forEach(id => {
    const el = document.getElementById(id);
    const field = id === 'addHours' ? 'hours' : 'minutes';
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      adjustAddPicker(field, e.deltaY < 0);
    }, { passive: false });
  });

  document.getElementById('confirmAdd').addEventListener('click', () => {
    const domain = document.getElementById('siteInput').value.trim().toLowerCase();
    const h = parseInt(document.getElementById('addHours').textContent);
    const m = parseInt(document.getElementById('addMins').textContent);
    const timeLimit = h * 60 + m;
    if (!domain || timeLimit < 1) return;
    chrome.runtime.sendMessage({ action: 'addSite', domain, timeLimit }, (response) => {
      if (response?.error) {
        const existing = document.querySelector(`.site-row[data-domain="${domain}"]`);
        if (existing) {
          existing.style.background = 'rgba(255, 69, 58, 0.1)';
          setTimeout(() => existing.style.background = '', 1000);
        }
        return;
      }
      document.getElementById('addForm').classList.remove('open');
      resetForm();
      refreshData();
    });
  });

  document.querySelectorAll('.char-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'setCharacter', character: btn.dataset.char }, refreshData);
    });
  });

  // Task form
  document.getElementById('showTaskForm').addEventListener('click', () => {
    const form = document.getElementById('taskForm');
    form.classList.toggle('open');
    if (form.classList.contains('open')) {
      document.getElementById('taskInput').focus();
    }
  });

  document.getElementById('cancelTask').addEventListener('click', () => {
    document.getElementById('taskForm').classList.remove('open');
    document.getElementById('taskInput').value = '';
  });

  document.querySelectorAll('.duration-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.duration-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedTaskDuration = parseInt(pill.dataset.dur);
    });
  });

  document.getElementById('confirmTask').addEventListener('click', () => {
    const title = document.getElementById('taskInput').value.trim();
    if (!title) return;
    chrome.runtime.sendMessage({
      action: 'addTask',
      title,
      durationMinutes: selectedTaskDuration
    }, () => {
      document.getElementById('taskInput').value = '';
      document.getElementById('taskForm').classList.remove('open');
      refreshData();
    });
  });

  document.getElementById('taskInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('confirmTask').click();
    }
  });
}

function bindAddPickerArrow(btnId, field, isUp) {
  document.getElementById(btnId).addEventListener('click', () => {
    adjustAddPicker(field, isUp);
  });
}

function adjustAddPicker(field, isUp) {
  const hoursEl = document.getElementById('addHours');
  const minsEl = document.getElementById('addMins');
  let h = parseInt(hoursEl.textContent);
  let m = parseInt(minsEl.textContent);

  if (field === 'hours') {
    h = isUp ? Math.min(h + 1, 24) : Math.max(h - 1, 0);
  } else {
    m = isUp ? m + 5 : m - 5;
    if (m >= 60) { m = 0; h = Math.min(h + 1, 24); }
    if (m < 0) { m = 55; h = Math.max(h - 1, 0); }
  }
  if (h === 0 && m < 5) m = 5;

  hoursEl.textContent = h;
  minsEl.textContent = m;
  selectedTime = h * 60 + m;

  document.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('active', parseInt(p.dataset.time) === selectedTime);
  });

  const el = field === 'hours' ? hoursEl : minsEl;
  el.classList.remove('picker-bump');
  void el.offsetWidth;
  el.classList.add('picker-bump');
}

function autoFillCurrentSite() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      try {
        const domain = new URL(tabs[0].url).hostname.replace(/^www\./, '');
        if (domain && !domain.includes('chrome') && !domain.includes('newtab')) {
          document.getElementById('siteInput').value = domain;
        }
      } catch {}
    }
  });
}

function resetForm() {
  document.getElementById('siteInput').value = '';
  selectedTime = 60;
  document.getElementById('addHours').textContent = 1;
  document.getElementById('addMins').textContent = 0;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  document.querySelector('.pill[data-time="60"]').classList.add('active');
  autoFillCurrentSite();
}

// ---- Helpers ----
function formatTime(minutes) {
  if (minutes <= 0) return '0m';
  if (minutes < 1) return '<1m';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}
