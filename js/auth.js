// ============================================================
//  auth.js — FitTrack Authentication
//  Handles Google Sign-In (OAuth), guards access to 2
//  authorised emails only, and manages sign-out.
//
//  Depends on: store.js (State, loadLocal, clearLocal, resetState)
//              config.js (CONFIG.CLIENT_ID, CONFIG.ALLOWED_EMAILS)
//  Loaded by:  index.html  (after store.js, before sync/ui/app.js)
// ============================================================


// ----------------------------------------------------------
//  1. GOOGLE IDENTITY SERVICES INITIALISATION
//  Runs once the Google GSI library is ready.
//  index.html must load this script:
//    <script src="https://accounts.google.com/gsi/client" async defer></script>
//  And call  Auth.init()  from app.js once the page is ready.
// ----------------------------------------------------------
const Auth = (() => {

  // --------------------------------------------------------
  //  Private helpers
  // --------------------------------------------------------

  /**
   * _isAllowed(email)
   * Returns true only if the email is in CONFIG.ALLOWED_EMAILS.
   * This is the primary security gate — nobody else can use the app.
   */
  function _isAllowed(email) {
    if (!email) return false;
    const allowed = (typeof CONFIG !== "undefined" && CONFIG.ALLOWED_EMAILS)
      ? CONFIG.ALLOWED_EMAILS
      : [];
    return allowed.map(e => e.toLowerCase()).includes(email.toLowerCase());
  }

  /**
   * _parseJwt(token)
   * Decodes a Google ID token (JWT) without a library.
   * Returns the payload object (contains email, name, picture, etc.)
   */
  function _parseJwt(token) {
    try {
      const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(base64)
          .split("")
          .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(json);
    } catch (err) {
      console.error("[Auth] Failed to parse JWT:", err);
      return null;
    }
  }

  /**
   * _showScreen(id)
   * Shows one top-level screen, hides all others.
   * Screens: "screen-login" | "screen-app" | "screen-blocked"
   */
  function _showScreen(id) {
    ["screen-login", "screen-app", "screen-blocked"].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = (s === id) ? "" : "none";
    });
  }

  /**
   * _onSignInSuccess(payload)
   * Called after a valid Google credential is received.
   * payload = decoded JWT  { email, name, picture, ... }
   */
  function _onSignInSuccess(payload) {
    const email = payload.email;
    const name  = payload.name || email.split("@")[0];

    if (!_isAllowed(email)) {
      console.warn("[Auth] Blocked email:", email);
      _showScreen("screen-blocked");
      return;
    }

    // Store user in State
    State.user.email = email;
    State.user.name  = name;

    // Load this user's saved data from localStorage
    loadLocal();

    // Keep user fields fresh (name may have changed)
    State.user.email = email;
    State.user.name  = name;

    console.log("[Auth] Signed in as:", email);

    // Hand off to app.js to boot the UI
    if (typeof App !== "undefined" && typeof App.onSignIn === "function") {
      App.onSignIn();
    }

    _showScreen("screen-app");
  }

  // --------------------------------------------------------
  //  Public API
  // --------------------------------------------------------

  /**
   * Auth.init()
   * Initialises the Google Identity Services button renderer.
   * Call this once from app.js when the DOM is ready.
   *
   * Expects a <div id="g_id_signin"></div> in index.html where
   * the Google button will be rendered.
   */
  function init() {
    if (typeof google === "undefined" || !google.accounts) {
      // GSI library not loaded yet — retry in 200 ms
      console.warn("[Auth] GSI not ready, retrying...");
      setTimeout(init, 200);
      return;
    }

    const clientId = (typeof CONFIG !== "undefined")
      ? CONFIG.CLIENT_ID
      : "";

    // Initialise GSI
    google.accounts.id.initialize({
      client_id: clientId,
      callback: _handleCredentialResponse,
      auto_select: true,          // silently re-signs-in returning users
      cancel_on_tap_outside: false
    });

    // Render the sign-in button inside #g_id_signin
    const btnContainer = document.getElementById("g_id_signin");
    if (btnContainer) {
      google.accounts.id.renderButton(btnContainer, {
        type: "standard",
        shape: "pill",
        theme: "outline",
        text: "sign_in_with",
        size: "large",
        logo_alignment: "left"
      });
    }

    // Also trigger One Tap prompt (pops up the account chooser)
    google.accounts.id.prompt();

    console.log("[Auth] GSI initialised ✓");
  }

  /**
   * _handleCredentialResponse(response)
   * Google calls this with a credential object after the user picks
   * their account.  response.credential is the raw JWT string.
   */
  function _handleCredentialResponse(response) {
    const payload = _parseJwt(response.credential);
    if (!payload) {
      console.error("[Auth] Could not parse credential.");
      return;
    }
    _onSignInSuccess(payload);
  }

  /**
   * Auth.signOut()
   * Clears State, revokes the Google session, returns to login screen.
   * Wire this to a "Sign Out" button in the app.
   */
  function signOut() {
    const email = State.user.email;

    // Reset in-memory state
    resetState();

    // Revoke Google session so the account picker shows next time
    if (typeof google !== "undefined" && google.accounts && email) {
      google.accounts.id.revoke(email, () => {
        console.log("[Auth] Google session revoked for:", email);
      });
    }

    console.log("[Auth] Signed out.");
    _showScreen("screen-login");
  }

  /**
   * Auth.currentUser()
   * Convenience getter — returns { email, name } or null.
   */
  function currentUser() {
    if (!State.user.email) return null;
    return { email: State.user.email, name: State.user.name };
  }

  /**
   * Auth.isSignedIn()
   * Returns true if a valid user is in State.
   */
  function isSignedIn() {
    return !!State.user.email && _isAllowed(State.user.email);
  }

  // Expose public methods
  return { init, signOut, currentUser, isSignedIn };

})();


// ----------------------------------------------------------
//  2. EXPOSE GLOBALLY
// ----------------------------------------------------------
window.Auth = Auth;

console.log("[Auth] auth.js loaded ✓");
