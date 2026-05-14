// ============================================================
//  store.js — FitTrack State & Local Storage
//  Handles all data in memory and saves/loads from localStorage
//  Other files read/write State via the helpers below.
// ============================================================

// ----------------------------------------------------------
//  1. DEFAULT / BLANK STATE
//  This is what State looks like for a brand-new user.
// ----------------------------------------------------------
const DEFAULT_STATE = {
  user: {
    email: null,
    name: null
  },
  profile: {
    age: null,
    gender: null,
    height_cm: null,
    weight_kg: null,
    activity: null,         // "sedentary" | "light" | "moderate" | "active" | "very_active"
    body_fat_pct: null,
    target_weight_kg: null,
    target_weeks: null
  },
  foodLog: {},              // { "YYYY-MM-DD": [{id, food_name, calories, logged_at, _synced}] }
  weightLog: {},            // { "YYYY-MM-DD": {weight_kg, body_fat_pct, logged_at, _synced} }
  training: [],             // [{id, date, sport, duration_min, distance, distance_unit,
                            //   laps, calories, notes,
                            //   exercises:[{name, sets:[{kg,reps}]}], _synced}]
  exerciseLib: [],          // ["Squat","Bench Press",...] saved locally for autocomplete
  ui: {
    logDate: null,          // date string currently shown in food-log tab ("YYYY-MM-DD")
    sessDate: null,         // date string currently shown in training tab
    sport: null,            // sport type selected in training form
    gymCards: [],           // gym exercise cards open in session form
    histFilter: "all",      // session history filter
    wBarOff: 0,             // weekly calorie bar chart offset
    stampOff: 0,            // training stamp calendar offset
    hStatOff: 0             // home stats week offset
  }
};

// ----------------------------------------------------------
//  2. LIVE STATE OBJECT
//  This is what every other file uses. Never replace it —
//  always mutate its properties instead.
// ----------------------------------------------------------
let State = JSON.parse(JSON.stringify(DEFAULT_STATE));   // deep clone


// ----------------------------------------------------------
//  3. LOCAL STORAGE HELPERS
// ----------------------------------------------------------

/**
 * Key used in localStorage.
 * Each Google account gets its own key so 2 users on
 * the same device don't overwrite each other.
 */
function _storageKey() {
  const email = State.user?.email || "guest";
  return "fittrack_" + email;
}

/**
 * saveLocal()
 * Writes the whole State to localStorage as JSON.
 * Call this after any change you want to survive a page refresh.
 */
function saveLocal() {
  try {
    const key = _storageKey();
    localStorage.setItem(key, JSON.stringify(State));
    console.log("[Store] Saved to localStorage:", key);
  } catch (err) {
    console.error("[Store] Could not save to localStorage:", err);
  }
}

/**
 * loadLocal()
 * Reads saved State for the current user from localStorage.
 * Returns true if data was found, false if starting fresh.
 */
function loadLocal() {
  try {
    const key = _storageKey();
    const raw = localStorage.getItem(key);
    if (!raw) {
      console.log("[Store] No local data found for", key);
      return false;
    }
    const saved = JSON.parse(raw);

    // Merge saved data into State (keeps any new keys from DEFAULT_STATE)
    _deepMerge(State, saved);
    console.log("[Store] Loaded from localStorage:", key);
    return true;
  } catch (err) {
    console.error("[Store] Could not load from localStorage:", err);
    return false;
  }
}

/**
 * clearLocal()
 * Wipes localStorage for the current user. Used on sign-out.
 */
function clearLocal() {
  try {
    const key = _storageKey();
    localStorage.removeItem(key);
    console.log("[Store] Cleared localStorage:", key);
  } catch (err) {
    console.error("[Store] Could not clear localStorage:", err);
  }
}

/**
 * resetState()
 * Resets in-memory State to blank defaults (does NOT touch localStorage).
 * Used when signing out so stale data isn't shown.
 */
function resetState() {
  const blank = JSON.parse(JSON.stringify(DEFAULT_STATE));
  _deepMerge(State, blank, /*overwriteAll=*/ true);
  console.log("[Store] State reset to defaults.");
}


// ----------------------------------------------------------
//  4. FOOD LOG HELPERS
// ----------------------------------------------------------

/**
 * getFoodLog(date)  →  array of food entries for that date
 * date: "YYYY-MM-DD" string.  Returns [] if nothing logged.
 */
function getFoodLog(date) {
  return State.foodLog[date] || [];
}

/**
 * addFoodEntry(date, entry)
 * entry = { id, food_name, calories }
 * Adds a _synced:false flag and a logged_at timestamp.
 */
function addFoodEntry(date, entry) {
  if (!State.foodLog[date]) State.foodLog[date] = [];
  const item = {
    id: entry.id || _makeId(),
    food_name: entry.food_name,
    calories: Number(entry.calories),
    logged_at: entry.logged_at || new Date().toISOString(),
    _synced: false
  };
  State.foodLog[date].push(item);
  saveLocal();
  return item;
}

/**
 * deleteFoodEntry(date, id)
 * Removes one food entry by id. Returns true if found.
 */
function deleteFoodEntry(date, id) {
  if (!State.foodLog[date]) return false;
  const before = State.foodLog[date].length;
  State.foodLog[date] = State.foodLog[date].filter(e => e.id !== id);
  const removed = State.foodLog[date].length < before;
  if (removed) saveLocal();
  return removed;
}

/**
 * totalCalories(date)  →  number
 * Sum of all calories logged on a given date.
 */
function totalCalories(date) {
  return getFoodLog(date).reduce((sum, e) => sum + (Number(e.calories) || 0), 0);
}


// ----------------------------------------------------------
//  5. WEIGHT LOG HELPERS
// ----------------------------------------------------------

/**
 * getWeightEntry(date)  →  object or null
 */
function getWeightEntry(date) {
  return State.weightLog[date] || null;
}

/**
 * setWeightEntry(date, weight_kg, body_fat_pct)
 * One entry per day — overwrites if date already exists.
 */
function setWeightEntry(date, weight_kg, body_fat_pct) {
  State.weightLog[date] = {
    weight_kg: weight_kg !== undefined ? Number(weight_kg) : null,
    body_fat_pct: body_fat_pct !== undefined ? Number(body_fat_pct) : null,
    logged_at: new Date().toISOString(),
    _synced: false
  };
  saveLocal();
  return State.weightLog[date];
}

/**
 * latestWeight()  →  { date, weight_kg, body_fat_pct } or null
 * Finds the most recent weight entry across all dates.
 */
function latestWeight() {
  const dates = Object.keys(State.weightLog).sort().reverse();
  if (!dates.length) return null;
  const date = dates[0];
  return { date, ...State.weightLog[date] };
}


// ----------------------------------------------------------
//  6. TRAINING LOG HELPERS
// ----------------------------------------------------------

/**
 * getSessions(filter)
 * filter = "all" | sport name (e.g. "run", "gym")
 * Returns sessions sorted newest-first.
 */
function getSessions(filter) {
  let sessions = [...State.training].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );
  if (filter && filter !== "all") {
    sessions = sessions.filter(s => s.sport === filter);
  }
  return sessions;
}

/**
 * getSession(id)  →  session object or null
 */
function getSession(id) {
  return State.training.find(s => s.id === id) || null;
}

/**
 * addSession(session)
 * session = { date, sport, duration_min, distance, distance_unit,
 *             laps, calories, notes, exercises }
 * Returns the saved session with id and _synced:false added.
 */
function addSession(session) {
  const item = {
    id: session.id || _makeId(),
    date: session.date,
    sport: session.sport,
    duration_min: Number(session.duration_min) || 0,
    distance: session.distance ? Number(session.distance) : null,
    distance_unit: session.distance_unit || null,
    laps: session.laps ? Number(session.laps) : null,
    calories: session.calories ? Number(session.calories) : null,
    notes: session.notes || "",
    exercises: session.exercises || [],
    logged_at: new Date().toISOString(),
    _synced: false
  };
  State.training.push(item);

  // Learn exercise names for autocomplete
  if (item.exercises && item.exercises.length) {
    item.exercises.forEach(ex => {
      if (ex.name && !State.exerciseLib.includes(ex.name)) {
        State.exerciseLib.push(ex.name);
      }
    });
  }

  saveLocal();
  return item;
}

/**
 * deleteSession(id)
 * Removes a session by id. Returns true if found.
 */
function deleteSession(id) {
  const before = State.training.length;
  State.training = State.training.filter(s => s.id !== id);
  const removed = State.training.length < before;
  if (removed) saveLocal();
  return removed;
}

/**
 * weekSessions(dateStr)
 * Returns all sessions in the same Mon–Sun week as dateStr.
 */
function weekSessions(dateStr) {
  const { start, end } = _weekRange(dateStr);
  return State.training.filter(s => s.date >= start && s.date <= end);
}


// ----------------------------------------------------------
//  7. PROFILE HELPERS
// ----------------------------------------------------------

/**
 * saveProfile(fields)
 * Merges updated fields into State.profile.
 * Also updates State.profile._synced = false.
 */
function saveProfile(fields) {
  Object.assign(State.profile, fields);
  State.profile._synced = false;
  saveLocal();
}

/**
 * calcBMR()  →  number (kcal/day) using Mifflin-St Jeor
 * Returns null if profile is incomplete.
 */
function calcBMR() {
  const { age, gender, height_cm, weight_kg } = State.profile;
  if (!age || !gender || !height_cm || !weight_kg) return null;
  const h = Number(height_cm), w = Number(weight_kg), a = Number(age);
  if (gender === "male") return Math.round(10 * w + 6.25 * h - 5 * a + 5);
  return Math.round(10 * w + 6.25 * h - 5 * a - 161);
}

/**
 * calcTDEE()  →  number (kcal/day)
 * BMR × activity multiplier.  Returns null if incomplete.
 */
function calcTDEE() {
  const bmr = calcBMR();
  if (!bmr) return null;
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };
  const factor = multipliers[State.profile.activity] || 1.2;
  return Math.round(bmr * factor);
}

/**
 * calcBMI()  →  number rounded to 1 decimal, or null
 */
function calcBMI() {
  const { height_cm, weight_kg } = State.profile;
  if (!height_cm || !weight_kg) return null;
  const h = Number(height_cm) / 100;
  return Math.round((Number(weight_kg) / (h * h)) * 10) / 10;
}


// ----------------------------------------------------------
//  8. UNSYNCED DATA QUERY
//  sync.js uses these to know what needs pushing to Sheets.
// ----------------------------------------------------------

/**
 * unsyncedFoods()  →  array of {date, ...entry} not yet synced
 */
function unsyncedFoods() {
  const out = [];
  for (const [date, entries] of Object.entries(State.foodLog)) {
    for (const e of entries) {
      if (!e._synced) out.push({ date, ...e });
    }
  }
  return out;
}

/**
 * unsyncedWeights()  →  array of {date, ...entry} not yet synced
 */
function unsyncedWeights() {
  const out = [];
  for (const [date, entry] of Object.entries(State.weightLog)) {
    if (!entry._synced) out.push({ date, ...entry });
  }
  return out;
}

/**
 * unsyncedSessions()  →  array of sessions not yet synced
 */
function unsyncedSessions() {
  return State.training.filter(s => !s._synced);
}

/**
 * markSynced(type, ids)
 * type = "food" | "weight" | "session"
 * ids  = array of id strings (for food/session)
 *        or array of date strings (for weight)
 */
function markSynced(type, ids) {
  const set = new Set(ids);
  if (type === "food") {
    for (const entries of Object.values(State.foodLog)) {
      for (const e of entries) {
        if (set.has(e.id)) e._synced = true;
      }
    }
  } else if (type === "weight") {
    for (const date of set) {
      if (State.weightLog[date]) State.weightLog[date]._synced = true;
    }
  } else if (type === "session") {
    for (const s of State.training) {
      if (set.has(s.id)) s._synced = true;
    }
  }
  saveLocal();
}


// ----------------------------------------------------------
//  9. DATE UTILITIES
// ----------------------------------------------------------

/**
 * today()  →  "YYYY-MM-DD" in local time
 */
function today() {
  return _toDateStr(new Date());
}

/**
 * _toDateStr(date)  →  "YYYY-MM-DD"
 */
function _toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * _weekRange(dateStr)  →  { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 * Monday–Sunday week containing dateStr.
 */
function _weekRange(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();                       // 0=Sun,1=Mon,...
  const diffToMon = (day === 0) ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: _toDateStr(mon), end: _toDateStr(sun) };
}

/**
 * weekDates(dateStr)  →  array of 7 "YYYY-MM-DD" strings (Mon→Sun)
 */
function weekDates(dateStr) {
  const { start } = _weekRange(dateStr);
  const base = new Date(start + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return _toDateStr(d);
  });
}

/**
 * last30Days()  →  array of 30 "YYYY-MM-DD" strings ending today
 */
function last30Days() {
  const base = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() - (29 - i));
    return _toDateStr(d);
  });
}


// ----------------------------------------------------------
//  10. MISC INTERNALS
// ----------------------------------------------------------

/**
 * _makeId()  →  short unique-ish string  (e.g. "ft_k7x2p")
 */
function _makeId() {
  return "ft_" + Math.random().toString(36).slice(2, 7);
}

/**
 * _deepMerge(target, source, overwriteAll)
 * Recursively copies source keys onto target.
 * If overwriteAll is true, replaces even non-object values.
 */
function _deepMerge(target, source, overwriteAll = false) {
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      _deepMerge(target[key], source[key], overwriteAll);
    } else {
      target[key] = source[key];
    }
  }
}


// ----------------------------------------------------------
//  EXPOSE ON WINDOW so other scripts can use these
// ----------------------------------------------------------
Object.assign(window, {
  // Core state
  State,
  saveLocal,
  loadLocal,
  clearLocal,
  resetState,

  // Food
  getFoodLog,
  addFoodEntry,
  deleteFoodEntry,
  totalCalories,

  // Weight
  getWeightEntry,
  setWeightEntry,
  latestWeight,

  // Training
  getSessions,
  getSession,
  addSession,
  deleteSession,
  weekSessions,

  // Profile
  saveProfile,
  calcBMR,
  calcTDEE,
  calcBMI,

  // Sync support
  unsyncedFoods,
  unsyncedWeights,
  unsyncedSessions,
  markSynced,

  // Date utils
  today,
  weekDates,
  last30Days
});

console.log("[Store] store.js loaded ✓");
