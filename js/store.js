const Store = { data: {} };

function calc() {
  const wt = parseFloat(document.getElementById('wt').value) || 0;
  const ht = parseFloat(document.getElementById('ht').value) || 0;
  const age = parseInt(document.getElementById('age').value) || 0;
  const gender = document.getElementById('gender').value;
  const act = parseFloat(document.getElementById('act').value) || 1.2;

  if (!wt || !ht || !age) return;

  const bmi = (wt / Math.pow(ht / 100, 2)).toFixed(1);
  const bmiEl = document.getElementById('bmi-v');
  if (bmiEl) bmiEl.textContent = bmi;

  let bmr = (10 * wt) + (6.25 * ht) - (5 * age);
  bmr = gender === 'male' ? bmr + 5 : bmr - 161;
  const bmrEl = document.getElementById('bmr-v');
  if (bmrEl) bmrEl.innerHTML = Math.round(bmr) + '<span class="sunit">kcal</span>';

  const tdee = Math.round(bmr * act);
  const tdeeEl = document.getElementById('tdee-v');
  if (tdeeEl) tdeeEl.innerHTML = tdee + '<span class="sunit">kcal</span>';
}
