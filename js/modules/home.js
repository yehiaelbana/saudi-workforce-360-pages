// ============================================================================
// Home / Country Command Center — overview for every audience.
// No HR-only alert queue here (that lives in HR Workspace) — this page is the
// "are we safe, where's the risk, what happens next" view for everyone.
// ============================================================================

var Modules = window.Modules || {};
Modules.home = (() => {

  function render(root) {
    const entity = Store.entity;
    const cfg = Store.nitaqatConfig[entity];
    const allEmp = Store.employees.filter(e => e.entity === entity);
    const active = allEmp.filter(e => e.status === 'Active');
    const inactive = allEmp.filter(e => e.status === 'Inactive');
    const attrition = allEmp.filter(e => e.status === 'Attrition');
    const stats = Engine.headcountStats(active);
    const reqs = Store.requisitions.filter(r => r.entity === entity);
    const openReqs = reqs.filter(r => r.status !== 'Filled');
    const saudiPriorityPct = openReqs.length ? openReqs.filter(r => r.nationalityPriority === 'Saudi Priority').length / openReqs.length : 0;
    const proj = Engine.projection(Store.employees, Store.requisitions, Store.nitaqatConfig, 18, entity);
    const proj12 = proj[11] || proj[proj.length - 1];
    const jSoon = Engine.joiningSoon(openReqs, new Date(), 45);
    const lSoon = Engine.leavingSoon(allEmp, new Date(), 60);
    const zone = Engine.zoneFor(stats.ratio, cfg);
    const margin = Engine.marginToTarget(stats.ratio, cfg.target);
    const marginHeads = Math.round(marginToTargetHeads(stats.saudi, stats.total, cfg.target));

    const serviceLinesCovered = Engine.uniqueSorted(active, 'serviceLine').length;
    const accountsCovered = Engine.uniqueSorted(active, 'account').length;
    const managersCovered = Engine.uniqueSorted(active, 'managerId').length;

    const actions = []; // delegated click actions, see bindActions()

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h2>Country Command Center</h2>
          <div class="sub">${esc(cfg.entityLabel)} · live snapshot, recalculated from current data · ${new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="home-export">${Icon('download')} Export Snapshot</button>
          ${currentRole().perms.seeAlerts ? `<button class="btn btn-primary" id="home-hrws">${Icon('shield')} Open HR Workspace</button>` : `<button class="btn btn-primary" id="home-sim">${Icon('sliders')} Run a Scenario</button>`}
        </div>
      </div>

      <div class="grid grid-4 mt-16">
        ${kpiCard(actions, 'users', 'Active Workforce', Engine.fmtNum(stats.total), `${inactive.length} inactive · ${attrition.length} in notice period`, { route: 'employees', filters: { status: 'Active' } })}
        ${kpiCard(actions, 'shield', 'Saudi Workforce Ratio', Engine.fmtPct(stats.ratio), zoneChip(zone.name), { route: 'hrworkspace' }, zoneKeyFor(zone.name))}
        ${kpiCard(actions, 'flag', 'Margin to Target', (margin>=0?'+':'') + Engine.fmtPct(margin), `${marginHeads>=0?'+':''}${marginHeads} Saudi heads vs ${Engine.fmtPct(cfg.target)} target`, { route: 'hrworkspace' }, margin>=0?'up':'down')}
        ${kpiCard(actions, 'pipeline', 'Open Pipeline', Engine.fmtNum(openReqs.length), `${Engine.fmtPct(saudiPriorityPct,0)} Saudi-priority requisitions`, { route: 'pipeline' })}
      </div>
      <div class="grid grid-4 mt-16">
        ${kpiCard(actions, 'trendUp', 'Projected Workforce · 12mo', Engine.fmtNum(proj12 ? proj12.headcount : stats.total), proj12 ? `${Engine.fmtPct(proj12.ratio)} Saudi · ${zoneChip(proj12.zone)}` : '—', { route: 'simulator' })}
        ${kpiCard(actions, 'calendar', 'Joining Soon · 45 days', Engine.fmtNum(jSoon.length), 'From confirmed pipeline requisitions', { route: 'pipeline', filters: { stage: '__soon' } })}
        ${kpiCard(actions, 'clock', 'Leaving Soon · 60 days', Engine.fmtNum(lSoon.length), 'Contract end date or active notice period', { route: 'employees', filters: { __leavingSoon: true } })}
        ${kpiCard(actions, 'building', 'Coverage', `${serviceLinesCovered}<small>/${SERVICE_LINES.length} lines</small>`, `${accountsCovered} active accounts · ${managersCovered} people managers`, { route: 'managers' })}
      </div>

      <div class="panel mt-16">
        <div class="panel-head">
          <div><h3>${Icon('shield', 'inline-icon')} Where do we stand — Nitaqat / Saudization zone</h3><div class="sub">${esc(cfg.registeredActivity)} · ${esc(cfg.sizeCategory)}</div></div>
          <span class="chip chip-grey">Planning indicator — pending HR/Legal &amp; official Qiwa confirmation</span>
        </div>
        <div class="panel-body">
          <div class="grid grid-12" style="align-items:center;">
            <div style="grid-column: span 8;">${renderZoneGauge(stats.ratio, cfg)}</div>
            <div style="grid-column: span 4; border-left:1px solid var(--grey-100); padding-left:20px;">
              <div class="text-xs text-muted" style="font-weight:700; text-transform:uppercase;">${esc(zone.name)} zone means</div>
              <ul style="margin-top:6px;">
                ${(ZONE_CONSEQUENCES[zone.name]?.points || []).slice(0,3).map(p => `<li class="text-sm" style="padding:3px 0; display:flex; gap:6px;">${Icon('check')} <span>${esc(p)}</span></li>`).join('')}
              </ul>
              <a href="#hrworkspace" class="text-sm" style="font-weight:700;">Full regulatory workspace ${Icon('arrowRight')}</a>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>Headcount &amp; Saudi ratio projection</h3><div class="sub">Next 18 months · pipeline joiners minus contract-end / modeled attrition</div></div></div>
          <div class="panel-body"><canvas id="home-chart-proj" height="230"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Workforce composition</h3><div class="sub">Active, ${entity === 'KSA' ? 'DXC Saudi Arabia' : 'Regional HQ'}</div></div></div>
          <div class="panel-body grid grid-2" style="gap:10px;">
            <div style="min-width:0;"><div style="position:relative; height:180px; width:100%; overflow:hidden;"><canvas id="home-chart-nat" style="width:100%; height:100%;"></canvas></div></div>
            <div style="min-width:0;"><div style="position:relative; height:180px; width:100%; overflow:hidden;"><canvas id="home-chart-gender" style="width:100%; height:100%;"></canvas></div></div>
          </div>
          <div class="panel-foot text-xs text-muted">National context: Saudi female labour-force participation reached 36.3% in Q1 2025, already above the original 30% Vision 2030 target (General Authority for Statistics / MHRSD reporting) — shown for reference only, not a direct comparison to this workforce's mix.</div>
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>Service line health</h3><div class="sub">Headcount, Saudi ratio vs company target</div></div></div>
          <div class="table-wrap"><table class="data-table" id="home-sl-table"></table></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Offering mix</h3><div class="sub">Active headcount by offering</div></div></div>
          <div class="panel-body"><canvas id="home-chart-offering" height="230"></canvas></div>
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>Account health</h3><div class="sub">Click a row to drill into that account's roster</div></div></div>
          <div class="table-wrap"><table class="data-table" id="home-acc-table"></table></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>People manager leaderboard</h3><div class="sub">By team size · click to open the manager cockpit</div></div></div>
          <div class="table-wrap"><table class="data-table" id="home-mgr-table"></table></div>
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head">
            <div><h3>${Icon('flag','inline-icon')} Profession-category watchlist</h3><div class="sub">HRSD job-localization targets, independent of the overall Nitaqat ratio</div></div>
            <a href="#hrworkspace" class="text-sm" style="font-weight:700; white-space:nowrap;">Full breakdown ${Icon('arrowRight')}</a>
          </div>
          <div class="table-wrap"><table class="data-table" id="home-profcat-table"></table></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Seniority mix</h3><div class="sub">Active headcount by job level · ${entity === 'KSA' ? 'DXC Saudi Arabia' : 'Regional HQ'}</div></div></div>
          <div class="panel-body"><canvas id="home-chart-level" height="230"></canvas></div>
        </div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head"><div><h3>${Icon('clock','inline-icon')} Tenure distribution</h3><div class="sub">Years of service, active workforce — a quick read on retention depth and flight risk after year 1</div></div></div>
        <div class="panel-body"><canvas id="home-chart-tenure" height="180"></canvas></div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>${Icon('calendar','inline-icon')} Joining soon</h3><div class="sub">Next 45 days, from Demand &amp; Supply pipeline</div></div><span class="chip chip-purple">${jSoon.length}</span></div>
          <div class="table-wrap"><table class="data-table" id="home-joining-table"></table></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>${Icon('clock','inline-icon')} Leaving soon</h3><div class="sub">Contract end within 60 days or active notice period</div></div><span class="chip chip-amber">${lSoon.length}</span></div>
          <div class="table-wrap"><table class="data-table" id="home-leaving-table"></table></div>
        </div>
      </div>

    `;

    // ---- tables ----
    renderServiceLineTable(active, cfg);
    renderAccountTable(active, cfg);
    renderManagerLeaderboard(active);
    renderJoiningTable(jSoon);
    renderLeavingTable(lSoon);
    renderProfessionWatchlist(active);

    // ---- charts ----
    drawProjectionChart(proj);
    drawNationalityChart(active);
    drawGenderChart(active);
    drawOfferingChart(active);
    drawLevelChart(active);
    drawTenureChart(active);

    // ---- actions ----
    bindKpiActions(root, actions);
    qs('#home-export', root).addEventListener('click', () => exportSnapshot(entity, stats, cfg, zone));
    const hrws = qs('#home-hrws', root); if (hrws) hrws.addEventListener('click', () => navigate('hrworkspace'));
    const sim = qs('#home-sim', root); if (sim) sim.addEventListener('click', () => navigate('simulator'));
  }

  function marginToTargetHeads(saudi, total, target) { return saudi - Math.round(target * total); }

  function kpiCard(actions, icon, label, value, footHtml, goto, tone) {
    const id = 'kpi' + actions.length;
    actions.push({ id, goto });
    const toneClass = tone === 'up' ? 'up' : tone === 'down' ? 'down' : '';
    return `
      <div class="kpi-card clickable" data-act="${id}">
        <div class="kpi-top">
          <span class="kpi-label">${esc(label)}</span>
          <span class="kpi-icon">${Icon(icon)}</span>
        </div>
        <div class="kpi-value ${toneClass}">${value}</div>
        <div class="kpi-foot">${footHtml}</div>
      </div>`;
  }

  function bindKpiActions(root, actions) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const a = actions.find(x => x.id === el.dataset.act);
      if (a) goTo(a.goto.route, a.goto.filters);
    });
  }

  function renderServiceLineTable(active, cfg) {
    const el = qs('#home-sl-table');
    const rows = SERVICE_LINES.map(sl => {
      const pool = active.filter(e => e.serviceLine === sl.id);
      const s = Engine.headcountStats(pool);
      return { sl, s };
    }).filter(r => r.s.total > 0).sort((a,b) => b.s.total - a.s.total);
    el.innerHTML = `
      <thead><tr><th>Service Line</th><th>Headcount</th><th>Saudi %</th><th>vs Target</th><th>Status</th></tr></thead>
      <tbody>
        ${rows.map(r => {
          const gap = r.s.ratio - cfg.target;
          const rag = gap >= 0 ? 'green' : gap >= -0.08 ? 'amber' : 'red';
          return `<tr class="clickable" data-sl="${r.sl.id}">
            <td class="cell-name">${esc(r.sl.name)}</td>
            <td class="mono">${r.s.total}</td>
            <td class="mono">${Engine.fmtPct(r.s.ratio)}</td>
            <td class="mono ${gap>=0?'up':'down'}">${gap>=0?'+':''}${Engine.fmtPct(gap)}</td>
            <td>${ragChip(rag, rag==='green'?'Healthy':rag==='amber'?'Watch':'At Risk')}</td>
          </tr>`;
        }).join('') || `<tr><td colspan="5" class="table-empty">No active headcount for this entity.</td></tr>`}
      </tbody>`;
    qsa('tr[data-sl]', el).forEach(tr => tr.addEventListener('click', () => {
      Router.pendingServiceLine = tr.dataset.sl;
      navigate('managers');
    }));
  }

  function renderAccountTable(active, cfg) {
    const el = qs('#home-acc-table');
    const byAcc = Engine.groupBy(active, 'account');
    const rows = Object.keys(byAcc).map(acc => ({ acc, s: Engine.headcountStats(byAcc[acc]) }))
      .sort((a,b) => b.s.total - a.s.total).slice(0, 8);
    el.innerHTML = `
      <thead><tr><th>Account</th><th>Headcount</th><th>Saudi %</th><th>Status</th></tr></thead>
      <tbody>
        ${rows.map(r => {
          const gap = r.s.ratio - cfg.target;
          const rag = gap >= 0 ? 'green' : gap >= -0.1 ? 'amber' : 'red';
          return `<tr class="clickable" data-acc="${esc(r.acc)}">
            <td class="cell-name">${esc(r.acc)}</td>
            <td class="mono">${r.s.total}</td>
            <td class="mono">${Engine.fmtPct(r.s.ratio)}</td>
            <td>${ragChip(rag, rag==='green'?'Healthy':rag==='amber'?'Watch':'At Risk')}</td>
          </tr>`;
        }).join('')}
      </tbody>`;
    qsa('tr[data-acc]', el).forEach(tr => tr.addEventListener('click', () => goTo('employees', { account: tr.dataset.acc })));
  }

  function renderManagerLeaderboard(active) {
    const el = qs('#home-mgr-table');
    const byMgr = Engine.groupBy(active, 'managerId');
    const rows = Object.keys(byMgr).filter(id => id !== 'mgr-unassigned').map(id => {
      const mgr = MANAGERS.find(m => m.id === id) || SERVICE_LINE_LEADS.find(m=>m.id===id);
      const s = Engine.headcountStats(byMgr[id]);
      return { mgr, s, count: byMgr[id].length };
    }).filter(r => r.mgr).sort((a,b) => b.count - a.count).slice(0, 8);
    el.innerHTML = `
      <thead><tr><th>Manager</th><th>Team</th><th>Saudi %</th><th></th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr class="clickable" data-mgr="${r.mgr.id}">
            <td class="cell-name"><span class="avatar-sm">${initials(r.mgr.name)}</span>${esc(r.mgr.name)}</td>
            <td class="mono">${r.count}</td>
            <td class="mono">${Engine.fmtPct(r.s.ratio)}</td>
            <td>${Icon('chevronRight')}</td>
          </tr>`).join('')}
      </tbody>`;
    qsa('tr[data-mgr]', el).forEach(tr => tr.addEventListener('click', () => goTo('managers', null, tr.dataset.mgr)));
  }

  function renderJoiningTable(jSoon) {
    const el = qs('#home-joining-table');
    el.innerHTML = `
      <thead><tr><th>Req #</th><th>Role</th><th>Account</th><th>Nationality</th><th>Starts</th></tr></thead>
      <tbody>
        ${jSoon.slice(0,7).map(r => `<tr>
          <td class="mono">${r.reqNo}</td>
          <td>${esc(r.jobTitle)}</td>
          <td>${esc(r.account||'—')}</td>
          <td>${r.nationalityPriority === 'Saudi Priority' ? '<span class="chip chip-green">Saudi Priority</span>' : '<span class="chip chip-grey">Open</span>'}</td>
          <td class="mono">${r.daysToStart<=0 ? 'Due now' : r.daysToStart+'d'}</td>
        </tr>`).join('') || `<tr><td colspan="5" class="table-empty">No confirmed starters in the next 45 days.</td></tr>`}
      </tbody>`;
  }

  function renderLeavingTable(lSoon) {
    const el = qs('#home-leaving-table');
    el.innerHTML = `
      <thead><tr><th>Employee</th><th>Account</th><th>Reason</th><th>Leaves</th></tr></thead>
      <tbody>
        ${lSoon.slice(0,7).map(e => `<tr>
          <td class="cell-name">${esc(e.name)}</td>
          <td>${esc(e.account||'—')}</td>
          <td>${e.status==='Attrition' ? 'Resignation in notice' : 'Fixed-term contract end'}</td>
          <td class="mono ${e.contractDaysLeft!==null && e.contractDaysLeft<0 ? 'down':''}">${e.contractDaysLeft===null?'—':(e.contractDaysLeft<=0?'Overdue':e.contractDaysLeft+'d')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="table-empty">No confirmed leavers in the next 60 days.</td></tr>`}
      </tbody>`;
  }

  function renderProfessionWatchlist(active) {
    const el = qs('#home-profcat-table');
    const rows = Engine.professionCompliance(active, Store.professionCategories)
      .filter(r => r.total > 0)
      .sort((a, b) => (a.status === 'Below Target' ? 0 : 1) - (b.status === 'Below Target' ? 0 : 1) || b.gapHeads - a.gapHeads)
      .slice(0, 6);
    el.innerHTML = `
      <thead><tr><th>Category</th><th>Headcount</th><th>Saudi %</th><th>Target</th><th>Status</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td class="cell-name">${esc(r.name)} <span class="cell-sub">${r.code}</span></td>
          <td class="mono">${r.total}</td>
          <td class="mono">${Engine.fmtPct(r.actual)}</td>
          <td class="mono">${Engine.fmtPct(r.target,0)}</td>
          <td>${r.status === 'On Target' ? ragChip('green','On Target') : `${ragChip('red','Below Target')} <span class="text-xs text-muted">−${r.gapHeads}</span>`}</td>
        </tr>`).join('') || `<tr><td colspan="5" class="table-empty">No Saudization-mandated categories with headcount yet.</td></tr>`}
      </tbody>`;
  }

  function drawProjectionChart(proj) {
    mountChart('home-chart-proj', {
      type: 'line',
      data: {
        labels: proj.map(p => p.label),
        datasets: [
          { label: 'Projected headcount', data: proj.map(p => p.headcount), borderColor: CHART_PALETTE[0], backgroundColor: CHART_PALETTE[0]+'22', fill: true, tension: 0.35, yAxisID: 'y' },
          { label: 'Saudi ratio', data: proj.map(p => +(p.ratio*100).toFixed(1)), borderColor: CHART_PALETTE[1], borderDash: [4,3], yAxisID: 'y1', tension: 0.35 },
          { label: 'Target %', data: proj.map(p => +(p.target*100).toFixed(1)), borderColor: CHART_PALETTE[5], borderDash: [2,2], pointRadius: 0, yAxisID: 'y1' },
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: baseChartFont() } } },
        scales: {
          y: { position: 'left', title: { display: true, text: 'Headcount', font: baseChartFont() }, ticks: { font: baseChartFont() } },
          y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Saudi %', font: baseChartFont() }, ticks: { font: baseChartFont(), callback: v => v + '%' } },
          x: { ticks: { font: baseChartFont() } },
        }
      }
    });
  }

  function drawNationalityChart(active) {
    const saudi = active.filter(e => e.isSaudi).length;
    const nonSaudi = active.length - saudi;
    mountChart('home-chart-nat', {
      type: 'doughnut',
      data: { labels: ['Saudi', 'Non-Saudi'], datasets: [{ data: [saudi, nonSaudi], backgroundColor: [CHART_PALETTE[0], CHART_PALETTE[6]] }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: baseChartFont() } }, title: { display: true, text: 'Nationality', font: baseChartFont() } }, cutout: '62%' }
    }, { labels: true, labelColor: '#fff', labelFormatter: (v, ctx) => v ? `${v}` : '' });
  }

  function drawGenderChart(active) {
    const byG = Engine.groupBy(active, 'gender');
    const labels = Object.keys(byG).filter(k => k !== 'Unassigned');
    mountChart('home-chart-gender', {
      type: 'doughnut',
      data: { labels, datasets: [{ data: labels.map(l => byG[l].length), backgroundColor: [CHART_PALETTE[1], CHART_PALETTE[2], CHART_PALETTE[6]] }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: baseChartFont() } }, title: { display: true, text: 'Gender', font: baseChartFont() } }, cutout: '62%' }
    }, { labels: true, labelColor: '#fff' });
  }

  function drawOfferingChart(active) {
    const byOff = Engine.groupBy(active, 'offering');
    const rows = Object.keys(byOff).map(k => ({ k, n: byOff[k].length })).sort((a,b) => b.n - a.n);
    mountChart('home-chart-offering', {
      type: 'bar',
      data: { labels: rows.map(r => r.k), datasets: [{ label: 'Headcount', data: rows.map(r => r.n), backgroundColor: CHART_PALETTE[0], borderRadius: 4, maxBarThickness: 26 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { font: baseChartFont() } }, y: { ticks: { font: baseChartFont() } } } }
    }, { labels: true, labelColor: '#241f30', labelOptions: { anchor: 'end', align: 'right', offset: 2 } });
  }

  function drawLevelChart(active) {
    const byLevel = Engine.groupBy(active, 'level');
    const rows = LEVELS.map(l => ({ l, n: (byLevel[l] || []).length })).filter(r => r.n > 0);
    mountChart('home-chart-level', {
      type: 'bar',
      data: { labels: rows.map(r => r.l), datasets: [{ label: 'Headcount', data: rows.map(r => r.n), backgroundColor: CHART_PALETTE[3], borderRadius: 4, maxBarThickness: 22 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { font: baseChartFont() } }, y: { ticks: { font: baseChartFont() } } } }
    }, { labels: true, labelColor: '#241f30', labelOptions: { anchor: 'end', align: 'right', offset: 2 } });
  }

  function drawTenureChart(active) {
    const bands = [
      { label: '< 1 year', test: y => y < 1 },
      { label: '1–2 years', test: y => y >= 1 && y < 2 },
      { label: '2–3 years', test: y => y >= 2 && y < 3 },
      { label: '3–5 years', test: y => y >= 3 && y < 5 },
      { label: '5–10 years', test: y => y >= 5 && y < 10 },
      { label: '10+ years', test: y => y >= 10 },
    ];
    const derived = active.map(e => Engine.deriveEmployee(e));
    const counts = bands.map(b => derived.filter(e => b.test(e.tenureYears || 0)).length);
    mountChart('home-chart-tenure', {
      type: 'bar',
      data: { labels: bands.map(b => b.label), datasets: [{ label: 'Headcount', data: counts, backgroundColor: CHART_PALETTE[4], borderRadius: 5, maxBarThickness: 60 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0, font: baseChartFont() } }, x: { ticks: { font: baseChartFont() } } } }
    }, { labels: true, labelColor: '#241f30', labelOptions: { anchor: 'end', align: 'top', offset: 4, font: { weight: '700' } } });
  }

  function exportSnapshot(entity, stats, cfg, zone) {
    const rows = [
      { k: 'Entity', v: cfg.entityLabel },
      { k: 'Snapshot Date', v: new Date().toISOString() },
      { k: 'Active Workforce', v: stats.total },
      { k: 'Saudi Count', v: stats.saudi },
      { k: 'Saudi Ratio', v: Engine.fmtPct(stats.ratio) },
      { k: 'Target', v: Engine.fmtPct(cfg.target) },
      { k: 'Zone', v: zone.name },
    ];
    const csv = Engine.toCSV(rows, [{ label: 'Metric', value: 'k' }, { label: 'Value', value: 'v' }]);
    Engine.downloadCSV(`sw360-home-snapshot-${entity}.csv`, csv);
    toast('Snapshot exported');
  }

  return { render };
})();
