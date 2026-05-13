/* ═══════════════════════════════════════
   AUTHENTICATION
═══════════════════════════════════════ */

function onGoogleSignIn(response) {
  try {
    // Decode the JWT from Google
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    const email = payload.email.toLowerCase();

    // Check against config
    if (!CONFIG.ALLOWED_EMAILS.includes(email)) {
      alert('Unauthorised user: ' + email);
      return;
    }

    // Save login state
    localStorage.setItem('fitTrack_email', email);
    bootApp(email);

  } catch (error) {
    console.error("Login failed:", error);
    alert("Failed to sign in. Check console.");
  }
}

function signOut() {
  localStorage.removeItem('fitTrack_email');
  localStorage.removeItem('fitTrack_data');
  location.reload();
}

function bootApp(email) {
  // Hide login, show main app
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').classList.add('visible');
  
  // Update drawer UI
  const emailEl = document.getElementById('drawer-email');
  const nameEl = document.getElementById('drawer-name');
  const avatarEl = document.getElementById('drawer-avatar');
  
  if (emailEl) emailEl.textContent = email;
  if (nameEl) nameEl.textContent = email.split('@')[0];
  if (avatarEl) avatarEl.textContent = email.charAt(0).toUpperCase();

  // If we have our Store/App logic loaded, initialize it here later
  if (typeof App !== 'undefined' && App.init) {
    App.init();
  }
}

// Auto-check on page load
document.addEventListener('DOMContentLoaded', () => {
  const email = localStorage.getItem('fitTrack_email');
  if (email) {
    bootApp(email);
  }
});
