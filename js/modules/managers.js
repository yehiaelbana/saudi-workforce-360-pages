// ============================================================================
// People Managers — replaces the old "Organization" tab. A real accountability
// view: cross-manager scorecard for HR/Exec/SLM, and a single-manager
// workspace (My Team / Open Positions / Leaving / Expiring / Team Actions /
// Future) that People Managers land on directly. Manager-level stats are also
// surfaced contextually on Home (leaderboard) and as a filter/column in
// Employees and Pipeline, so this page isn't the only place they show up.
// ============================================================================

var Modules = window.Modules || {};
Modules.managers = (() => {

  let viewManagerId = null;
  let slFilter = '';
  let detailTab = 'team';

  function render(root) {
    const role = currentRole();
    if (Router.pendingManagerId) { viewManagerId = Router.pendingManagerId; Router.pendingManagerId = null; detailTab = 'team'; }
    if (Router.pendingServiceLine) { slFilter = Router.pendingServiceLine; Router.pendingServiceLine = null; }
    if (role.id === 'pm') viewManagerId = Store.scopeManagerId;
    if (role.id === 'slm' && !slFilter) slFilter = Store.scopeServiceLine;

    if (viewManagerId) renderDetail(root, viewManagerId, role);
    else renderList(root, role);
  }

  // -------------------------------------------------------------------------
  // LIST VIEW
  // -------------------------------------------------------------------------
  function renderList(root, role) {
    const entityEmp = Store.employees.filter(e => e.entity === Store.entity && e.status === 'Active');
    let managers = MANAGERS.filter(m => m.id !== 'mgr-unassigned');
    if (slFilter) managers = managers.filter(m => m.serviceLine === slFilter);

    const rows = managers.map(m => {
      const sc = Engine.managerScorecard(m.id, entityEmp, Store.requisitions.filter(r=>r.entity===Store.entity), Store.nitaqatConfig);
      return { m, sc };
    }).filter(r => r.sc.stats.total > 0).sort((a,b) => b.sc.stats.total - a.sc.stats.total);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>People Managers</h2><div class="sub">${rows.length} managers with active headcount · ${esc(Store.entity==='KSA'?'DXC Saudi Arabia':'Regional HQ')} · team size, Saudization and capacity by manager</div></div>
        <div class="page-actions">
          <select id="mgr-sl-filter"><option value="">All Service Lines</option>${SERVICE_LINES.map(s=>`<option value="${s.id}" ${slFilter===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="grid grid-4">
        ${summaryCard('Managers in scope', rows.length, 'manager')}
        ${summaryCard('Avg. team size', rows.length ? Math.round(rows.reduce((a,r)=>a+r.sc.stats.total,0)/rows.length) : 0, 'users')}
        ${summaryCard('Total open positions', rows.reduce((a,r)=>a+r.sc.openReqs.length,0), 'pipeline')}
        ${summaryCard('Teams needing action', rows.filter(r=>r.sc.actionCount>0).length, 'alertTriangle')}
      </div>
      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>Team size by manager</h3><div class="sub">Top 12 · bar color = Saudi ratio vs entity target</div></div></div>
          <div class="panel-body"><canvas id="mgr-chart-size" height="220"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Saudi ratio spread</h3><div class="sub">Every manager in scope, sorted by ratio</div></div></div>
          <div class="panel-body"><canvas id="mgr-chart-ratio" height="220"></canvas></div>
        </div>
      </div>

      <div class="panel mt-16">
        <div class="table-wrap"><table class="data-table" id="mgr-table">
          <thead><tr>
            <th>Manager</th><th>Service Line</th><th>Team</th><th>Saudi %</th><th>vs Target</th><th>Open Positions</th><th>Joining Soon</th><th>Leaving Soon</th><th>Actions</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map(r => managerRowHtml(r)).join('') || `<tr><td colspan="10" class="table-empty">No managers match this filter.</td></tr>`}
          </tbody>
        </table></div>
      </div>
    `;
    drawListCharts(rows);
    qs('#mgr-sl-filter', root).addEventListener('change', (e) => { slFilter = e.target.value; render(root); });
    qsa('tr[data-mgr]', root).forEach(tr => tr.addEventListener('click', () => { viewManagerId = tr.dataset.mgr; detailTab='team'; render(root); }));
  }

  function drawListCharts(rows) {
    const cfg = Store.nitaqatConfig[Store.entity];
    const top = rows.slice(0, 12);
    mountChart('mgr-chart-size', {
      type: 'bar',
      data: {
        labels: top.map(r => r.m.name),
        datasets: [{
          data: top.map(r => r.sc.stats.total),
          backgroundColor: top.map(r => r.sc.stats.ratio >= cfg.target ? '#147A50' : r.sc.stats.ratio >= cfg.target - 0.08 ? '#92600E' : '#96281D'),
          borderRadius: 4, maxBarThickness: 28,
        }],
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { font: baseChartFont() } }, y: { ticks: { font: { size: 10 } } } } },
    }, { labels: true, labelColor: '#fff', labelOptions: { anchor: 'center' } });

    const byRatio = rows.slice().sort((a,b) => a.sc.stats.ratio - b.sc.stats.ratio);
    mountChart('mgr-chart-ratio', {
      type: 'bar',
      data: {
        labels: byRatio.map(r => r.m.name),
        datasets: [
          { label: 'Saudi ratio', data: byRatio.map(r => +(r.sc.stats.ratio*100).toFixed(1)), backgroundColor: CHART_PALETTE[0], borderRadius: 4 },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { display: false } }, y: { ticks: { callback: v => v + '%', font: baseChartFont() } } },
      },
    });
  }

  function summaryCard(label, value, icon) {
    return `<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">${esc(label)}</span><span class="kpi-icon">${Icon(icon)}</span></div><div class="kpi-value">${value}</div></div>`;
  }

  function managerRowHtml(r) {
    const cfg = Store.nitaqatConfig[Store.entity];
    const gap = r.sc.stats.ratio - cfg.target;
    return `<tr class="clickable" data-mgr="${r.m.id}">
      <td class="cell-name"><span class="avatar-sm">${initials(r.m.name)}</span>${esc(r.m.name)}<br/><span class="cell-sub" style="margin-left:34px;">${esc(r.m.title)}</span></td>
      <td>${esc((SERVICE_LINES.find(s=>s.id===r.m.serviceLine)||{}).name||'—')}</td>
      <td class="mono">${r.sc.stats.total}</td>
      <td class="mono">${Engine.fmtPct(r.sc.stats.ratio)}</td>
      <td class="mono ${gap>=0?'up':'down'}">${gap>=0?'+':''}${Engine.fmtPct(gap)}</td>
      <td class="mono">${r.sc.openReqs.length}</td>
      <td class="mono">${r.sc.joiningSoon.length}</td>
      <td class="mono">${r.sc.leavingSoon.length}</td>
      <td>${r.sc.actionCount>0 ? `<span class="chip chip-amber">${r.sc.actionCount}</span>` : `<span class="chip chip-green">0</span>`}</td>
      <td>${Icon('chevronRight')}</td>
    </tr>`;
  }

  // -------------------------------------------------------------------------
  // DETAIL VIEW — single manager cockpit
  // -------------------------------------------------------------------------
  function renderDetail(root, managerId, role) {
    const m = MANAGERS.find(x => x.id === managerId) || SERVICE_LINE_LEADS.find(x => x.id === managerId);
    if (!m) { viewManagerId = null; renderList(root, role); return; }
    const entityEmp = Store.employees.filter(e => e.entity === Store.entity);
    const reqs = Store.requisitions.filter(r => r.entity === Store.entity);
    const sc = Engine.managerScorecard(managerId, entityEmp, reqs, Store.nitaqatConfig);
    const cfg = Store.nitaqatConfig[Store.entity];
    const gap = sc.stats.ratio - cfg.target;
    const expiringRecords = sc.derived.filter(e => e.rag !== 'green');

    root.innerHTML = `
      ${role.id !== 'pm' ? `<div class="mt-4 mb-8"><span class="btn btn-ghost btn-sm" id="mgr-back">${Icon('chevronDown')} Back to all managers</span></div>` : ''}
      <div class="page-head">
        <div>
          <h2>${esc(m.name)}</h2>
          <div class="sub">${esc(m.title)} · ${esc((SERVICE_LINES.find(s=>s.id===m.serviceLine)||{}).name||'—')} ${m.offerings?('· '+m.offerings.join(', ')):''}</div>
        </div>
        <div class="page-actions">
          ${role.perms.addRequisition ? `<button class="btn btn-primary" id="mgr-raise-req">${Icon('plus')} Raise Requisition</button>` : ''}
        </div>
      </div>

      <div class="grid grid-4">
        ${summaryCard('Team size', sc.stats.total, 'users')}
        <div class="kpi-card"><div class="kpi-top"><span class="kpi-label">Saudi Ratio</span><span class="kpi-icon">${Icon('shield')}</span></div><div class="kpi-value">${Engine.fmtPct(sc.stats.ratio)}</div><div class="kpi-foot ${gap>=0?'up':'down'}">${gap>=0?'+':''}${Engine.fmtPct(gap)} vs ${Engine.fmtPct(cfg.target)} target</div></div>
        ${summaryCard('Open positions', sc.openReqs.length, 'pipeline')}
        <div class="kpi-card"><div class="kpi-top"><span class="kpi-label">Team Actions</span><span class="kpi-icon">${Icon('alertTriangle')}</span></div><div class="kpi-value ${sc.actionCount>0?'down':''}">${sc.actionCount}</div><div class="kpi-foot">records needing attention</div></div>
      </div>

      <div class="panel mt-16">
        <div class="tabs">
          ${tabDef().map(t => `<div class="tab-btn ${detailTab===t.id?'active':''}" data-tab="${t.id}">${t.label}${t.count!==undefined?` <span class="chip chip-grey" style="margin-left:4px;">${t.count}</span>`:''}</div>`).join('')}
        </div>
        <div class="tab-panel" id="mgr-tab-body"></div>
      </div>
    `;

    function tabDef() {
      return [
        { id: 'team', label: 'My Team', count: sc.activeTeam.length },
        { id: 'open', label: 'Open Positions', count: sc.openReqs.length },
        { id: 'leaving', label: 'Leaving Workers', count: sc.leavingSoon.length },
        { id: 'expiring', label: 'Expiring Records', count: expiringRecords.length },
        { id: 'actions', label: 'Team Actions', count: sc.actionCount },
        { id: 'future', label: 'Skills & Performance' },
      ];
    }

    paintTab();

    qsa('.tab-btn', root).forEach(b => b.addEventListener('click', () => { detailTab = b.dataset.tab; paintTab(); qsa('.tab-btn', root).forEach(x=>x.classList.toggle('active', x===b)); }));
    const back = qs('#mgr-back', root); if (back) back.addEventListener('click', () => { viewManagerId = null; render(root); });
    const raiseBtn = qs('#mgr-raise-req', root);
    if (raiseBtn) raiseBtn.addEventListener('click', () => Modules.pipeline.openRequisitionForm(null, { managerId, offering: m.offerings ? m.offerings[0] : null }));

    function paintTab() {
      const body = qs('#mgr-tab-body', root);
      if (detailTab === 'team') body.innerHTML = teamTabHtml(sc, m);
      else if (detailTab === 'open') body.innerHTML = openTabHtml(sc);
      else if (detailTab === 'leaving') body.innerHTML = leavingTabHtml(sc);
      else if (detailTab === 'expiring') body.innerHTML = expiringTabHtml(expiringRecords);
      else if (detailTab === 'actions') body.innerHTML = actionsTabHtml(expiringRecords);
      else if (detailTab === 'future') body.innerHTML = futureTabHtml();
      wireRowClicks(body);
      if (detailTab === 'team') drawTeamCharts(sc);
    }
  }

  function wireRowClicks(scopeEl) {
    // Not always a <tr> — the Team Actions tab renders alert-row <div>s with
    // the same data-open-emp hook, so match on the attribute, not the tag.
    qsa('[data-open-emp]', scopeEl).forEach(el => el.addEventListener('click', () => Modules.employees.openProfileDrawer(el.dataset.openEmp)));
  }

  function teamTabHtml(sc, m) {
    const profComp = Engine.professionCompliance(sc.activeTeam, Store.professionCategories).filter(c => c.total > 0);
    return `
      <div class="grid grid-3 mt-8" style="margin-bottom:18px;">
        <div class="panel panel-pad" style="min-width:0;"><div class="text-xs text-muted" style="font-weight:700;">By Nationality</div><div style="position:relative; height:150px; width:100%; overflow:hidden;"><canvas id="mgr-chart-nat" style="width:100%; height:100%;"></canvas></div></div>
        <div class="panel panel-pad" style="min-width:0;"><div class="text-xs text-muted" style="font-weight:700;">By Level</div><canvas id="mgr-chart-level" height="150"></canvas></div>
        <div class="panel panel-pad" style="min-width:0;"><div class="text-xs text-muted" style="font-weight:700;">By Location</div><div style="position:relative; height:150px; width:100%; overflow:hidden;"><canvas id="mgr-chart-loc" style="width:100%; height:100%;"></canvas></div></div>
      </div>
      ${profComp.length ? `
      <div class="panel panel-pad mb-16">
        <div class="flex items-center justify-between mb-8"><div class="text-xs text-muted" style="font-weight:700;">Profession-category compliance — this team</div><span class="text-xs text-muted">HRSD Saudization-of-professions, scoped to your team only</span></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Category</th><th>Team HC</th><th>Saudi %</th><th>Target</th><th>Status</th></tr></thead>
          <tbody>${profComp.map(c => `<tr>
            <td class="cell-name">${esc(c.name)} <span class="chip chip-grey">${c.code}</span></td>
            <td class="mono">${c.total}</td><td class="mono">${Engine.fmtPct(c.actual)}</td><td class="mono">${Engine.fmtPct(c.target,0)}</td>
            <td>${c.status==='On Target'?'<span class="chip chip-green">On Target</span>':`<span class="chip chip-red">Below Target</span> <span class="text-xs text-muted">−${c.gapHeads}</span>`}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>` : ''}
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Employee</th><th>Nationality</th><th>Offering</th><th>Account</th><th>Level</th><th>Tenure</th><th>RAG</th></tr></thead>
        <tbody>
          ${sc.derived.map(e => `<tr class="clickable" data-open-emp="${e.id}">
            <td class="cell-name"><span class="avatar-sm">${initials(e.name)}</span>${esc(e.name)}</td>
            <td>${esc(e.nationality)}</td><td>${esc(e.offering||'—')}</td><td>${esc(e.account||'—')}</td>
            <td>${esc(e.level||'—')}</td><td class="mono">${esc(e.tenureLabel)}</td><td>${ragChip(e.rag)}</td>
          </tr>`).join('') || `<tr><td colspan="7" class="table-empty">No active team members.</td></tr>`}
        </tbody>
      </table></div>`;
  }

  function drawTeamCharts(sc) {
    const byNat = Engine.groupBy(sc.activeTeam, 'nationality');
    mountChart('mgr-chart-nat', {
      type: 'pie',
      data: { labels: Object.keys(byNat), datasets: [{ data: Object.values(byNat).map(a=>a.length), backgroundColor: CHART_PALETTE }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9.5 } } } } }
    }, { labels: true, labelColor: '#fff', labelOptions: { font: { size: 9.5, weight: '700' } } });

    const byLevel = Engine.groupBy(sc.activeTeam, 'level');
    mountChart('mgr-chart-level', {
      type: 'bar',
      data: { labels: Object.keys(byLevel), datasets: [{ data: Object.values(byLevel).map(a=>a.length), backgroundColor: CHART_PALETTE[0], borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { display: false } } } }
    }, { labels: true, labelColor: '#241f30', labelOptions: { anchor: 'end', align: 'top', offset: 2, font: { size: 10, weight: '700' } } });

    const byLoc = Engine.groupBy(sc.activeTeam, 'location');
    mountChart('mgr-chart-loc', {
      type: 'pie',
      data: { labels: Object.keys(byLoc), datasets: [{ data: Object.values(byLoc).map(a=>a.length), backgroundColor: CHART_PALETTE.slice().reverse() }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9.5 } } } } }
    }, { labels: true, labelColor: '#fff', labelOptions: { font: { size: 9.5, weight: '700' } } });
  }

  function openTabHtml(sc) {
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Req #</th><th>Job Title</th><th>Account</th><th>Stage</th><th>Nationality</th><th>Target Start</th></tr></thead>
      <tbody>${sc.openReqs.map(r => `<tr><td class="mono">${r.reqNo}</td><td>${esc(r.jobTitle)}</td><td>${esc(r.account||'—')}</td><td><span class="chip chip-info">${esc(r.stage)}</span></td><td>${r.nationalityPriority==='Saudi Priority'?'<span class="chip chip-green">Saudi</span>':'<span class="chip chip-grey">Open</span>'}</td><td>${Engine.fmtDate(r.targetStartDate)}</td></tr>`).join('') || `<tr><td colspan="6" class="table-empty">No open positions for this manager.</td></tr>`}</tbody>
    </table></div>`;
  }

  function leavingTabHtml(sc) {
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Employee</th><th>Reason</th><th>Leaves In</th></tr></thead>
      <tbody>${sc.leavingSoon.map(e => `<tr class="clickable" data-open-emp="${e.id}"><td class="cell-name">${esc(e.name)}</td><td>${e.status==='Attrition'?'Resignation in notice':'Fixed-term contract end'}</td><td class="mono">${e.contractDaysLeft<=0?'Overdue':e.contractDaysLeft+'d'}</td></tr>`).join('') || `<tr><td colspan="3" class="table-empty">No confirmed leavers in the next 60 days.</td></tr>`}</tbody>
    </table></div>`;
  }

  function expiringTabHtml(list) {
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Employee</th><th>Flags</th></tr></thead>
      <tbody>${list.map(e => `<tr class="clickable" data-open-emp="${e.id}"><td class="cell-name">${esc(e.name)}</td><td>${e.ragReasons.map(r=>`<span class="chip ${e.rag==='red'?'chip-red':'chip-amber'}" style="margin:2px 4px 2px 0;">${esc(r)}</span>`).join('')}</td></tr>`).join('') || `<tr><td colspan="2" class="table-empty">No expiring records — clean team.</td></tr>`}</tbody>
    </table></div>`;
  }

  function actionsTabHtml(list) {
    if (!list.length) return `<div class="empty-state">${Icon('checkCircle')}<h4>No open actions</h4><p>This team has no outstanding compliance or data-quality flags.</p></div>`;
    return list.map(e => `<div class="alert-row" data-open-emp="${e.id}">
      <div class="alert-icon ${e.rag}">${Icon(e.rag==='red'?'alertCircle':'alertTriangle')}</div>
      <div class="alert-body"><div class="a-title">${esc(e.name)}</div><div class="a-detail">${e.ragReasons.map(esc).join(' · ')}</div></div>
      ${Icon('chevronRight')}
    </div>`).join('');
  }

  function futureTabHtml() {
    return `<div class="phase2-hero"><span class="badge-p2">Phase 2</span><div><h3 style="font-size:14px;">Skills, Learning &amp; Performance</h3><p class="text-sm text-muted mt-4">Competency matrix, certification tracking, learning-plan completion and performance-cycle status will roll up here per manager once those data sources are connected.</p></div></div>`;
  }

  return { render };
})();
