// ============================================================
//  auth.js — FitTrack Authentication
//  Works with the data-callback="onGoogleSignIn" approach
//  already set up in index.html.
//
//  Depends on: store.js, config.js (SCRIPT_URL, DEFAULT_PROFILE)
// ============================================================

// Allowed emails — add both husband and wife here
const ALLOWED_EMAILS = [
  "syahmyalim@gmail.com",   // ← replace with real emails
  "nabila9782@gmail.com"           // ← replace with real email
];

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

  // Save user into State
  State.user.email = email;
  State.user.name  = name;

  // Load this user's local data
  loadLocal();

  // Re-apply user fields (loadLocal may overwrite them)
  State.user.email = email;
  State.user.name  = name;

  console.log("[Auth] Signed in:", email);

  // Show the app, hide the login screen
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("main-app").style.display     = "";

  // Boot the app
  if (typeof App !== "undefined" && typeof App.onSignIn === "function") {
    App.onSignIn();
  }
}

// ----------------------------------------------------------
//  signOut()
//  Called by the Sign Out button in the drawer.
// ----------------------------------------------------------
function signOut() {
  const email = State.user.email;

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
  document.getElementById("main-app").style.display     = "none";

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

console.log("[Auth] auth.js loaded ✓");
