// ============================================================
// Screen Time Buddy — Content Script (Floating Countdown Overlay)
// Updates every 5 seconds for responsive display
// ============================================================

let overlay = null;
let minimized = false;
let currentCharacter = 'fox';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'countdown') {
    if (msg.character) currentCharacter = msg.character;
    updateOverlay(msg);
    sendResponse({ ok: true });
  }
});

function requestInitialData() {
  chrome.runtime.sendMessage({ action: 'getTimeRemaining' }, (res) => {
    // Background will send regular countdown messages
  });
}

document.addEventListener('DOMContentLoaded', requestInitialData);
window.addEventListener('load', requestInitialData);

function updateOverlay(data) {
  if (!data || data.timeRemaining == null) {
    removeOverlay();
    return;
  }

  const { timeRemaining, timeLimit, character } = data;
  if (timeRemaining <= 0) return;
  if (minimized) return;
  if (!overlay) createOverlay();

  const ratio = timeLimit > 0 ? timeRemaining / timeLimit : 1;
  const minutes = Math.floor(timeRemaining);
  const seconds = Math.floor((timeRemaining - minutes) * 60);
  const timeStr = minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m ${String(seconds).padStart(2, '0')}s`;

  const textEl = overlay.querySelector('.stb-overlay-text');
  if (textEl) textEl.textContent = timeStr;

  // Update ring
  const ring = overlay.querySelector('.stb-mini-ring-progress');
  if (ring) {
    const circumference = 2 * Math.PI * 16;
    const dash = ratio * circumference;
    ring.setAttribute('stroke-dasharray', `${dash} ${circumference}`);

    let color = '#A4FF80';
    if (ratio < 0.25) color = '#FF4D4D';
    else if (ratio < 0.5) color = '#FFBB33';
    ring.setAttribute('stroke', color);
  }

  // Update character icon
  const iconEl = overlay.querySelector('.stb-overlay-icon');
  if (iconEl && character) {
    const charUrl = chrome.runtime.getURL(`assets/characters/${character}.svg`);
    if (iconEl.src !== charUrl) iconEl.src = charUrl;
  }

  // Warning pulse
  if (ratio < 0.1) {
    overlay.classList.add('stb-warning');
  } else {
    overlay.classList.remove('stb-warning');
  }
}

function createOverlay() {
  overlay = document.createElement('div');
  overlay.className = 'stb-overlay';

  const charUrl = chrome.runtime.getURL(`assets/characters/${currentCharacter}.svg`);

  overlay.innerHTML = `
    <div class="stb-overlay-ring">
      <svg viewBox="0 0 40 40" width="36" height="36">
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3" />
        <circle class="stb-mini-ring-progress" cx="20" cy="20" r="16" fill="none"
          stroke="#A4FF80" stroke-width="3" stroke-linecap="round"
          stroke-dasharray="100 100"
          transform="rotate(-90 20 20)" />
      </svg>
      <img class="stb-overlay-icon" src="${charUrl}" alt="">
    </div>
    <span class="stb-overlay-text">--:--</span>
    <button class="stb-overlay-close" title="Hide timer">&times;</button>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.stb-overlay-close').addEventListener('click', (e) => {
    e.stopPropagation();
    minimized = true;
    removeOverlay();
    showMiniBubble();
  });

  makeDraggable(overlay);
}

function removeOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

function showMiniBubble() {
  const bubble = document.createElement('div');
  bubble.className = 'stb-mini-bubble';
  const charUrl = chrome.runtime.getURL(`assets/characters/${currentCharacter}.svg`);
  bubble.innerHTML = `<img src="${charUrl}" alt="STB">`;
  bubble.title = 'Show Screen Time Buddy timer';
  document.body.appendChild(bubble);

  bubble.addEventListener('click', () => {
    minimized = false;
    bubble.remove();
  });
}

function makeDraggable(el) {
  let isDragging = false;
  let offsetX, offsetY;

  el.addEventListener('mousedown', (e) => {
    if (e.target.closest('.stb-overlay-close')) return;
    isDragging = true;
    offsetX = e.clientX - el.getBoundingClientRect().left;
    offsetY = e.clientY - el.getBoundingClientRect().top;
    el.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.left = (e.clientX - offsetX) + 'px';
    el.style.top = (e.clientY - offsetY) + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    if (el) el.style.transition = '';
  });
}
