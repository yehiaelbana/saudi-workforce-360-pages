// ============================================================================
// Saudi Workforce 360 — Shared UI helpers (icons, modal/drawer, toast, chips,
// zone gauge, chart wrapper). Every module renders through these so the app
// looks and behaves consistently.
// ============================================================================

const Icon = (() => {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2"/><circle cx="17" cy="8.5" r="2.6"/><path d="M15.5 13.9c2.9.4 5 2.7 5 6.1"/>',
    manager: '<circle cx="12" cy="7.5" r="3.3"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/><path d="M4 10.5 2 8.5m0 0 2-2m-2 2h5"/><path d="M20 10.5 22 8.5m0 0-2-2m2 2h-5"/>',
    pipeline: '<path d="M3 5h18"/><path d="M6 5v3.5L11 12v7"/><path d="M18 5v3.5L13 12"/><circle cx="11" cy="20.5" r="1.4"/>',
    shield: '<path d="M12 3 4.5 6v6c0 4.8 3.2 8 7.5 9 4.3-1 7.5-4.2 7.5-9V6L12 3Z"/><path d="m9 12 2 2 4-4.5"/>',
    sliders: '<path d="M5 21V14"/><path d="M5 10V3"/><path d="M12 21v-4"/><path d="M12 13V3"/><path d="M19 21v-6"/><path d="M19 11V3"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="19" cy="13" r="2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.36.5.6 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    gift: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13"/><path d="M3 12h18"/><path d="M12 8c-1.8 0-4-1-4-3a2 2 0 0 1 4 0c0-1.5 1.5-2.5 3-2 1.2.4 1.8 2 .5 3.2C14.5 7 13 8 12 8Z"/>',
    file: '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    bot: '<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M12 3v5"/><circle cx="9" cy="13.5" r="1.2"/><circle cx="15" cy="13.5" r="1.2"/><path d="M9 17h6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    download: '<path d="M12 3v13"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/>',
    alertTriangle: '<path d="M12 3.5 22 20.5H2Z"/><path d="M12 10v4.2"/><circle cx="12" cy="17.4" r="0.4" fill="currentColor"/>',
    alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.3" r="0.4" fill="currentColor"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/><path d="M9 21v-3.5h6V21"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/><path d="M10 11v6M14 11v6"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7"/><path d="M3 12h18"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    flag: '<path d="M5 3v18"/><path d="M5 4h11l-2 4 2 4H5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    filter: '<path d="M4 5h16l-6 8v6l-4 2v-8Z"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    star: '<path d="m12 3 2.6 5.8 6.2.6-4.7 4.2 1.4 6.2L12 16.8 6.5 19.8l1.4-6.2-4.7-4.2 6.2-.6Z"/>',
    grad: '<path d="M2 9 12 4l10 5-10 5Z"/><path d="M6 11.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-5.5"/><path d="M22 9v6"/>',
    trendUp: '<path d="M3 17 10 10l4 4 7-7"/><path d="M17 7h4v4"/>',
    logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    mapPin: '<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1.2 1.2 0 0 1 1.2-.3 9.5 9.5 0 0 0 3 .5 1.2 1.2 0 0 1 1.2 1.2V20a1.2 1.2 0 0 1-1.2 1.2A17.2 17.2 0 0 1 2.8 4.2 1.2 1.2 0 0 1 4 3h3.4a1.2 1.2 0 0 1 1.2 1.2 9.5 9.5 0 0 0 .5 3 1.2 1.2 0 0 1-.3 1.2Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r="0.4" fill="currentColor"/>',
  };
  return function icon(name, cls) {
    const p = paths[name] || paths.info;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${cls||''}">${p}</svg>`;
  };
})();

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0]||'') + (parts[1]?.[0]||'')).toUpperCase();
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function qs(sel, root) { return (root||document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root||document).querySelectorAll(sel)); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 220); }; }

// ---------------------------------------------------------------------------
// Toasts — confirmation only; the real feedback is the state/DOM actually
// changing underneath it.
// ---------------------------------------------------------------------------
function toast(msg, kind) {
  let stack = qs('.toast-stack');
  if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; document.body.appendChild(stack); }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${Icon('checkCircle')}<span>${esc(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 260); }, 2600);
}

// ---------------------------------------------------------------------------
// Modal / Drawer
// ---------------------------------------------------------------------------
function closeOverlay() { qsa('.overlay').forEach(o => o.remove()); document.body.style.overflow = ''; }

function openModal(innerHtml, opts) {
  closeOverlay();
  opts = opts || {};
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="modal ${opts.wide ? 'modal-wide' : ''}">${innerHtml}</div>`;
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeOverlay(); });
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  return overlay;
}

function openDrawer(innerHtml) {
  closeOverlay();
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="drawer">${innerHtml}</div>`;
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeOverlay(); });
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  return overlay;
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------
function ragChip(rag, label) {
  const map = { green: ['chip-green', label || 'On Track'], amber: ['chip-amber', label || 'Needs Attention'], red: ['chip-red', label || 'At Risk'] };
  const [cls, txt] = map[rag] || map.green;
  return `<span class="chip ${cls}"><span class="chip-dot" style="background:currentColor"></span>${esc(txt)}</span>`;
}

function zoneKeyFor(name) {
  return { 'Platinum': 'platinum', 'High Green': 'green-high', 'Mid Green': 'green-mid', 'Low Green': 'green-low', 'Red': 'red' }[name] || 'green-mid';
}

function zoneChip(zoneName) {
  return `<span class="zone-chip zone-${zoneKeyFor(zoneName)}">${Icon(zoneName==='Red'?'alertTriangle':'shield')}${esc(zoneName)} Zone</span>`;
}

function statusDot(status) {
  const cls = status === 'Active' ? 'dot-active' : status === 'Attrition' ? 'dot-attrition' : 'dot-inactive';
  return `<span class="status-dot ${cls}"></span>`;
}

// ---------------------------------------------------------------------------
// Zone gauge — horizontal band widget shared by Home + HR Workspace + Simulator
// ---------------------------------------------------------------------------
function renderZoneGauge(ratio, entityConfig, opts) {
  opts = opts || {};
  // Highest-value zone (Platinum) on the left, lowest (Red) on the right —
  // sorted explicitly here rather than assuming the caller's array order,
  // since that assumption was exactly the bug: this used to rely on
  // `.slice().reverse()` matching data-config.js's original hardcoded
  // Platinum-first array, which broke silently once Phase 2 started
  // sourcing zones from Supabase in a different (ascending-min) order —
  // the bands still rendered in a plausible-looking order, but the marker
  // position (computed with the opposite left/right assumption) ended up
  // pointing at the wrong band entirely. Found via a real screenshot: the
  // 60.5% marker sat over "Red" while the chip correctly said "High Green".
  const zones = entityConfig.zones.slice().sort((a, b) => b.min - a.min);
  const capMax = Math.max(zones[0].min * 1.18, ratio * 1.08, entityConfig.target * 1.3);
  // Left edge is capMax (highest value shown), right edge is 0 — a value's
  // distance from the left is how much smaller than capMax it is.
  const posFromLeft = (v) => Math.max(2, Math.min(98, ((capMax - v) / capMax) * 100));
  let segs = '';
  zones.forEach(z => {
    const width = ((Math.min(z.max, capMax) - z.min) / capMax) * 100;
    // Always label every band — a colored block with no text reads as broken,
    // not "intentionally compact". Shrink the font for narrow bands instead
    // of hiding the label outright (found via real-browser screenshot: Low
    // Green was landing right under the old 9% cutoff and rendering blank).
    // `title` gives a native tooltip too, so it's never ambiguous on hover.
    const segFont = width > 9 ? '9.5px' : width > 5 ? '7.5px' : '6px';
    segs += `<div class="zone-gauge-seg zone-${zoneKeyFor(z.name)}" style="width:${width}%; background:var(--zone-${zoneKeyFor(z.name)}); font-size:${segFont}; overflow:hidden;" title="${esc(z.name)} zone">${esc(z.name)}</div>`;
  });
  const markerPct = posFromLeft(ratio);
  const targetPct = posFromLeft(entityConfig.target);
  const zone = Engine.zoneFor(ratio, entityConfig);
  return `
    <div class="zone-gauge">
      <div style="position:relative; padding-top:30px;">
        <div class="zone-gauge-marker-flag" style="left:${markerPct}%">${Engine.fmtPct(ratio)}</div>
        <div class="zone-gauge-marker" style="left:${markerPct}%; height:34px;"></div>
        <div class="zone-gauge-target-marker" style="left:${targetPct}%; height:34px;" title="Target ${Engine.fmtPct(entityConfig.target)}"></div>
        <div class="zone-gauge-track">${segs}</div>
      </div>
      ${opts.hideLegend ? '' : `<div class="legend mt-8">
        <span><i style="background:var(--dxc-purple)"></i> Your position — ${zoneChip(zone.name)}</span>
        <span style="color:var(--grey-500)">┊ Target line = ${Engine.fmtPct(entityConfig.target)}</span>
      </div>`}
    </div>`;
}

// ---------------------------------------------------------------------------
// Chart.js helpers (CDN-loaded; guarded so a missing/offline CDN never breaks
// the rest of the app — the surrounding panel just shows a fallback note).
// Two optional plugins ride along, each independently guarded the same way:
//  - chartjs-plugin-datalabels: on-chart value labels (off by default per
//    chart — mountChart(id, config, {labels:true}) opts a chart in, since
//    labeling every bar on a 20-category chart is clutter, not clarity).
//  - chartjs-chart-matrix: real heatmap/matrix cells (registers a 'matrix'
//    chart type), used for the diversity/coverage heatmaps.
// ---------------------------------------------------------------------------
const ChartRegistry = {};
let _chartPluginsRegistered = false;
function ensureChartPlugins() {
  if (_chartPluginsRegistered || typeof Chart === 'undefined') return;
  _chartPluginsRegistered = true;
  if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
    Chart.defaults.set('plugins.datalabels', { display: false }); // opt-in per chart, see mountChart
  }
}
function chartMatrixAvailable() {
  if (typeof Chart === 'undefined') return false;
  try { return !!Chart.registry.getController('matrix'); } catch (e) { return false; }
}
function mountChart(canvasId, config, opts) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (typeof Chart === 'undefined') {
    el.parentElement.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Chart library unavailable offline — data shown in the table above.</p></div>';
    return;
  }
  ensureChartPlugins();
  opts = opts || {};
  if (opts.labels && typeof ChartDataLabels !== 'undefined') {
    config = Object.assign({}, config);
    config.options = Object.assign({}, config.options);
    config.options.plugins = Object.assign({}, config.options.plugins, {
      datalabels: Object.assign({ display: true, color: opts.labelColor || '#fff', font: { weight: '700', size: 10.5 }, formatter: opts.labelFormatter || (v => v || '') }, opts.labelOptions || {}),
    });
  }
  if (ChartRegistry[canvasId]) { ChartRegistry[canvasId].destroy(); }
  ChartRegistry[canvasId] = new Chart(el.getContext('2d'), config);
}

const CHART_PALETTE = ['#5F249F', '#006975', '#F9B54C', '#3E9B6C', '#8E6FBB', '#C23B32', '#969696', '#1D5FA8', '#B37FE0', '#147A50'];

function baseChartFont() {
  return { family: getComputedStyle(document.body).fontFamily, size: 11.5 };
}
