// ============================================================
// Screen Time Buddy — Firebase Sync Service (Stub)
// ============================================================
// TODO: Connect to Firestore when Firebase auth is integrated.
// Architecture is ready — just implement the fetch calls.

const STBSync = {
  /**
   * Push local data to Firestore.
   * Firestore paths:
   *   users/{uid} → { coins_rewards, streak_reward, character }
   *   users/{uid}/extension_tasks → task documents
   *   users/{uid}/extension_sites → site limit documents
   */
  async syncToCloud(data) {
    if (!data.user || !data.user.uid) {
      console.log('[STB Sync] No user UID — skipping cloud sync');
      return { synced: false, reason: 'no_uid' };
    }

    const uid = data.user.uid;
    console.log(`[STB Sync] TODO: Push to Firestore for user ${uid}`);

    // TODO: Implement Firestore REST API calls
    // Example structure:
    //
    // const userDocUrl = `${FIRESTORE_BASE}/users/${uid}`;
    // await fetch(userDocUrl, {
    //   method: 'PATCH',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${idToken}`
    //   },
    //   body: JSON.stringify({
    //     fields: {
    //       coins_rewards: { integerValue: data.coins },
    //       streak_reward: { integerValue: data.streak },
    //       character: { stringValue: data.character }
    //     }
    //   })
    // });

    return { synced: false, reason: 'not_implemented' };
  },

  /**
   * Pull data from Firestore for a given user.
   */
  async syncFromCloud(uid) {
    if (!uid) {
      console.log('[STB Sync] No UID — skipping cloud pull');
      return null;
    }

    console.log(`[STB Sync] TODO: Pull from Firestore for user ${uid}`);

    // TODO: Implement Firestore REST API fetch
    // const userDocUrl = `${FIRESTORE_BASE}/users/${uid}`;
    // const res = await fetch(userDocUrl, { headers: { 'Authorization': `Bearer ${idToken}` } });
    // const doc = await res.json();
    // return parseFirestoreDoc(doc);

    return null;
  },

  /**
   * Sync tasks to Firestore subcollection.
   */
  async syncTasks(uid, tasks) {
    if (!uid) return { synced: false };
    console.log(`[STB Sync] TODO: Sync ${tasks.length} tasks for user ${uid}`);
    return { synced: false, reason: 'not_implemented' };
  },

  /**
   * Sync site limits to Firestore subcollection.
   */
  async syncSites(uid, sites) {
    if (!uid) return { synced: false };
    console.log(`[STB Sync] TODO: Sync ${Object.keys(sites).length} sites for user ${uid}`);
    return { synced: false, reason: 'not_implemented' };
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.STBSync = STBSync;
}
