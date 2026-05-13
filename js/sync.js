/* ═══════════════════════════════════════
   API & SYNC LAYER
═══════════════════════════════════════ */

const Sync = {
  // Centralized fetch function
  async request(action, payload = {}) {
    // We will set this email in localStorage when the user logs in
    const email = localStorage.getItem('fitTrack_email');
    
    if (!email) {
      console.warn('Sync aborted: No email found.');
      throw new Error('Unauthorised: Please log in.');
    }

    const data = { action, email, ...payload };

    try {
      const response = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (result.status !== 'ok') {
        throw new Error(result.message || 'Unknown server error');
      }
      
      return result;
    } catch (error) {
      console.error(`[Sync Error] Action: ${action}`, error);
      throw error;
    }
  },

  // ─── Endpoints ──────────────────────────────────────────────

  async loadAll() {
    return this.request('load_all');
  },

  async saveProfile(profileData) {
    return this.request('save_profile', profileData);
  },

  async saveFood(date, foodName, calories) {
    return this.request('save_food', { date, food_name: foodName, calories });
  },

  async deleteFood(id) {
    return this.request('delete_food', { id });
  },

  async saveWeight(date, weightKg, bodyFatPct) {
    return this.request('save_weight', { date, weight_kg: weightKg, body_fat_pct: bodyFatPct });
  },

  async saveSession(sessionData) {
    return this.request('save_session', sessionData);
  },

  async deleteSession(id) {
    return this.request('delete_session', { id });
  }
};
