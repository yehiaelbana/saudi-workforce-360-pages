// ============================================================================
// Saudi Workforce 360 — Activity Log (HR-only)
// Full audit history for compliance review — every write action across the
// app (Add/Edit Employee, Raise/Edit Requisition, Save/Delete Scenario,
// Regulatory Config Change, Role Change), one row per action, who did it and
// when. Reads directly from the real `audit_log` table (server-side
// filtered + paginated), not the session-local Store.auditLog cache used by
// the employee-profile "Audit History" tab — that cache only ever holds
// what happened in the current browser session, which isn't a real audit
// trail. RLS already restricts audit_log reads to HR ("hr reads audit log"
// in backend/rls_policies.sql); the route-level gate in js/app.js is the
// same defense-in-depth pattern used everywhere else in this app.
// ============================================================================

var Modules = window.Modules || {};
Modules.activitylog = (() => {
  const PAGE_SIZE = 25;
  const EXPORT_CAP = 5000; // sane upper bound on a single CSV export

  // Kept in sync with every Store.log(action, ...) call site — extend this
  // list if a new action string is ever added in js/store.js or elsewhere.
  const ACTIONS = [
    'Add Employee', 'Edit Employee', 'Raise Requisition', 'Edit Requisition',
    'Save Scenario', 'Delete Scenario', 'Regulatory Config Change', 'Role Change',
  ];

  let filters = { actor: '', action: '', from: '', to: '' };
  let page = 1;
  let totalCount = 0;
  let loading = false;

  function render(root) {
    page = 1;
    root.innerHTML = shellHtml();
    bind(root);
    fetchAndRenderTable(root);
  }

  function shellHtml() {
    return `
      <div class="page-head">
        <div>
          <h2>Activity Log</h2>
          <div class="sub">Full audit history — every write action across the app, for compliance review. HR & Admin only.</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="al-export">${Icon('download')} Export Filtered (CSV)</button>
        </div>
      </div>
      <div class="panel mt-16">
        <div class="filter-bar">
          <div class="search-box">${Icon('search')}<input type="text" id="al-actor" placeholder="Search by person (email)…"/></div>
          <select id="al-action"><option value="">Action: All</option>${ACTIONS.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select>
          <input type="date" id="al-from" title="From date"/>
          <input type="date" id="al-to" title="To date"/>
          <button class="btn btn-ghost btn-sm" id="al-clear">${Icon('x')} Clear</button>
        </div>
        <div class="table-toolbar">
          <div class="table-count" id="al-count">Loading…</div>
        </div>
        <div class="table-wrap"><table class="data-table" id="al-table"></table></div>
        <div class="pagination" id="al-pagination"></div>
      </div>
    `;
  }

  function bind(root) {
    qs('#al-actor', root).addEventListener('input', debounce(() => {
      filters.actor = qs('#al-actor', root).value.trim();
      page = 1; fetchAndRenderTable(root);
    }, 300));
    qs('#al-action', root).addEventListener('change', () => {
      filters.action = qs('#al-action', root).value;
      page = 1; fetchAndRenderTable(root);
    });
    qs('#al-from', root).addEventListener('change', () => {
      filters.from = qs('#al-from', root).value;
      page = 1; fetchAndRenderTable(root);
    });
    qs('#al-to', root).addEventListener('change', () => {
      filters.to = qs('#al-to', root).value;
      page = 1; fetchAndRenderTable(root);
    });
    qs('#al-clear', root).addEventListener('click', () => {
      filters = { actor: '', action: '', from: '', to: '' };
      page = 1;
      qs('#al-actor', root).value = ''; qs('#al-action', root).value = '';
      qs('#al-from', root).value = ''; qs('#al-to', root).value = '';
      fetchAndRenderTable(root);
    });
    qs('#al-export', root).addEventListener('click', () => exportCSV());
  }

  function buildQuery(withRange) {
    let q = supabaseClient.from('audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (filters.actor) q = q.ilike('actor_email', `%${filters.actor}%`);
    if (filters.action) q = q.eq('action', filters.action);
    if (filters.from) q = q.gte('created_at', filters.from + 'T00:00:00');
    if (filters.to) q = q.lte('created_at', filters.to + 'T23:59:59');
    if (withRange) q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    else q = q.limit(EXPORT_CAP);
    return q;
  }

  async function fetchAndRenderTable(root) {
    if (loading) return;
    loading = true;
    const countEl = qs('#al-count', root);
    if (countEl) countEl.textContent = 'Loading…';
    try {
      const { data, error, count } = await buildQuery(true);
      if (error) throw error;
      totalCount = count || 0;
      renderTable(root, data || []);
      renderPagination(root);
      if (countEl) {
        const start = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
        const end = Math.min(page * PAGE_SIZE, totalCount);
        countEl.textContent = totalCount === 0 ? 'No activity matches these filters.' : `${start}–${end} of ${totalCount} actions`;
      }
    } catch (err) {
      if (countEl) countEl.textContent = '';
      qs('#al-table', root).innerHTML = `<tr><td colspan="4" class="table-empty">${Icon('alertCircle')}<br/>Couldn't load the activity log: ${esc(err.message)}</td></tr>`;
      toast(`Couldn't load activity log: ${err.message}`, 'error');
    } finally {
      loading = false;
    }
  }

  function actionChip(action) {
    const tone = /Delete|Role Change/.test(action) ? 'chip-amber' : /Add|Raise|Save/.test(action) ? 'chip-green' : 'chip-info';
    return `<span class="chip ${tone}">${esc(action)}</span>`;
  }

  function renderTable(root, rows) {
    const el = qs('#al-table', root);
    el.innerHTML = `
      <thead><tr><th>When</th><th>Person</th><th>Action</th><th>Detail</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td class="mono">${Engine.fmtDateTime(r.created_at)}</td>
        <td>${esc(r.actor_email || '—')}</td>
        <td>${actionChip(r.action)}</td>
        <td class="cell-sub">${esc(r.detail || '—')}</td>
      </tr>`).join('') || `<tr><td colspan="4" class="table-empty">${Icon('search')}<br/>No activity matches these filters.</td></tr>`}</tbody>
    `;
  }

  function renderPagination(root) {
    const el = qs('#al-pagination', root);
    const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (page > pages) page = pages;
    let html = `<button ${page<=1?'disabled':''} data-pg="prev">‹</button>`;
    for (let p = 1; p <= pages; p++) {
      if (pages > 8 && Math.abs(p-page) > 2 && p !== 1 && p !== pages) { if (p === 2 || p === pages-1) html += `<span class="text-muted" style="padding:0 4px;">…</span>`; continue; }
      html += `<button class="${p===page?'active':''}" data-pg="${p}">${p}</button>`;
    }
    html += `<button ${page>=pages?'disabled':''} data-pg="next">›</button>`;
    el.innerHTML = html;
    qsa('button[data-pg]', el).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.pg === 'prev') page = Math.max(1, page-1);
      else if (b.dataset.pg === 'next') page = Math.min(pages, page+1);
      else page = Number(b.dataset.pg);
      fetchAndRenderTable(root);
    }));
  }

  async function exportCSV() {
    toast('Preparing export…');
    try {
      const { data, error } = await buildQuery(false);
      if (error) throw error;
      const cols = [
        { label: 'When', value: r => Engine.fmtDateTime(r.created_at) },
        { label: 'Person', value: 'actor_email' }, { label: 'Action', value: 'action' }, { label: 'Detail', value: 'detail' },
      ];
      Engine.downloadCSV(`sw360-activity-log-${new Date().toISOString().slice(0,10)}.csv`, Engine.toCSV(data || [], cols));
      toast(`Exported ${(data || []).length} activity records${(data||[]).length === EXPORT_CAP ? ` (capped at ${EXPORT_CAP} — narrow the filters for a complete export)` : ''}`);
    } catch (err) {
      toast(`Couldn't export: ${err.message}`, 'error');
    }
  }

  return { render };
})();
