// ============================================================
// Screen Time Buddy — Design Tokens & Constants
// ============================================================

const STB_CONSTANTS = {
  // ---- Colors (matching iOS app) ----
  colors: {
    surface: '#000000',
    surfaceElevated: '#1C1C1E',
    surfaceSecondary: '#1A1A1A',
    surfaceTertiary: '#2C2C2E',
    accent: '#A4FF80',
    accentDim: '#6BBF52',
    accentSurface: 'rgba(164, 255, 128, 0.1)',
    btnGreenStart: '#8FD14F',
    btnGreenEnd: '#6BAF3D',
    textPrimary: '#FFFFFF',
    textSecondary: '#8E8E93',
    textTertiary: '#636366',
    error: '#FF453A',
    gold: '#FFD700',
    streakFire: '#FF8800',
    ringGreen: '#A4FF80',
    ringYellow: '#FFBB33',
    ringRed: '#FF4D4D',
    border: 'rgba(255, 255, 255, 0.06)',
    borderStrong: 'rgba(255, 255, 255, 0.1)',
    divider: '#38383A'
  },

  // ---- Character Tiers ----
  characters: {
    eagle: { goalHours: 1.5, coinsPerDay: 4, label: 'Eagle' },
    fox:   { goalHours: 3,   coinsPerDay: 3, label: 'Fox' },
    panda: { goalHours: 4,   coinsPerDay: 2, label: 'Panda' },
    sloth: { goalHours: 5,   coinsPerDay: 1, label: 'Sloth' }
  },

  // ---- Coin Logic ----
  // 1 coin = 1 hour saved (NOT 30 min)
  COINS_PER_HOUR_SAVED: 1,

  // ---- Timing ----
  TICK_PERIOD_MINUTES: 0.083, // ~5 seconds
  OVERLAY_UPDATE_INTERVAL: 5000, // 5 seconds

  // ---- Storage Key ----
  STORAGE_KEY: 'stb_data',

  // ---- Alarm Names ----
  ALARM_TICK: 'stb_tick',
  ALARM_MIDNIGHT: 'stb_midnight',

  // ---- Ring Math ----
  RING_CIRCUMFERENCE: 2 * Math.PI * 52,
  MINI_RING_CIRCUMFERENCE: 2 * Math.PI * 20,

  // ---- Game Configs ----
  games: {
    mindMatch: {
      gridSize: 4,
      pairs: 8,
      timeLimit: 60,
      coinsReward: 2,
      symbols: ['star', 'heart', 'tree', 'diamond', 'eagle', 'seed', 'coin', 'moon'],
      flipDelay: 600
    },
    eagleEye: {
      gridSize: 4,
      timeLimit: 60,
      coinsPerRound: 1
    },
    wordForge: {
      coinsPerWord: 2,
      words: [
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
      ]
    },
    reflexRush: {
      circleCount: 12,
      timeLimit: 30,
      coinsPerFiveCorrect: 1
    },
    impulseMath: {
      timeLimit: 30,
      coinsPerFiveCorrect: 1,
      choiceCount: 4
    },
    zenBreath: {
      breathCount: 3,
      inhaleSeconds: 4,
      holdSeconds: 4,
      exhaleSeconds: 4,
      holdAfterSeconds: 4,
      coinsReward: 2
    }
  },

  // ---- Message Engine Priorities ----
  messagePriority: {
    SLEEP: 1,
    HIGH_ATTEMPTS: 2,
    STREAK_LOSS: 3,
    PERSONAL: 4,
    TIME_OF_DAY: 5,
    USAGE_WARNING: 6,
    LOSS_AVERSION: 7,
    SCIENCE: 8,
    ATTEMPT_ESCALATION: 9
  },

  // ---- Feeling Options ----
  feelings: [
    { id: 'bored', label: 'Bored', emoji: '😐', redirect: 'Try something creative — draw, write, or build something with your hands.' },
    { id: 'anxious', label: 'Anxious', emoji: '😰', redirect: 'Anxiety shrinks when you move. Try a short walk or stretching for 5 minutes.' },
    { id: 'lonely', label: 'Lonely', emoji: '😔', redirect: 'Call or text someone you care about. Real connection beats scrolling every time.' },
    { id: 'fomo', label: 'FOMO', emoji: '😟', redirect: 'Nothing on that app is more important than your goals. You\'re not missing out — you\'re leveling up.' },
    { id: 'procrastinating', label: 'Procrastinating', emoji: '😬', redirect: 'Start your task for just 2 minutes. That\'s all it takes to break the barrier.' },
    { id: 'cantSleep', label: "Can't Sleep", emoji: '🌙', redirect: 'Blue light is keeping you awake. Try reading a book or listening to a podcast instead.' },
    { id: 'habit', label: 'Just a Habit', emoji: '🔄', redirect: 'You caught yourself! That awareness alone is progress. Do something different for 5 minutes.' },
    { id: 'stressed', label: 'Stressed', emoji: '😤', redirect: 'Take 3 deep breaths right now. Inhale for 4 seconds, hold for 4, exhale for 4.' }
  ],

  // ---- Congrats Messages ----
  congratsMessages: {
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
  }
};

// Make available globally
if (typeof globalThis !== 'undefined') {
  globalThis.STB_CONSTANTS = STB_CONSTANTS;
}
