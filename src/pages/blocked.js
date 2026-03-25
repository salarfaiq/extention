// ============================================================
// Screen Time Buddy — Blocked Page Controller
// Complete rewrite with games, breathing, message engine
// ============================================================

const CHARACTER_GOALS = { eagle: 1.5, fox: 3, panda: 4, sloth: 5 };
const CHARACTER_COINS = { eagle: 4, fox: 3, panda: 2, sloth: 1 };

let domain = null;
let pageData = null;
let attemptCount = 0;
let coinsToEarn = 1;

// ---- Panels ----
const panels = ['mainView', 'strugglingPanel', 'breathingPanel', 'feelingPanel',
  'feelingRedirect', 'gamesHub', 'gameContainer', 'tasksPanel', 'walkPanel'];

function showPanel(id) {
  panels.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.toggle('hidden', p !== id);
  });
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  domain = new URLSearchParams(window.location.search).get('domain');
  if (domain) document.getElementById('blockedDomain').textContent = domain;

  pageData = await sendMsg({ action: 'getData' });
  const attRes = await sendMsg({ action: 'getAttempts', domain });
  attemptCount = attRes?.count || 0;

  renderMainView();
  startResetTimer();
  bindMainEvents();
  bindStrugglingEvents();
  bindBreathingEvents();
  bindGamesEvents();
});

function sendMsg(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}

// ============================================================
// MAIN VIEW
// ============================================================

function renderMainView() {
  if (!pageData) return;
  const character = pageData.character || 'fox';
  const streak = pageData.streak || 0;
  const charConfig = CHARACTER_GOALS[character] || 3;
  const goalMinutes = (CHARACTER_GOALS[character] || 3) * 60;

  // Character in ring
  document.getElementById('blockedCharacter').innerHTML =
    `<img src="../../assets/characters/${character}.svg" alt="${character}">`;

  // Dynamic message from engine
  const msg = getSmartMessage();
  document.getElementById('blockedMessage').textContent = msg.text;
  document.getElementById('messageBorder').style.background = msg.color || '#FF4D4D';

  // Calculate coins
  let totalUsed = 0;
  for (const site of Object.values(pageData.sites || {})) {
    if (site.enabled) totalUsed += (site.timeUsed || 0);
  }
  const remainingMinutes = Math.max(0, goalMinutes - totalUsed);
  coinsToEarn = Math.max(1, Math.floor(remainingMinutes / 60));

  // Stakes
  if (streak > 0) {
    document.getElementById('stakeStreak').textContent = `${streak} day streak at risk`;
  } else {
    document.getElementById('stakeStreak').textContent = 'Start building your streak';
  }
  document.getElementById('stakeCoins').textContent = `Close now to earn ${coinsToEarn} coin${coinsToEarn > 1 ? 's' : ''}`;

  // CTA
  document.getElementById('ctaText').textContent = `Close & Earn ${coinsToEarn} Coin${coinsToEarn > 1 ? 's' : ''}`;
}

function bindMainEvents() {
  // Close & Earn
  document.getElementById('closeAppBtn').addEventListener('click', async () => {
    const res = await sendMsg({ action: 'closeBlockedApp', domain });
    const congratsUrl = chrome.runtime.getURL(
      `src/pages/congrats.html?domain=${encodeURIComponent(domain)}&coins=${res?.coinsEarned || coinsToEarn}`
    );
    window.location.href = congratsUrl;
  });

  // I'm Struggling
  document.getElementById('struggleBtn').addEventListener('click', () => {
    showPanel('strugglingPanel');
  });
}

// ============================================================
// STRUGGLING PANEL
// ============================================================

function bindStrugglingEvents() {
  document.getElementById('backToMain').addEventListener('click', () => showPanel('mainView'));

  document.querySelectorAll('.struggle-option').forEach(btn => {
    btn.addEventListener('click', () => {
      switch (btn.dataset.action) {
        case 'breathe': showPanel('breathingPanel'); break;
        case 'games': showPanel('gamesHub'); break;
        case 'tasks': showTasksPanel(); break;
        case 'walk': showPanel('walkPanel'); break;
      }
    });
  });

  // Walk panel back
  document.getElementById('backFromWalk').addEventListener('click', () => showPanel('strugglingPanel'));

  // Tasks panel backs
  document.getElementById('backFromTasks').addEventListener('click', () => showPanel('strugglingPanel'));
  document.getElementById('tasksGoBack').addEventListener('click', () => showPanel('strugglingPanel'));
}

function showTasksPanel() {
  const tasks = pageData.tasks || [];
  const container = document.getElementById('blockedTasksList');

  if (tasks.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#8E8E93;padding:20px;">No tasks planned for today. Add some in the popup!</p>';
  } else {
    container.innerHTML = tasks.map(t => `
      <div class="task-item-blocked">
        <div class="task-bullet ${t.completed ? 'done' : ''}"></div>
        <div class="task-item-info">
          <div class="task-item-title ${t.completed ? 'done' : ''}">${t.title}</div>
          <div class="task-item-dur">${t.durationMinutes}m</div>
        </div>
      </div>
    `).join('');
  }
  showPanel('tasksPanel');
}

// ============================================================
// BREATHING EXERCISE
// ============================================================

let breathingActive = false;

function bindBreathingEvents() {
  document.getElementById('backFromBreathing').addEventListener('click', () => {
    breathingActive = false;
    showPanel('strugglingPanel');
  });

  document.getElementById('startBreathing').addEventListener('click', startBreathingExercise);
}

async function startBreathingExercise() {
  breathingActive = true;
  const circle = document.getElementById('breathingCircle');
  const textEl = document.getElementById('breathingText');
  const countEl = document.getElementById('breathingCount');
  const startBtn = document.getElementById('startBreathing');
  startBtn.style.display = 'none';

  for (let breath = 0; breath < 4 && breathingActive; breath++) {
    // Inhale 4s
    circle.className = 'breathing-circle inhale';
    textEl.textContent = 'Inhale';
    await countdown(countEl, 4);
    if (!breathingActive) break;

    // Hold 4s
    circle.className = 'breathing-circle hold';
    textEl.textContent = 'Hold';
    await countdown(countEl, 4);
    if (!breathingActive) break;

    // Exhale 4s
    circle.className = 'breathing-circle exhale';
    textEl.textContent = 'Exhale';
    await countdown(countEl, 4);
    if (!breathingActive) break;

    // Hold 4s
    circle.className = 'breathing-circle hold';
    textEl.textContent = 'Hold';
    await countdown(countEl, 4);
    if (!breathingActive) break;
  }

  if (breathingActive) {
    circle.className = 'breathing-circle';
    textEl.textContent = 'Well done';
    countEl.textContent = '';
    // Show feeling check after 1.5s
    setTimeout(() => {
      if (breathingActive) showFeelingCheck();
    }, 1500);
  }

  startBtn.style.display = '';
  startBtn.textContent = 'Breathe Again';
}

function countdown(el, seconds) {
  return new Promise(resolve => {
    let remaining = seconds;
    el.textContent = remaining;
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0 || !breathingActive) {
        clearInterval(interval);
        el.textContent = '';
        resolve();
      } else {
        el.textContent = remaining;
      }
    }, 1000);
  });
}

// ============================================================
// FEELING CHECK
// ============================================================

const FEELINGS = [
  { id: 'bored', label: 'Bored', emoji: '\u{1F610}', redirect: 'Try something creative \u2014 draw, write, or build something with your hands.' },
  { id: 'anxious', label: 'Anxious', emoji: '\u{1F630}', redirect: 'Anxiety shrinks when you move. Try a short walk or stretching for 5 minutes.' },
  { id: 'lonely', label: 'Lonely', emoji: '\u{1F614}', redirect: 'Call or text someone you care about. Real connection beats scrolling every time.' },
  { id: 'fomo', label: 'FOMO', emoji: '\u{1F61F}', redirect: 'Nothing on that app is more important than your goals. You\'re not missing out \u2014 you\'re leveling up.' },
  { id: 'procrastinating', label: 'Procrastinating', emoji: '\u{1F62C}', redirect: 'Start your task for just 2 minutes. That\'s all it takes to break the barrier.' },
  { id: 'cantSleep', label: "Can't Sleep", emoji: '\u{1F319}', redirect: 'Blue light is keeping you awake. Try reading a book or listening to a podcast instead.' },
  { id: 'habit', label: 'Just a Habit', emoji: '\u{1F504}', redirect: 'You caught yourself! That awareness alone is progress. Do something different for 5 minutes.' },
  { id: 'stressed', label: 'Stressed', emoji: '\u{1F624}', redirect: 'Take 3 deep breaths right now. Inhale for 4 seconds, hold for 4, exhale for 4.' }
];

function showFeelingCheck() {
  const grid = document.getElementById('feelingGrid');
  grid.innerHTML = FEELINGS.map(f => `
    <button class="feeling-btn" data-id="${f.id}">
      <span class="f-emoji">${f.emoji}</span>
      <span class="f-label">${f.label}</span>
    </button>
  `).join('');

  grid.querySelectorAll('.feeling-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const feeling = FEELINGS.find(f => f.id === btn.dataset.id);
      if (feeling) showFeelingRedirect(feeling);
    });
  });

  showPanel('feelingPanel');
}

function showFeelingRedirect(feeling) {
  document.getElementById('redirectEmoji').textContent = feeling.emoji;
  document.getElementById('redirectMessage').textContent = feeling.redirect;
  document.getElementById('redirectBack').addEventListener('click', () => {
    showPanel('mainView');
  });
  showPanel('feelingRedirect');
}

// ============================================================
// MESSAGE ENGINE
// ============================================================

function getSmartMessage() {
  const hour = new Date().getHours();
  const streak = pageData?.streak || 0;
  const tasks = pageData?.tasks || [];
  const pendingTask = tasks.find(t => !t.completed);

  // Priority 1: Sleep (10pm-6am)
  if (hour >= 22 || hour < 6) {
    return pick([
      { text: 'It\'s late. Screen time before bed wrecks your sleep quality. Put the phone down.', color: '#6366F1' },
      { text: 'Your brain needs rest, not stimulation. Close this and let your body wind down.', color: '#6366F1' },
      { text: 'Every minute of screen time now costs you 2 minutes of quality sleep. Is it worth it?', color: '#6366F1' }
    ]);
  }

  // Priority 2: High attempts (>=7)
  if (attemptCount >= 7) {
    return pick([
      { text: 'You\'ve tried to access this site ' + attemptCount + ' times today. This is the urge talking, not you. Be stronger.', color: '#FF453A' },
      { text: attemptCount + ' attempts. Each one you resist makes you mentally tougher. Don\'t give in now.', color: '#FF453A' }
    ]);
  }

  // Priority 3: Streak loss (streak >= 7)
  if (streak >= 7) {
    return pick([
      { text: `You have a ${streak}-day streak! Don't throw it away for a few minutes of scrolling.`, color: '#FF8800' },
      { text: `${streak} days of discipline. One moment of weakness could reset it all. Stay strong.`, color: '#FF8800' }
    ]);
  }

  // Priority 4: Personal (from tasks)
  if (pendingTask) {
    return pick([
      { text: `"${pendingTask.title}" is waiting for you. That's more important than this site.`, color: '#A4FF80' },
      { text: `You planned to do "${pendingTask.title}" today. Channel this energy into your goals.`, color: '#A4FF80' }
    ]);
  }

  // Priority 5: Time of day
  if (hour >= 6 && hour < 12) {
    return pick([
      { text: 'Mornings set the tone. Start with intention, not distraction.', color: '#FFBB33' },
      { text: 'Your morning brain is at peak performance. Don\'t waste it here.', color: '#FFBB33' }
    ]);
  }
  if (hour >= 12 && hour < 14) {
    return pick([
      { text: 'Midday check: are you using your time the way you planned?', color: '#FFBB33' },
      { text: 'Half the day is gone. Make the second half count.', color: '#FFBB33' }
    ]);
  }
  if (hour >= 14 && hour < 17) {
    return pick([
      { text: 'Afternoon slump? That\'s your brain craving easy dopamine. Give it something meaningful instead.', color: '#FFBB33' },
      { text: 'The afternoon is where focus dies or thrives. Choose wisely.', color: '#FFBB33' }
    ]);
  }
  if (hour >= 17 && hour < 20) {
    return pick([
      { text: 'Evening time is yours. Don\'t let an algorithm decide how you spend it.', color: '#FFBB33' },
      { text: 'You made it through the day. End it on your terms, not this app\'s.', color: '#FFBB33' }
    ]);
  }

  // Priority 6+: Loss aversion / science
  return pick([
    { text: 'Every minute you resist is a win. You\'re building real discipline.', color: '#FF4D4D' },
    { text: 'Studies show it takes 10 minutes for a craving to pass. You\'re almost there.', color: '#87CEEB' },
    { text: 'Your attention is your most valuable resource. Protect it.', color: '#FF4D4D' },
    { text: 'The apps are designed to keep you hooked. You\'re choosing freedom.', color: '#87CEEB' },
    { text: 'Dopamine from scrolling is borrowed happiness. Real satisfaction comes from creating.', color: '#87CEEB' },
    { text: 'This pause is your superpower. Most people never stop scrolling.', color: '#FF4D4D' },
    { text: 'You don\'t need one more scroll. You need one good decision.', color: '#FF4D4D' },
    { text: 'Small wins compound. Closing this now protects your streak and your focus.', color: '#A4FF80' }
  ]);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// GAMES
// ============================================================

let gameTimer = null;
let gameTimeLeft = 0;

function bindGamesEvents() {
  document.getElementById('backFromGames').addEventListener('click', () => showPanel('strugglingPanel'));
  document.getElementById('backFromGame').addEventListener('click', () => {
    clearInterval(gameTimer);
    showPanel('gamesHub');
  });
  document.getElementById('resultBack').addEventListener('click', () => {
    showPanel('gamesHub');
  });

  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => launchGame(card.dataset.game));
  });
}

function launchGame(gameId) {
  showPanel('gameContainer');
  document.getElementById('gameResult').classList.add('hidden');
  document.getElementById('gameArea').innerHTML = '';
  document.getElementById('gameScore').textContent = '';

  switch (gameId) {
    case 'mindMatch': startMindMatch(); break;
    case 'eagleEye': startEagleEye(); break;
    case 'wordForge': startWordForge(); break;
    case 'reflexRush': startReflexRush(); break;
    case 'impulseMath': startImpulseMath(); break;
    case 'zenBreath': startZenBreath(); break;
  }
}

function startGameTimer(seconds, onTick, onEnd) {
  gameTimeLeft = seconds;
  updateTimerDisplay();
  clearInterval(gameTimer);
  gameTimer = setInterval(() => {
    gameTimeLeft--;
    updateTimerDisplay();
    if (onTick) onTick(gameTimeLeft);
    if (gameTimeLeft <= 0) {
      clearInterval(gameTimer);
      if (onEnd) onEnd();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('gameTimer');
  el.textContent = gameTimeLeft + 's';
  el.classList.toggle('warning', gameTimeLeft <= 10);
}

async function endGame(won, coinsAwarded, message) {
  clearInterval(gameTimer);
  if (coinsAwarded > 0) {
    await sendMsg({ action: 'awardCoins', amount: coinsAwarded });
  }
  const area = document.getElementById('gameArea');
  area.innerHTML = '';
  const result = document.getElementById('gameResult');
  result.classList.remove('hidden');
  document.getElementById('resultIcon').textContent = won ? '\u{1F389}' : '\u{23F0}';
  document.getElementById('resultText').textContent = message || (won ? 'Great job!' : 'Time\'s up!');
  document.getElementById('resultCoins').textContent = coinsAwarded > 0 ? `+${coinsAwarded} coins earned!` : 'No coins this time';
}

// ---- MIND MATCH ----
function startMindMatch() {
  const symbols = ['\u2B50', '\u2764\uFE0F', '\u{1F332}', '\u{1F48E}', '\u{1F985}', '\u{1F331}', '\u{1FA99}', '\u{1F319}'];
  let cards = [...symbols, ...symbols];
  cards = shuffle(cards);

  let flipped = [];
  let matched = 0;
  let locked = false;

  const area = document.getElementById('gameArea');
  area.innerHTML = '<div class="match-grid">' + cards.map((sym, i) =>
    `<div class="match-card" data-idx="${i}" data-sym="${sym}"><span class="card-face">${sym}</span></div>`
  ).join('') + '</div>';

  area.querySelectorAll('.match-card').forEach(card => {
    card.addEventListener('click', () => {
      if (locked || card.classList.contains('flipped') || card.classList.contains('matched')) return;
      card.classList.add('flipped');
      flipped.push(card);

      if (flipped.length === 2) {
        locked = true;
        const [a, b] = flipped;
        if (a.dataset.sym === b.dataset.sym) {
          a.classList.add('matched');
          b.classList.add('matched');
          matched++;
          flipped = [];
          locked = false;
          document.getElementById('gameScore').textContent = `${matched}/8 pairs`;
          if (matched === 8) endGame(true, 2, 'All pairs matched!');
        } else {
          setTimeout(() => {
            a.classList.remove('flipped');
            b.classList.remove('flipped');
            flipped = [];
            locked = false;
          }, 600);
        }
      }
    });
  });

  document.getElementById('gameScore').textContent = '0/8 pairs';
  startGameTimer(60, null, () => endGame(false, 0, 'Time\'s up! Try again.'));
}

// ---- EAGLE EYE ----
function startEagleEye() {
  const icons = ['\u2B50', '\u2764\uFE0F', '\u{1F332}', '\u{1F48E}', '\u{1F985}', '\u{1F331}', '\u{1FA99}', '\u{1F319}', '\u26A1', '\u{1F525}'];
  let rounds = 0;
  let coinsEarned = 0;

  function newRound() {
    const target = icons[Math.floor(Math.random() * icons.length)];
    // Place target 2-4 times, fill rest randomly
    const targetCount = 2 + Math.floor(Math.random() * 3);
    let grid = [];
    for (let i = 0; i < 16; i++) {
      grid.push(icons[Math.floor(Math.random() * icons.length)]);
    }
    // Ensure exactly targetCount targets
    const positions = shuffle([...Array(16).keys()]).slice(0, targetCount);
    positions.forEach(p => grid[p] = target);

    let found = 0;

    const area = document.getElementById('gameArea');
    area.innerHTML = `
      <div class="eagle-target">
        <span class="eagle-target-icon">${target}</span>
        Find all ${target} (${targetCount} total)
      </div>
      <div class="eagle-grid">${grid.map((icon, i) =>
        `<div class="eagle-cell" data-idx="${i}" data-icon="${icon}">${icon}</div>`
      ).join('')}</div>
    `;

    area.querySelectorAll('.eagle-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        if (cell.classList.contains('correct')) return;
        if (cell.dataset.icon === target) {
          cell.classList.add('correct');
          found++;
          if (found === targetCount) {
            rounds++;
            coinsEarned++;
            document.getElementById('gameScore').textContent = `Round ${rounds} | +${coinsEarned} coins`;
            setTimeout(newRound, 500);
          }
        } else {
          cell.classList.add('wrong');
          setTimeout(() => cell.classList.remove('wrong'), 300);
        }
      });
    });
  }

  document.getElementById('gameScore').textContent = 'Round 0 | +0 coins';
  newRound();
  startGameTimer(60, null, () => endGame(rounds > 0, coinsEarned, `${rounds} rounds completed!`));
}

// ---- WORD FORGE ----
function startWordForge() {
  const words = [
    { word: 'FOCUS', hint: 'Direct your attention' },
    { word: 'PRESENT', hint: 'Living in the now' },
    { word: 'GROWTH', hint: 'Getting better every day' },
    { word: 'STRONG', hint: 'Inner power and resilience' },
    { word: 'CALM', hint: 'A peaceful state of mind' },
    { word: 'BREATHE', hint: 'In and out, slowly' },
    { word: 'FOREST', hint: 'A place of tall trees' },
    { word: 'PEACE', hint: 'Freedom from disturbance' },
    { word: 'MINDFUL', hint: 'Aware of the present moment' },
    { word: 'BALANCE', hint: 'Equal parts of everything' },
    { word: 'CLARITY', hint: 'Clear thinking' },
    { word: 'FREEDOM', hint: 'The power to choose' },
    { word: 'PATIENT', hint: 'Waiting without frustration' },
    { word: 'ENERGY', hint: 'The fuel that drives you' },
    { word: 'DREAM', hint: 'A vision for the future' }
  ];

  let remaining = shuffle([...words]);
  let solved = 0;
  let coinsEarned = 0;

  function nextWord() {
    if (remaining.length === 0) {
      endGame(true, coinsEarned, `All words solved! +${coinsEarned} coins`);
      return;
    }
    const current = remaining.pop();
    const scrambled = shuffle(current.word.split('')).join('');

    const area = document.getElementById('gameArea');
    area.innerHTML = `
      <div class="word-forge">
        <div class="wf-scrambled">${scrambled}</div>
        <div class="wf-hint">${current.hint}</div>
        <input class="wf-input" type="text" maxlength="${current.word.length}" placeholder="Type your answer" autofocus>
        <div class="wf-score">Solved: ${solved} | +${coinsEarned} coins</div>
      </div>
    `;

    const input = area.querySelector('.wf-input');
    input.focus();
    input.addEventListener('input', () => {
      const val = input.value.toUpperCase().trim();
      if (val === current.word) {
        input.classList.add('correct');
        solved++;
        coinsEarned += 2;
        document.getElementById('gameScore').textContent = `${solved} words | +${coinsEarned} coins`;
        setTimeout(nextWord, 600);
      } else if (val.length === current.word.length) {
        input.classList.add('wrong');
        setTimeout(() => {
          input.classList.remove('wrong');
          input.value = '';
        }, 400);
      }
    });
  }

  document.getElementById('gameScore').textContent = '0 words | +0 coins';
  // No timer for word forge — unlimited
  document.getElementById('gameTimer').textContent = '\u221E';
  clearInterval(gameTimer);
  nextWord();
}

// ---- REFLEX RUSH ----
function startReflexRush() {
  const colors = ['#FF453A', '#007AFF', '#34C759', '#FFD60A', '#FF9500', '#AF52DE', '#FF2D55', '#00C7BE'];
  let targetColor = colors[Math.floor(Math.random() * colors.length)];
  let correct = 0;
  let wrong = 0;
  let coinsEarned = 0;

  function renderGrid() {
    const grid = [];
    for (let i = 0; i < 12; i++) {
      grid.push(colors[Math.floor(Math.random() * colors.length)]);
    }
    // Ensure at least 2 targets
    const spots = shuffle([...Array(12).keys()]).slice(0, 2 + Math.floor(Math.random() * 3));
    spots.forEach(s => grid[s] = targetColor);

    const area = document.getElementById('gameArea');
    area.innerHTML = `
      <div class="reflex-target">
        <div class="reflex-target-label">Tap this color:</div>
        <div class="reflex-target-color" style="background:${targetColor}"></div>
      </div>
      <div class="reflex-grid">${grid.map((c, i) =>
        `<div class="reflex-circle" data-idx="${i}" data-color="${c}" style="background:${c}"></div>`
      ).join('')}</div>
      <div class="reflex-score">Correct: ${correct} | Wrong: ${wrong}</div>
    `;

    area.querySelectorAll('.reflex-circle').forEach(circle => {
      circle.addEventListener('click', () => {
        if (circle.dataset.color === targetColor) {
          correct++;
          if (correct % 5 === 0) coinsEarned++;
        } else {
          wrong++;
          if (correct > 0) correct--;
        }
        document.getElementById('gameScore').textContent = `${correct} hits | +${coinsEarned} coins`;
        renderGrid();
      });
    });
  }

  document.getElementById('gameScore').textContent = '0 hits | +0 coins';
  renderGrid();
  startGameTimer(30, null, () => endGame(correct >= 5, coinsEarned, `${correct} correct taps!`));
}

// ---- IMPULSE MATH ----
function startImpulseMath() {
  let correct = 0;
  let coinsEarned = 0;

  function nextProblem() {
    const ops = ['+', '-', '\u00D7'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, answer;

    if (op === '+') {
      a = 1 + Math.floor(Math.random() * 20);
      b = 1 + Math.floor(Math.random() * 20);
      answer = a + b;
    } else if (op === '-') {
      a = 5 + Math.floor(Math.random() * 20);
      b = 1 + Math.floor(Math.random() * (a - 1));
      answer = a - b;
    } else {
      a = 1 + Math.floor(Math.random() * 12);
      b = 1 + Math.floor(Math.random() * 12);
      answer = a * b;
    }

    // Generate 4 choices including correct
    let choices = new Set([answer]);
    while (choices.size < 4) {
      const offset = Math.floor(Math.random() * 10) - 5;
      const wrong = answer + (offset === 0 ? 1 : offset);
      if (wrong > 0) choices.add(wrong);
    }
    choices = shuffle([...choices]);

    const area = document.getElementById('gameArea');
    area.innerHTML = `
      <div class="math-problem">
        <div class="math-expression">${a} ${op} ${b} = ?</div>
      </div>
      <div class="math-choices">${choices.map(c =>
        `<button class="math-choice" data-val="${c}">${c}</button>`
      ).join('')}</div>
      <div class="math-score">Correct: ${correct} | +${coinsEarned} coins</div>
    `;

    area.querySelectorAll('.math-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.val);
        if (val === answer) {
          btn.classList.add('correct');
          correct++;
          if (correct % 5 === 0) coinsEarned++;
          document.getElementById('gameScore').textContent = `${correct} correct | +${coinsEarned} coins`;
          setTimeout(nextProblem, 400);
        } else {
          btn.classList.add('wrong');
          // Show correct answer
          area.querySelectorAll('.math-choice').forEach(b => {
            if (parseInt(b.dataset.val) === answer) b.classList.add('correct');
          });
          setTimeout(nextProblem, 800);
        }
      });
    });
  }

  document.getElementById('gameScore').textContent = '0 correct | +0 coins';
  nextProblem();
  startGameTimer(30, null, () => endGame(correct >= 5, coinsEarned, `${correct} correct answers!`));
}

// ---- ZEN BREATH ----
function startZenBreath() {
  document.getElementById('gameTimer').textContent = '\u{1F9D8}';
  clearInterval(gameTimer);

  const area = document.getElementById('gameArea');
  let phase = 'guide'; // guide -> hold -> done
  let breathsDone = 0;

  async function guidedBreaths() {
    area.innerHTML = `
      <div class="zen-breath">
        <div class="zen-circle" id="zenCircle">
          <div>
            <span class="zen-text" id="zenText">Ready</span>
            <span class="zen-count" id="zenCount"></span>
          </div>
        </div>
        <p style="color:#8E8E93;font-size:14px;" id="zenProgress">Breath 0/3</p>
      </div>
    `;

    const circle = document.getElementById('zenCircle');
    const text = document.getElementById('zenText');
    const count = document.getElementById('zenCount');
    const progress = document.getElementById('zenProgress');

    for (let i = 0; i < 3; i++) {
      breathsDone = i + 1;
      progress.textContent = `Breath ${breathsDone}/3`;

      // Inhale
      circle.className = 'zen-circle inhale';
      text.textContent = 'Inhale';
      await zenCountdown(count, 4);

      // Hold
      circle.className = 'zen-circle hold';
      text.textContent = 'Hold';
      await zenCountdown(count, 4);

      // Exhale
      circle.className = 'zen-circle exhale';
      text.textContent = 'Exhale';
      await zenCountdown(count, 4);

      // Hold
      circle.className = 'zen-circle hold';
      text.textContent = 'Hold';
      await zenCountdown(count, 4);
    }

    // Now hold phase
    startHoldPhase();
  }

  function startHoldPhase() {
    let holdTime = 0;
    let holding = false;
    let holdInterval = null;

    area.innerHTML = `
      <div class="zen-breath">
        <p style="color:#8E8E93;font-size:16px;margin-bottom:8px;">Now hold your breath as long as you can</p>
        <div class="zen-hold-timer" id="holdTimer">0.0s</div>
        <div class="zen-best" id="zenBest"></div>
        <button class="zen-hold-btn" id="holdBtn">Hold & Start</button>
      </div>
    `;

    const timerEl = document.getElementById('holdTimer');
    const btn = document.getElementById('holdBtn');

    btn.addEventListener('click', () => {
      if (!holding) {
        holding = true;
        holdTime = 0;
        btn.textContent = 'Release';
        btn.style.borderColor = '#FF4D4D';
        holdInterval = setInterval(() => {
          holdTime += 0.1;
          timerEl.textContent = holdTime.toFixed(1) + 's';
        }, 100);
      } else {
        holding = false;
        clearInterval(holdInterval);
        btn.textContent = 'Done!';
        btn.disabled = true;
        document.getElementById('zenBest').textContent = `Your hold: ${holdTime.toFixed(1)}s`;
        endGame(true, 2, `Held for ${holdTime.toFixed(1)} seconds!`);
      }
    });
  }

  function zenCountdown(el, seconds) {
    return new Promise(resolve => {
      let rem = seconds;
      el.textContent = rem;
      const iv = setInterval(() => {
        rem--;
        if (rem <= 0) {
          clearInterval(iv);
          el.textContent = '';
          resolve();
        } else {
          el.textContent = rem;
        }
      }, 1000);
    });
  }

  guidedBreaths();
}

// ============================================================
// RESET TIMER
// ============================================================

function startResetTimer() {
  function update() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const el = document.getElementById('resetTimer');
    if (el) el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  update();
  setInterval(update, 1000);
}

// ============================================================
// HELPERS
// ============================================================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
