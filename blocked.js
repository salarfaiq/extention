// ============================================================
// Screen Time Buddy — Blocked Page Controller
// ============================================================

const MESSAGES = [
  "You've reached your daily limit. Your future self will thank you for stopping now.",
  "Every minute you resist is a win. You're building real discipline.",
  "This pause is your superpower. Most people never stop scrolling.",
  "The urge will pass in 10 minutes. You've got this.",
  "Think about what you could do with this time instead.",
  "Your brain is craving dopamine. Give it something real — go for a walk, read, or create.",
  "Small wins compound. Closing this now protects your streak and your focus.",
  "You don't need one more scroll. You need one good decision.",
  "The apps are designed to keep you hooked. You're choosing freedom.",
  "Your attention is your most valuable resource. Protect it."
];

let domain = null;
let pageData = null;

document.addEventListener('DOMContentLoaded', async () => {
  domain = new URLSearchParams(window.location.search).get('domain');
  if (domain) {
    document.getElementById('blockedDomain').textContent = domain;
  }

  // Get data from background
  pageData = await new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getData' }, resolve);
  });

  renderPage();
  startResetTimer();
  bindEvents();
});

function renderPage() {
  if (!pageData) return;

  const character = pageData.character || 'fox';
  const streak = pageData.streak || 0;
  const coins = pageData.coins || 0;
  const characterCoins = { eagle: 4, fox: 3, panda: 2, sloth: 1 }[character] || 3;
  const earnableCoins = Math.ceil(characterCoins / 2);

  // Character
  document.getElementById('blockedCharacter').innerHTML =
    `<img src="assets/characters/${character}.svg" alt="${character}">`;

  // Message
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  document.getElementById('blockedMessage').textContent = msg;

  // Stakes
  if (streak > 0) {
    document.getElementById('stakeStreak').textContent = `${streak} day streak at risk`;
  } else {
    document.getElementById('stakeStreak').textContent = 'Start building your streak';
  }
  document.getElementById('stakeCoins').textContent = `Close now to earn ${earnableCoins} coin${earnableCoins > 1 ? 's' : ''}`;

  // CTA text
  document.querySelector('.cta-primary span').textContent = `Close & Earn ${earnableCoins} Coin${earnableCoins > 1 ? 's' : ''}`;

  // Extend balance
  document.getElementById('extendBalance').textContent = coins;
}

function bindEvents() {
  // Close & Earn
  document.getElementById('closeAppBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'closeBlockedApp', domain }, (res) => {
      // Navigate to a productive page or new tab
      window.location.href = 'https://www.google.com';
    });
  });

  // I'm Struggling
  document.getElementById('struggleBtn').addEventListener('click', () => {
    const panel = document.getElementById('extendPanel');
    panel.classList.toggle('open');
  });

  // Extend buttons
  document.querySelectorAll('.extend-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.minutes);
      const cost = parseInt(btn.dataset.cost);

      chrome.runtime.sendMessage({
        action: 'extendTime',
        domain,
        extraMinutes: minutes,
        cost
      }, (res) => {
        if (res?.error) {
          btn.style.borderColor = '#FF453A';
          btn.querySelector('.extend-cost').textContent = 'Not enough coins!';
          setTimeout(() => {
            btn.style.borderColor = '';
            btn.querySelector('.extend-cost').textContent = `${cost} coin${cost > 1 ? 's' : ''}`;
          }, 2000);
          return;
        }
        // Success — go back to the site
        window.location.href = `https://${domain}`;
      });
    });
  });
}

function startResetTimer() {
  function update() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    document.getElementById('resetTimer').textContent =
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  update();
  setInterval(update, 1000);
}
