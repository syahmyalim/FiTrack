const App = {
  init: function() {
    const email = localStorage.getItem('fitTrack_email');
    if (email) {
      this.boot(email);
    }
  },
  
  boot: function(email) {
    // Reveal app, hide login
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').classList.add('visible');
    
    // Set drawer profile info
    const emailEl = document.getElementById('drawer-email');
    if (emailEl) emailEl.textContent = email;
    
    const nameEl = document.getElementById('drawer-name');
    if (nameEl) nameEl.textContent = email.split('@')[0];
    
    const avatar = document.getElementById('drawer-avatar');
    if (avatar) avatar.textContent = email.charAt(0).toUpperCase();

    // Trigger initial data load
    if (typeof loadAll === 'function') loadAll();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
