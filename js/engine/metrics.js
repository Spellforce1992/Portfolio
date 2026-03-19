/** engine/metrics.js — Control performance metrics */
const Metrics = {
  /**
   * Compute standard performance metrics from a time-series response
   * @param {number[]} t     - time array
   * @param {number[]} y     - output array (e.g. angle)
   * @param {number}   ref   - reference / setpoint
   * @param {number}   band  - settling band (fraction, default 0.02 = 2%)
   * @returns {object} metrics
   */
  compute(t, y, ref, band = 0.02) {
    if (!t.length || !y.length) return { ts: null, sse: null, os: null, tr: null, iae: null };

    const n = t.length;
    const tol = Math.max(Math.abs(ref) * band, 0.01); // absolute tolerance
    const e0 = Math.abs(y[0] - ref); // initial error magnitude

    // Steady-state error: average of last 10%
    const tail = Math.max(1, Math.floor(n * 0.1));
    let sseSum = 0;
    for (let i = n - tail; i < n; i++) sseSum += y[i] - ref;
    const sse = sseSum / tail;

    // Peak overshoot
    let peak = y[0], peakIdx = 0;
    const above = ref > y[0]; // approaching from below
    for (let i = 1; i < n; i++) {
      if (above ? y[i] > peak : y[i] < peak) { peak = y[i]; peakIdx = i; }
    }
    const os = e0 > 0.01 ? Math.abs(peak - ref) / e0 * 100 : 0; // percent of initial error

    // Settling time (last time signal exits the band)
    let ts = null;
    for (let i = n - 1; i >= 0; i--) {
      if (Math.abs(y[i] - ref) > tol) { ts = i < n - 1 ? t[i + 1] : null; break; }
    }
    if (ts === null && Math.abs(y[0] - ref) <= tol) ts = t[0]; // already settled

    // Rise time (10% to 90% of step)
    let tr = null;
    const y10 = y[0] + 0.1 * (ref - y[0]);
    const y90 = y[0] + 0.9 * (ref - y[0]);
    let t10 = null, t90 = null;
    const rising = ref > y[0];
    for (let i = 1; i < n; i++) {
      if (t10 === null && (rising ? y[i] >= y10 : y[i] <= y10)) t10 = t[i];
      if (t90 === null && (rising ? y[i] >= y90 : y[i] <= y90)) t90 = t[i];
    }
    if (t10 !== null && t90 !== null) tr = t90 - t10;

    // Integral Absolute Error
    let iae = 0;
    for (let i = 1; i < n; i++) {
      const dt = t[i] - t[i - 1];
      iae += Math.abs(y[i] - ref) * dt;
    }

    // RMS control effort (if available)
    return { ts, sse: Math.abs(sse), os, tr, iae };
  },

  /** Compute RMS of a signal */
  rms(arr) {
    if (!arr.length) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
    return Math.sqrt(sum / arr.length);
  },

  /** Format metrics as an HTML string for display */
  html(m) {
    const fmt = (v, unit, dec = 2) => v !== null && v !== undefined ? v.toFixed(dec) + unit : '—';
    const cls = (v, good, warn) => v === null ? '' : v <= good ? 'good' : v <= warn ? 'warn' : 'bad';
    return `
      <div class="metric"><div class="metric-label">Settling time</div><div class="metric-val ${cls(m.ts, 3, 8)}">${fmt(m.ts, ' s')}</div></div>
      <div class="metric"><div class="metric-label">Steady-state error</div><div class="metric-val ${cls(m.sse, 0.05, 0.2)}">${fmt(m.sse, ' rad', 3)}</div></div>
      <div class="metric"><div class="metric-label">Overshoot</div><div class="metric-val ${cls(m.os, 10, 30)}">${fmt(m.os, ' %', 1)}</div></div>
      <div class="metric"><div class="metric-label">Rise time</div><div class="metric-val">${fmt(m.tr, ' s')}</div></div>
      <div class="metric"><div class="metric-label">IAE</div><div class="metric-val">${fmt(m.iae, '', 2)}</div></div>
    `;
  }
};
window.Metrics = Metrics;
