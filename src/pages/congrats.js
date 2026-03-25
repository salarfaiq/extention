// ============================================================
// Screen Time Buddy — Congrats Page Controller
// ============================================================

const CONGRATS_MESSAGES = {
  morning: [
    "Starting your day with discipline. That's how winners are built.",
    "Morning you chose wisely. The rest of your day just got better."
  ],
  afternoon: [
    "Afternoon focus saved. Your brain thanks you.",
    "That took real willpower. Use this energy for something meaningful."
  ],
  evening: [
    "Evening well spent. Real life > screen life.",
    "You just bought yourself quality time. Use it well."
  ],
  night: [
    "Smart choice. Better sleep starts with less screen time.",
    "Your future morning self is grateful right now."
  ],
  task: [
    "Now go crush '{taskTitle}'. You've got {durationMinutes} minutes of focus ahead.",
    "Your next task '{taskTitle}' is waiting. Channel this momentum."
  ],
  streak: [
    "Day {streak} of your streak. Every day gets easier.",
    "{streak} days strong. You're in the top 1% of self-control."
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain');
  const coinsEarned = parseInt(params.get('coins')) || 1;

  // Get data from background
  const data = await new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getData' }, resolve);
  });

  const streak = data?.streak || 0;
  const tasks = data?.tasks || [];
  const pendingTask = tasks.find(t => !t.completed);

  // Set coins
  document.getElementById('earnedAmount').textContent = `+${coinsEarned}`;

  // Set streak
  if (streak > 0) {
    document.getElementById('streakSafe').style.display = 'flex';
  } else {
    document.getElementById('streakSafe').style.display = 'none';
  }

  // Pick message
  const message = pickMessage(streak, pendingTask, domain);
  document.getElementById('congratsMessage').textContent = message;

  // Streak-based title variations
  if (streak >= 7) {
    document.getElementById('congratsTitle').textContent = 'Unstoppable!';
  } else if (streak >= 3) {
    document.getElementById('congratsTitle').textContent = 'Keep it going!';
  }

  // Back to browsing
  document.getElementById('backToBrowsing').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.update(tabs[0].id, { url: 'chrome://newtab' });
      } else {
        window.close();
      }
    });
  });

  // Check tasks link
  document.getElementById('checkTasks').addEventListener('click', (e) => {
    e.preventDefault();
    // Open the extension popup (can't directly, so show a message)
    alert('Open the Screen Time Buddy popup to see your tasks!');
  });

  // Auto redirect countdown
  let countdown = 8;
  const countdownEl = document.getElementById('redirectCountdown');
  const redirectInterval = setInterval(() => {
    countdown--;
    countdownEl.textContent = countdown;
    if (countdown <= 0) {
      clearInterval(redirectInterval);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.update(tabs[0].id, { url: 'chrome://newtab' });
        }
      });
    }
  }, 1000);

  // Cancel auto-redirect on interaction
  document.addEventListener('click', () => {
    clearInterval(redirectInterval);
    document.getElementById('autoRedirect').style.display = 'none';
  }, { once: true });
});

function pickMessage(streak, pendingTask, domain) {
  const hour = new Date().getHours();
  const pools = [];

  // Add time-based messages
  if (hour >= 6 && hour < 12) {
    pools.push(...CONGRATS_MESSAGES.morning);
  } else if (hour >= 12 && hour < 17) {
    pools.push(...CONGRATS_MESSAGES.afternoon);
  } else if (hour >= 17 && hour < 21) {
    pools.push(...CONGRATS_MESSAGES.evening);
  } else {
    pools.push(...CONGRATS_MESSAGES.night);
  }

  // Add task-related if available
  if (pendingTask) {
    CONGRATS_MESSAGES.task.forEach(msg => {
      pools.push(
        msg.replace('{taskTitle}', pendingTask.title)
           .replace('{durationMinutes}', pendingTask.durationMinutes)
      );
    });
  }

  // Add streak-related if applicable
  if (streak >= 2) {
    CONGRATS_MESSAGES.streak.forEach(msg => {
      pools.push(msg.replace(/\{streak\}/g, streak));
    });
  }

  return pools[Math.floor(Math.random() * pools.length)];
}
