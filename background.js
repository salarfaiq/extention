// ============================================================
// Screen Time Buddy — Background Service Worker
// ============================================================

const ALARM_TICK = 'stb_tick';
const ALARM_MIDNIGHT = 'stb_midnight';
const STORAGE_KEY = 'stb_data';

// Default user data shape
function defaultData() {
  return {
    sites: {},          // { "domain.com": { timeLimit, timeUsed, enabled, addedAt } }
    coins: 0,
    streak: 0,
    lastActiveDay: null,
    character: 'fox',   // eagle | fox | panda | sloth
    totalSavedMinutes: 0,
    settings: {
      showOverlay: true,
      soundEnabled: false,
      strictMode: false  // prevents easy extension disable
    }
  };
}

// ---- Initialization ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    if (!result[STORAGE_KEY]) {
      chrome.storage.local.set({ [STORAGE_KEY]: defaultData() });
    }
  });
  chrome.alarms.create(ALARM_TICK, { periodInMinutes: 0.25 }); // every 15 seconds
  scheduleMidnightReset();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_TICK, { periodInMinutes: 0.25 });
  scheduleMidnightReset();
  checkDayRollover();
});

// ---- Active Tab Tracking ----
let activeState = { domain: null, startTime: null, tabId: null };

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
  if (minutes > 0 && minutes < 60) { // sanity check
    addTimeForDomain(activeState.domain, minutes);
  }
  activeState.startTime = Date.now();
}

function addTimeForDomain(domain, minutes) {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const data = result[STORAGE_KEY] || defaultData();
    if (data.sites[domain] && data.sites[domain].enabled) {
      data.sites[domain].timeUsed = (data.sites[domain].timeUsed || 0) + minutes;
      chrome.storage.local.set({ [STORAGE_KEY]: data });
    }
  });
}

// ---- Blocking Logic ----
function checkAndBlock(domain, tabId) {
  if (!domain) return;
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const data = result[STORAGE_KEY] || defaultData();
    const site = data.sites[domain];
    if (!site || !site.enabled) return;
    if ((site.timeUsed || 0) >= site.timeLimit) {
      blockTab(tabId, domain);
    }
  });
}

function blockTab(tabId, domain) {
  const blockedUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(domain)}`);
  chrome.tabs.update(tabId, { url: blockedUrl });
}

// Update declarativeNetRequest rules for strict blocking
function updateBlockRules() {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const data = result[STORAGE_KEY] || defaultData();
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
              extensionPath: `/blocked.html?domain=${encodeURIComponent(domain)}`
            }
          },
          condition: {
            urlFilter: `||${domain}`,
            resourceTypes: ['main_frame']
          }
        });
      }
    }

    // Get existing dynamic rules to remove them first
    chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
      const removeIds = existingRules.map(r => r.id);
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: removeIds,
        addRules: rules
      });
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

function resetDaily() {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const data = result[STORAGE_KEY] || defaultData();

    // Award coins and update streak before reset
    const characterCoins = getCharacterCoins(data.character);
    const allUnderLimit = Object.values(data.sites).every(
      s => !s.enabled || (s.timeUsed || 0) < s.timeLimit
    );

    if (allUnderLimit && Object.keys(data.sites).length > 0) {
      data.coins += characterCoins;
      data.streak += 1;
    }

    // Calculate saved minutes
    for (const site of Object.values(data.sites)) {
      if (site.enabled) {
        const saved = Math.max(0, site.timeLimit - (site.timeUsed || 0));
        data.totalSavedMinutes += saved;
      }
    }

    // Reset time used
    for (const domain in data.sites) {
      data.sites[domain].timeUsed = 0;
    }

    data.lastActiveDay = new Date().toISOString().split('T')[0];
    chrome.storage.local.set({ [STORAGE_KEY]: data });

    // Clear block rules
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rules.map(r => r.id),
        addRules: []
      });
    });
  });
}

function checkDayRollover() {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const data = result[STORAGE_KEY] || defaultData();
    const today = new Date().toISOString().split('T')[0];
    if (data.lastActiveDay && data.lastActiveDay !== today) {
      resetDaily();
    }
  });
}

// ---- Character Coins ----
function getCharacterCoins(character) {
  const map = { eagle: 4, fox: 3, panda: 2, sloth: 1 };
  return map[character] || 3;
}

function getCharacterGoalHours(character) {
  const map = { eagle: 1.5, fox: 3, panda: 4, sloth: 5 };
  return map[character] || 3;
}

// ---- Content Script Communication ----
function sendCountdownToActiveTab() {
  if (!activeState.domain || !activeState.tabId) return;
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const data = result[STORAGE_KEY] || defaultData();
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
    }).catch(() => {}); // tab may not have content script
  });
}

// ---- Message Handler ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getData') {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      sendResponse(result[STORAGE_KEY] || defaultData());
    });
    return true;
  }

  if (msg.action === 'setData') {
    chrome.storage.local.set({ [STORAGE_KEY]: msg.data }, () => {
      updateBlockRules();
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === 'addSite') {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY] || defaultData();
      const domain = msg.domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();
      if (data.sites[domain]) {
        sendResponse({ error: 'Site already exists' });
        return;
      }
      data.sites[domain] = {
        timeLimit: msg.timeLimit,
        timeUsed: 0,
        enabled: true,
        addedAt: Date.now()
      };
      chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (msg.action === 'removeSite') {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY] || defaultData();
      delete data.sites[msg.domain];
      chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
        updateBlockRules();
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (msg.action === 'toggleSite') {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY] || defaultData();
      if (data.sites[msg.domain]) {
        data.sites[msg.domain].enabled = msg.enabled;
        chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
          updateBlockRules();
          sendResponse({ ok: true });
        });
      }
    });
    return true;
  }

  if (msg.action === 'updateTimeLimit') {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY] || defaultData();
      if (data.sites[msg.domain]) {
        data.sites[msg.domain].timeLimit = msg.timeLimit;
        chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
          updateBlockRules();
          sendResponse({ ok: true });
        });
      }
    });
    return true;
  }

  if (msg.action === 'setCharacter') {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY] || defaultData();
      data.character = msg.character;
      chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (msg.action === 'extendTime') {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY] || defaultData();
      if (data.sites[msg.domain]) {
        // Extending costs coins
        const cost = msg.cost || 1;
        if (data.coins >= cost) {
          data.coins -= cost;
          data.sites[msg.domain].timeLimit += msg.extraMinutes;
          chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
            updateBlockRules();
            sendResponse({ ok: true, newCoins: data.coins });
          });
        } else {
          sendResponse({ error: 'Not enough coins' });
        }
      }
    });
    return true;
  }

  if (msg.action === 'getTimeRemaining') {
    const domain = sender.tab ? extractDomain(sender.tab.url) : null;
    if (!domain) { sendResponse({ timeRemaining: null }); return; }
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY] || defaultData();
      const site = data.sites[domain];
      if (site && site.enabled) {
        sendResponse({ timeRemaining: Math.max(0, site.timeLimit - (site.timeUsed || 0)) });
      } else {
        sendResponse({ timeRemaining: null });
      }
    });
    return true;
  }

  if (msg.action === 'closeBlockedApp') {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY] || defaultData();
      // Award coins for closing blocked app
      const characterCoins = getCharacterCoins(data.character);
      data.coins += Math.ceil(characterCoins / 2); // half coins for mid-day close
      chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
        sendResponse({ ok: true, coins: data.coins });
      });
    });
    return true;
  }
});

// ---- Helpers ----
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
