/* ═══════════════════════════════════════
   DATA STORE & STATE MANAGEMENT
═══════════════════════════════════════ */

const Store = {
  data: {
    profile: {
      age: 28,
      gender: 'male',
      height_cm: 170,
      weight_kg: 70,
      activity: 'sedentary',
      target_weight_kg: 65,
      target_weeks: 12
    },
    foodLog: {},     // Format: { "YYYY-MM-DD": [{id, food_name, calories}] }
    weightLog: {},   // Format: { "YYYY-MM-DD": {weight_kg, body_fat_pct} }
    training: []     // Format: Array of session objects
  },

  // ─── Initialization ─────────────────────────────────────────

  async init() {
    // 1. Load local data first for instant UI rendering
    const saved = localStorage.getItem('fitTrack_data');
    if (saved) {
      this.data = JSON.parse(saved);
    }
    
    this.refreshCalculations();

    // 2. Attempt to sync with Cloud in the background
    const email = localStorage.getItem('fitTrack_email');
    if (email) {
      this.syncFromCloud();
    }
  },

  saveLocal() {
    this.refreshCalculations();
    localStorage.setItem('fitTrack_data', JSON.stringify(this.data));
    // Dispatch an event so the UI knows to update
    window.dispatchEvent(new Event('storeUpdated'));
  },

  async syncFromCloud() {
    try {
      const response = await Sync.loadAll();
      if (response.data) {
        // Merge cloud data into local state
        if (response.data.profile) this.data.profile = response.data.profile;
        if (response.data.foodLog) this.data.foodLog = response.data.foodLog;
        if (response.data.weightLog) this.data.weightLog = response.data.weightLog;
        if (response.data.training) this.data.training = response.data.training;
        this.saveLocal();
      }
    } catch (err) {
      console.warn('Cloud sync failed, relying on local data.', err);
    }
  },

  // ─── Core Calculations ──────────────────────────────────────

  refreshCalculations() {
    const p = this.data.profile;
    if (!p.weight_kg || !p.height_cm || !p.age) return;

    // Mifflin-St Jeor
    let bmr = (10 * p.weight_kg) + (6.25 * p.height_cm) - (5 * p.age);
    bmr = (p.gender === 'male') ? bmr + 5 : bmr - 161;
    
    // Multipliers
    const multipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725
    };
    
    p.tdee = Math.round(bmr * (multipliers[p.activity] || 1.2));
    
    // Deficit calculation (approx 7700 kcal per kg of fat)
    if (p.target_weight_kg && p.target_weeks) {
      const weightDiff = p.weight_kg - p.target_weight_kg;
      const weeklyDeficit = (weightDiff * 7700) / p.target_weeks;
      const dailyDeficit = weeklyDeficit / 7;
      p.daily_calorie_target = Math.round(p.tdee - dailyDeficit);
    } else {
      p.daily_calorie_target = p.tdee;
    }
  },

  // ─── Data Mutations (Add/Delete) ────────────────────────────

  async updateProfile(newProfile) {
    this.data.profile = { ...this.data.profile, ...newProfile };
    this.saveLocal();
    try { await Sync.saveProfile(this.data.profile); } catch(e) {}
  },

  async addFood(date, name, calories) {
    if (!this.data.foodLog[date]) this.data.foodLog[date] = [];
    
    // Optimistic UI update
    const tempId = 'temp_' + Date.now();
    this.data.foodLog[date].push({ id: tempId, food_name: name, calories: Number(calories) });
    this.saveLocal();

    try {
      const res = await Sync.saveFood(date, name, calories);
      // Replace temp ID with real ID from server
      const entry = this.data.foodLog[date].find(f => f.id === tempId);
      if (entry) entry.id = res.id;
      this.saveLocal();
    } catch (e) {
      console.error('Failed to save food to cloud', e);
    }
  },

  async addWeight(date, weight, bodyFat) {
    this.data.weightLog[date] = { weight_kg: Number(weight), body_fat_pct: Number(bodyFat) };
    this.data.profile.weight_kg = Number(weight); // Update current weight
    this.saveLocal();
    try { await Sync.saveWeight(date, weight, bodyFat); } catch(e) {}
  },

  async addTrainingSession(sessionData) {
    // Generate a temporary ID for instant UI rendering
    const tempId = 'temp_sess_' + Date.now();
    const newSession = { id: tempId, ...sessionData };
    this.data.training.unshift(newSession);
    this.saveLocal();

    try {
      const res = await Sync.saveSession(sessionData);
      const sess = this.data.training.find(s => s.id === tempId);
      if (sess) sess.id = res.id;
      this.saveLocal();
    } catch (e) {
      console.error('Failed to save session to cloud', e);
    }
  }
};
