// ============================================================
//  sync.js — FitTrack Cloud Sync
//  Talks to the Google Apps Script backend (SCRIPT_URL).
//  Manual only — user presses "Load from cloud" or "Save to cloud".
//
//  Depends on: store.js, config.js (SCRIPT_URL)
// ============================================================


// ----------------------------------------------------------
//  1. LOW-LEVEL FETCH WRAPPER
// ----------------------------------------------------------

/**
 * _api(params)
 * Sends a GET request to the Apps Script URL with the given
 * query parameters. Returns the parsed JSON response.
 * Throws an error if the request fails or script returns an error.
 */
async function _api(params) {
  const email = State.user?.email;
  if (!email) throw new Error("Not signed in.");

  // Build query string
  const qs = new URLSearchParams({ ...params, email }).toString();
  const url = SCRIPT_URL + "?" + qs;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error: " + res.status);

  const data = await res.json();
  if (data.status === "error") throw new Error(data.message || "Script error.");

  return data;
}


// ----------------------------------------------------------
//  2. LOAD ALL  (↓ Load from cloud)
//  Fetches every row for the signed-in user from all 4 sheet
//  tabs and merges into State.  Existing local records are kept;
//  cloud records overwrite by id/date.
// ----------------------------------------------------------

async function loadAll() {
  _setSyncNote("Loading…", "loading");

  try {
    const data = await _api({ action: "load_all" });

    // ── Profile ──
    if (data.profile) {
      Object.assign(State.profile, data.profile);
      State.profile._synced = true;
    }

    // ── Food log ──
    // data.food_log = [{id, date, food_name, calories, logged_at}, ...]
    if (Array.isArray(data.food_log)) {
      data.food_log.forEach(row => {
        const date = row.date;
        if (!date) return;
        if (!State.foodLog[date]) State.foodLog[date] = [];

        // Skip if we already have this id locally
        const exists = State.foodLog[date].some(e => e.id === row.id);
        if (!exists) {
          State.foodLog[date].push({
            id:        row.id,
            food_name: row.food_name,
            calories:  Number(row.calories) || 0,
            logged_at: row.logged_at || "",
            _synced:   true
          });
        } else {
          // Mark it synced if we already had it
          const local = State.foodLog[date].find(e => e.id === row.id);
          if (local) local._synced = true;
        }
      });
    }

    // ── Weight log ──
    // data.weight_log = [{date, weight_kg, body_fat_pct, logged_at}, ...]
    if (Array.isArray(data.weight_log)) {
      data.weight_log.forEach(row => {
        const date = row.date;
        if (!date) return;
        // Cloud wins for weight (one entry per day)
        State.weightLog[date] = {
          weight_kg:   row.weight_kg   !== "" ? Number(row.weight_kg)   : null,
          body_fat_pct: row.body_fat_pct !== "" ? Number(row.body_fat_pct) : null,
          logged_at:   row.logged_at || "",
          _synced:     true
        };
      });
    }

    // ── Training log ──
    // data.training_log = [{id, date, sport, duration_min, distance,
    //                        distance_unit, laps, calories, notes}, ...]
    // data.exercise_log = [{training_id, exercise_name, set_number, weight_kg, reps}, ...]
    if (Array.isArray(data.training_log)) {
      // Build exercise lookup by training_id
      const exMap = {};
      if (Array.isArray(data.exercise_log)) {
        data.exercise_log.forEach(ex => {
          if (!exMap[ex.training_id]) exMap[ex.training_id] = {};
          const name = ex.exercise_name;
          if (!exMap[ex.training_id][name]) exMap[ex.training_id][name] = [];
          exMap[ex.training_id][name].push({
            kg:   Number(ex.weight_kg) || 0,
            reps: Number(ex.reps)      || 0
          });
        });
      }

      data.training_log.forEach(row => {
        // Skip if already in State
        const exists = State.training.some(s => s.id === row.id);
        if (exists) {
          const local = State.training.find(s => s.id === row.id);
          if (local) local._synced = true;
          return;
        }

        // Build exercises array from exMap
        const exByName = exMap[row.id] || {};
        const exercises = Object.entries(exByName).map(([name, sets]) => ({
          name,
          sets
        }));

        State.training.push({
          id:            row.id,
          date:          row.date,
          sport:         row.sport,
          duration_min:  Number(row.duration_min) || 0,
          distance:      row.distance !== "" ? Number(row.distance) : null,
          distance_unit: row.distance_unit || null,
          laps:          row.laps !== "" ? Number(row.laps) : null,
          calories:      row.calories !== "" ? Number(row.calories) : null,
          notes:         row.notes || "",
          exercises,
          logged_at:     row.logged_at || "",
          _synced:       true
        });
      });
    }

    saveLocal();
    _setSyncNote("Loaded " + _formatNow(), "ok");
    console.log("[Sync] loadAll complete.");

    // Refresh UI
    if (typeof UI !== "undefined" && typeof UI.refresh === "function") {
      UI.refresh();
    }

  } catch (err) {
    console.error("[Sync] loadAll failed:", err);
    _setSyncNote("Load failed: " + err.message, "err");
  }
}


// ----------------------------------------------------------
//  3. SYNC ALL  (↑ Save to cloud)
//  Pushes every unsynced record to Sheets.
//  Profile is always pushed (cheap and idempotent).
// ----------------------------------------------------------

async function syncAll() {
  _setSyncNote("Saving…", "loading");

  try {
    let pushed = 0;

    // ── Profile ──
    await _api({
      action: "save_profile",
      ...State.profile
    });
    State.profile._synced = true;
    pushed++;

    // ── Unsynced food entries ──
    const foods = unsyncedFoods();
    for (const food of foods) {
      await _api({
        action:     "save_food",
        id:         food.id,
        date:       food.date,
        food_name:  food.food_name,
        calories:   food.calories,
        logged_at:  food.logged_at
      });
      pushed++;
    }
    if (foods.length) markSynced("food", foods.map(f => f.id));

    // ── Unsynced weight entries ──
    const weights = unsyncedWeights();
    for (const w of weights) {
      await _api({
        action:       "save_weight",
        date:         w.date,
        weight_kg:    w.weight_kg ?? "",
        body_fat_pct: w.body_fat_pct ?? "",
        logged_at:    w.logged_at
      });
      pushed++;
    }
    if (weights.length) markSynced("weight", weights.map(w => w.date));

    // ── Unsynced training sessions ──
    const sessions = unsyncedSessions();
    for (const s of sessions) {
      await _api({
        action:        "save_session",
        id:            s.id,
        date:          s.date,
        sport:         s.sport,
        duration_min:  s.duration_min,
        distance:      s.distance ?? "",
        distance_unit: s.distance_unit ?? "",
        laps:          s.laps ?? "",
        calories:      s.calories ?? "",
        notes:         s.notes ?? "",
        exercises:     JSON.stringify(s.exercises || [])
      });
      pushed++;
    }
    if (sessions.length) markSynced("session", sessions.map(s => s.id));

    saveLocal();
    _setSyncNote("Saved " + _formatNow(), "ok");
    console.log("[Sync] syncAll complete. Records pushed:", pushed);

  } catch (err) {
    console.error("[Sync] syncAll failed:", err);
    _setSyncNote("Save failed: " + err.message, "err");
  }
}


// ----------------------------------------------------------
//  4. DELETE HELPERS
//  Called by ui.js when user deletes a food item or session.
// ----------------------------------------------------------

/**
 * syncDeleteFood(id)
 * Tells the sheet to delete a food row by id.
 * Safe to call even if record wasn't synced yet (no-op on server).
 */
async function syncDeleteFood(id) {
  try {
    await _api({ action: "delete_food", id });
    console.log("[Sync] Deleted food:", id);
  } catch (err) {
    // Not a fatal error — local delete already happened
    console.warn("[Sync] delete_food failed (may not have been in sheet):", err.message);
  }
}

/**
 * syncDeleteSession(id)
 * Tells the sheet to delete a training session row by id.
 */
async function syncDeleteSession(id) {
  try {
    await _api({ action: "delete_session", id });
    console.log("[Sync] Deleted session:", id);
  } catch (err) {
    console.warn("[Sync] delete_session failed:", err.message);
  }
}


// ----------------------------------------------------------
//  5. SYNC STATUS NOTE
//  Updates the small text under the save/load buttons in the drawer.
// ----------------------------------------------------------

function _setSyncNote(msg, state) {
  const el = document.getElementById("sync-note");
  if (!el) return;
  el.textContent = msg;
  el.className = "sync-note" + (state === "err" ? " err" : state === "ok" ? " ok" : "");
}

function _formatNow() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return "at " + hh + ":" + mm;
}


// ----------------------------------------------------------
//  6. UNSYNCED COUNT BADGE
//  Call this to show how many records are waiting to be saved.
// ----------------------------------------------------------

function unsyncedCount() {
  return unsyncedFoods().length +
         unsyncedWeights().length +
         unsyncedSessions().length;
}

function updateSyncBadge() {
  const count = unsyncedCount();
  const note  = document.getElementById("sync-note");
  if (!note) return;
  if (count > 0 && note.textContent === "—") {
    note.textContent = count + " record" + (count > 1 ? "s" : "") + " not yet saved to cloud";
  }
}

console.log("[Sync] sync.js loaded ✓");
