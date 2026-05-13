/* ═══════════════════════════════════════
   APP CONTROLLER (The Director)
═══════════════════════════════════════ */

const App = {
  init() {
    this.bindEvents();
    
    // Listen for data changes to repaint the UI automatically
    window.addEventListener('storeUpdated', () => this.render());

    // Check Login State
    const email = localStorage.getItem('fitTrack_email');
    if (email) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-app').classList.add('visible');
      Store.init(); // Boot the brain and trigger initial sync
    } else {
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('main-app').classList.remove('visible');
    }
  },

  bindEvents() {
    // ─── Authentication ───
    const loginBtn = document.querySelector('.login-card .savebtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        const emailInput = document.querySelector('.login-card input[type="email"]');
        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
        
        if (email) {
          localStorage.setItem('fitTrack_email', email);
          location.reload(); // Reset state and boot app
        } else {
          Utils.toast('Enter a valid email.', true);
        }
      });
    }

    // ─── Navigation ───
    document.querySelectorAll('.snav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Find closest button element in case an icon was clicked
        const targetBtn = e.target.closest('.snav-btn');
        if (!targetBtn) return;
        
        const targetId = targetBtn.dataset.target; // Ensure your HTML has data-target="pg-home" etc.
        
        // Update active states
        document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('on'));
        targetBtn.classList.add('on');
        
        document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
        const activePage = document.getElementById(targetId);
        if (activePage) activePage.classList.add('on');
        
        this.render(); 
      });
    });

    // ─── Drawer (Settings) ───
    const hbg = document.querySelector('.hbg');
    const drawer = document.querySelector('.drawer');
    const overlay = document.querySelector('.drawer-overlay');
    
    if (hbg && drawer && overlay) {
      const toggleDrawer = () => {
        drawer.classList.toggle('on');
        overlay.classList.toggle('on');
      };
      hbg.addEventListener('click', toggleDrawer);
      overlay.addEventListener('click', toggleDrawer);
    }

    // Logout logic
    const logoutBtn = document.querySelector('.drawer-btn.red');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('fitTrack_email');
        localStorage.removeItem('fitTrack_data');
        location.reload();
      });
    }
    
    // Manual Sync button
    const syncBtn = document.querySelector('.drawer-btn.green');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        const icon = syncBtn.querySelector('i');
        // Simple visual feedback if you add lucide icons
        syncBtn.textContent = 'Syncing...';
        await Store.syncFromCloud();
        syncBtn.textContent = 'Force Sync Data';
        Utils.toast('Data synchronized.');
      });
    }
  },

  // ─── UI Rendering ───
  render() {
    // This is where you map Store.data variables to your specific HTML IDs
    this.renderHome();
    this.renderDrawer();
    // this.renderProgress(); 
    // this.renderTraining();
  },

  renderHome() {
    const homePg = document.getElementById('pg-home');
    if (!homePg || !homePg.classList.contains('on')) return;

    const p = Store.data.profile;
    const date = Utils.today();
    
    // Update headers
    const greetEl = document.querySelector('.h-greet');
    const dateEl = document.querySelector('.h-date');
    if (greetEl) greetEl.textContent = 'Ready to work.';
    if (dateEl) dateEl.textContent = Utils.formatDisplayDate(date);

    // If you have standard IDs in your HTML for stats, map them here:
    // e.g., document.getElementById('stat-tdee').textContent = p.tdee;
  },

  renderDrawer() {
     const emailEl = document.querySelector('.user-email');
     const nameEl = document.querySelector('.user-name');
     const email = localStorage.getItem('fitTrack_email');
     
     if (emailEl && email) emailEl.textContent = email;
     if (nameEl && email) {
       // Quick formatting to pull name from email
       nameEl.textContent = Utils.capitalize(email.split('@')[0].replace(/[0-9]/g, ''));
     }
  }
};

// Start the engine once the DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
