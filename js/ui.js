// ============================================================
//  ui.js — FitTrack UI Rendering
//  Renders every page, chart, modal, and widget in the app.
//
//  Depends on: store.js, config.js
//  Call UI.refresh() after any State change to repaint the
//  currently-visible page.
// ============================================================

const UI = (() => {

  // ──────────────────────────────────────────
  //  INTERNAL HELPERS
  // ──────────────────────────────────────────

  /**
   * $(id)  →  shorthand for getElementById
   */
  function $(id) { return document.getElementById(id); }

  /**
   * fmt(n, dec)  →  round number to dec decimal places as string
   */
  function fmt(n, dec = 1) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toFixed(dec);
  }

  /**
   * fmtDate(dateStr)  →  "Mon 13 May" style label
   */
  function fmtDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }

  /**
   * shortDay(dateStr)  →  "Mo", "Tu" etc.
   */
  function shortDay(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2);
  }

  /**
   * offsetDate(dateStr, days)  →  new date string offset by days
   */
  function offsetDate(dateStr, days) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return _toDateStr(d);
  }

  function _toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  /**
   * weekLabel(dateStr)  →  "13–19 May 2025" or "This week"
   */
  function weekLabel(dateStr, off) {
    if (off === 0) return "This week";
    const dates = weekDates(dateStr);
    const s = new Date(dates[0] + "T00:00:00");
    const e = new Date(dates[6] + "T00:00:00");
    const sm = s.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const em = e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return sm + " – " + em;
  }

  /**
   * tdeeFromProfile()  —  reads profile directly from DOM inputs
   * (used in profile page live calc)
   */
  function tdeeFromInputs() {
    const age    = Number($("age")?.value);
    const gender = $("gender")?.value;
    const ht     = Number($("ht")?.value);
    const wt     = Number($("wt")?.value);
    const act    = Number($("act")?.value) || 1.2;
    if (!age || !ht || !wt) return null;
    let bmr;
    if (gender === "male") bmr = 10 * wt + 6.25 * ht - 5 * age + 5;
    else                   bmr = 10 * wt + 6.25 * ht - 5 * age - 161;
    return Math.round(bmr * act);
  }

  /**
   * destroyChart(id)  —  safely destroy a Chart.js instance
   */
  const _charts = {};
  function destroyChart(id) {
    if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
  }

  /**
   * sparkLine(canvasId, data, color)
   * Draws a tiny line chart on a canvas element.
   * data = array of numbers (nulls are skipped).
   */
  function sparkLine(canvasId, data, color = "#1D9E75") {
    destroyChart(canvasId);
    const canvas = $(canvasId);
    if (!canvas) return;
    const labels = data.map((_, i) => i);
    _charts[canvasId] = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          data,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          backgroundColor: color + "22",
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        animation: { duration: 400 }
      }
    });
  }


  // ──────────────────────────────────────────
  //  HOME PAGE
  // ──────────────────────────────────────────

  function renderHome() {
    // Greeting
    const h = new Date().getHours();
    const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const name  = State.user.name ? ", " + State.user.name.split(" ")[0] : "";
    $("h-greet").textContent = greet + name;
    $("h-date").textContent  = new Date().toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    renderHStat();
    renderCalBar();
    renderWBar();
    renderStampCal();
  }

  // ── Home week stats (weight/BF/sessions) ──
  function renderHStat() {
    const off    = State.ui.hStatOff || 0;
    const refDay = offsetDate(today(), off * 7);
    const dates  = weekDates(refDay);

    $("hstat-title").textContent = weekLabel(refDay, off);
    $("hstat-prev").disabled = false;
    $("hstat-next").disabled = (off >= 0);

    // Avg weight this week
    const wtVals = dates
      .map(d => State.weightLog[d]?.weight_kg)
      .filter(v => v !== null && v !== undefined);
    const avgWt = wtVals.length ? wtVals.reduce((a, b) => a + b, 0) / wtVals.length : null;

    // Previous week avg for trend
    const prevDates = weekDates(offsetDate(refDay, -7));
    const prevWt = prevDates
      .map(d => State.weightLog[d]?.weight_kg)
      .filter(v => v !== null && v !== undefined);
    const prevAvgWt = prevWt.length ? prevWt.reduce((a, b) => a + b, 0) / prevWt.length : null;

    $("h-wt").textContent = avgWt !== null ? fmt(avgWt) + " kg" : "—";
    if (avgWt !== null && prevAvgWt !== null) {
      const diff = avgWt - prevAvgWt;
      const sign = diff > 0 ? "▲" : "▼";
      $("h-wt-tr").textContent  = sign + " " + fmt(Math.abs(diff)) + " vs prev wk";
      $("h-wt-tr").className    = "hstat-sub " + (diff > 0 ? "tup" : "tdn");
    } else {
      $("h-wt-tr").textContent = "";
    }

    // Avg body fat
    const bfVals = dates
      .map(d => State.weightLog[d]?.body_fat_pct)
      .filter(v => v !== null && v !== undefined);
    const avgBf = bfVals.length ? bfVals.reduce((a, b) => a + b, 0) / bfVals.length : null;
    $("h-bf2").textContent = avgBf !== null ? fmt(avgBf) + " %" : "—";

    const prevBf = prevDates
      .map(d => State.weightLog[d]?.body_fat_pct)
      .filter(v => v !== null && v !== undefined);
    const prevAvgBf = prevBf.length ? prevBf.reduce((a, b) => a + b, 0) / prevBf.length : null;
    if (avgBf !== null && prevAvgBf !== null) {
      const diff = avgBf - prevAvgBf;
      const sign = diff > 0 ? "▲" : "▼";
      $("h-bf-tr").textContent = sign + " " + fmt(Math.abs(diff)) + " vs prev wk";
      $("h-bf-tr").className   = "hstat-sub " + (diff > 0 ? "tup" : "tdn");
    } else {
      $("h-bf-tr").textContent = "";
    }

    // Sessions this week
    const sess = dates.flatMap(d => State.training.filter(s => s.date === d));
    $("h-sess").textContent = sess.length;
    $("h-sess-sub").textContent = off === 0 ? "this week" : "that week";
  }

  // ── Today's calorie bar ──
  function renderCalBar() {
    const t      = today();
    const eaten  = totalCalories(t);

    // Burned = sum of session calories logged today
    const burned = State.training
      .filter(s => s.date === t && s.calories)
      .reduce((sum, s) => sum + (s.calories || 0), 0);

    // TDEE from state profile
    const tdee = (() => {
      const { age, gender, height_cm, weight_kg, activity } = State.profile;
      if (!age || !gender || !height_cm || !weight_kg) return null;
      const h = Number(height_cm), w = Number(weight_kg), a = Number(age);
      let bmr = gender === "male"
        ? 10 * w + 6.25 * h - 5 * a + 5
        : 10 * w + 6.25 * h - 5 * a - 161;
      const factor = Number(activity) || 1.2;
      return Math.round(bmr * factor);
    })();

    $("h-eaten").textContent  = eaten;
    $("h-burned").textContent = burned || 0;

    const net  = eaten - burned;
    const rem  = tdee !== null ? tdee - net : null;

    $("h-rem").textContent = rem !== null ? Math.round(rem) : "—";

    // Colour remaining
    const remEl = $("h-rem");
    if (rem !== null) {
      remEl.className = "cal-hval" + (rem < 0 ? " red" : rem < 100 ? " " : " grn");
    }

    $("h-bl").textContent = net + " kcal net";
    $("h-br").textContent = tdee !== null ? "Goal: " + tdee + " kcal" : "Set profile to see goal";

    // Bar fill
    const bar  = $("h-bar");
    const pct  = tdee ? Math.min((net / tdee) * 100, 100) : 0;
    bar.style.width = Math.max(pct, 0) + "%";
    bar.className   = "hbar-fill" +
      (pct > 100 ? " red" : pct > 90 ? " amb" : "");
  }

  // ── Weekly calorie bar chart ──
  function renderWBar() {
    const off    = State.ui.wBarOff || 0;
    const refDay = offsetDate(today(), off * 7);
    const dates  = weekDates(refDay);

    $("wbar-title").textContent = (off === 0 ? "This week" : weekLabel(refDay, off)) + " — calories";
    $("wbar-prev").disabled = false;
    $("wbar-next").disabled = (off >= 0);

    // TDEE from state
    const tdee = (() => {
      const { age, gender, height_cm, weight_kg, activity } = State.profile;
      if (!age || !gender || !height_cm || !weight_kg) return null;
      const h = Number(height_cm), w = Number(weight_kg), a = Number(age);
      let bmr = gender === "male"
        ? 10 * w + 6.25 * h - 5 * a + 5
        : 10 * w + 6.25 * h - 5 * a - 161;
      return Math.round(bmr * (Number(activity) || 1.2));
    })();

    const cals = dates.map(d => {
      const entries = State.foodLog[d] || [];
      return entries.length ? entries.reduce((s, e) => s + (e.calories || 0), 0) : null;
    });

    const maxCal = Math.max(...cals.filter(c => c !== null), tdee || 1, 1);
    const container = $("week-bars");
    if (!container) return;

    const todayStr = today();
    container.innerHTML = dates.map((d, i) => {
      const cal   = cals[i];
      const noData = cal === null;
      const isFuture = d > todayStr;
      const over  = !noData && tdee && cal > tdee;
      const pct   = noData ? 0 : Math.round((cal / maxCal) * 100);
      const color = noData ? "#f2f2f7" : over ? "#E24B4A" : "#1D9E75";
      const border = noData ? "0.5px solid #c7c7cc" : "none";
      const lbl   = shortDay(d).charAt(0);
      const val   = noData ? "" : cal >= 1000 ? Math.round(cal / 100) / 10 + "k" : String(cal);

      return `<div class="week-bar-col" title="${fmtDate(d)}: ${noData ? "No data" : cal + " kcal"}">
        <div class="week-bar-val">${val}</div>
        <div class="week-bar-wrap">
          <div class="week-bar-inner" style="height:${pct}%;background:${color};border:${border}"></div>
        </div>
        <div class="week-bar-lbl">${lbl}</div>
      </div>`;
    }).join("");
  }

  // ── Training stamp calendar ──
  function renderStampCal() {
    const off    = State.ui.stampOff || 0;
    const refDay = offsetDate(today(), off * 7);
    const dates  = weekDates(refDay);

    $("stamp-prev").disabled = false;
    $("stamp-next").disabled = (off >= 0);

    const todayStr = today();
    const container = $("stamp-cal");
    if (!container) return;

    // Day labels row
    const dayLabels = ["Mo","Tu","We","Th","Fr","Sa","Su"];
    let html = `<div class="stamp-dlbl">` +
      dayLabels.map(l => `<span>${l}</span>`).join("") +
      `</div><div class="stamp-row">`;

    dates.forEach(d => {
      const sessions = State.training.filter(s => s.date === d);
      const dayNum   = new Date(d + "T00:00:00").getDate();
      const isFuture = d > todayStr;
      const isToday  = d === todayStr;

      let cellClass = "stamp-cell";
      if (!sessions.length) cellClass += " empty";
      if (isToday) cellClass += " today";
      if (isFuture) cellClass += " future";

      // Primary sport (first session)
      const primary = sessions[0];
      const bg      = primary ? SPORT_COL[primary.sport] || "#6B7A8D" : "";
      const abr     = primary ? SPORT_ABR[primary.sport] || "OTH"      : "";

      // Second sport dot
      const second = sessions[1];
      const dot2   = second
        ? `<div class="stamp-dot2" style="background:${SPORT_COL[second.sport] || "#6B7A8D"}"></div>`
        : "";

      html += `<div class="${cellClass}" style="${primary ? "background:" + bg : ""}">
        ${primary ? abr : dayNum}
        ${dot2}
      </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  // Toggle legend
  function toggleLegend() {
    const el = $("stamp-legend");
    if (!el) return;
    el.style.display = el.style.display === "none" ? "flex" : "none";
  }

  // Week nav handlers
  function chHStat(dir) {
    State.ui.hStatOff = (State.ui.hStatOff || 0) + dir;
    if (State.ui.hStatOff > 0) State.ui.hStatOff = 0;
    renderHStat();
  }

  function chWBar(dir) {
    State.ui.wBarOff = (State.ui.wBarOff || 0) + dir;
    if (State.ui.wBarOff > 0) State.ui.wBarOff = 0;
    renderWBar();
  }

  function chStamp(dir) {
    State.ui.stampOff = (State.ui.stampOff || 0) + dir;
    if (State.ui.stampOff > 0) State.ui.stampOff = 0;
    renderStampCal();
  }


  // ──────────────────────────────────────────
  //  PROGRESS PAGE
  // ──────────────────────────────────────────

  function renderProgress() {
    renderInsight();
    renderStreaks();
    renderGoalCard();
    renderMiniCharts();
  }

  // ── AI Insight strip ──
  function renderInsight() {
    const el = $("insight-text");
    if (!el) return;

    const t       = today();
    const eaten   = totalCalories(t);
    const lw      = latestWeight();
    const profile = State.profile;
    const sessions7 = State.training.filter(s => s.date >= offsetDate(t, -6));

    // Simple rule-based insights
    const insights = [];

    if (sessions7.length >= 3)
      insights.push("Great consistency — " + sessions7.length + " sessions in the last 7 days 💪");

    const tdee = calcTDEE();
    if (tdee && eaten > 0) {
      const diff = eaten - tdee;
      if (diff > 300)  insights.push("You're " + diff + " kcal over today. Consider a lighter dinner.");
      if (diff < -300) insights.push("You're well under your calorie goal today — great discipline!");
    }

    if (lw && profile.target_weight_kg) {
      const gap = Number(lw.weight_kg) - Number(profile.target_weight_kg);
      if (Math.abs(gap) < 0.5)
        insights.push("Almost there — only " + fmt(Math.abs(gap)) + " kg from your target weight!");
      else if (gap > 0)
        insights.push(fmt(gap) + " kg to go to reach your target weight. Keep going!");
    }

    if (!insights.length) {
      if (!lw) insights.push("Log your weight to start seeing progress insights.");
      else     insights.push("Keep logging daily to unlock personalised insights.");
    }

    el.textContent = insights[Math.floor(Math.random() * insights.length)];
  }

  // ── Streaks ──
  function renderStreaks() {
    const container = $("pg-streaks");
    if (!container) return;

    // Training streak = consecutive days with a session
    let trainStreak = 0, trainBest = 0, cur = 0;
    const sessionDates = new Set(State.training.map(s => s.date));
    const todayStr = today();
    for (let i = 0; i <= 365; i++) {
      const d = offsetDate(todayStr, -i);
      if (sessionDates.has(d)) { cur++; if (i === 0 || trainStreak > 0) trainStreak = cur; }
      else { trainBest = Math.max(trainBest, cur); cur = 0; if (i > 0 && trainStreak === 0) break; }
    }
    trainBest = Math.max(trainBest, cur, trainStreak);

    // Logging streak = consecutive days with any food logged
    let logStreak = 0, logBest = 0; cur = 0;
    for (let i = 0; i <= 365; i++) {
      const d = offsetDate(todayStr, -i);
      if ((State.foodLog[d] || []).length > 0) { cur++; if (i === 0 || logStreak > 0) logStreak = cur; }
      else { logBest = Math.max(logBest, cur); cur = 0; if (i > 0 && logStreak === 0) break; }
    }
    logBest = Math.max(logBest, cur, logStreak);

    container.innerHTML = `
      <div class="streak-pill">
        <div class="streak-num">${trainStreak}</div>
        <div class="streak-lbl">🏋️ Training streak</div>
        <div class="streak-best">Best: ${trainBest} days</div>
      </div>
      <div class="streak-pill">
        <div class="streak-num">${logStreak}</div>
        <div class="streak-lbl">📓 Logging streak</div>
        <div class="streak-best">Best: ${logBest} days</div>
      </div>`;
  }

  // ── Goal progress card ──
  function renderGoalCard() {
    const container = $("pg-goal");
    if (!container) return;

    const { target_weight_kg, target_weeks } = State.profile;
    const lw = latestWeight();

    if (!target_weight_kg || !lw) {
      container.innerHTML = "";
      return;
    }

    const start  = lw.weight_kg;
    const target = Number(target_weight_kg);
    const diff   = start - target;   // positive = needs to lose
    const pct    = diff === 0 ? 100 : Math.max(0, Math.min(100, ((start - lw.weight_kg) / diff + 1) * 100 / 2));
    const color  = diff > 0 ? "#E24B4A" : "#1D9E75";
    const label  = diff > 0 ? "to lose" : "to gain";
    const weeks  = Number(target_weeks) || 4;

    // Estimate weeks remaining
    // Weekly rate needed
    const rate = diff / weeks;

    container.innerHTML = `
      <div class="goal-card">
        <div class="ctitle">Weight goal</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <span style="font-size:15px;font-weight:500">${fmt(lw.weight_kg)} kg → ${fmt(target)} kg</span>
          <span style="font-size:12px;color:#6b6b6b">${fmt(Math.abs(diff))} kg ${label}</span>
        </div>
        <div class="goal-bar-trk">
          <div class="goal-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div style="font-size:11px;color:#a0a0a5">
          Target: ${weeks} week${weeks !== 1 ? "s" : ""} •
          ~${fmt(Math.abs(rate))} kg/wk needed
        </div>
      </div>`;
  }

  // ── Mini charts ──
  function renderMiniCharts() {
    const t      = today();
    const days30 = last30Days();

    // Body (weight) chart
    const wtData = days30.map(d => State.weightLog[d]?.weight_kg ?? null);
    sparkLine("mini-body-chart", wtData, "#1D9E75");
    const lw = latestWeight();
    $("pg-body-val").innerHTML = lw
      ? `${fmt(lw.weight_kg)} <span>kg</span>`
      : "—";
    $("pg-body-sub").textContent = lw ? "Latest reading" : "No data yet";

    // Calories chart
    const calData = days30.map(d => {
      const e = State.foodLog[d] || [];
      return e.length ? e.reduce((s, x) => s + x.calories, 0) : null;
    });
    sparkLine("mini-cal-chart", calData, "#E8A020");
    const weekCals = calData.slice(-7).filter(c => c !== null);
    const avgCal   = weekCals.length ? Math.round(weekCals.reduce((a, b) => a + b, 0) / weekCals.length) : null;
    $("pg-cal-val").innerHTML = avgCal !== null ? `${avgCal} <span>kcal</span>` : "—";

    // Training chart (sessions per week, last 4 weeks)
    const wkCounts = [3, 2, 1, 0].map(w => {
      const ref = offsetDate(t, -w * 7);
      return weekDates(ref).reduce((n, d) => n + State.training.filter(s => s.date === d).length, 0);
    });
    sparkLine("mini-train-chart", wkCounts, "#7B5EA7");
    const totalSess = State.training.filter(s => s.date >= offsetDate(t, -6)).length;
    $("pg-train-val").innerHTML = `${totalSess} <span>sess</span>`;
    $("pg-train-sub").textContent = "last 7 days";
  }


  // ──────────────────────────────────────────
  //  CHART OVERLAY
  // ──────────────────────────────────────────

  function openChartOverlay(type) {
    const overlay = $("chart-overlay");
    const body    = $("chart-overlay-body");
    const title   = $("chart-overlay-title");
    if (!overlay || !body) return;

    const t      = today();
    const days30 = last30Days();

    overlay.style.display = "flex";

    if (type === "body") {
      title.textContent = "Body";
      const wtData = days30.map(d => State.weightLog[d]?.weight_kg ?? null);
      const bfData = days30.map(d => State.weightLog[d]?.body_fat_pct ?? null);
      const lw = latestWeight();
      const prevLw = (() => {
        const dates = Object.keys(State.weightLog).sort().reverse();
        return dates.length > 1 ? State.weightLog[dates[1]] : null;
      })();
      const delta = lw && prevLw ? (lw.weight_kg - prevLw.weight_kg) : null;

      body.innerHTML = `
        <div class="ov-stat-grid">
          <div class="ov-stat">
            <div class="ov-stat-lbl">Latest weight</div>
            <div class="ov-stat-val">${lw ? fmt(lw.weight_kg) : "—"}<span> kg</span></div>
            <div class="ov-stat-delta" style="color:${delta !== null ? (delta < 0 ? "#1D9E75" : "#E24B4A") : "#a0a0a5"}">
              ${delta !== null ? (delta < 0 ? "▼" : "▲") + " " + fmt(Math.abs(delta)) + " kg" : "—"}
            </div>
          </div>
          <div class="ov-stat">
            <div class="ov-stat-lbl">Body fat</div>
            <div class="ov-stat-val">${lw?.body_fat_pct ? fmt(lw.body_fat_pct) : "—"}<span> %</span></div>
            <div class="ov-stat-delta" style="color:#a0a0a5">latest reading</div>
          </div>
        </div>
        <div class="ov-chart-wrap">
          <div class="ov-chart-title">Weight — last 30 days</div>
          <canvas id="ov-wt-chart" style="height:160px;width:100%"></canvas>
          <div class="ov-chart-title" style="margin-top:1rem">Body fat — last 30 days</div>
          <canvas id="ov-bf-chart" style="height:120px;width:100%"></canvas>
        </div>`;

      // Defer so canvas is in DOM
      requestAnimationFrame(() => {
        _bigLine("ov-wt-chart", days30, wtData, "#1D9E75", "kg");
        _bigLine("ov-bf-chart", days30, bfData, "#E8A020", "%");
      });

    } else if (type === "cals") {
      title.textContent = "Calories";
      const calData = days30.map(d => {
        const e = State.foodLog[d] || [];
        return e.length ? e.reduce((s, x) => s + x.calories, 0) : null;
      });
      const tdee = calcTDEE();
      const avg  = (() => {
        const v = calData.filter(c => c !== null);
        return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
      })();

      body.innerHTML = `
        <div class="ov-stat-grid">
          <div class="ov-stat">
            <div class="ov-stat-lbl">Avg daily (30d)</div>
            <div class="ov-stat-val">${avg ?? "—"}<span> kcal</span></div>
          </div>
          <div class="ov-stat">
            <div class="ov-stat-lbl">Daily target</div>
            <div class="ov-stat-val">${tdee ?? "—"}<span> kcal</span></div>
          </div>
        </div>
        <div class="ov-chart-wrap">
          <div class="ov-chart-title">Calories eaten — last 30 days</div>
          <canvas id="ov-cal-chart" style="height:180px;width:100%"></canvas>
          <div class="ov-legend">
            <div class="ov-legend-item"><div class="ov-legend-dot" style="background:#1D9E75"></div>Under</div>
            <div class="ov-legend-item"><div class="ov-legend-dot" style="background:#E24B4A"></div>Over</div>
          </div>
        </div>`;

      requestAnimationFrame(() => {
        _calBarChart("ov-cal-chart", days30, calData, tdee);
      });

    } else if (type === "training") {
      title.textContent = "Training";
      // Last 8 weeks
      const weeks = Array.from({ length: 8 }, (_, i) => {
        const ref  = offsetDate(t, -(7 - i) * 7);
        const dts  = weekDates(ref);
        const sess = dts.reduce((n, d) => n + State.training.filter(s => s.date === d).length, 0);
        const label = new Date(dts[0] + "T00:00:00")
          .toLocaleDateString("en-GB", { month: "short", day: "numeric" });
        return { label, sess };
      });

      // Sport breakdown
      const sportCount = {};
      State.training.forEach(s => { sportCount[s.sport] = (sportCount[s.sport] || 0) + 1; });
      const topSport = Object.entries(sportCount).sort((a, b) => b[1] - a[1])[0];

      body.innerHTML = `
        <div class="ov-stat-grid">
          <div class="ov-stat">
            <div class="ov-stat-lbl">Total sessions</div>
            <div class="ov-stat-val">${State.training.length}</div>
          </div>
          <div class="ov-stat">
            <div class="ov-stat-lbl">Most frequent</div>
            <div class="ov-stat-val" style="font-size:16px">${topSport ? topSport[0] : "—"}</div>
            <div class="ov-stat-delta" style="color:#a0a0a5">${topSport ? topSport[1] + " sessions" : ""}</div>
          </div>
        </div>
        <div class="ov-chart-wrap">
          <div class="ov-chart-title">Sessions per week — last 8 weeks</div>
          <canvas id="ov-train-chart" style="height:180px;width:100%"></canvas>
        </div>`;

      requestAnimationFrame(() => {
        destroyChart("ov-train-chart");
        const canvas = $("ov-train-chart");
        if (!canvas) return;
        _charts["ov-train-chart"] = new Chart(canvas, {
          type: "bar",
          data: {
            labels: weeks.map(w => w.label),
            datasets: [{
              data: weeks.map(w => w.sess),
              backgroundColor: "#7B5EA7",
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
              y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } }
            }
          }
        });
      });
    }
  }

  function closeChartOverlay() {
    const overlay = $("chart-overlay");
    if (overlay) overlay.style.display = "none";
    // Clean up overlay charts
    ["ov-wt-chart","ov-bf-chart","ov-cal-chart","ov-train-chart"].forEach(destroyChart);
    $("chart-overlay-body").innerHTML = "";
  }

  function _bigLine(canvasId, labels30, data, color, unit) {
    destroyChart(canvasId);
    const canvas = $(canvasId);
    if (!canvas) return;
    const shortLabels = labels30.map(d =>
      new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    );
    _charts[canvasId] = new Chart(canvas, {
      type: "line",
      data: {
        labels: shortLabels,
        datasets: [{
          data,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: true,
          backgroundColor: color + "18",
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ctx.parsed.y !== null ? ctx.parsed.y + " " + unit : "No data" }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 } } },
          y: { grid: { color: "#f2f2f7" }, ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  function _calBarChart(canvasId, labels30, data, tdee) {
    destroyChart(canvasId);
    const canvas = $(canvasId);
    if (!canvas) return;
    const shortLabels = labels30.map(d =>
      new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    );
    const colors = data.map(c => c === null ? "#f2f2f7" : (tdee && c > tdee ? "#E24B4A" : "#1D9E75"));
    _charts[canvasId] = new Chart(canvas, {
      type: "bar",
      data: {
        labels: shortLabels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderRadius: 3,
            spanGaps: true
          },
          // TDEE target line
          ...(tdee ? [{
            type: "line",
            data: Array(30).fill(tdee),
            borderColor: "#1a1a1a",
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 0,
            fill: false
          }] : [])
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: "#f2f2f7" }, ticks: { font: { size: 10 } } }
        }
      }
    });
  }


  // ──────────────────────────────────────────
  //  TRAINING PAGE
  // ──────────────────────────────────────────

  function renderTraining() {
    renderSessDate();
    renderExerciseDropdown();
    renderHistory();
  }

  function renderSessDate() {
    if (!State.ui.sessDate) State.ui.sessDate = today();
    const d   = State.ui.sessDate;
    const lbl = d === today() ? "Today" : fmtDate(d);
    const el  = $("sdlbl");
    if (el) el.textContent = lbl;
    $("sn") && ($("sn").disabled = d >= today());
    $("sp") && ($("sp").disabled = false);
  }

  function chSess(dir) {
    if (!State.ui.sessDate) State.ui.sessDate = today();
    const d   = new Date(State.ui.sessDate + "T00:00:00");
    d.setDate(d.getDate() + dir);
    const nd  = _toDateStr(d);
    if (nd > today()) return;
    State.ui.sessDate = nd;
    renderSessDate();
    renderLastRef();
  }

  function selSport(sport, btn) {
    State.ui.sport = sport;
    // Toggle pill
    document.querySelectorAll("#sport-pills .spill").forEach(b => b.classList.remove("on"));
    btn.classList.add("on");

    const gymEl    = $("sp-gym");
    const cardioEl = $("sp-cardio");
    if (sport === "gym") {
      if (gymEl) gymEl.style.display = "";
      if (cardioEl) cardioEl.style.display = "none";
    } else {
      if (gymEl) gymEl.style.display = "none";
      if (cardioEl) cardioEl.style.display = "";
      renderCardioFields(sport);
      renderLastRef();
    }
  }

  function renderCardioFields(sport) {
    const wrap = $("cfields");
    if (!wrap) return;
    const fields = {
      run:   [{ id: "cd-dur",  label: "Duration (min)",   type: "number" },
              { id: "cd-dist", label: "Distance (km)",     type: "number", step: "0.01" },
              { id: "cd-note", label: "Notes",             type: "text"   }],
      swim:  [{ id: "cd-dur",  label: "Duration (min)",   type: "number" },
              { id: "cd-laps", label: "Laps",              type: "number" },
              { id: "cd-note", label: "Notes",             type: "text"   }],
      cycle: [{ id: "cd-dur",  label: "Duration (min)",   type: "number" },
              { id: "cd-dist", label: "Distance (km)",     type: "number", step: "0.01" },
              { id: "cd-note", label: "Notes",             type: "text"   }],
      walk:  [{ id: "cd-dur",  label: "Duration (min)",   type: "number" },
              { id: "cd-dist", label: "Distance (km)",     type: "number", step: "0.01" },
              { id: "cd-note", label: "Notes",             type: "text"   }],
      other: [{ id: "cd-dur",  label: "Duration (min)",   type: "number" },
              { id: "cd-note", label: "Notes",             type: "text"   }]
    };
    const defs = fields[sport] || fields.other;
    wrap.innerHTML = defs.map(f =>
      `<div class="field">
        <label>${f.label}</label>
        <input type="${f.type}" id="${f.id}" ${f.step ? 'step="' + f.step + '"' : ""} min="0">
      </div>`
    ).join("");
  }

  function renderLastRef() {
    const sport = State.ui.sport;
    if (!sport || sport === "gym") return;
    const prev = getSessions(sport)[0];
    const wrap = $("lcref");
    const txt  = $("lcreftxt");
    if (!wrap || !txt || !prev) { if (wrap) wrap.style.display = "none"; return; }
    wrap.style.display = "";
    let details = fmtDate(prev.date);
    if (prev.duration_min) details += " · " + prev.duration_min + " min";
    if (prev.distance)     details += " · " + prev.distance + " km";
    if (prev.laps)         details += " · " + prev.laps + " laps";
    txt.textContent = details;
  }

  function renderExerciseDropdown() {
    const dd = $("exdd");
    if (!dd) return;
    const lib = [...new Set([...DEFAULT_EXERCISES, ...State.exerciseLib])].sort();
    dd.innerHTML = lib.map(ex => `<option value="${ex}">${ex}</option>`).join("") +
      `<option value="__custom__">+ Custom exercise…</option>`;
  }

  function onExDd() {
    const dd   = $("exdd");
    const wrap = $("cxwrap");
    if (!dd || !wrap) return;
    wrap.style.display = dd.value === "__custom__" ? "" : "none";
  }

  // ── Add exercise card ──
  function addExCard() {
    const dd    = $("exdd");
    const cxin  = $("cxname");
    let name    = dd?.value === "__custom__" ? (cxin?.value?.trim() || "") : (dd?.value || "");
    if (!name) return;

    const container = $("excards");
    if (!container) return;

    const cardId = "exc-" + Math.random().toString(36).slice(2, 6);
    const card   = document.createElement("div");
    card.className = "excard";
    card.id        = cardId;

    // Look up previous performance
    const prevSess = State.training.filter(s => s.sport === "gym" && s.exercises?.some(e => e.name === name));
    const prevSets = prevSess.length ? prevSess[prevSess.length - 1].exercises.find(e => e.name === name)?.sets || [] : [];
    const prevRef  = prevSets.length
      ? prevSets.map((s, i) => `Set ${i + 1}: ${s.kg ?? "—"} kg × ${s.reps ?? "—"}`).join("  |  ")
      : null;

    card.innerHTML = `
      <div class="exhdr">
        <span class="exname">${name}</span>
        <button class="exdel" onclick="document.getElementById('${cardId}').remove()">✕</button>
      </div>
      ${prevRef ? `<div class="prevref"><div class="prevlbl">Last time</div><div class="prevtxt">${prevRef}</div></div>` : ""}
      <div id="${cardId}-sets"></div>
      <button class="addset" onclick="addSet('${cardId}','${name}')">+ Add set</button>`;

    container.appendChild(card);
    addSet(cardId, name);   // start with one empty set

    // Learn exercise name
    if (!State.exerciseLib.includes(name)) {
      State.exerciseLib.push(name);
      saveLocal();
    }
    // Reset dropdown
    if (dd) dd.value = dd.options[0]?.value || "";
    if (cxin) cxin.value = "";
    if ($("cxwrap")) $("cxwrap").style.display = "none";
  }

  function addSet(cardId, exerciseName) {
    const setsDiv = $(cardId + "-sets");
    if (!setsDiv) return;
    const setNum = setsDiv.children.length + 1;
    const sid    = cardId + "-s" + setNum;
    const row    = document.createElement("div");
    row.className = "setrow";
    row.innerHTML = `
      <span class="setnum">${setNum}</span>
      <input class="setval" type="number" id="${sid}-kg"   placeholder="kg"   min="0" step="0.5">
      <input class="setval" type="number" id="${sid}-reps" placeholder="reps" min="0">
      <button class="setdel" onclick="this.parentElement.remove();_renumSets('${cardId}')">✕</button>`;
    setsDiv.appendChild(row);
  }

  function _renumSets(cardId) {
    const setsDiv = $(cardId + "-sets");
    if (!setsDiv) return;
    Array.from(setsDiv.children).forEach((row, i) => {
      const numEl = row.querySelector(".setnum");
      if (numEl) numEl.textContent = i + 1;
    });
  }

  // ── Save gym session ──
  function saveGym() {
    const date      = State.ui.sessDate || today();
    const calInput  = $("gym-cal");
    const calories  = calInput?.value ? Number(calInput.value) : null;
    const exercises = [];

    document.querySelectorAll(".excard").forEach(card => {
      const name    = card.querySelector(".exname")?.textContent || "";
      const setRows = card.querySelectorAll(".setrow");
      const sets    = [];
      setRows.forEach(row => {
        const kg   = Number(row.querySelector("[placeholder='kg']")?.value);
        const reps = Number(row.querySelector("[placeholder='reps']")?.value);
        if (kg || reps) sets.push({ kg: kg || 0, reps: reps || 0 });
      });
      if (name && sets.length) exercises.push({ name, sets });
    });

    if (!exercises.length) {
      alert("Add at least one exercise with a set before saving.");
      return;
    }

    addSession({ date, sport: "gym", calories, exercises });
    $("excards").innerHTML = "";
    if (calInput) calInput.value = "";
    renderHistory();
    renderHome();
    alert("Gym session saved! 💪");
  }

  // ── Save cardio session ──
  function saveCardio() {
    const sport    = State.ui.sport;
    const date     = State.ui.sessDate || today();
    const dur      = Number($("cd-dur")?.value) || 0;
    const dist     = $("cd-dist")?.value ? Number($("cd-dist").value) : null;
    const laps     = $("cd-laps")?.value ? Number($("cd-laps").value) : null;
    const notes    = $("cd-note")?.value || "";
    const calories = $("cardio-cal")?.value ? Number($("cardio-cal").value) : null;

    if (!dur) { alert("Enter a duration to save this session."); return; }

    addSession({
      date, sport, duration_min: dur,
      distance: dist, distance_unit: dist ? "km" : null,
      laps, notes, calories
    });

    // Clear fields
    ["cd-dur","cd-dist","cd-laps","cd-note","cardio-cal"].forEach(id => {
      const el = $(id); if (el) el.value = "";
    });

    renderHistory();
    renderHome();
    alert("Session saved! 🎉");
  }

  // ── Session history ──
  function filtHist(filter, btn) {
    State.ui.histFilter = filter;
    document.querySelectorAll("#hist-pills .spill").forEach(b => b.classList.remove("on"));
    if (btn) btn.classList.add("on");
    renderHistory();
  }

  function renderHistory() {
    const container = $("hist");
    if (!container) return;
    const filter   = State.ui.histFilter || "all";
    const sessions = getSessions(filter);

    if (!sessions.length) {
      container.innerHTML = `<div class="empty">No sessions yet${filter !== "all" ? " for " + filter : ""}.</div>`;
      return;
    }

    container.innerHTML = sessions.map(s => {
      const color = SPORT_COL[s.sport] || "#6B7A8D";
      let details = "";
      if (s.duration_min) details += s.duration_min + " min";
      if (s.distance)     details += (details ? " · " : "") + s.distance + " km";
      if (s.laps)         details += (details ? " · " : "") + s.laps + " laps";
      if (s.calories)     details += (details ? " · " : "") + s.calories + " kcal";
      if (s.sport === "gym" && s.exercises?.length)
        details += (details ? " · " : "") + s.exercises.length + " exercise" + (s.exercises.length !== 1 ? "s" : "");

      return `<div class="psess">
        <div class="psess-hdr">
          <span class="psess-date">${fmtDate(s.date)}</span>
          <span class="badge" style="background:${color}22;color:${color}">${s.sport}</span>
        </div>
        <div class="psess-prev">${details || "No details"}</div>
        ${s.exercises?.length ? `<div style="margin-top:6px">` +
          s.exercises.map(ex =>
            `<div style="font-size:12px;color:#6b6b6b;margin-top:2px">
              ${ex.name}: ${ex.sets.map((set, i) => `${i + 1}. ${set.kg ?? "—"}kg×${set.reps ?? "—"}`).join("  ")}
            </div>`).join("") + `</div>` : ""}
        <button onclick="delSession('${s.id}')" style="margin-top:8px;font-size:11px;color:#E24B4A;background:none;border:none;cursor:pointer;padding:0">Delete</button>
      </div>`;
    }).join("");
  }

  function delSession(id) {
    if (!confirm("Delete this session?")) return;
    deleteSession(id);
    if (typeof syncDeleteSession === "function") syncDeleteSession(id);
    renderHistory();
    renderHome();
  }

  // ── Training page tab switcher ──
  function swTrain(tab) {
    const logEl  = $("tr-log");
    const histEl = $("tr-history");
    const btns   = document.querySelectorAll("#train-tabs button");
    if (tab === "log") {
      if (logEl) logEl.style.display = "";
      if (histEl) histEl.style.display = "none";
      btns[0]?.classList.add("on");
      btns[1]?.classList.remove("on");
    } else {
      if (logEl) logEl.style.display = "none";
      if (histEl) histEl.style.display = "";
      btns[0]?.classList.remove("on");
      btns[1]?.classList.add("on");
      renderHistory();
    }
  }


  // ──────────────────────────────────────────
  //  LOG MODAL (food + weight)
  // ──────────────────────────────────────────

  function openLogModal() {
    if (!State.ui.logDate) State.ui.logDate = today();
    $("log-modal").style.display = "flex";
    swLogTab("food");
    renderLogDate();
    lucide?.createIcons?.();
  }

  function closeLogModal() {
    $("log-modal").style.display = "none";
  }

  function swLogTab(tab) {
    $("lm-food").style.display   = tab === "food"   ? "" : "none";
    $("lm-weight").style.display = tab === "weight" ? "" : "none";
    $("ltab-food").className   = "modal-tab" + (tab === "food"   ? " on" : "");
    $("ltab-weight").className = "modal-tab" + (tab === "weight" ? " on" : "");
    renderLogDate();
  }

  function renderLogDate() {
    const d   = State.ui.logDate || today();
    const lbl = d === today() ? "Today" : fmtDate(d);
    if ($("lm-dlbl"))  $("lm-dlbl").textContent  = lbl;
    if ($("lm-wdlbl")) $("lm-wdlbl").textContent = lbl;
    $("lm-dnext")  && ($("lm-dnext").disabled  = d >= today());
    $("lm-wdnext") && ($("lm-wdnext").disabled = d >= today());
    renderFoodList();
    renderWeightForm();
  }

  function chLogDate(dir) {
    const d = new Date((State.ui.logDate || today()) + "T00:00:00");
    d.setDate(d.getDate() + dir);
    const nd = _toDateStr(d);
    if (nd > today()) return;
    State.ui.logDate = nd;
    renderLogDate();
  }

  // ── Food list ──
  function renderFoodList() {
    const d   = State.ui.logDate || today();
    const el  = $("lm-food-list");
    if (!el) return;
    const entries = getFoodLog(d);
    if (!entries.length) {
      el.innerHTML = `<div class="empty">Nothing logged yet</div>`;
    } else {
      const total = entries.reduce((s, e) => s + e.calories, 0);
      el.innerHTML = entries.map(e =>
        `<div class="lentry">
          <span class="lname">${e.food_name}</span>
          <div class="lright">
            <span style="font-size:13px;color:#6b6b6b">${e.calories} kcal</span>
            <button class="ldel" onclick="delFood('${d}','${e.id}')">✕</button>
          </div>
        </div>`
      ).join("") +
      `<div style="padding:8px 0;font-size:13px;font-weight:500;color:#1a1a1a;border-top:0.5px solid #e0e0e5;margin-top:4px">
        Total: ${total} kcal
      </div>`;
    }
    // Refresh home calorie bar
    renderCalBar();
  }

  function addFood() {
    const nameEl = $("lm-fn");
    const calEl  = $("lm-fc");
    const name   = nameEl?.value?.trim();
    const cal    = Number(calEl?.value);
    if (!name || !cal || cal <= 0) { alert("Enter a food name and calories."); return; }
    const d = State.ui.logDate || today();
    addFoodEntry(d, { food_name: name, calories: cal });
    if (nameEl) nameEl.value = "";
    if (calEl)  calEl.value  = "";
    renderFoodList();
  }

  function delFood(date, id) {
    deleteFoodEntry(date, id);
    if (typeof syncDeleteFood === "function") syncDeleteFood(id);
    renderFoodList();
  }

  // ── Weight form ──
  function renderWeightForm() {
    const d   = State.ui.logDate || today();
    const ent = getWeightEntry(d);
    const listEl = $("lm-weight-list");

    if (listEl) {
      if (ent) {
        listEl.innerHTML = `<div class="lentry">
          <span class="lname">Weight logged</span>
          <div class="lright">
            <span style="font-size:13px;color:#6b6b6b">
              ${ent.weight_kg !== null ? ent.weight_kg + " kg" : ""}
              ${ent.body_fat_pct !== null && ent.body_fat_pct !== undefined ? " · " + ent.body_fat_pct + " %" : ""}
            </span>
          </div>
        </div>`;
      } else {
        listEl.innerHTML = `<div class="empty">No weight logged for this day</div>`;
      }
    }

    // Pre-fill inputs if entry exists
    const wwEl  = $("lm-ww");
    const wbfEl = $("lm-wbf");
    if (wwEl)  wwEl.value  = ent?.weight_kg  ?? "";
    if (wbfEl) wbfEl.value = ent?.body_fat_pct ?? "";
  }

  function addWeight() {
    const wwEl  = $("lm-ww");
    const wbfEl = $("lm-wbf");
    const wt    = wwEl?.value  ? Number(wwEl.value)  : null;
    const bf    = wbfEl?.value ? Number(wbfEl.value) : null;
    if (wt === null && bf === null) { alert("Enter a weight or body fat %."); return; }
    const d = State.ui.logDate || today();
    setWeightEntry(d, wt, bf);
    renderWeightForm();
    renderHome();
    renderProgress();
  }


  // ──────────────────────────────────────────
  //  PROFILE PAGE
  // ──────────────────────────────────────────

  function renderProfile() {
    const p = State.profile;
    if (p.age)              $("age").value    = p.age;
    if (p.gender)           $("gender").value = p.gender;
    if (p.height_cm)        $("ht").value     = p.height_cm;
    if (p.weight_kg)        $("wt").value     = p.weight_kg;
    if (p.target_weight_kg) $("tgw").value    = p.target_weight_kg;
    if (p.target_weeks)     $("tgwk").value   = p.target_weeks;
    if (p.activity)         $("act").value    = p.activity;
    if (p.body_fat_pct)     $("bfin").value   = p.body_fat_pct;
    calc();
  }

  /**
   * calc()  —  live BMI / BMR / TDEE calculation driven by DOM inputs.
   * Called via oninput/onchange in index.html.
   */
  function calc() {
    const age    = Number($("age")?.value);
    const gender = $("gender")?.value;
    const ht     = Number($("ht")?.value);
    const wt     = Number($("wt")?.value);
    const act    = Number($("act")?.value) || 1.2;
    const bfIn   = Number($("bfin")?.value);
    const tgw    = Number($("tgw")?.value);
    const tgwk   = Number($("tgwk")?.value) || 4;

    if (!age || !ht || !wt) return;

    // BMI
    const bmi = Math.round((wt / ((ht / 100) ** 2)) * 10) / 10;
    $("bmi-v") && ($("bmi-v").textContent = bmi);

    const bmiCat = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
    $("bmi-c") && ($("bmi-c").textContent = bmiCat);

    // BMI needle (0%=15, 100%=40 BMI range)
    const pct = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));
    $("bmi-ndl") && ($("bmi-ndl").style.left = pct + "%");

    // BMR
    let bmr;
    if (gender === "male") bmr = Math.round(10 * wt + 6.25 * ht - 5 * age + 5);
    else                   bmr = Math.round(10 * wt + 6.25 * ht - 5 * age - 161);
    $("bmr-v") && ($("bmr-v").innerHTML = bmr + `<span class="sunit">kcal</span>`);

    // TDEE
    const tdee = Math.round(bmr * act);
    $("tdee-v") && ($("tdee-v").innerHTML = tdee + `<span class="sunit">kcal</span>`);

    // Goal
    let goalText = "Maintain weight";
    if (tgw && tgw !== wt) {
      const diff = tgw - wt;
      const totalKcal = diff * 7700;               // ~7700 kcal per kg
      const dailyAdj  = Math.round(totalKcal / (tgwk * 7));
      const targetCal = tdee + dailyAdj;
      goalText = (diff > 0 ? "Gain" : "Lose") + " — eat ~" + targetCal + " kcal/day";
    }
    $("goal-v") && ($("goal-v").textContent = goalText);

    // Body fat estimate (Navy / BMI method if no smart scale)
    if (bfIn) {
      $("bfout-v") && ($("bfout-v").innerHTML = bfIn + `<span class="sunit">%</span>`);
      $("bfsrc-v") && ($("bfsrc-v").textContent = "from smart scale");
    } else {
      // Rough estimate from BMI
      const estBf = gender === "male"
        ? Math.round((1.2 * bmi + 0.23 * age - 16.2) * 10) / 10
        : Math.round((1.2 * bmi + 0.23 * age - 5.4)  * 10) / 10;
      $("bfout-v") && ($("bfout-v").innerHTML = estBf + `<span class="sunit">%</span>`);
      $("bfsrc-v") && ($("bfsrc-v").textContent = "estimated from BMI");
    }
  }

  function doSaveProfile() {
    const fields = {
      age:              Number($("age")?.value)    || null,
      gender:           $("gender")?.value         || null,
      height_cm:        Number($("ht")?.value)     || null,
      weight_kg:        Number($("wt")?.value)     || null,
      activity:         $("act")?.value            || null,
      body_fat_pct:     $("bfin")?.value ? Number($("bfin").value) : null,
      target_weight_kg: $("tgw")?.value  ? Number($("tgw").value)  : null,
      target_weeks:     $("tgwk")?.value || null
    };
    saveProfile(fields);
    _showToast("✓ Profile saved!");
    renderCalBar();
  }

  /**
   * _showToast(msg, durationMs)
   * Floating pill toast — fixed at bottom of screen, always visible.
   */
  function _showToast(msg, durationMs = 2500) {
    let toast = $("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      document.body.appendChild(toast);
    }
    Object.assign(toast.style, {
      position:      "fixed",
      bottom:        "90px",
      left:          "50%",
      transform:     "translateX(-50%)",
      background:    "#1a1a1a",
      color:         "#fff",
      padding:       "12px 24px",
      borderRadius:  "24px",
      fontSize:      "14px",
      fontWeight:    "500",
      zIndex:        "9999",
      opacity:       "1",
      transition:    "opacity 0.4s ease",
      pointerEvents: "none",
      whiteSpace:    "nowrap",
      boxShadow:     "0 4px 16px rgba(0,0,0,0.25)",
      display:       "block"
    });
    toast.textContent = msg;
    if (toast._hideTimer) clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => { toast.style.display = "none"; toast.style.opacity = "1"; }, 400);
    }, durationMs);
  }


  // ──────────────────────────────────────────
  //  DRAWER
  // ──────────────────────────────────────────

  function renderDrawer() {
    const name  = State.user.name  || "—";
    const email = State.user.email || "—";
    const avEl  = $("drawer-avatar");
    if (avEl) avEl.textContent = name.charAt(0).toUpperCase();
    $("drawer-name")  && ($("drawer-name").textContent  = name);
    $("drawer-email") && ($("drawer-email").textContent = email);
  }

  function openDrawer() {
    $("drawer")?.classList.add("on");
    $("drawer-overlay")?.classList.add("on");
    updateSyncBadge?.();
  }

  function closeDrawer() {
    $("drawer")?.classList.remove("on");
    $("drawer-overlay")?.classList.remove("on");
  }


  // ──────────────────────────────────────────
  //  PAGE NAVIGATION
  // ──────────────────────────────────────────

  function goPage(name) {
    // Hide all pages
    document.querySelectorAll(".pg").forEach(el => el.classList.remove("on"));
    // Show target
    const pg = $("pg-" + name);
    if (pg) pg.classList.add("on");

    // Nav button states
    ["home","progress","training"].forEach(p => {
      $("snav-" + p)?.classList.remove("on");
    });
    $("snav-" + name)?.classList.add("on");

    // FAB visibility — hide on profile, show elsewhere
    const fab = $("fab-log");
    if (fab) fab.classList.toggle("hidden", name === "profile");

    // Render the page
    if (name === "home")     renderHome();
    if (name === "progress") renderProgress();
    if (name === "training") renderTraining();
    if (name === "profile")  renderProfile();
  }


  // ──────────────────────────────────────────
  //  PUBLIC SURFACE
  // ──────────────────────────────────────────

  return {
    goPage,

    // ── Drawer ──
    openDrawer,
    closeDrawer,

    // ── Chart overlay ──
    openChartOverlay,
    closeChartOverlay,

    // ── Training page ──
    swTrain,
    chSess,
    selSport,
    onExDd,
    addExCard,
    addSet,
    _renumSets,
    saveGym,
    saveCardio,
    filtHist,
    delSession,

    // ── Log modal (food + weight) ──
    openLogModal,
    closeLogModal,
    swLogTab,
    chLogDate,
    addFood,
    delFood,
    addWeight,

    // ── Profile ──
    calc,
    doSaveProfile,

    init() {
      if (!State.ui.logDate)  State.ui.logDate  = today();
      if (!State.ui.sessDate) State.ui.sessDate = today();
      if (!State.ui.sport)    State.ui.sport    = "gym";

      renderDrawer();
      goPage("home");

      lucide?.createIcons?.();
    },

    /**
     * refresh()
     * Re-renders whatever page is currently visible.
     * Call after loading from cloud or making any state change.
     */
    refresh() {
      renderDrawer();
      // Find which page is active
      const active = document.querySelector(".pg.on");
      if (!active) return;
      const id = active.id.replace("pg-", "");
      if (id === "home")     { renderHome();     lucide?.createIcons?.(); }
      if (id === "progress") { renderProgress(); lucide?.createIcons?.(); }
      if (id === "training") { renderTraining(); lucide?.createIcons?.(); }
      if (id === "profile")  { renderProfile();  lucide?.createIcons?.(); }
    }
  };

})();


// ──────────────────────────────────────────
//  GLOBALS EXPECTED BY index.html
//  (inline onclick= handlers call these)
// ──────────────────────────────────────────
function goPage(name)          { UI.goPage(name); }
function openDrawer()          { UI.openDrawer?.() ?? (document.getElementById("drawer")?.classList.add("on"), document.getElementById("drawer-overlay")?.classList.add("on")); }
function closeDrawer()         { document.getElementById("drawer")?.classList.remove("on"); document.getElementById("drawer-overlay")?.classList.remove("on"); }
function toggleLegend()        { const el = document.getElementById("stamp-legend"); if(el) el.style.display = el.style.display === "none" ? "flex" : "none"; }
function chHStat(dir)          { State.ui.hStatOff = (State.ui.hStatOff || 0) + dir; if(State.ui.hStatOff > 0) State.ui.hStatOff = 0; UI.refresh(); }
function chWBar(dir)           { State.ui.wBarOff  = (State.ui.wBarOff  || 0) + dir; if(State.ui.wBarOff  > 0) State.ui.wBarOff  = 0; UI.refresh(); }
function chStamp(dir)          { State.ui.stampOff = (State.ui.stampOff || 0) + dir; if(State.ui.stampOff > 0) State.ui.stampOff = 0; UI.refresh(); }
function openChartOverlay(t)   { UI.openChartOverlay(t); }
function closeChartOverlay()   { UI.closeChartOverlay(); }
function swTrain(tab)          { UI.swTrain(tab); }
function chSess(dir)           { UI.chSess(dir); }
function selSport(sport, btn)  { UI.selSport(sport, btn); }
function onExDd()              { UI.onExDd(); }
function addExCard()           { UI.addExCard(); }
function addSet(cId, name)     { UI.addSet(cId, name); }
function _renumSets(cId)       { UI._renumSets(cId); }
function saveGym()             { UI.saveGym(); }
function saveCardio()          { UI.saveCardio(); }
function filtHist(f, btn)      { UI.filtHist(f, btn); }
function delSession(id)        { UI.delSession(id); }
function openLogModal()        { UI.openLogModal(); }
function closeLogModal()       { UI.closeLogModal(); }
function swLogTab(tab)         { UI.swLogTab(tab); }
function chLogDate(dir)        { UI.chLogDate(dir); }
function addFood()             { UI.addFood(); }
function delFood(d, id)        { UI.delFood(d, id); }
function addWeight()           { UI.addWeight(); }
function calc()                { UI.calc(); }
function saveProfile()         { UI.doSaveProfile(); }

console.log("[UI] ui.js loaded ✓");
