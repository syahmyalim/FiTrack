// ============================================================
//  auth.js — FitTrack Authentication
//  Works with the data-callback="onGoogleSignIn" approach
//  already set up in index.html.
//
//  Depends on: store.js, config.js (SCRIPT_URL, DEFAULT_PROFILE)
//
//  Session persistence: the Google ID token (JWT) is stored in
//  localStorage under "fittrack_auth_token". On page load we
//  try to restore the session from that token without requiring
//  the user to tap Sign In again.
// ============================================================

// Allowed emails — add both husband and wife here
const ALLOWED_EMAILS = [
  "syahmyalim@gmail.com",
  "nabila9782@gmail.com"
];

const _AUTH_TOKEN_KEY = "fittrack_auth_token";

// ----------------------------------------------------------
//  _parseJwt(token)
//  Decodes the Google ID token to get email, name, etc.
// ----------------------------------------------------------
function _parseJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64).split("").map(c =>
        "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
      ).join("")
    );
    return JSON.parse(json);
  } catch (e) {
    console.error("[Auth] JWT parse failed:", e);
    return null;
  }
}

// ----------------------------------------------------------
//  _bootUser(email, name)
//  Shared logic: load local data, show app, boot UI.
// ----------------------------------------------------------
function _bootUser(email, name) {
  State.user.email = email;
  State.user.name  = name;

  loadLocal();

  // Re-apply after loadLocal (it may overwrite user fields)
  State.user.email = email;
  State.user.name  = name;

  console.log("[Auth] Booting user:", email);

  document.getElementById("login-screen").style.display = "none";
  document.getElementById("main-app").classList.add("on");

  if (typeof App !== "undefined" && typeof App.onSignIn === "function") {
    App.onSignIn();
  }
}

// ----------------------------------------------------------
//  onGoogleSignIn(response)
//  Called by Google GSI after the user picks their account.
//  index.html wires this up via data-callback="onGoogleSignIn"
// ----------------------------------------------------------
function onGoogleSignIn(response) {
  const payload = _parseJwt(response.credential);
  if (!payload) {
    alert("Sign-in failed. Please try again.");
    return;
  }

  const email = payload.email;
  const name  = payload.name || email.split("@")[0];

  // Block anyone not on the list
  if (!ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())) {
    console.warn("[Auth] Blocked:", email);
    alert("Sorry, this app is private. Your account (" + email + ") is not authorised.");
    return;
  }

  // Persist the token so we can restore the session next visit
  try {
    localStorage.setItem(_AUTH_TOKEN_KEY, response.credential);
  } catch (e) {
    console.warn("[Auth] Could not persist token:", e);
  }

  _bootUser(email, name);
}

// ----------------------------------------------------------
//  tryRestoreSession()
//  Called on DOMContentLoaded. If we have a stored token that
//  is still valid (not expired) and the email is allowed, we
//  sign the user in silently without showing the login screen.
// ----------------------------------------------------------
function tryRestoreSession() {
  try {
    const token = localStorage.getItem(_AUTH_TOKEN_KEY);
    if (!token) return false;

    const payload = _parseJwt(token);
    if (!payload) { localStorage.removeItem(_AUTH_TOKEN_KEY); return false; }

    // Check expiry (Google ID tokens last 1 hour; we extend this by
    // storing and re-validating only on email membership — the token
    // is not sent to any server, so the exp field is informational only
    // for our offline-first app. We give a 30-day grace window so users
    // aren't signed out every hour.)
    const nowSec = Math.floor(Date.now() / 1000);
    const ageDays = (nowSec - (payload.iat || 0)) / 86400;
    if (ageDays > 30) {
      console.log("[Auth] Stored token too old, clearing.");
      localStorage.removeItem(_AUTH_TOKEN_KEY);
      return false;
    }

    const email = payload.email;
    const name  = payload.name || email.split("@")[0];

    if (!ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())) {
      localStorage.removeItem(_AUTH_TOKEN_KEY);
      return false;
    }

    console.log("[Auth] Restored session for:", email);
    _bootUser(email, name);
    return true;

  } catch (e) {
    console.warn("[Auth] Session restore failed:", e);
    return false;
  }
}

// ----------------------------------------------------------
//  signOut()
//  Called by the Sign Out button in the drawer.
// ----------------------------------------------------------
function signOut() {
  const email = State.user.email;

  // Clear the persisted token so they truly sign out
  try { localStorage.removeItem(_AUTH_TOKEN_KEY); } catch (e) {}

  // Wipe in-memory state
  resetState();

  // Revoke Google session (so account picker shows next time)
  if (typeof google !== "undefined" && google.accounts && email) {
    google.accounts.id.revoke(email, () => {
      console.log("[Auth] Revoked:", email);
    });
  }

  // Show login, hide app
  document.getElementById("login-screen").style.display = "";
  document.getElementById("main-app").classList.remove("on");

  console.log("[Auth] Signed out.");
}

// ----------------------------------------------------------
//  isSignedIn()
//  Quick check used by other files.
// ----------------------------------------------------------
function isSignedIn() {
  const email = State.user?.email;
  if (!email) return false;
  return ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase());
}

// ----------------------------------------------------------
//  Auto-restore on page load
//  Runs as soon as auth.js is parsed. If the DOM is already
//  ready we run immediately; otherwise we wait for it.
// ----------------------------------------------------------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", tryRestoreSession);
} else {
  // DOMContentLoaded already fired (shouldn't happen in normal load order,
  // but guard anyway)
  tryRestoreSession();
}

console.log("[Auth] auth.js loaded ✓");
