// ============================================================
//  FitTrack — auth.js
//  Handles Google Sign-In (OAuth).
//  Only 2 allowed emails can get in.
//  Calls loadState() from store.js, then kicks off the app.
// ============================================================

// ── The only 2 emails allowed to use the app ─────────────────
const ALLOWED_EMAILS = [
  "syahmyalim@gmail.com",   // ← replace with husband's email
  "nabila9782@gmail.com"        // ← replace with wife's email
];

// ── Google OAuth Client ID (from config.js) ──────────────────
//    This is already set in config.js, we just reference it here
//    via the global CONFIG object.
//    If you don't have config.js set up yet, you can paste it directly:
//    const CLIENT_ID = "359944522311-ccu0kc5unogbqujuuh33kqjij6eev2pu.apps.googleusercontent.com";

// ============================================================
//  Called automatically by Google after their script loads.
//  We initialise the Sign-In button here.
// ============================================================
function initGoogleAuth() {
  google.accounts.id.initialize({
    client_id: CONFIG.CLIENT_ID,   // from config.js
    callback: handleGoogleSignIn,  // runs when the user picks an account
    auto_select: true              // silently signs back in if session is fresh
  });

  // Render the Sign-In button inside <div id="g_signin_btn">
  google.accounts.id.renderButton(
    document.getElementById("g_signin_btn"),
    {
      theme: "filled_black",
      size: "large",
      text: "signin_with",
      shape: "pill"
    }
  );

  // Also show the "one tap" popup if the user has signed in before
  google.accounts.id.prompt();
}

// ============================================================
//  This runs after Google verifies the user.
//  response.credential is a JWT token — we decode it to get
//  the user's name and email without any extra server calls.
// ============================================================
function handleGoogleSignIn(response) {
  // Decode the JWT (it's just base64 — no secret needed to read it)
  const payload = parseJWT(response.credential);

  const email = payload.email;
  const name  = payload.name || email.split("@")[0];

  // ── Access check ─────────────────────────────────────────
  if (!ALLOWED_EMAILS.includes(email)) {
    showAuthError("Sorry, this app is private. Your email is not on the list.");
    return;
  }

  // ── Store the user in State ───────────────────────────────
  State.user = { email, name };
  saveState();

  // ── Hide the sign-in screen, show the app ────────────────
  document.getElementById("signin_screen").style.display = "none";
  document.getElementById("app_shell").style.display     = "block";

  // ── Hand off to the app ───────────────────────────────────
  //    app.js will call this once auth is confirmed
  if (typeof onAuthReady === "function") {
    onAuthReady();
  }

  console.log("FitTrack: signed in as", email, "✓");
}

// ============================================================
//  Sign the user out.
//  Call this from a "Sign Out" button in the UI.
// ============================================================
function signOut() {
  google.accounts.id.disableAutoSelect(); // stop auto sign-in next time
  clearState();                           // wipe localStorage (from store.js)

  // Hide app, show sign-in screen
  document.getElementById("app_shell").style.display     = "none";
  document.getElementById("signin_screen").style.display = "flex";

  console.log("FitTrack: signed out ✓");
}

// ============================================================
//  Check if the user is already signed in (on page load).
//  If State has a saved user, skip the sign-in screen.
// ============================================================
function checkExistingSession() {
  loadState(); // always load first (from store.js)

  if (State.user && State.user.email && ALLOWED_EMAILS.includes(State.user.email)) {
    // Already signed in — skip straight to the app
    document.getElementById("signin_screen").style.display = "none";
    document.getElementById("app_shell").style.display     = "block";

    if (typeof onAuthReady === "function") {
      onAuthReady();
    }

    console.log("FitTrack: session restored for", State.user.email, "✓");
  } else {
    // Not signed in — show the sign-in screen
    document.getElementById("signin_screen").style.display = "flex";
    document.getElementById("app_shell").style.display     = "none";
  }
}

// ============================================================
//  Show an error message on the sign-in screen.
// ============================================================
function showAuthError(message) {
  const el = document.getElementById("auth_error");
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  } else {
    alert(message); // fallback
  }
}

// ============================================================
//  Decode a JWT token (read-only — not for security verification).
//  Google already verified the token; we just need the payload.
// ============================================================
function parseJWT(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch (e) {
    console.error("FitTrack: could not parse JWT", e);
    return {};
  }
}

// ============================================================
//  Kick everything off when the page loads.
// ============================================================
window.addEventListener("load", () => {
  checkExistingSession();
});
