/* ═══════════════════════════════════════
   UTILITIES & HELPERS
═══════════════════════════════════════ */

const Utils = {
  // ─── Date Formatting ────────────────────────────────────────

  // Get current date strictly formatted as YYYY-MM-DD
  today() {
    const d = new Date();
    // Adjust for timezone offset so 'today' doesn't drift at midnight
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  },

  // Parse YYYY-MM-DD to a standard Date object
  parseDate(dateStr) {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-');
    return new Date(y, m - 1, d);
  },

  // Format Date for UI (e.g., "Mon, 1 Jan")
  formatDisplayDate(dateStr) {
    const d = this.parseDate(dateStr);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  },

  // Get Monday of the current week for any given date
  getWeekStart(dateStr) {
    const d = this.parseDate(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const mon = new Date(d.setDate(diff));
    mon.setMinutes(mon.getMinutes() - mon.getTimezoneOffset());
    return mon.toISOString().split('T')[0];
  },

  // Generate an array of 7 date strings (YYYY-MM-DD) for weekly views
  getWeekDays(startDateStr) {
    const start = this.parseDate(startDateStr);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  },

  // ─── UI & Text Helpers ──────────────────────────────────────

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  round(num, decimals = 1) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },

  // Standardize how we show success/error messages
  toast(msg, isError = false) {
    console.log(`[Toast ${isError ? 'ERROR' : 'INFO'}] ${msg}`);
    // If you have a toast element in your HTML, you can trigger it here.
    // For now, an alert acts as a fallback so we don't fail silently.
    const t = document.querySelector('.toast');
    if (t) {
      t.textContent = msg;
      t.style.color = isError ? '#E24B4A' : '#1D9E75';
      t.style.display = 'block';
      setTimeout(() => t.style.display = 'none', 3000);
    } else if (isError) {
      alert(msg);
    }
  }
};
