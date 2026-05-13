const Sync = {
  request: async (action, data = {}) => {
    const email = localStorage.getItem('fitTrack_email');
    if (!email) return;
    return fetch(CONFIG.GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action, email, ...data })
    }).then(r => r.json());
  }
};

function loadAll() {
  const note = document.getElementById('sync-note');
  if(note) note.textContent = 'Loading...';
  Sync.request('load_all').then(res => {
    if(res && res.status === 'ok') {
      Store.data = res.data;
      if(note) note.textContent = 'Synced just now';
    }
  }).catch(() => { if(note) note.textContent = 'Sync failed'; });
}

function syncAll() { loadAll(); }

function saveProfile() {
  const toast = document.getElementById('toast');
  if(toast) { toast.style.display = 'block'; toast.textContent = 'Saving...'; }
  
  Sync.request('save_profile', {
    age: document.getElementById('age').value,
    gender: document.getElementById('gender').value,
    height_cm: document.getElementById('ht').value,
    weight_kg: document.getElementById('wt').value,
    activity: document.getElementById('act').value,
    body_fat_pct: document.getElementById('bfin').value,
    target_weight_kg: document.getElementById('tgw').value,
    target_weeks: document.getElementById('tgwk').value
  }).then(() => {
    if(toast) { toast.textContent = 'Profile saved!'; setTimeout(()=>toast.style.display='none', 3000); }
  });
}

function addFood() {
  const name = document.getElementById('lm-fn').value;
  const cal = document.getElementById('lm-fc').value;
  if(!name || !cal) return;
  const date = new Date().toISOString().split('T')[0];
  
  Sync.request('save_food', { date, food_name: name, calories: cal }).then(() => {
    document.getElementById('lm-fn').value = '';
    document.getElementById('lm-fc').value = '';
    alert('Food logged!');
  });
}

function addWeight() {
  const wt = document.getElementById('lm-ww').value;
  const bf = document.getElementById('lm-wbf').value;
  if(!wt) return;
  const date = new Date().toISOString().split('T')[0];
  
  Sync.request('save_weight', { date, weight_kg: wt, body_fat_pct: bf }).then(() => {
    document.getElementById('lm-ww').value = '';
    document.getElementById('lm-wbf').value = '';
    alert('Weight logged!');
  });
}

// Training placeholders for now to prevent console errors
function saveGym() {} function saveCardio() {}
