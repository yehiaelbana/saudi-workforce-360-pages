// ============================================================================
// Saudi HR Workspace — the regulatory control room. HR/Admin only. This is
// the module the whole app exists to support: "which Nitaqat zone are we in,
// and what do we need to do about it." Everything here is computed live from
// Engine + the current NITAQAT_CONFIG so editing the config in Administration
// (or here) actually moves the numbers.
// ============================================================================

var Modules = window.Modules || {};
Modules.hrworkspace = (() => {

  let jobTitleSearch = '';

  function render(root) {
    if (!currentRole().perms.seeAlerts) {
      root.innerHTML = `<div class="empty-state">${Icon('lock')}<h4>HR &amp; Admin access only</h4><p>Switch role to "HR &amp; Admin" (top right) to open the regulatory workspace.</p></div>`;
      return;
    }
    const entity = Store.entity;
    const cfg = Store.nitaqatConfig[entity];
    const active = Store.employees.filter(e => e.entity === entity && e.status === 'Active');
    const derived = active.map(e => Engine.deriveEmployee(e));
    const stats = Engine.headcountStats(active);
    const zone = Engine.zoneFor(stats.ratio, cfg);
    const margin = Engine.marginToTarget(stats.ratio, cfg.target);
    const marginHeads = stats.saudi - Math.round(cfg.target * stats.total);
    const nextGap = Engine.nextZoneGap(stats.ratio, stats.saudi, stats.total, cfg);
    const actions = Engine.actionQueue(Store.employees, Store.requisitions, Store.nitaqatConfig).filter(a => entity === 'KSA' || true);
    const profComp = Engine.professionCompliance(active, Store.professionCategories);
    const jobComp = Engine.jobTitleCompliance(active, Store.professionCategories).filter(j => !jobTitleSearch || j.jobTitle.toLowerCase().includes(jobTitleSearch.toLowerCase()));
    const jobCompTop = Engine.jobTitleCompliance(active, Store.professionCategories).slice(0, 12);

    const qiwaDocumented = derived.filter(e => e.qiwaStatus === 'Documented').length;
    const qiwaPending = derived.filter(e => e.qiwaStatus === 'Pending Documentation').length;
    const qiwaMissing = derived.filter(e => e.qiwaStatus === 'Not Documented').length;
    const qiwaMissingSaudi = derived.filter(e => e.qiwaStatus === 'Not Documented' && e.isSaudi).length;

    const iqamaPool = derived.filter(e => !e.isSaudi);
    const iqamaValid = iqamaPool.filter(e => e.iqamaStatus === 'Valid').length;
    const iqamaSoon = iqamaPool.filter(e => e.iqamaStatus === 'Expiring Soon').length;
    const iqamaExpired = iqamaPool.filter(e => e.iqamaStatus === 'Expired').length;
    const iqamaMissing = iqamaPool.filter(e => e.iqamaStatus === 'Not on File').length;

    const allEntityEmp = Store.employees.filter(e => e.entity === entity);
    const attritionPool = allEntityEmp.filter(e => e.status === 'Attrition');
    const attritionSaudi = attritionPool.filter(e => e.isSaudi).length;
    const milestoneGroups = Engine.groupBy(active.filter(e => e.milestoneTag), 'milestoneTag');
    const milestoneOrder = Object.keys(milestoneGroups).sort((a,b) => (parseInt(a)||0) - (parseInt(b)||0));

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Saudi HR Workspace</h2><div class="sub">${esc(cfg.entityLabel)} — Nitaqat planning, Qiwa documentation, and compliance control room</div></div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="hrw-export">${Icon('download')} Export Compliance Snapshot</button>
          <button class="btn btn-primary" id="hrw-config">${Icon('settings')} Edit Regulatory Config</button>
        </div>
      </div>

      <div class="disclaimer-box mb-8" style="margin-bottom:16px;">
        ${Icon('alertTriangle')}
        <span>Planning indicator only. Figures here support internal HR workforce planning and do not replace Qiwa's official Nitaqat calculation, HRSD determinations, or HR/Legal advice. Confirm classification directly in Qiwa before acting on visa, hiring, or transfer decisions.</span>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div><h3>${Icon('shield','inline-icon')} Nitaqat position</h3><div class="sub">${esc(cfg.registeredActivity)} · ${esc(cfg.sizeCategory)}</div></div>
          <span class="chip chip-grey">${esc(cfg.ruleVersion)}</span>
        </div>
        <div class="panel-body">
          <div class="grid grid-12">
            <div style="grid-column: span 8;">
              ${renderZoneGauge(stats.ratio, cfg)}
              <div class="grid grid-4 mt-16">
                ${miniStat('Active Workforce', Engine.fmtNum(stats.total))}
                ${miniStat('Saudi / Non-Saudi', `${stats.saudi} / ${stats.nonSaudi}`)}
                ${miniStat('Margin to Target', `${margin>=0?'+':''}${Engine.fmtPct(margin)}`, margin>=0?'up':'down')}
                ${miniStat('Heads vs Target', `${marginHeads>=0?'+':''}${marginHeads}`, marginHeads>=0?'up':'down')}
              </div>
            </div>
            <div style="grid-column: span 4; border-left:1px solid var(--grey-100); padding-left:20px;">
              <div class="text-xs text-muted" style="font-weight:700; text-transform:uppercase;">${esc(zone.name)} zone — what it means</div>
              <ul class="mt-8">${(ZONE_CONSEQUENCES[zone.name]?.points||[]).map(p=>`<li class="text-sm" style="padding:4px 0; display:flex; gap:6px;">${Icon('check')}<span>${esc(p)}</span></li>`).join('')}</ul>
              ${nextGap ? `<div class="chip chip-purple mt-8">${nextGap.headsShort} more Saudi heads → ${esc(nextGap.nextZoneName)} zone</div>` : `<div class="chip chip-green mt-8">Already at Platinum — best available standing</div>`}
            </div>
          </div>
        </div>
        <div class="panel-foot text-xs text-muted">${GOSI_WEIGHT_NOTE}</div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head">
          <div><h3>${Icon('alertTriangle','inline-icon')} Compliance action queue</h3><div class="sub">Computed live from current records · recommended owner shown per item</div></div>
          <span class="chip chip-red">${actions.filter(a=>a.severity==='red').length} urgent</span>
        </div>
        <div class="panel-body">
          ${actions.length ? actions.map(a => `
            <div class="alert-row" data-filter='${escAttr(JSON.stringify(a.filter))}'>
              <div class="alert-icon ${a.severity}">${Icon(a.severity==='red'?'alertCircle':'alertTriangle')}</div>
              <div class="alert-body"><div class="a-title">${esc(a.title)}</div><div class="a-detail">${esc(a.detail)}</div><div class="a-detail" style="margin-top:3px;"><b>Owner:</b> ${esc(a.owner||'HR & Admin')}</div></div>
              <div class="alert-count">${a.count}</div>
            </div>`).join('') : `<div class="empty-state">${Icon('checkCircle')}<h4>Queue is clear</h4><p>No open compliance or data-quality actions right now.</p></div>`}
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>Qiwa contract documentation</h3><div class="sub">${esc(QIWA_RULE_NOTE.slice(0,84))}…</div></div></div>
          <div class="panel-body grid grid-2" style="align-items:center;">
            <canvas id="hrw-chart-qiwa" height="180"></canvas>
            <div>
              ${miniRow('Documented', qiwaDocumented, 'green')}
              ${miniRow('Pending', qiwaPending, 'amber')}
              ${miniRow('Not Documented', qiwaMissing, 'red')}
              ${qiwaMissingSaudi>0 ? `<div class="chip chip-red mt-8">${qiwaMissingSaudi} Saudi contracts excluded from ratio credit</div>` : ''}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Iqama / work authorization</h3><div class="sub">Non-Saudi active workforce, ${iqamaPool.length} records</div></div></div>
          <div class="panel-body grid grid-2" style="align-items:center;">
            <canvas id="hrw-chart-iqama" height="180"></canvas>
            <div>
              ${miniRow('Valid (60d+)', iqamaValid, 'green')}
              ${miniRow('Expiring ≤60d', iqamaSoon, 'amber')}
              ${miniRow('Expired', iqamaExpired, 'red')}
              ${miniRow('Not on file', iqamaMissing, 'amber')}
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>Attrition &amp; notice</h3><div class="sub">Confirmed resignations in notice, this entity</div></div><span class="chip ${attritionPool.length?'chip-amber':'chip-green'}">${attritionPool.length}</span></div>
          <div class="panel-body">
            ${attritionPool.length ? `
              ${miniRow('In notice period', attritionPool.length, 'amber')}
              ${miniRow('— of which Saudi', attritionSaudi, attritionSaudi>0?'red':'green')}
              <div class="text-xs text-muted mt-8">Saudi departures reduce the ratio numerator immediately — worth checking backfill priority against <a href="#pipeline">Demand &amp; Supply</a>.</div>
            ` : `<div class="empty-state" style="padding:20px;">${Icon('checkCircle')}<h4>No one in notice</h4></div>`}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Tenure milestones</h3><div class="sub">Active workforce, upcoming/recent recognition anniversaries</div></div></div>
          <div class="panel-body">
            ${milestoneOrder.length ? milestoneOrder.map(m => miniRow(m, milestoneGroups[m].length, 'info')).join('') : `<div class="text-sm text-muted" style="padding:8px 0;">No milestone data recorded for this entity yet.</div>`}
            ${milestoneOrder.length ? `<div class="text-xs text-muted mt-8">Feeds the "Work Anniversary" notification template (Administration → Notifications) once that channel is wired up.</div>` : ''}
          </div>
        </div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head"><div><h3>Nationality mix by service line</h3><div class="sub">Headcount heatmap — darker cell = more people; top 5 non-Saudi nationalities by overall headcount, plus Saudi and Other</div></div></div>
        <div class="panel-body"><canvas id="hrw-chart-matrix" height="150"></canvas></div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head">
          <div><h3>Profession / job-localization compliance</h3><div class="sub">HRSD-aligned Saudization-of-professions targets, independent of the overall Nitaqat ratio</div></div>
        </div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Category</th><th>Target</th><th>Headcount</th><th>Saudi</th><th>Actual</th><th>Status</th><th>Gap</th></tr></thead>
          <tbody>
            ${profComp.map(c => `<tr class="clickable" data-prof="${c.code}">
              <td class="cell-name">${esc(c.name)} <span class="chip chip-grey">${c.code}</span></td>
              <td class="mono">${Engine.fmtPct(c.target,0)}</td>
              <td class="mono">${c.total}</td>
              <td class="mono">${c.saudi}</td>
              <td class="mono">${c.actual===null?'—':Engine.fmtPct(c.actual)}</td>
              <td>${c.status==='On Target'?'<span class="chip chip-green">On Target</span>':c.status==='Below Target'?'<span class="chip chip-red">Below Target</span>':'<span class="chip chip-grey">No Headcount</span>'}</td>
              <td class="mono">${c.gapHeads>0?`+${c.gapHeads} needed`:'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        <div class="panel-foot text-xs text-muted">Source: DXC KSA Saudization-of-professions reference table (Arabic/English profession mapping). Category codes: EP=Engineering, CITE=Comms &amp; IT Engineering, ADPA=App Dev/Programming/Analytics, TSTC=Technical Support/Comms, AP=Accounting, PMP=Project Management, SP=Sales.</div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head">
          <div><h3>Distribution by job title</h3><div class="sub">Every active job title, its HRSD category and how that specific role is tracking — two job titles in the same category can sit at very different Saudi ratios</div></div>
          <span class="chip chip-grey">${jobComp.length} job titles</span>
        </div>
        <div class="panel-body">
          <canvas id="hrw-chart-jobtitle" height="220"></canvas>
        </div>
        <div class="table-toolbar">
          <div class="search-box" style="min-width:240px;">${Icon('search')}<input type="text" id="hrw-job-search" placeholder="Filter job titles…" value="${esc(jobTitleSearch)}"/></div>
          <div class="table-count">${jobComp.reduce((a,j)=>a+j.total,0)} employees across ${jobComp.length} titles</div>
        </div>
        <div class="table-wrap" style="max-height:420px; overflow-y:auto;"><table class="data-table">
          <thead><tr><th>Job Title</th><th>Category</th><th>Headcount</th><th>Saudi</th><th>Saudi %</th><th>Category Target</th><th>Status</th></tr></thead>
          <tbody>
            ${jobComp.map(j => `<tr class="clickable" data-jobtitle="${esc(j.jobTitle)}">
              <td class="cell-name">${esc(j.jobTitle)}</td>
              <td>${j.categoryName ? esc(j.categoryName) + ' <span class="chip chip-grey">'+esc(j.professionCode)+'</span>' : '<span class="text-muted">Not mapped</span>'}</td>
              <td class="mono">${j.total}</td>
              <td class="mono">${j.saudi}</td>
              <td class="mono">${j.actual===null?'—':Engine.fmtPct(j.actual)}</td>
              <td class="mono">${j.target===null?'—':Engine.fmtPct(j.target,0)}</td>
              <td>${j.status==='On Target'?'<span class="chip chip-green">On Target</span>':j.status==='Below Target'?'<span class="chip chip-red">Below Target</span>':j.status==='Not Saudization-Mandated'?'<span class="chip chip-grey">Not Mandated</span>':'<span class="chip chip-amber">No Category</span>'}</td>
            </tr>`).join('') || `<tr><td colspan="7" class="table-empty">No job titles match "${esc(jobTitleSearch)}".</td></tr>`}
          </tbody>
        </table></div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>Saudization by account</h3></div></div>
          <div class="table-wrap"><table class="data-table" id="hrw-acc-table"></table></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Saudization by offering</h3></div></div>
          <div class="table-wrap"><table class="data-table" id="hrw-off-table"></table></div>
        </div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head"><div><h3>Regulatory configuration &amp; version</h3><div class="sub">Owned by HR — editable, versioned, and pending official confirmation</div></div></div>
        <div class="info-list" style="padding-top:16px;">
          <div class="info-item"><label>Registered Activity</label><div>${esc(cfg.registeredActivity)}</div></div>
          <div class="info-item"><label>Activity Reference</label><div>${esc(cfg.activityRef)}</div></div>
          <div class="info-item"><label>Entity Size Category</label><div>${esc(cfg.sizeCategory)}</div></div>
          <div class="info-item"><label>Rule Version</label><div>${esc(cfg.ruleVersion)}</div></div>
          <div class="info-item"><label>Last Reviewed</label><div>${Engine.fmtDate(cfg.lastReviewed)}</div></div>
          <div class="info-item"><label>Reviewed By</label><div>${esc(cfg.reviewedBy)}</div></div>
        </div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head"><div><h3>Zone reference — full band table</h3><div class="sub">All five bands for ${esc(cfg.entityLabel)}</div></div></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Zone</th><th>Range</th><th>Standing</th></tr></thead>
          <tbody>${cfg.zones.map(z => `<tr class="${z.name===zone.name?'':''}" style="${z.name===zone.name?'background:var(--dxc-purple-tint);':''}">
            <td>${zoneChip(z.name)}</td><td class="mono">${Engine.fmtPct(z.min)} – ${z.max>=1?'100%+':Engine.fmtPct(z.max)}</td><td>${esc(ZONE_CONSEQUENCES[z.name]?.tag||'')}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>
    `;

    renderAccTable(active, cfg);
    renderOffTable(active, cfg);
    drawDonut('hrw-chart-qiwa', ['Documented','Pending','Not Documented'], [qiwaDocumented, qiwaPending, qiwaMissing], ['#147A50','#92600E','#96281D']);
    drawDonut('hrw-chart-iqama', ['Valid','Expiring','Expired','Not on file'], [iqamaValid, iqamaSoon, iqamaExpired, iqamaMissing], ['#147A50','#92600E','#96281D','#969696']);
    drawJobTitleChart(jobCompTop);
    drawDiversityMatrix(active);

    qsa('[data-filter]', root).forEach(row => row.addEventListener('click', () => {
      const f = JSON.parse(row.dataset.filter);
      goTo('employees', f);
    }));
    qsa('tr[data-prof]', root).forEach(row => row.addEventListener('click', () => goTo('employees', { professionCode: row.dataset.prof })));
    qsa('tr[data-jobtitle]', root).forEach(row => row.addEventListener('click', () => goTo('employees', { jobTitle: row.dataset.jobtitle })));
    const jobSearch = qs('#hrw-job-search', root);
    if (jobSearch) jobSearch.addEventListener('input', debounce(() => { jobTitleSearch = jobSearch.value; render(root); }, 220));
    qs('#hrw-config', root).addEventListener('click', () => openConfigForm(entity, cfg));
    qs('#hrw-export', root).addEventListener('click', () => exportCompliance(entity, stats, cfg, zone, actions));
  }

  function drawJobTitleChart(rows) {
    mountChart('hrw-chart-jobtitle', {
      type: 'bar',
      data: {
        labels: rows.map(r => r.jobTitle),
        datasets: [
          { label: 'Saudi', data: rows.map(r => r.saudi), backgroundColor: '#147A50', stack: 's', borderRadius: 3 },
          { label: 'Non-Saudi', data: rows.map(r => r.total - r.saudi), backgroundColor: '#969696', stack: 's', borderRadius: 3 },
        ]
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: baseChartFont() } }, title: { display: true, text: 'Top 12 job titles by headcount — Saudi vs. Non-Saudi', font: baseChartFont() } },
        scales: { x: { stacked: true, ticks: { font: { size: 9 }, maxRotation: 55, minRotation: 55 } }, y: { stacked: true, ticks: { precision: 0 } } }
      }
    });
  }

  function escAttr(s) { return s.replace(/'/g, '&#39;'); }

  function miniStat(label, value, tone) {
    return `<div><div class="text-xs text-muted" style="font-weight:700;">${esc(label)}</div><div class="kpi-value ${tone==='up'?'up':tone==='down'?'down':''}" style="font-size:20px; margin-top:2px;">${value}</div></div>`;
  }
  function miniRow(label, count, color) {
    const map = { green: 'var(--c-success)', amber: 'var(--c-warning)', red: 'var(--c-danger)', info: 'var(--c-info)', purple: 'var(--dxc-purple)' };
    return `<div class="flex items-center justify-between" style="padding:5px 0;"><span class="text-sm flex items-center gap-6"><i style="width:8px;height:8px;border-radius:2px;background:${map[color]};display:inline-block;"></i>${esc(label)}</span><b class="mono">${count}</b></div>`;
  }

  function renderAccTable(active, cfg) {
    const el = qs('#hrw-acc-table');
    const byAcc = Engine.groupBy(active, 'account');
    const rows = Object.keys(byAcc).map(acc => ({ acc, s: Engine.headcountStats(byAcc[acc]) })).sort((a,b)=>b.s.total-a.s.total);
    el.innerHTML = `<thead><tr><th>Account</th><th>Headcount</th><th>Saudi %</th><th>Gap to Target</th></tr></thead>
      <tbody>${rows.map(r => { const gap=r.s.ratio-cfg.target; return `<tr class="clickable" data-acc="${esc(r.acc)}"><td class="cell-name">${esc(r.acc)}</td><td class="mono">${r.s.total}</td><td class="mono">${Engine.fmtPct(r.s.ratio)}</td><td class="mono ${gap>=0?'up':'down'}">${gap>=0?'+':''}${Engine.fmtPct(gap)}</td></tr>`; }).join('')}</tbody>`;
    qsa('tr[data-acc]', el).forEach(tr => tr.addEventListener('click', () => goTo('employees', { account: tr.dataset.acc })));
  }
  function renderOffTable(active, cfg) {
    const el = qs('#hrw-off-table');
    const byOff = Engine.groupBy(active, 'offering');
    const rows = Object.keys(byOff).map(o => ({ o, s: Engine.headcountStats(byOff[o]) })).sort((a,b)=>b.s.total-a.s.total);
    el.innerHTML = `<thead><tr><th>Offering</th><th>Headcount</th><th>Saudi %</th><th>Gap to Target</th></tr></thead>
      <tbody>${rows.map(r => { const gap=r.s.ratio-cfg.target; return `<tr class="clickable" data-off="${esc(r.o)}"><td class="cell-name">${esc(r.o)}</td><td class="mono">${r.s.total}</td><td class="mono">${Engine.fmtPct(r.s.ratio)}</td><td class="mono ${gap>=0?'up':'down'}">${gap>=0?'+':''}${Engine.fmtPct(gap)}</td></tr>`; }).join('')}</tbody>`;
    qsa('tr[data-off]', el).forEach(tr => tr.addEventListener('click', () => goTo('employees', { offering: tr.dataset.off })));
  }

  function drawDonut(id, labels, data, colors) {
    mountChart(id, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors }] },
      options: { cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: baseChartFont() } } } }
    }, { labels: true, labelColor: '#fff' });
  }

  function drawDiversityMatrix(active) {
    const el = document.getElementById('hrw-chart-matrix');
    if (!el) return;
    if (!chartMatrixAvailable()) {
      el.parentElement.innerHTML = '<div class="empty-state" style="padding:20px;"><p>Heatmap library unavailable offline — see Saudization-by-account/offering tables above instead.</p></div>';
      return;
    }
    const rows = SERVICE_LINES.map(s => s.name);
    const natCounts = {};
    active.forEach(e => { if (e.nationality) natCounts[e.nationality] = (natCounts[e.nationality]||0) + 1; });
    const topNats = Object.keys(natCounts).filter(n => n !== 'Saudi Arabia').sort((a,b) => natCounts[b]-natCounts[a]).slice(0,5);
    const cols = ['Saudi Arabia', ...topNats, 'Other'];

    const cells = [];
    SERVICE_LINES.forEach(sl => {
      const pool = active.filter(e => e.serviceLine === sl.id);
      cols.forEach(col => {
        const v = col === 'Other'
          ? pool.filter(e => e.nationality !== 'Saudi Arabia' && !topNats.includes(e.nationality)).length
          : pool.filter(e => e.nationality === col).length;
        cells.push({ x: col, y: sl.name, v });
      });
    });
    const maxV = Math.max(1, ...cells.map(c => c.v));

    mountChart('hrw-chart-matrix', {
      type: 'matrix',
      data: { datasets: [{
        label: 'Headcount',
        data: cells,
        backgroundColor: (ctx) => {
          const v = ctx.dataset.data[ctx.dataIndex] ? ctx.dataset.data[ctx.dataIndex].v : 0;
          return `rgba(95,36,159,${(0.10 + 0.78 * (v / maxV)).toFixed(2)})`;
        },
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
        width: (ctx) => ((ctx.chart.chartArea || {}).width || 0) / cols.length - 3,
        height: (ctx) => ((ctx.chart.chartArea || {}).height || 0) / rows.length - 3,
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
          x: { type: 'category', labels: cols, offset: true, grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { type: 'category', labels: rows, offset: true, grid: { display: false }, ticks: { font: { size: 10 } } },
        },
      },
    });
  }

  function openConfigForm(entity, cfg) {
    const overlay = openModal(`
      <div class="modal-head"><h3>Edit Regulatory Configuration — ${entity}</h3><button class="modal-close" data-close>${Icon('x')}</button></div>
      <div class="modal-body">
        <div class="disclaimer-box" style="margin-bottom:14px;">${Icon('info')}<span>Changing the target or zone bands here immediately recalculates every Nitaqat view in the app. In production this action would be logged and require Legal sign-off (see Administration → Approval Matrix).</span></div>
        <form id="cfg-form">
          <div class="form-grid">
            <div class="field full"><label>Registered Activity</label><input name="registeredActivity" value="${esc(cfg.registeredActivity)}"/></div>
            <div class="field"><label>Activity Reference</label><input name="activityRef" value="${esc(cfg.activityRef)}"/></div>
            <div class="field"><label>Entity Size Category</label><input name="sizeCategory" value="${esc(cfg.sizeCategory)}"/></div>
            <div class="field"><label>Current Planning Target (Saudization %)</label><input type="number" step="0.01" min="0" max="100" name="targetPct" value="${(cfg.target*100).toFixed(2)}"/></div>
            <div class="field"><label>Last Reviewed</label><input type="date" name="lastReviewed" value="${cfg.lastReviewed}"/></div>
            <div class="field full"><label>Reviewed By</label><input name="reviewedBy" value="${esc(cfg.reviewedBy)}"/></div>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <span class="text-xs text-muted" style="margin-right:auto;">${Icon('info')} Saved to this browser session only — not yet synced to the shared database.</span>
        <button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" id="cfg-save">${Icon('check')} Save Configuration</button>
      </div>
    `);
    qsa('[data-close]', overlay).forEach(b => b.addEventListener('click', closeOverlay));
    qs('#cfg-save', overlay).addEventListener('click', () => {
      const fd = new FormData(qs('#cfg-form', overlay));
      const patch = { registeredActivity: fd.get('registeredActivity'), activityRef: fd.get('activityRef'), sizeCategory: fd.get('sizeCategory'), lastReviewed: fd.get('lastReviewed'), reviewedBy: fd.get('reviewedBy'), target: Number(fd.get('targetPct'))/100 };
      Store.updateNitaqatConfig(entity, patch);
      closeOverlay();
      toast('Regulatory configuration updated');
      render(qs('#route-container'));
    });
  }

  function exportCompliance(entity, stats, cfg, zone, actions) {
    const rows = [
      { k: 'Entity', v: cfg.entityLabel }, { k: 'Snapshot', v: new Date().toISOString() },
      { k: 'Active Workforce', v: stats.total }, { k: 'Saudi', v: stats.saudi }, { k: 'Non-Saudi', v: stats.nonSaudi },
      { k: 'Ratio', v: Engine.fmtPct(stats.ratio) }, { k: 'Target', v: Engine.fmtPct(cfg.target) }, { k: 'Zone', v: zone.name },
      { k: 'Open Actions', v: actions.length }, { k: 'Urgent Actions', v: actions.filter(a=>a.severity==='red').length },
    ];
    Engine.downloadCSV(`sw360-compliance-${entity}-${new Date().toISOString().slice(0,10)}.csv`, Engine.toCSV(rows,[{label:'Metric',value:'k'},{label:'Value',value:'v'}]));
    toast('Compliance snapshot exported');
  }

  return { render };
})();
