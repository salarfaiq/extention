// ============================================================
// Screen Time Buddy — Local Storage Service
// ============================================================
// Wraps chrome.storage.local with typed accessors for all app data.

const STB_STORAGE_KEY = 'stb_data';

function defaultData() {
  return {
    user: { uid: null, email: null, username: null },
    sites: {},
    coins: 0,
    streak: 0,
    lastActiveDay: null,
    character: 'fox',
    totalSavedMinutes: 0,
    tasks: [],
    attempts: {}, // { "domain.com": { count: 0, date: "2024-01-01" } }
    settings: {
      showOverlay: true,
      soundEnabled: false,
      strictMode: false
    }
  };
}

// ---- Core CRUD ----

function getData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STB_STORAGE_KEY, (result) => {
      const data = result[STB_STORAGE_KEY] || defaultData();
      resolve(data);
    });
  });
}

function setData(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STB_STORAGE_KEY]: data }, resolve);
  });
}

async function updateData(updater) {
  const data = await getData();
  updater(data);
  await setData(data);
  return data;
}

// ---- Site Management ----

async function addSite(domain, timeLimit) {
  domain = cleanDomain(domain);
  const data = await getData();
  if (data.sites[domain]) {
    return { error: 'Site already exists' };
  }
  data.sites[domain] = {
    timeLimit,
    timeUsed: 0,
    enabled: true,
    addedAt: Date.now()
  };
  await setData(data);
  return { ok: true };
}

async function removeSite(domain) {
  return updateData((data) => {
    delete data.sites[domain];
  });
}

async function toggleSite(domain, enabled) {
  return updateData((data) => {
    if (data.sites[domain]) {
      data.sites[domain].enabled = enabled;
    }
  });
}

async function updateTimeLimit(domain, timeLimit) {
  return updateData((data) => {
    if (data.sites[domain]) {
      data.sites[domain].timeLimit = timeLimit;
    }
  });
}

async function addTimeForDomain(domain, minutes) {
  return updateData((data) => {
    if (data.sites[domain] && data.sites[domain].enabled) {
      data.sites[domain].timeUsed = (data.sites[domain].timeUsed || 0) + minutes;
    }
  });
}

// ---- Coins ----

async function addCoins(amount) {
  return updateData((data) => {
    data.coins = (data.coins || 0) + amount;
  });
}

async function spendCoins(amount) {
  const data = await getData();
  if ((data.coins || 0) < amount) {
    return { error: 'Not enough coins' };
  }
  data.coins -= amount;
  await setData(data);
  return { ok: true, newCoins: data.coins };
}

// ---- Streak ----

async function incrementStreak() {
  return updateData((data) => {
    data.streak = (data.streak || 0) + 1;
  });
}

async function resetStreak() {
  return updateData((data) => {
    data.streak = 0;
  });
}

// ---- Character ----

async function setCharacter(character) {
  return updateData((data) => {
    data.character = character;
  });
}

// ---- Tasks CRUD ----

async function addTask(title, durationMinutes) {
  return updateData((data) => {
    if (!data.tasks) data.tasks = [];
    data.tasks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title,
      durationMinutes,
      completed: false,
      createdAt: Date.now()
    });
  });
}

async function toggleTask(taskId) {
  return updateData((data) => {
    if (!data.tasks) return;
    const task = data.tasks.find(t => t.id === taskId);
    if (task) task.completed = !task.completed;
  });
}

async function deleteTask(taskId) {
  return updateData((data) => {
    if (!data.tasks) return;
    data.tasks = data.tasks.filter(t => t.id !== taskId);
  });
}

// ---- Attempts Tracking ----

async function incrementAttempts(domain) {
  const today = new Date().toISOString().split('T')[0];
  return updateData((data) => {
    if (!data.attempts) data.attempts = {};
    if (!data.attempts[domain] || data.attempts[domain].date !== today) {
      data.attempts[domain] = { count: 1, date: today };
    } else {
      data.attempts[domain].count += 1;
    }
  });
}

async function getAttempts(domain) {
  const data = await getData();
  const today = new Date().toISOString().split('T')[0];
  if (!data.attempts || !data.attempts[domain] || data.attempts[domain].date !== today) {
    return 0;
  }
  return data.attempts[domain].count;
}

// ---- Helpers ----

function cleanDomain(domain) {
  return domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();
}

// Make available globally
if (typeof globalThis !== 'undefined') {
  globalThis.STBStorage = {
    getData, setData, updateData, defaultData,
    addSite, removeSite, toggleSite, updateTimeLimit, addTimeForDomain,
    addCoins, spendCoins,
    incrementStreak, resetStreak,
    setCharacter,
    addTask, toggleTask, deleteTask,
    incrementAttempts, getAttempts,
    cleanDomain,
    STORAGE_KEY: STB_STORAGE_KEY
  };
}
