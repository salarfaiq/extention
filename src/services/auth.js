// ============================================================
// Screen Time Buddy — Firebase Auth Service
// Uses Firebase Auth REST API (Identity Toolkit)
// ============================================================

const AUTH_API = 'https://identitytoolkit.googleapis.com/v1';
const AUTH_API_KEY = 'AIzaSyCTAG56B4l51sd2AuYODvYrBnxFk2nrq6E';

const STBAuth = {

  // ---- Email/Password Sign-In ----
  async signInWithEmail(email, password) {
    const res = await fetch(
      `${AUTH_API}/accounts:signInWithPassword?key=${AUTH_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    );
    const data = await res.json();
    if (data.error) {
      return { error: mapAuthError(data.error.message) };
    }
    return {
      ok: true,
      uid: data.localId,
      email: data.email,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: parseInt(data.expiresIn)
    };
  },

  // ---- Email/Password Sign-Up ----
  async signUpWithEmail(email, password) {
    const res = await fetch(
      `${AUTH_API}/accounts:signUp?key=${AUTH_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    );
    const data = await res.json();
    if (data.error) {
      return { error: mapAuthError(data.error.message) };
    }
    return {
      ok: true,
      uid: data.localId,
      email: data.email,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: parseInt(data.expiresIn)
    };
  },

  // ---- Google Sign-In via Chrome Identity API ----
  async signInWithGoogle() {
    return new Promise((resolve) => {
      // Chrome identity API launches OAuth flow
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError || !token) {
          resolve({ error: chrome.runtime.lastError?.message || 'Google sign-in cancelled' });
          return;
        }

        // Exchange Google access token for Firebase credential
        const res = await fetch(
          `${AUTH_API}/accounts:signInWithIdp?key=${AUTH_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postBody: `access_token=${token}&providerId=google.com`,
              requestUri: chrome.identity.getRedirectURL(),
              returnSecureToken: true
            })
          }
        );
        const data = await res.json();
        if (data.error) {
          resolve({ error: mapAuthError(data.error.message) });
          return;
        }

        resolve({
          ok: true,
          uid: data.localId,
          email: data.email,
          displayName: data.displayName || '',
          photoUrl: data.photoUrl || '',
          idToken: data.idToken,
          refreshToken: data.refreshToken,
          expiresIn: parseInt(data.expiresIn)
        });
      });
    });
  },

  // ---- Refresh ID Token ----
  async refreshToken(refreshToken) {
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${AUTH_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      }
    );
    const data = await res.json();
    if (data.error) {
      return { error: data.error.message };
    }
    return {
      ok: true,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: parseInt(data.expires_in)
    };
  },

  // ---- Password Reset ----
  async sendPasswordReset(email) {
    const res = await fetch(
      `${AUTH_API}/accounts:sendOobCode?key=${AUTH_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email })
      }
    );
    const data = await res.json();
    if (data.error) {
      return { error: mapAuthError(data.error.message) };
    }
    return { ok: true };
  },

  // ---- Get User Profile from Firestore ----
  async getUserProfile(uid, idToken) {
    const url = `https://firestore.googleapis.com/v1/projects/power-mates/databases/(default)/documents/users/${uid}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (!res.ok) return null;
    const doc = await res.json();
    if (!doc.fields) return null;

    return {
      uid,
      email: doc.fields.email?.stringValue || '',
      fullname: doc.fields.fullname?.stringValue || '',
      username: doc.fields.username?.stringValue || '',
      imageUrl: doc.fields.imageUrl?.stringValue || '',
      coins: parseInt(doc.fields.coins_rewards?.integerValue || '0'),
      streak: parseInt(doc.fields.streak_reward?.integerValue || '0'),
      totalCoins: parseInt(doc.fields.total_coins_earned?.integerValue || '0')
    };
  },

  // ---- Save auth session to storage ----
  async saveSession(authResult) {
    const session = {
      uid: authResult.uid,
      email: authResult.email,
      displayName: authResult.displayName || '',
      idToken: authResult.idToken,
      refreshToken: authResult.refreshToken,
      expiresAt: Date.now() + (authResult.expiresIn * 1000)
    };
    await chrome.storage.local.set({ stb_auth: session });
    return session;
  },

  // ---- Get current session (auto-refresh if expired) ----
  async getSession() {
    const result = await chrome.storage.local.get('stb_auth');
    const session = result.stb_auth;
    if (!session || !session.refreshToken) return null;

    // Refresh if token expires in less than 5 minutes
    if (session.expiresAt < Date.now() + 300000) {
      const refreshed = await STBAuth.refreshToken(session.refreshToken);
      if (refreshed.error) {
        await STBAuth.clearSession();
        return null;
      }
      session.idToken = refreshed.idToken;
      session.refreshToken = refreshed.refreshToken;
      session.expiresAt = Date.now() + (refreshed.expiresIn * 1000);
      await chrome.storage.local.set({ stb_auth: session });
    }

    return session;
  },

  // ---- Sign Out ----
  async signOut() {
    // Revoke Google token if exists
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token });
      }
    });
    await STBAuth.clearSession();
  },

  async clearSession() {
    await chrome.storage.local.remove('stb_auth');
  }
};

function mapAuthError(code) {
  const map = {
    'EMAIL_NOT_FOUND': 'No account found with this email',
    'INVALID_PASSWORD': 'Incorrect password',
    'INVALID_LOGIN_CREDENTIALS': 'Incorrect email or password',
    'USER_DISABLED': 'This account has been disabled',
    'EMAIL_EXISTS': 'An account with this email already exists',
    'WEAK_PASSWORD': 'Password must be at least 6 characters',
    'TOO_MANY_ATTEMPTS_TRY_LATER': 'Too many attempts. Try again later',
    'INVALID_EMAIL': 'Invalid email address'
  };
  return map[code] || code.replace(/_/g, ' ').toLowerCase();
}

if (typeof globalThis !== 'undefined') {
  globalThis.STBAuth = STBAuth;
}
