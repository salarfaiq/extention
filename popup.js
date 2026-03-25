// ============================================================
// Screen Time Buddy — Popup Controller
// ============================================================

const CIRCUMFERENCE = 2 * Math.PI * 52; // ring radius = 52
const CHARACTER_GOALS = { eagle: 1.5, fox: 3, panda: 4, sloth: 5 };
const CHARACTER_COINS = { eagle: 4, fox: 3, panda: 2, sloth: 1 };

let currentData = null;
let selectedTime = 60;

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

  // Total time used across all tracked sites
  let totalUsed = 0;
  for (const site of Object.values(currentData.sites || {})) {
    if (site.enabled) totalUsed += (site.timeUsed || 0);
  }

  const ratio = Math.min(totalUsed / goalMinutes, 1);
  const dashLength = ratio * CIRCUMFERENCE;

  const ring = document.getElementById('ringProgress');
  ring.setAttribute('stroke-dasharray', `${dashLength} ${CIRCUMFERENCE}`);

  // Color based on usage ratio
  if (ratio < 0.5) ring.style.stroke = 'var(--ring-green)';
  else if (ratio < 0.75) ring.style.stroke = 'var(--ring-yellow)';
  else ring.style.stroke = 'var(--ring-red)';

  // Character image
  const charEl = document.getElementById('ringCharacter');
  charEl.innerHTML = `<img src="assets/characters/${character}.svg" alt="${character}">`;

  // Stats
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

    let badgeClass = '';
    if (ratio >= 1) badgeClass = 'danger';
    else if (ratio >= 0.75) badgeClass = 'warning';

    return `
      <div class="site-row" data-domain="${domain}">
        <img class="site-favicon" src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="">
        <div class="site-info">
          <div class="site-domain">${domain}</div>
          <div class="site-meta">${formatTime(site.timeUsed || 0)} used / ${formatTime(site.timeLimit)} limit</div>
        </div>
        <div class="site-time-badge ${badgeClass}">${formatTime(remaining)}</div>
        <label class="toggle">
          <input type="checkbox" ${site.enabled ? 'checked' : ''} data-domain="${domain}">
          <span class="toggle-track"></span>
        </label>
        <button class="site-delete" data-domain="${domain}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="#FF453A" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Bind toggle and delete events
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
      chrome.runtime.sendMessage({ action: 'removeSite', domain }, refreshData);
    });
  });
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
  const miniCircumference = 2 * Math.PI * 20; // mini ring radius

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

// ---- Events ----
function bindEvents() {
  // Show/hide add form
  document.getElementById('showAddForm').addEventListener('click', () => {
    const form = document.getElementById('addForm');
    form.classList.toggle('open');
  });

  document.getElementById('cancelAdd').addEventListener('click', () => {
    document.getElementById('addForm').classList.remove('open');
    resetForm();
  });

  // Time pills
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedTime = parseInt(pill.dataset.time);
      document.getElementById('customTime').value = '';
    });
  });

  document.getElementById('customTime').addEventListener('input', (e) => {
    if (e.target.value) {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      selectedTime = parseInt(e.target.value) || 60;
    }
  });

  // Add site
  document.getElementById('confirmAdd').addEventListener('click', () => {
    const domain = document.getElementById('siteInput').value.trim().toLowerCase();
    const customTime = document.getElementById('customTime').value;
    const timeLimit = customTime ? parseInt(customTime) : selectedTime;

    if (!domain) return;
    if (!timeLimit || timeLimit <= 0) return;

    chrome.runtime.sendMessage({
      action: 'addSite',
      domain,
      timeLimit
    }, (response) => {
      if (response?.error) {
        // Briefly highlight the existing site
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

  // Character selector
  document.querySelectorAll('.char-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'setCharacter',
        character: btn.dataset.char
      }, refreshData);
    });
  });
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
  document.getElementById('customTime').value = '';
  selectedTime = 60;
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
