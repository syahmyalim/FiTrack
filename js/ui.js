function goPage(pageId) {
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  document.getElementById('pg-' + pageId).classList.add('on');
  document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('on'));
  const btn = document.getElementById('snav-' + pageId);
  if(btn) btn.classList.add('on');
}

function openDrawer() { document.getElementById('drawer').classList.add('on'); document.getElementById('drawer-overlay').classList.add('on'); }
function closeDrawer() { document.getElementById('drawer').classList.remove('on'); document.getElementById('drawer-overlay').classList.remove('on'); }

function openLogModal() { document.getElementById('log-modal').style.display = 'flex'; }
function closeLogModal() { document.getElementById('log-modal').style.display = 'none'; }

function swLogTab(tab) {
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('on'));
  document.getElementById('ltab-' + tab).classList.add('on');
  document.getElementById('lm-food').style.display = tab === 'food' ? 'block' : 'none';
  document.getElementById('lm-weight').style.display = tab === 'weight' ? 'block' : 'none';
}

function openChartOverlay() { document.getElementById('chart-overlay').style.display = 'flex'; }
function closeChartOverlay() { document.getElementById('chart-overlay').style.display = 'none'; }

function swTrain(tab) {
  document.querySelectorAll('#train-tabs button').forEach(b => b.classList.remove('on'));
  event.target.classList.add('on');
  document.getElementById('tr-log').style.display = tab === 'log' ? 'block' : 'none';
  document.getElementById('tr-history').style.display = tab === 'history' ? 'block' : 'none';
}

function selSport(sport, btn) {
  document.querySelectorAll('#sport-pills .spill').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('sp-gym').style.display = sport === 'gym' ? 'block' : 'none';
  document.getElementById('sp-cardio').style.display = sport !== 'gym' ? 'block' : 'none';
}

function filtHist(filter, btn) {
  document.querySelectorAll('#hist-pills .spill').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function toggleLegend() {
  const leg = document.getElementById('stamp-legend');
  leg.style.display = leg.style.display === 'none' ? 'flex' : 'none';
}

// Arrow Navigators
function chHStat(dir) {} function chWBar(dir) {} function chStamp(dir) {} function chSess(dir) {} function chLogDate(dir) {} 
function onExDd() {} function addExCard() {}
