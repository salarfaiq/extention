// ============================================================
// Screen Time Buddy — Firebase Configuration
// ============================================================
// NOTE: Chrome extensions cannot use Firebase JS SDK with ES modules directly.
// This file provides the configuration and a stub for future REST API / CDN integration.
// For now, all data lives in chrome.storage.local via storage.js.
// When ready to connect, use Firestore REST API or load Firebase via CDN in a background page.

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCTAG56B4l51sd2AuYODvYrBnxFk2nrq6E',
  authDomain: 'power-mates.firebaseapp.com',
  projectId: 'power-mates',
  storageBucket: 'power-mates.appspot.com',
  messagingSenderId: '522222757805',
  appId: '1:522222757805:ios:e0278cf9da75370ecba324',
  databaseURL: 'https://power-mates-default-rtdb.firebaseio.com'
};

// Firestore REST API base URL
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

// Firestore document paths for sync
const FIRESTORE_PATHS = {
  userDoc: (uid) => `users/${uid}`,
  extensionTasks: (uid) => `users/${uid}/extension_tasks`,
  extensionSites: (uid) => `users/${uid}/extension_sites`,
  coinsRewards: (uid) => `users/${uid}` // field: coins_rewards
};

if (typeof globalThis !== 'undefined') {
  globalThis.FIREBASE_CONFIG = FIREBASE_CONFIG;
  globalThis.FIRESTORE_BASE = FIRESTORE_BASE;
  globalThis.FIRESTORE_PATHS = FIRESTORE_PATHS;
}
