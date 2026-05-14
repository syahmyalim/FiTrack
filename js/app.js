// ============================================================
//  app.js — FitTrack Application Entry Point
//  Boots the app after sign-in, wires up global event
//  listeners, and coordinates between all other modules.
//
//  Depends on: store.js, auth.js, sync.js, ui.js
//  This file is loaded last (see index.html script order).
// ============================================================


// ──────────────────────────────────────────
//  THE App OBJECT
//  ui.js and auth.js call methods on this.
// ──────────────────────────────────────────

const App = {

  /**
   * onSignIn()
   * Called by auth.js immediately after a successful Google
   * sign-in. Initialises the UI and triggers a background
   * cloud load.
   */
  onSignIn() {
    console.log("[App] onSignIn — booting UI for", State.user.email);

    // 1. Boot the UI (renders home page, sets initial state)
    UI.init();

    // 2. Silently load latest data from cloud in background.
    //    UI already shows local data; cloud data merges in
    //    and refresh() repaints once it arrives.
    loadAll().then(() => {
      UI.refresh();
    }).catch(err => {
      // Non-fatal — user still has local data
      console.warn("[App] Background load failed:", err.message);
    });
  },

  /**
   * onSignOut()
   * Called (optionally) after sign-out. Currently auth.js
   * handles the DOM switch; this is a hook for future cleanup.
   */
  onSignOut() {
    console.log("[App] onSignOut — cleaning up.");
    // Any cleanup beyond what auth.js does can go here.
  }

};


// ──────────────────────────────────────────
//  GLOBAL EVENT LISTENERS
// ──────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {

  // ── Close modals when tapping the dark overlay ──
  const logOverlay = document.getElementById("log-modal");
  if (logOverlay) {
    logOverlay.addEventListener("click", e => {
      // Only close if the tap was on the overlay itself,
      // not on the white sheet inside it.
      if (e.target === logOverlay) closeLogModal();
    });
  }

  const chartOverlay = document.getElementById("chart-overlay");
  if (chartOverlay) {
    chartOverlay.addEventListener("click", e => {
      if (e.target === chartOverlay) closeChartOverlay();
    });
  }

  // ── Keyboard: Escape closes any open modal ──
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (document.getElementById("log-modal")?.style.display !== "none") {
      closeLogModal();
    }
    if (document.getElementById("chart-overlay")?.style.display !== "none") {
      closeChartOverlay();
    }
  });

  // ── Prevent iOS double-tap zoom on buttons ──
  document.addEventListener("touchend", e => {
    if (e.target.tagName === "BUTTON") e.preventDefault();
  }, { passive: false });

  console.log("[App] DOMContentLoaded — listeners attached.");
});


// ──────────────────────────────────────────
//  EXPOSE App ON WINDOW
//  auth.js calls App.onSignIn() after sign-in.
// ──────────────────────────────────────────
window.App = App;

console.log("[App] app.js loaded ✓");
