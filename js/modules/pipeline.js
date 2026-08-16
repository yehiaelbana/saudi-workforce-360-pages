// ============================================================================
// Demand & Supply — Workforce Pipeline (replaces "Recruitment"). Requisition
// registry + funnel + demand-vs-supply + at-risk Saudi-priority requirements,
// with a working Raise/Edit Requisition form.
// ============================================================================

var Modules = window.Modules || {};
Modules.pipeline = (() => {

  let filters = {};
  const STAGES = ['Sourcing', 'Screening', 'Interview', 'Offer', 'Onboarding', 'Filled'];

  function scopedReqs() {
    let reqs = Store.requisitions.filter(r => r.entity === Store.entity);
    const role = currentRole();
    if (role.id === 'pm' && Store.scopeManagerId) reqs = reqs.filter(r => r.managerId === Store.scopeManagerId);
    if (role.id === 'slm' && Store.scopeServiceLine) reqs = reqs.filter(r => r.serviceLine === Store.scopeServiceLine);
    return reqs;
  }

  function render(root) {
    if (Router.pendingFilters) { filters = Object.assign({}, Router.pendingFilters); Router.pendingFilters = null; }
    if (filters.stage === '__soon') delete filters.stage; // Home KPI hand-off: just land here, no strict stage filter

    const role = currentRole();
    const base = scopedReqs();
    const open = base.filter(r => r.status !== 'Filled');
    const working = Engine.applyFilters(base, cleanFilters());
    const saudiPct = open.length ? open.filter(r => r.nationalityPriority === 'Saudi Priority').length / open.length : 0;
    const jSoon = Engine.joiningSoon(open, new Date(), 45);
    const entityEmp = Store.employees.filter(e => e.entity === Store.entity);
    const lSoonNext90 = Engine.leavingSoon(entityEmp, new Date(), 90);
    const netMovement = jSoon.length - lSoonNext90.length;
    const atRisk = computeAtRisk(open);
    const cfg = Store.nitaqatConfig[Store.entity];
    const activeNow = Engine.headcountStats(entityEmp.filter(e => e.status === 'Active'));
    const projSaudi = activeNow.saudi + open.filter(r => r.nationalityPriority === 'Saudi Priority').length;
    const projTotal = activeNow.total + open.length;
    const projRatio = projTotal ? projSaudi / projTotal : activeNow.ratio;
    const currentZone = Engine.zoneFor(activeNow.ratio, cfg);
    const projZone = Engine.zoneFor(projRatio, cfg);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Demand &amp; Supply</h2><div class="sub">Workforce pipeline · ${esc(Store.entity==='KSA'?'DXC Saudi Arabia':'Regional HQ')} · ${base.length} requisitions in scope</div></div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="pl-export">${Icon('download')} Export CSV</button>
          ${role.perms.addRequisition ? `<button class="btn btn-primary" id="pl-add">${Icon('plus')} Raise Requisition</button>` : ''}
        </div>
      </div>

      <div class="grid grid-4">
        ${kpi('Open Requisitions', open.length, 'pipeline')}
        ${kpi('Saudi-Priority Share', Engine.fmtPct(saudiPct,0), 'shield')}
        ${kpi('Expected Starts · 45d', jSoon.length, 'calendar')}
        ${kpi('Net Movement · 90d', (netMovement>=0?'+':'')+netMovement, netMovement>=0?'trendUp':'clock', netMovement>=0?'up':'down')}
      </div>

      <div class="panel mt-16">
        <div class="panel-head"><div><h3>${Icon('shield','inline-icon')} Nitaqat impact of this pipeline</h3><div class="sub">If every open requisition is filled exactly as targeted, today, no other movement</div></div></div>
        <div class="panel-body compare-cols">
          <div class="compare-col"><div class="cc-label">Current ratio</div><div class="cc-value">${Engine.fmtPct(activeNow.ratio)}</div><div class="text-xs text-muted mt-4">${zoneChip(currentZone.name)}</div></div>
          <div class="compare-arrow">${Icon('arrowRight')}</div>
          <div class="compare-col"><div class="cc-label">If pipeline fills as planned</div><div class="cc-value ${projRatio>=activeNow.ratio?'up':'down'}">${Engine.fmtPct(projRatio)}</div><div class="text-xs text-muted mt-4">${zoneChip(projZone.name)}${projZone.name!==currentZone.name ? ` <span class="chip chip-purple">Zone ${projZone.min>currentZone.min?'improves':'drops'}</span>` : ''}</div></div>
        </div>
        <div class="panel-foot text-xs text-muted">${open.filter(r=>r.nationalityPriority==='Saudi Priority').length} of ${open.length} open requisitions are Saudi-priority · assumes no attrition or exits between now and fill</div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>Pipeline funnel</h3><div class="sub">All open requisitions by stage</div></div></div>
          <div class="panel-body"><canvas id="pl-chart-funnel" height="220"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Demand vs. committed supply</h3><div class="sub">Open positions vs. candidates in Offer/Onboarding, by offering</div></div></div>
          <div class="panel-body"><canvas id="pl-chart-ds" height="220"></canvas></div>
        </div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head"><div><h3>Where positions are stuck</h3><div class="sub">Open requisitions by offering × stage — darker cell = more requisitions</div></div></div>
        <div class="panel-body"><canvas id="pl-chart-matrix" height="140"></canvas></div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head"><div><h3>${Icon('alertTriangle','inline-icon')} At-risk requirements</h3><div class="sub">Saudi-priority roles stalled in early stage for 45+ days — Nitaqat planning exposure</div></div><span class="chip chip-red">${atRisk.length}</span></div>
        <div class="panel-body">
          ${atRisk.length ? atRisk.map(r => `<div class="alert-row" data-view-req="${r.id}"><div class="alert-icon amber">${Icon('alertTriangle')}</div><div class="alert-body"><div class="a-title">Req ${r.reqNo} — ${esc(r.jobTitle)}</div><div class="a-detail">${esc(r.account||'—')} · open ${r.daysOpen}d · still in ${esc(r.stage)}</div></div>${Icon('chevronRight')}</div>`).join('') : `<div class="empty-state">${Icon('checkCircle')}<h4>No stalled Saudi-priority requirements</h4></div>`}
        </div>
      </div>

      <div class="panel mt-16">
        ${filterBarHtml(base)}
        <div class="table-toolbar"><div class="table-count">${working.length} of ${base.length} requisitions</div></div>
        <div class="table-wrap"><table class="data-table" id="pl-table"></table></div>
      </div>
    `;

    drawFunnel(open);
    drawDemandSupply(open);
    drawStageMatrix(open);
    renderTable(working);
    bindFilterBar(root, base);

    qs('#pl-export', root).addEventListener('click', () => exportCSV(working));
    const addBtn = qs('#pl-add', root); if (addBtn) addBtn.addEventListener('click', () => openRequisitionForm(null));
    qsa('[data-view-req]', root).forEach(el => el.addEventListener('click', () => openRequisitionForm(el.dataset.viewReq)));

    function cleanFilters() { const f = Object.assign({}, filters); delete f.stage; if (filters.stage && filters.stage !== '__soon') f.stage = filters.stage; return f; }
  }

  function computeAtRisk(open) {
    const now = new Date();
    return open.filter(r => r.nationalityPriority === 'Saudi Priority' && ['Sourcing','Screening'].includes(r.stage))
      .map(r => Object.assign({}, r, { daysOpen: Engine.daysBetween(r.createdDate, now) }))
      .filter(r => r.daysOpen >= 45)
      .sort((a,b) => b.daysOpen - a.daysOpen);
  }

  function kpi(label, value, icon, tone) {
    return `<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">${esc(label)}</span><span class="kpi-icon">${Icon(icon)}</span></div><div class="kpi-value ${tone==='up'?'up':tone==='down'?'down':''}">${value}</div></div>`;
  }

  function filterBarHtml(base) {
    const opt = (arr, cur) => arr.map(v => `<option value="${esc(v)}" ${cur===v?'selected':''}>${esc(v)}</option>`).join('');
    return `<div class="filter-bar">
      <div class="search-box">${Icon('search')}<input type="text" id="pf-search" placeholder="Req #, job title…" value="${esc(filters.search||'')}"/></div>
      <select id="pf-stage"><option value="">Stage: All</option>${opt(STAGES, filters.stage)}</select>
      <select id="pf-status"><option value="">Status: All</option>${opt(['In Progress','On Hold','Filled'], filters.status)}</select>
      <select id="pf-account"><option value="">Account: All</option>${opt(Engine.uniqueSorted(base,'account'), filters.account)}</select>
      <select id="pf-offering"><option value="">Offering: All</option>${opt(OFFERINGS.map(o=>o.name), filters.offering)}</select>
      <select id="pf-nat"><option value="">Nationality: All</option>${opt(['Saudi Priority','Open to All Nationalities'], filters.nationalityPriority)}</select>
      <button class="btn btn-ghost btn-sm" id="pf-clear">${Icon('x')} Clear</button>
    </div>`;
  }

  function bindFilterBar(root) {
    const map = { 'pf-stage':'stage', 'pf-status':'status', 'pf-account':'account', 'pf-offering':'offering', 'pf-nat':'nationalityPriority' };
    Object.keys(map).forEach(id => { const el = qs('#'+id, root); if (el) el.addEventListener('change', () => { filters[map[id]] = el.value || undefined; render(root); }); });
    const search = qs('#pf-search', root); if (search) search.addEventListener('input', debounce(() => { filters.search = search.value || undefined; render(root); }, 250));
    const clear = qs('#pf-clear', root); if (clear) clear.addEventListener('click', () => { filters = {}; render(root); });
  }

  function renderTable(rows) {
    const el = qs('#pl-table');
    el.innerHTML = `
      <thead><tr><th>Req #</th><th>Job Title / Profession</th><th>Account</th><th>Offering</th><th>Manager</th><th>Nationality</th><th>Stage</th><th>Target Start</th><th>Reason</th><th></th></tr></thead>
      <tbody>${rows.map(reqRow).join('') || `<tr><td colspan="10" class="table-empty">No requisitions match these filters.</td></tr>`}</tbody>`;
    qsa('tr[data-req]', el).forEach(tr => tr.addEventListener('click', () => openRequisitionForm(tr.dataset.req)));
  }

  function reqRow(r) {
    const mgr = MANAGERS.find(m => m.id === r.managerId);
    return `<tr class="clickable" data-req="${r.id}">
      <td class="mono">${r.reqNo}</td>
      <td class="cell-name">${esc(r.jobTitle)}<br/><span class="cell-sub">${esc(r.profession||'—')}</span></td>
      <td>${esc(r.account||'—')}</td>
      <td>${esc(r.offering||'—')}</td>
      <td>${mgr?esc(mgr.name):'—'}</td>
      <td>${r.nationalityPriority==='Saudi Priority'?'<span class="chip chip-green">Saudi Priority</span>':'<span class="chip chip-grey">Open</span>'}</td>
      <td><span class="chip chip-info">${esc(r.stage)}</span></td>
      <td class="mono">${Engine.fmtDate(r.targetStartDate)}</td>
      <td>${esc(r.vacancyReason||'—')}</td>
      <td>${Icon('chevronRight')}</td>
    </tr>`;
  }

  function drawFunnel(open) {
    const counts = STAGES.map(s => open.filter(r => r.stage === s).length);
    mountChart('pl-chart-funnel', {
      type: 'bar',
      data: { labels: STAGES, datasets: [{ data: counts, backgroundColor: CHART_PALETTE[0], borderRadius: 4, maxBarThickness: 40 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    }, { labels: true, labelColor: '#241f30', labelOptions: { anchor: 'end', align: 'top', offset: 4, font: { size: 11, weight: '700' } } });
  }

  function drawDemandSupply(open) {
    const offs = Engine.uniqueSorted(open, 'offering');
    const demand = offs.map(o => open.filter(r => r.offering === o).length);
    const supply = offs.map(o => open.filter(r => r.offering === o && (r.stage === 'Offer' || r.stage === 'Onboarding')).length);
    mountChart('pl-chart-ds', {
      type: 'bar',
      data: { labels: offs, datasets: [
        { label: 'Open Demand', data: demand, backgroundColor: CHART_PALETTE[0], borderRadius: 4 },
        { label: 'Committed Supply', data: supply, backgroundColor: CHART_PALETTE[1], borderRadius: 4 },
      ]},
      options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: baseChartFont() } } }, scales: { x: { ticks: { font: { size: 10 } } } } }
    }, { labels: true, labelColor: '#241f30', labelOptions: { anchor: 'end', align: 'top', offset: 2, font: { size: 10, weight: '700' }, formatter: (v) => v || '' } });
  }

  function drawStageMatrix(open) {
    const el = document.getElementById('pl-chart-matrix');
    if (!el) return;
    if (!chartMatrixAvailable()) {
      el.parentElement.innerHTML = '<div class="empty-state" style="padding:20px;"><p>Heatmap library unavailable offline — see funnel chart above instead.</p></div>';
      return;
    }
    const offs = Engine.uniqueSorted(open, 'offering');
    if (!offs.length) { el.parentElement.innerHTML = '<div class="empty-state" style="padding:20px;"><p>No open requisitions to map.</p></div>'; return; }
    const cells = [];
    offs.forEach(off => {
      STAGES.forEach(stage => {
        cells.push({ x: stage, y: off, v: open.filter(r => r.offering === off && r.stage === stage).length });
      });
    });
    const maxV = Math.max(1, ...cells.map(c => c.v));
    mountChart('pl-chart-matrix', {
      type: 'matrix',
      data: { datasets: [{
        label: 'Requisitions',
        data: cells,
        backgroundColor: (ctx) => {
          const v = ctx.dataset.data[ctx.dataIndex] ? ctx.dataset.data[ctx.dataIndex].v : 0;
          return `rgba(0,105,117,${(0.10 + 0.78 * (v / maxV)).toFixed(2)})`;
        },
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
        width: (ctx) => ((ctx.chart.chartArea || {}).width || 0) / STAGES.length - 3,
        height: (ctx) => ((ctx.chart.chartArea || {}).height || 0) / offs.length - 3,
      }] },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: () => '', label: (ctx) => `${ctx.raw.y} · ${ctx.raw.x}: ${ctx.raw.v}` } },
          datalabels: {
            display: true, font: { size: 10.5, weight: '700' },
            color: (ctx) => { const v = ctx.dataset.data[ctx.dataIndex].v; return v / maxV > 0.45 ? '#fff' : '#241f30'; },
            formatter: (v) => v.v || '',
          },
        },
        scales: {
          x: { type: 'category', labels: STAGES, offset: true, grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { type: 'category', labels: offs, offset: true, grid: { display: false }, ticks: { font: { size: 10 } } },
        },
      },
    });
  }

  function exportCSV(rows) {
    const cols = [
      { label: 'Req #', value: 'reqNo' }, { label: 'Status', value: 'status' }, { label: 'Stage', value: 'stage' },
      { label: 'Account', value: 'account' }, { label: 'Offering', value: 'offering' },
      { label: 'Manager', value: r => (MANAGERS.find(m=>m.id===r.managerId)||{}).name || '' },
      { label: 'Job Title', value: 'jobTitle' }, { label: 'Profession', value: 'profession' },
      { label: 'Nationality Priority', value: 'nationalityPriority' }, { label: 'Target Start', value: 'targetStartDate' },
      { label: 'Vacancy Reason', value: 'vacancyReason' }, { label: 'Created', value: 'createdDate' },
    ];
    Engine.downloadCSV(`sw360-pipeline-${Store.entity}-${new Date().toISOString().slice(0,10)}.csv`, Engine.toCSV(rows, cols));
    toast(`Exported ${rows.length} requisitions`);
  }

  // -------------------------------------------------------------------------
  function openRequisitionForm(reqId, presets) {
    const editing = !!reqId;
    const req = editing ? Store.requisitions.find(r => r.id === reqId) : Object.assign({ nationalityPriority: 'Saudi Priority', stage: 'Sourcing', status: 'In Progress' }, presets || {});
    const overlay = openModal(`
      <div class="modal-head"><h3>${editing ? `Requisition ${req.reqNo}` : 'Raise Requisition'}</h3><button class="modal-close" data-close>${Icon('x')}</button></div>
      <div class="modal-body">
        <form id="req-form">
          <div class="form-grid">
            <div class="field"><label>Job Title <span class="req">*</span></label><input name="jobTitle" required value="${esc(req.jobTitle||'')}"/></div>
            <div class="field"><label>Legal Profession</label><select name="profession"><option value="">— Not mapped —</option>${PROFESSIONS.map(p=>`<option value="${esc(p.name)}" data-code="${p.code}" ${req.profession===p.name?'selected':''}>${esc(p.name)} (${p.code})</option>`).join('')}</select></div>
            <div class="field"><label>Account <span class="req">*</span></label><select name="account" required>${ACCOUNTS.filter(a=>a.entity==='KSA' && a.active).map(a=>a.name).filter((v,i,arr)=>arr.indexOf(v)===i).map(a=>`<option ${req.account===a?'selected':''}>${esc(a)}</option>`).join('')}</select></div>
            <div class="field"><label>Offering <span class="req">*</span></label><select name="offering" required>${OFFERINGS.map(o=>`<option ${req.offering===o.name?'selected':''}>${esc(o.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Hiring / People Manager</label><select name="managerId">${MANAGERS.filter(m=>m.id!=='mgr-unassigned').map(m=>`<option value="${m.id}" ${req.managerId===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Level</label><select name="level">${LEVELS.map(l=>`<option ${req.level===l?'selected':''}>${esc(l)}</option>`).join('')}</select></div>
            <div class="field"><label>Nationality Priority</label><select name="nationalityPriority">${['Saudi Priority','Open to All Nationalities'].map(n=>`<option ${req.nationalityPriority===n?'selected':''}>${n}</option>`).join('')}</select></div>
            <div class="field"><label>Vacancy Reason</label><select name="vacancyReason">${['Growth','Replacement','Contract End','Transfer','Attrition'].map(n=>`<option ${req.vacancyReason===n?'selected':''}>${n}</option>`).join('')}</select></div>
            <div class="field"><label>Pipeline Stage</label><select name="stage">${STAGES.map(s=>`<option ${req.stage===s?'selected':''}>${s}</option>`).join('')}</select></div>
            <div class="field"><label>Status</label><select name="status">${['In Progress','On Hold','Filled'].map(s=>`<option ${req.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
            <div class="field"><label>Target Start Date <span class="req">*</span></label><input type="date" name="targetStartDate" required value="${req.targetStartDate||''}"/></div>
            <div class="field"><label>Requisition #</label><input value="${req.reqNo||'Auto-generated on save'}" disabled/></div>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        ${editing
          ? `<button class="btn btn-danger" id="req-fill" style="margin-right:auto;">${Icon('check')} Mark Filled</button>`
          : `<span class="text-xs text-muted" style="margin-right:auto;">${Icon('info')} Saved to this browser session only — not yet synced to the shared database.</span>`}
        <button class="btn btn-secondary" data-close>Cancel</button>
        <button class="btn btn-primary" id="req-save">${Icon('check')} ${editing?'Save Changes':'Raise Requisition'}</button>
      </div>
    `, { wide: true });

    qsa('[data-close]', overlay).forEach(b => b.addEventListener('click', closeOverlay));
    const fillBtn = qs('#req-fill', overlay);
    if (fillBtn) fillBtn.addEventListener('click', () => {
      Store.updateRequisition(reqId, { status: 'Filled', stage: 'Filled' });
      toast(`Req ${req.reqNo} marked Filled`);
      closeOverlay();
      render(qs('#route-container'));
    });
    qs('#req-save', overlay).addEventListener('click', () => {
      const form = qs('#req-form', overlay);
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const data = {};
      fd.forEach((v,k) => { if (v !== '') data[k] = v; });
      const profSelect = form.querySelector('[name=profession]');
      if (profSelect && profSelect.value) data.professionCode = profSelect.selectedOptions[0].dataset.code;
      const offMeta = OFFERINGS.find(o => o.name === data.offering);
      if (offMeta) data.serviceLine = offMeta.serviceLine;
      data.entity = Store.entity;
      if (editing) { Store.updateRequisition(reqId, data); toast(`Req ${req.reqNo} updated`); }
      else { const created = Store.addRequisition(data); toast(`Requisition ${created.reqNo} raised`); }
      closeOverlay();
      const rc = qs('#route-container'); if (rc) render(rc);
    });
  }

  return { render, openRequisitionForm };
})();
