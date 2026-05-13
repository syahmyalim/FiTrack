// ============================================================
//  FitTrack — store.js
//  Single source of truth. Handles State, localStorage,
//  and all data-mutation helpers.
//  No network calls here — that's sync.js's job.
// ============================================================

// ── Default / empty State shape ──────────────────────────────
const DEFAULT_STATE = {
  user: { email: "", name: "" },

  // keyed by "YYYY-MM-DD"
  foodLog: {},    // { "2025-05-13": [{id, food_name, calories, logged_at, _synced}] }
  weightLog: {},  // { "2025-05-13": {weight_kg, body_fat_pct, logged_at, _synced} }

  // array of sessions (each may have an exercises array)
  training: [],
  /*  [{
        id, date, sport, duration_min, distance, distance_unit,
        laps, calories, notes,
        exercises: [{ name, sets: [{kg, reps}] }],
        _synced
      }]  */

  profile: {
    age: "",
    gender: "",
    height_cm: "",
    weight_kg: "",
    activity: "",
    body_fat_pct: "",
    target_weight_kg: "",
    target_weeks: "",
  },

  exerciseLib: [], // list of exercise name strings, persisted locally

  // UI transient state — saved so the user lands back where they left off
  ui: {
    wBarOff: 0,       // weight bar chart offset (weeks back)
    stampOff: 0,      // stamp calendar offset (months back)
    hStatOff: 0,      // home stats offset
    logDate: "",      // active food-log date  (YYYY-MM-DD)
    sessDate: "",     // active session date   (YYYY-MM-DD)
    sport: "gym",     // active sport tab
    gymCards: [],     // open exercise card indices
    histFilter: "all" // training history filter
  }
};

// ── Live State object (populated from localStorage on init) ──
let State = {};

// ── localStorage key ─────────────────────────────────────────
const STORE_KEY = "fittrack_state";

// ============================================================
//  Core persistence helpers
// ============================================================

/** Load State from localStorage (or start fresh). */
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Deep-merge with DEFAULT_STATE so new keys added later still appear
      State = deepMerge(DEFAULT_STATE, parsed);
    } else {
      State = deepClone(DEFAULT_STATE);
    }
  } catch (err) {
    console.warn("FitTrack: could not parse saved state, starting fresh.", err);
    State = deepClone(DEFAULT_STATE);
  }

  // Always make sure today is set as the default log date if not already set
  const today = todayStr();
  if (!State.ui.logDate)  State.ui.logDate  = today;
  if (!State.ui.sessDate) State.ui.sessDate = today;

  console.log("FitTrack: State loaded ✓");
}

/** Persist the entire State to localStorage. */
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(State));
  } catch (err) {
    console.error("FitTrack: failed to save state.", err);
  }
}

/** Wipe localStorage and reset to defaults (used on sign-out). */
function clearState() {
  localStorage.removeItem(STORE_KEY);
  State = deepClone(DEFAULT_STATE);
}

// ============================================================
//  Food Log helpers
// ============================================================

/**
 * Add a food entry for a given date.
 * @param {string} date       "YYYY-MM-DD"
 * @param {string} food_name
 * @param {number} calories
 * @returns {object} the new entry
 */
function addFoodEntry(date, food_name, calories) {
  if (!State.foodLog[date]) State.foodLog[date] = [];

  const entry = {
    id: genId(),
    food_name: food_name.trim(),
    calories: Number(calories),
    logged_at: new Date().toISOString(),
    _synced: false
  };

  State.foodLog[date].push(entry);
  saveState();
  return entry;
}

/**
 * Delete a food entry by id (searches all dates).
 * @param {string} id
 * @returns {boolean} true if found and removed
 */
function deleteFoodEntry(id) {
  for (const date of Object.keys(State.foodLog)) {
    const idx = State.foodLog[date].findIndex(e => e.id === id);
    if (idx !== -1) {
      State.foodLog[date].splice(idx, 1);
      saveState();
      return true;
    }
  }
  return false;
}

/**
 * Return total calories logged on a given date.
 * @param {string} date "YYYY-MM-DD"
 */
function caloriesOnDate(date) {
  const entries = State.foodLog[date] || [];
  return entries.reduce((sum, e) => sum + (e.calories || 0), 0);
}

// ============================================================
//  Weight Log helpers
// ============================================================

/**
 * Save (upsert) a weight entry for a date.
 * @param {string} date        "YYYY-MM-DD"
 * @param {number} weight_kg
 * @param {number|string} body_fat_pct  (optional, pass "" to skip)
 * @returns {object} the saved entry
 */
function saveWeightEntry(date, weight_kg, body_fat_pct = "") {
  const entry = {
    weight_kg: Number(weight_kg),
    body_fat_pct: body_fat_pct !== "" ? Number(body_fat_pct) : "",
    logged_at: new Date().toISOString(),
    _synced: false
  };

  State.weightLog[date] = entry;
  saveState();
  return entry;
}

/**
 * Return the most recent weight entry (any date).
 * @returns {object|null}
 */
function latestWeightEntry() {
  const dates = Object.keys(State.weightLog).sort();
  if (!dates.length) return null;
  return { date: dates[dates.length - 1], ...State.weightLog[dates[dates.length - 1]] };
}

// ============================================================
//  Training Log helpers
// ============================================================

/**
 * Add a new training session.
 * @param {object} session  — partial object; id and _synced are set here
 * @returns {object} the full session
 */
function addSession(session) {
  const full = {
    id: genId(),
    date: session.date || State.ui.sessDate || todayStr(),
    sport: session.sport || "gym",
    duration_min: session.duration_min || "",
    distance: session.distance || "",
    distance_unit: session.distance_unit || "km",
    laps: session.laps || "",
    calories: session.calories || "",
    notes: session.notes || "",
    exercises: session.exercises || [],   // [{name, sets:[{kg,reps}]}]
    _synced: false
  };

  State.training.push(full);
  saveState();
  return full;
}

/**
 * Delete a training session by id.
 * @param {string} id
 * @returns {boolean}
 */
function deleteSession(id) {
  const idx = State.training.findIndex(s => s.id === id);
  if (idx === -1) return false;
  State.training.splice(idx, 1);
  saveState();
  return true;
}

/**
 * Update a training session (pass only changed fields).
 * @param {string} id
 * @param {object} updates
 */
function updateSession(id, updates) {
  const session = State.training.find(s => s.id === id);
  if (!session) return false;
  Object.assign(session, updates, { _synced: false });
  saveState();
  return session;
}

/**
 * Return sessions for a given date (sorted earliest first).
 * @param {string} date "YYYY-MM-DD"
 */
function sessionsOnDate(date) {
  return State.training
    .filter(s => s.date === date)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Return sessions in a date range [fromDate, toDate] inclusive.
 * @param {string} fromDate "YYYY-MM-DD"
 * @param {string} toDate   "YYYY-MM-DD"
 */
function sessionsInRange(fromDate, toDate) {
  return State.training.filter(s => s.date >= fromDate && s.date <= toDate);
}

// ============================================================
//  Profile helpers
// ============================================================

/**
 * Save (merge) profile fields.
 * @param {object} fields  — any subset of the profile keys
 */
function saveProfile(fields) {
  Object.assign(State.profile, fields);
  State.profile._synced = false;
  saveState();
}

// ============================================================
//  Exercise Library helpers
// ============================================================

/**
 * Add an exercise name to the local library (no duplicates, case-insensitive).
 * @param {string} name
 */
function addExercise(name) {
  const trimmed = name.trim();
  const exists = State.exerciseLib.some(
    e => e.toLowerCase() === trimmed.toLowerCase()
  );
  if (!exists) {
    State.exerciseLib.push(trimmed);
    State.exerciseLib.sort((a, b) => a.localeCompare(b));
    saveState();
  }
}

// ============================================================
//  UI state helpers
// ============================================================

/**
 * Update one or more ui fields.
 * @param {object} fields
 */
function setUI(fields) {
  Object.assign(State.ui, fields);
  saveState();
}

// ============================================================
//  Sync flag helpers  (used by sync.js after push succeeds)
// ============================================================

/** Mark a food entry as synced. */
function markFoodSynced(date, id) {
  const entries = State.foodLog[date] || [];
  const entry = entries.find(e => e.id === id);
  if (entry) { entry._synced = true; saveState(); }
}

/** Mark a weight entry as synced. */
function markWeightSynced(date) {
  if (State.weightLog[date]) {
    State.weightLog[date]._synced = true;
    saveState();
  }
}

/** Mark a training session as synced. */
function markSessionSynced(id) {
  const session = State.training.find(s => s.id === id);
  if (session) { session._synced = true; saveState(); }
}

/** Mark profile as synced. */
function markProfileSynced() {
  State.profile._synced = true;
  saveState();
}

// ============================================================
//  Replace entire State after a full load_all from the server
//  (called by sync.js after a successful cloud sync)
// ============================================================

/**
 * Merge server data into local State.
 * Server data wins for _synced records; local unsynced records are kept.
 * @param {object} serverData  { profile, foodLog, weightLog, training }
 */
function mergeServerData(serverData) {
  // Profile — server wins
  if (serverData.profile) {
    State.profile = { ...serverData.profile, _synced: true };
  }

  // Weight log — server wins per date, keep local unsync'd dates
  if (serverData.weightLog) {
    for (const [date, entry] of Object.entries(serverData.weightLog)) {
      // Only overwrite if local entry is already synced (or missing)
      if (!State.weightLog[date] || State.weightLog[date]._synced) {
        State.weightLog[date] = { ...entry, _synced: true };
      }
    }
  }

  // Food log — merge by id within each date
  if (serverData.foodLog) {
    for (const [date, serverEntries] of Object.entries(serverData.foodLog)) {
      if (!State.foodLog[date]) State.foodLog[date] = [];
      const localIds = new Set(State.foodLog[date].map(e => e.id));
      for (const se of serverEntries) {
        if (!localIds.has(se.id)) {
          State.foodLog[date].push({ ...se, _synced: true });
        }
      }
    }
  }

  // Training — merge by id
  if (serverData.training) {
    const localIds = new Set(State.training.map(s => s.id));
    for (const ss of serverData.training) {
      if (!localIds.has(ss.id)) {
        State.training.push({ ...ss, _synced: true });
      }
    }
  }

  saveState();
}

// ============================================================
//  Computed / derived helpers  (used by ui.js)
// ============================================================

/**
 * Get an ISO week number for a date string.
 * @param {string} dateStr "YYYY-MM-DD"
 * @returns {number}
 */
function isoWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Return "YYYY-MM-DD" for today.
 */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Return "YYYY-MM-DD" for N days ago (negative = future).
 * @param {number} n
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Return last 7 dates ending today (oldest first).
 */
function last7Days() {
  return Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
}

/**
 * Calculate BMR using Mifflin-St Jeor equation.
 * @param {object} profile
 * @returns {number|null}
 */
function calcBMR(profile) {
  const { weight_kg, height_cm, age, gender } = profile;
  if (!weight_kg || !height_cm || !age || !gender) return null;
  const base = 10 * Number(weight_kg) + 6.25 * Number(height_cm) - 5 * Number(age);
  return gender === "male" ? base + 5 : base - 161;
}

/** Activity multipliers for TDEE. */
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
};

/**
 * Calculate TDEE.
 * @param {object} profile
 * @returns {number|null}
 */
function calcTDEE(profile) {
  const bmr = calcBMR(profile);
  if (!bmr) return null;
  const mult = ACTIVITY_MULTIPLIERS[profile.activity] || 1.2;
  return Math.round(bmr * mult);
}

/**
 * Calculate BMI.
 * @param {object} profile
 * @returns {number|null}
 */
function calcBMI(profile) {
  const { weight_kg, height_cm } = profile;
  if (!weight_kg || !height_cm) return null;
  return (Number(weight_kg) / Math.pow(Number(height_cm) / 100, 2)).toFixed(1);
}

// ============================================================
//  Private utilities
// ============================================================

/** Generate a short unique ID (timestamp + random). */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Deep clone a plain object. */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Recursively merge src into dst (dst wins on primitives, recurse on objects).
 * Arrays from src REPLACE arrays in dst.
 */
function deepMerge(dst, src) {
  const out = { ...dst };
  for (const key of Object.keys(src)) {
    if (
      src[key] !== null &&
      typeof src[key] === "object" &&
      !Array.isArray(src[key]) &&
      typeof dst[key] === "object" &&
      !Array.isArray(dst[key])
    ) {
      out[key] = deepMerge(dst[key] || {}, src[key]);
    } else {
      out[key] = src[key];
    }
  }
  return out;
}
