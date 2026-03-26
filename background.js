// ============================================================
// Screen Time Buddy — Background Service Worker
// ============================================================

importScripts(
  'src/core/constants.js',
  'src/core/firebase-config.js',
  'src/services/storage.js',
  'src/services/auth.js',
  'src/services/sync.js'
);

const ALARM_TICK = STB_CONSTANTS.ALARM_TICK;
const ALARM_MIDNIGHT = STB_CONSTANTS.ALARM_MIDNIGHT;
const CHARACTERS = STB_CONSTANTS.characters;

// ---- Active Tab State ----
let activeState = { domain: null, startTime: null, tabId: null };

// ---- Initialization ----
chrome.runtime.onInstalled.addListener(async () => {
  const data = await STBStorage.getData();
  // Ensure defaults exist (merge with existing)
  if (!data.tasks) data.tasks = [];
  if (!data.attempts) data.attempts = {};
  if (!data.user) data.user = { uid: null, email: null, username: null };
  await STBStorage.setData(data);

  chrome.alarms.create(ALARM_TICK, { periodInMinutes: STB_CONSTANTS.TICK_PERIOD_MINUTES });
  scheduleMidnightReset();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_TICK, { periodInMinutes: STB_CONSTANTS.TICK_PERIOD_MINUTES });
  scheduleMidnightReset();
  checkDayRollover();
});

// ---- Active Tab Tracking ----
chrome.tabs.onActivated.addListener((info) => {
  chrome.tabs.get(info.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url) return;
    onTabChanged(tab.id, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === 'complete' && tab.active) {
    onTabChanged(tabId, tab.url);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    flushActiveTime();
    activeState = { domain: null, startTime: null, tabId: null };
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) onTabChanged(tabs[0].id, tabs[0].url);
    });
  }
});

function onTabChanged(tabId, url) {
  const domain = extractDomain(url);
  if (activeState.domain && activeState.domain !== domain) {
    flushActiveTime();
  }
  activeState = { domain, startTime: Date.now(), tabId };
  if (domain) checkAndBlock(domain, tabId);
}

function flushActiveTime() {
  if (!activeState.domain || !activeState.startTime) return;
  const minutes = (Date.now() - activeState.startTime) / 60000;
  if (minutes > 0 && minutes < 60) {
    STBStorage.addTimeForDomain(activeState.domain, minutes);
  }
  activeState.startTime = Date.now();
}

// ---- Blocking Logic ----
async function checkAndBlock(domain, tabId) {
  if (!domain) return;
  const data = await STBStorage.getData();
  const site = data.sites[domain];
  if (!site || !site.enabled) return;
  if ((site.timeUsed || 0) >= site.timeLimit) {
    // Increment attempt counter
    await STBStorage.incrementAttempts(domain);
    blockTab(tabId, domain);
  }
}

function blockTab(tabId, domain) {
  const blockedUrl = chrome.runtime.getURL(`src/pages/blocked.html?domain=${encodeURIComponent(domain)}`);
  chrome.tabs.update(tabId, { url: blockedUrl });
}

// ---- Declarative Net Request Rules ----
async function updateBlockRules() {
  const data = await STBStorage.getData();
  const rules = [];
  let ruleId = 1;

  for (const [domain, site] of Object.entries(data.sites)) {
    if (site.enabled && (site.timeUsed || 0) >= site.timeLimit) {
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            extensionPath: `/src/pages/blocked.html?domain=${encodeURIComponent(domain)}`
          }
        },
        condition: {
          urlFilter: `||${domain}`,
          resourceTypes: ['main_frame']
        }
      });
    }
  }

  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    const removeIds = existingRules.map(r => r.id);
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeIds,
      addRules: rules
    });
  });
}

// ---- Alarm Handlers ----
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_TICK) {
    flushActiveTime();
    if (activeState.domain && activeState.tabId) {
      checkAndBlock(activeState.domain, activeState.tabId);
    }
    updateBlockRules();
    sendCountdownToActiveTab();
  }
  if (alarm.name === ALARM_MIDNIGHT) {
    resetDaily();
    scheduleMidnightReset();
  }
});

// ---- Midnight Reset ----
function scheduleMidnightReset() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;
  chrome.alarms.create(ALARM_MIDNIGHT, { delayInMinutes: msUntilMidnight / 60000 });
}

async function resetDaily() {
  const data = await STBStorage.getData();

  // Check if user stayed under all limits
  const allUnderLimit = Object.values(data.sites).every(
    s => !s.enabled || (s.timeUsed || 0) < s.timeLimit
  );

  if (allUnderLimit && Object.keys(data.sites).length > 0) {
    const charConfig = CHARACTERS[data.character] || CHARACTERS.fox;
    data.coins += charConfig.coinsPerDay;
    data.streak += 1;
  }

  // Calculate saved minutes
  for (const site of Object.values(data.sites)) {
    if (site.enabled) {
      const saved = Math.max(0, site.timeLimit - (site.timeUsed || 0));
      data.totalSavedMinutes += saved;
    }
  }

  // Reset time used for all sites
  for (const domain in data.sites) {
    data.sites[domain].timeUsed = 0;
  }

  // Reset attempts
  data.attempts = {};

  // Clear completed tasks
  if (data.tasks) {
    data.tasks = data.tasks.filter(t => !t.completed);
  }

  data.lastActiveDay = new Date().toISOString().split('T')[0];
  await STBStorage.setData(data);

  // Clear block rules
  chrome.declarativeNetRequest.getDynamicRules((rules) => {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: rules.map(r => r.id),
      addRules: []
    });
  });
}

async function checkDayRollover() {
  const data = await STBStorage.getData();
  const today = new Date().toISOString().split('T')[0];
  if (data.lastActiveDay && data.lastActiveDay !== today) {
    resetDaily();
  }
}

// ---- Content Script Communication ----
async function sendCountdownToActiveTab() {
  if (!activeState.domain || !activeState.tabId) return;
  const data = await STBStorage.getData();
  const site = data.sites[activeState.domain];
  if (!site || !site.enabled) return;

  const timeRemaining = Math.max(0, site.timeLimit - (site.timeUsed || 0));
  chrome.tabs.sendMessage(activeState.tabId, {
    action: 'countdown',
    timeRemaining,
    timeLimit: site.timeLimit,
    domain: activeState.domain,
    character: data.character,
    coins: data.coins,
    streak: data.streak
  }).catch(() => {});
}

// ---- Message Handler ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse);
  return true; // keep channel open for async
});

async function handleMessage(msg, sender) {
  switch (msg.action) {
    case 'getData':
      return await STBStorage.getData();

    case 'setData':
      await STBStorage.setData(msg.data);
      updateBlockRules();
      return { ok: true };

    case 'addSite': {
      const result = await STBStorage.addSite(msg.domain, msg.timeLimit);
      if (result.ok) updateBlockRules();
      return result;
    }

    case 'removeSite':
      await STBStorage.removeSite(msg.domain);
      updateBlockRules();
      return { ok: true };

    case 'toggleSite':
      await STBStorage.toggleSite(msg.domain, msg.enabled);
      updateBlockRules();
      return { ok: true };

    case 'updateTimeLimit':
      await STBStorage.updateTimeLimit(msg.domain, msg.timeLimit);
      updateBlockRules();
      return { ok: true };

    case 'setCharacter':
      await STBStorage.setCharacter(msg.character);
      return { ok: true };

    case 'extendTime': {
      const data = await STBStorage.getData();
      const cost = msg.cost || 1;
      if ((data.coins || 0) < cost) {
        return { error: 'Not enough coins' };
      }
      data.coins -= cost;
      if (data.sites[msg.domain]) {
        data.sites[msg.domain].timeLimit += msg.extraMinutes;
      }
      await STBStorage.setData(data);
      updateBlockRules();
      return { ok: true, newCoins: data.coins };
    }

    case 'getTimeRemaining': {
      const domain = sender.tab ? extractDomain(sender.tab.url) : null;
      if (!domain) return { timeRemaining: null };
      const data = await STBStorage.getData();
      const site = data.sites[domain];
      if (site && site.enabled) {
        return { timeRemaining: Math.max(0, site.timeLimit - (site.timeUsed || 0)) };
      }
      return { timeRemaining: null };
    }

    case 'closeBlockedApp': {
      const data = await STBStorage.getData();
      const charConfig = CHARACTERS[data.character] || CHARACTERS.fox;
      const goalMinutes = charConfig.goalHours * 60;

      // Calculate total time used across all sites
      let totalUsed = 0;
      for (const site of Object.values(data.sites)) {
        if (site.enabled) totalUsed += (site.timeUsed || 0);
      }

      const remainingMinutes = Math.max(0, goalMinutes - totalUsed);
      // 1 coin per hour saved, minimum 1
      const coinsEarned = Math.max(1, Math.floor(remainingMinutes / 60));

      data.coins = (data.coins || 0) + coinsEarned;
      await STBStorage.setData(data);
      return { ok: true, coins: data.coins, coinsEarned };
    }

    case 'awardCoins': {
      const data = await STBStorage.getData();
      data.coins = (data.coins || 0) + (msg.amount || 0);
      await STBStorage.setData(data);
      return { ok: true, coins: data.coins };
    }

    case 'addTask': {
      await STBStorage.addTask(msg.title, msg.durationMinutes, msg.blockedSites);
      return { ok: true };
    }

    case 'toggleTask': {
      await STBStorage.toggleTask(msg.taskId);
      return { ok: true };
    }

    case 'deleteTask': {
      await STBStorage.deleteTask(msg.taskId);
      return { ok: true };
    }

    case 'getAttempts': {
      const count = await STBStorage.getAttempts(msg.domain);
      return { count };
    }

    // ---- Auth Actions ----
    case 'signInEmail': {
      const res = await STBAuth.signInWithEmail(msg.email, msg.password);
      if (res.error) return res;
      const session = await STBAuth.saveSession(res);
      // Pull user profile from Firestore and merge into local data
      const profile = await STBAuth.getUserProfile(res.uid, res.idToken);
      if (profile) {
        const data = await STBStorage.getData();
        data.user = { uid: profile.uid, email: profile.email, username: profile.username, fullname: profile.fullname };
        data.coins = profile.coins || data.coins;
        data.streak = profile.streak || data.streak;
        await STBStorage.setData(data);
      }
      return { ok: true, uid: res.uid, email: res.email };
    }

    case 'signInGoogle': {
      const res = await STBAuth.signInWithGoogle();
      if (res.error) return res;
      const session = await STBAuth.saveSession(res);
      const profile = await STBAuth.getUserProfile(res.uid, res.idToken);
      if (profile) {
        const data = await STBStorage.getData();
        data.user = { uid: profile.uid, email: profile.email, username: profile.username, fullname: profile.fullname };
        data.coins = profile.coins || data.coins;
        data.streak = profile.streak || data.streak;
        await STBStorage.setData(data);
      }
      return { ok: true, uid: res.uid, email: res.email, displayName: res.displayName };
    }

    case 'signOut': {
      await STBAuth.signOut();
      const data = await STBStorage.getData();
      data.user = { uid: null, email: null, username: null };
      await STBStorage.setData(data);
      return { ok: true };
    }

    case 'getAuthSession': {
      const session = await STBAuth.getSession();
      return session ? { loggedIn: true, uid: session.uid, email: session.email, displayName: session.displayName } : { loggedIn: false };
    }

    case 'resetPassword': {
      return await STBAuth.sendPasswordReset(msg.email);
    }

    case 'syncNow': {
      const session = await STBAuth.getSession();
      if (!session) return { error: 'Not logged in' };
      const profile = await STBAuth.getUserProfile(session.uid, session.idToken);
      if (profile) {
        const data = await STBStorage.getData();
        data.coins = profile.coins;
        data.streak = profile.streak;
        await STBStorage.setData(data);
        return { ok: true, coins: profile.coins, streak: profile.streak };
      }
      return { error: 'Could not fetch profile' };
    }

    default:
      return { error: 'Unknown action' };
  }
}

// ---- Helpers ----
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
