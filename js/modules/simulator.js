// ============================================================================
// Scenario Simulator — quick sliders for fast what-ifs, plus a structured
// move builder (Hire / Exit / Transfer across nationality, service line,
// offering, account, manager, job title, start date) that stacks multiple
// moves and recalculates headcount, Saudi ratio, zone, and capacity impact
// in real time. Nothing here is a toast — every control redraws the numbers.
// ============================================================================

var Modules = window.Modules || {};
Modules.simulator = (() => {

  let quick = { hireSaudi: 0, hireNonSaudi: 0, exits: 0 };
  let moves = [];
  let moveSeq = 1;

  function basePool() {
    return Store.employees.filter(e => e.entity === Store.entity && e.status === 'Active');
  }

  function render(root) {
    const cfg = Store.nitaqatConfig[Store.entity];
    const base = basePool();
    const baseStats = Engine.headcountStats(base);
    const baseZone = Engine.zoneFor(baseStats.ratio, cfg);

    const scenarioPool = applyScenario(base, quick, moves);
    const scStats = Engine.headcountStats(scenarioPool);
    const scZone = Engine.zoneFor(scStats.ratio, cfg);
    const baseMargin = Engine.marginToTarget(baseStats.ratio, cfg.target);
    const scMargin = Engine.marginToTarget(scStats.ratio, cfg.target);

    const touchedCodes = Engine.uniqueSorted(moves.filter(m => m.professionCode), 'professionCode');
    const profImpact = touchedCodes.map(code => {
      const cat = Store.professionCategories.find(c => c.code === code && c.target > 0);
      if (!cat) return null;
      const baseC = Engine.professionCompliance(base, [cat])[0];
      const scC = Engine.professionCompliance(scenarioPool, [cat])[0];
      if (!baseC || !scC) return null;
      return { cat, baseC, scC };
    }).filter(Boolean);

    const scenarioReqs = Store.requisitions.filter(r => r.entity === Store.entity && r.status !== 'Filled');
    const hiresByOffering = Engine.groupBy(moves.filter(m=>m.type==='Hire'), 'offering');
    const capacityMatches = Object.keys(hiresByOffering).map(off => {
      const openForOff = scenarioReqs.filter(r => r.offering === off).length;
      const hires = hiresByOffering[off].reduce((a,m)=>a+Number(m.count),0);
      return { off, openForOff, hires };
    });

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Scenario Simulator</h2><div class="sub">${esc(Store.entity==='KSA'?'DXC Saudi Arabia':'Regional HQ')} · model hires, exits and transfers before you commit to them</div></div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="sim-reset">${Icon('refresh')} Reset</button>
          <button class="btn btn-primary" id="sim-save">${Icon('check')} Save Scenario</button>
        </div>
      </div>

      <div class="grid grid-12">
        <div class="panel" style="grid-column: span 7;">
          <div class="panel-head"><div><h3>${Icon('sliders','inline-icon')} Quick simulate</h3><div class="sub">Drag to model headcount moves instantly</div></div></div>
          <div class="panel-body">
            <div class="slider-row">
              <div class="slider-label">Hire — Saudi nationals <span class="val" id="v-hs">${quick.hireSaudi}</span></div>
              <input type="range" min="0" max="80" id="s-hs" value="${quick.hireSaudi}"/>
            </div>
            <div class="slider-row">
              <div class="slider-label">Hire — Non-Saudi nationals <span class="val" id="v-hn">${quick.hireNonSaudi}</span></div>
              <input type="range" min="0" max="80" id="s-hn" value="${quick.hireNonSaudi}"/>
            </div>
            <div class="slider-row">
              <div class="slider-label">Planned exits (prioritizes contract-end &amp; notice-period staff) <span class="val" id="v-ex">${quick.exits}</span></div>
              <input type="range" min="0" max="60" id="s-ex" value="${quick.exits}"/>
            </div>
            <div class="text-xs text-muted mt-8">${Icon('info')} Quick-simulate hires are distributed across your current offering/account mix. Use the move builder below for a specific offering, account, manager or job title.</div>
          </div>
        </div>

        <div class="panel" style="grid-column: span 5;">
          <div class="panel-head"><div><h3>Current vs. scenario</h3></div></div>
          <div class="panel-body">
            <div class="compare-cols">
              <div class="compare-col"><div class="cc-label">Current</div><div class="cc-value">${baseStats.total}</div><div class="text-xs text-muted">${Engine.fmtPct(baseStats.ratio)} Saudi</div></div>
              <div class="compare-arrow">${Icon('arrowRight')}</div>
              <div class="compare-col"><div class="cc-label">Scenario</div><div class="cc-value" style="color:var(--dxc-purple)">${scStats.total}</div><div class="text-xs text-muted">${Engine.fmtPct(scStats.ratio)} Saudi</div></div>
            </div>
            <div class="divider"></div>
            <div class="flex justify-between mt-8"><span class="text-sm text-muted">Zone</span><span>${zoneChip(baseZone.name)} ${Icon('arrowRight')} ${zoneChip(scZone.name)}</span></div>
            <div class="flex justify-between mt-8"><span class="text-sm text-muted">Margin to target</span><span class="mono ${scMargin>=0?'up':'down'}">${scMargin>=0?'+':''}${Engine.fmtPct(scMargin)} <span class="text-muted">(was ${baseMargin>=0?'+':''}${Engine.fmtPct(baseMargin)})</span></span></div>
            <div class="divider"></div>
            <div class="grid grid-2" style="gap:6px;">
              <div style="min-width:0;"><div class="text-xs text-muted" style="text-align:center; font-weight:700;">Current</div><div style="position:relative; height:110px; width:100%; overflow:hidden;"><canvas id="sim-chart-nat-base" style="width:100%; height:100%;"></canvas></div></div>
              <div style="min-width:0;"><div class="text-xs text-muted" style="text-align:center; font-weight:700;">Scenario</div><div style="position:relative; height:110px; width:100%; overflow:hidden;"><canvas id="sim-chart-nat-sc" style="width:100%; height:100%;"></canvas></div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head">
          <div><h3>Move builder</h3><div class="sub">Stack specific hire / exit / transfer moves across any dimension</div></div>
          <button class="btn btn-secondary btn-sm" id="sim-add-move">${Icon('plus')} Add Move</button>
        </div>
        <div class="panel-body">
          ${moves.length ? `<div class="table-wrap"><table class="data-table">
            <thead><tr><th>Type</th><th>Count</th><th>Nationality</th><th>Offering</th><th>Account</th><th>Manager</th><th>Job Title</th><th>Start</th><th></th></tr></thead>
            <tbody>${moves.map(m => `<tr>
              <td><span class="chip ${m.type==='Hire'?'chip-green':m.type==='Exit'?'chip-red':'chip-info'}">${m.type}</span></td>
              <td class="mono">${m.count}</td><td>${esc(m.nationality||'Any')}</td>
              <td>${esc(m.type==='Transfer' ? (m.offering+' → '+m.toOffering) : (m.offering||'Any'))}</td>
              <td>${esc(m.type==='Transfer' ? (m.account+' → '+m.toAccount) : (m.account||'Any'))}</td>
              <td>${esc((MANAGERS.find(x=>x.id===m.managerId)||{}).name || 'Any')}</td>
              <td>${esc(m.jobTitle||'—')}</td><td class="mono">${m.startDate?Engine.fmtDate(m.startDate):'—'}</td>
              <td><button class="btn btn-ghost btn-sm" data-rm-move="${m.id}">${Icon('trash')}</button></td>
            </tr>`).join('')}</tbody>
          </table></div>` : `<div class="empty-state" style="padding:24px;">${Icon('sliders')}<h4>No moves yet</h4><p>Add a Hire, Exit or Transfer to model a specific dimension.</p></div>`}
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>Impact by offering</h3></div></div>
          <div class="panel-body"><canvas id="sim-chart-off" height="220"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Headcount &amp; ratio projection — with this scenario applied now</h3></div></div>
          <div class="panel-body"><canvas id="sim-chart-proj" height="220"></canvas></div>
        </div>
      </div>

      ${profImpact.length ? `
      <div class="panel mt-16">
        <div class="panel-head"><div><h3>${Icon('flag','inline-icon')} Profession-category impact</h3><div class="sub">HRSD job-localization targets touched by this scenario's moves</div></div></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Category</th><th>Current Saudi %</th><th>Scenario Saudi %</th><th>Target</th><th>Status</th></tr></thead>
          <tbody>${profImpact.map(({cat,baseC,scC}) => `<tr>
            <td class="cell-name">${esc(cat.name)} <span class="chip chip-grey">${cat.code}</span></td>
            <td class="mono">${baseC.actual===null?'—':Engine.fmtPct(baseC.actual)}</td>
            <td class="mono ${scC.actual!==null && baseC.actual!==null && scC.actual>=baseC.actual?'up':'down'}">${scC.actual===null?'—':Engine.fmtPct(scC.actual)}</td>
            <td class="mono">${Engine.fmtPct(cat.target,0)}</td>
            <td>${scC.status==='On Target'?'<span class="chip chip-green">On Target</span>':scC.status==='Below Target'?`<span class="chip chip-red">Below Target</span> <span class="text-xs text-muted">−${scC.gapHeads}</span>`:'<span class="chip chip-grey">No Headcount</span>'}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <div class="panel-foot text-xs text-muted">Tag a Hire/Exit/Transfer move with a Profession to see its category impact here.</div>
      </div>` : ''}

      <div class="panel mt-16">
        <div class="panel-head"><div><h3>${Icon('alertTriangle','inline-icon')} Risk messages &amp; recommended mitigation</h3></div></div>
        <div class="panel-body">${riskMessages(baseStats, scStats, cfg, baseZone, scZone, capacityMatches).join('')}</div>
      </div>

      ${Store.savedScenarios.length ? `<div class="panel mt-16">
        <div class="panel-head"><div><h3>Saved scenarios</h3></div></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Name</th><th>Saved</th><th>Headcount</th><th>Saudi %</th><th>Zone</th><th></th></tr></thead>
          <tbody>${Store.savedScenarios.map(s => `<tr>
            <td class="cell-name">${esc(s.name)}</td><td class="mono">${Engine.fmtDate(s.savedAt)}</td>
            <td class="mono">${s.resultTotal}</td><td class="mono">${Engine.fmtPct(s.resultRatio)}</td><td>${zoneChip(s.resultZone)}</td>
            <td><button class="btn btn-ghost btn-sm" data-load-sc="${s.id}">Load</button> <button class="btn btn-ghost btn-sm" data-del-sc="${s.id}">${Icon('trash')}</button></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>` : ''}

      <div class="disclaimer-box mt-16">${Icon('alertTriangle')}<span>This is a planning simulation only. Final Nitaqat classification must be verified directly in Qiwa before any hiring, transfer or exit decision is executed.</span></div>
    `;

    drawImpactChart(base, scenarioPool);
    drawProjectionCompare(base, scenarioPool);
    drawCompositionDonuts(base, scenarioPool);
    bindEvents(root);
  }

  // -------------------------------------------------------------------------
  function applyScenario(base, quick, moves) {
    let pool = base.map(e => Object.assign({}, e));

    // Quick-simulate hires: distribute across current offering/account mix
    const offList = Engine.uniqueSorted(base, 'offering');
    const accList = Engine.uniqueSorted(base, 'account');
    for (let i = 0; i < Number(quick.hireSaudi||0); i++) pool.push(syntheticHire(true, offList, accList));
    for (let i = 0; i < Number(quick.hireNonSaudi||0); i++) pool.push(syntheticHire(false, offList, accList));

    // Quick-simulate exits: prioritize leaving-soon / fixed-term-ending, then random
    if (quick.exits > 0) {
      const leaving = Engine.leavingSoon(pool).map(e => e.id);
      const prioritized = pool.filter(e => leaving.includes(e.id)).concat(pool.filter(e => !leaving.includes(e.id)));
      const toRemove = new Set(prioritized.slice(0, Number(quick.exits)).map(e => e.id));
      pool = pool.filter(e => !toRemove.has(e.id));
    }

    // Structured moves
    moves.forEach(m => {
      if (m.type === 'Hire') {
        for (let i = 0; i < Number(m.count); i++) {
          pool.push({
            id: 'sim-'+Math.random(), status: 'Active', entity: Store.entity,
            isSaudi: m.nationality === 'Saudi Arabia', nationality: m.nationality || 'Saudi Arabia',
            serviceLine: m.serviceLine, offering: m.offering, account: m.account, managerId: m.managerId,
            jobTitle: m.jobTitle || 'New Hire', level: m.level, profession: m.profession, professionCode: m.professionCode, synthetic: true,
          });
        }
      } else if (m.type === 'Exit') {
        let candidates = pool.filter(e => (!m.offering || e.offering === m.offering) && (!m.account || e.account === m.account) && (!m.managerId || e.managerId === m.managerId) && (!m.nationality || m.nationality === 'Any' || e.nationality === m.nationality));
        const leaving = Engine.leavingSoon(pool).map(e => e.id);
        candidates = candidates.filter(e=>leaving.includes(e.id)).concat(candidates.filter(e=>!leaving.includes(e.id)));
        const toRemove = new Set(candidates.slice(0, Number(m.count)).map(e => e.id));
        pool = pool.filter(e => !toRemove.has(e.id));
      } else if (m.type === 'Transfer') {
        let candidates = pool.filter(e => (!m.offering || e.offering === m.offering) && (!m.account || e.account === m.account) && (!m.nationality || m.nationality === 'Any' || e.nationality === m.nationality));
        const ids = new Set(candidates.slice(0, Number(m.count)).map(e => e.id));
        pool = pool.map(e => ids.has(e.id) ? Object.assign({}, e, { offering: m.toOffering || e.offering, account: m.toAccount || e.account, managerId: m.toManagerId || e.managerId, serviceLine: (OFFERINGS.find(o=>o.name===m.toOffering)||{}).serviceLine || e.serviceLine }) : e);
      }
    });

    return pool;
  }

  function syntheticHire(isSaudi, offList, accList) {
    const off = offList[Math.floor(Math.random()*offList.length)] || 'ITO & Cloud';
    return {
      id: 'sim-'+Math.random(), status: 'Active', entity: Store.entity, isSaudi,
      nationality: isSaudi ? 'Saudi Arabia' : 'Other', serviceLine: (OFFERINGS.find(o=>o.name===off)||{}).serviceLine,
      offering: off, account: accList[Math.floor(Math.random()*accList.length)] || 'Others',
      managerId: null, jobTitle: 'New Hire', synthetic: true,
    };
  }

  function riskMessages(baseStats, scStats, cfg, baseZone, scZone, capacityMatches) {
    const msgs = [];
    const zoneOrder = cfg.zones.map(z => z.name);
    const baseIdx = zoneOrder.indexOf(baseZone.name), scIdx = zoneOrder.indexOf(scZone.name);
    if (scIdx > baseIdx) msgs.push(alertMsg('red', `This scenario moves you from ${baseZone.name} to ${scZone.name} — a weaker Nitaqat band.`, `Add more Saudi hires or reduce non-Saudi exits until margin returns to positive.`));
    else if (scIdx < baseIdx) msgs.push(alertMsg('green', `This scenario improves your position from ${baseZone.name} to ${scZone.name}.`, `No action needed — consider locking in these moves and re-checking in Qiwa.`));
    const scMargin = Engine.marginToTarget(scStats.ratio, cfg.target);
    if (scMargin < 0) {
      const shortHeads = Math.ceil(cfg.target*scStats.total) - scStats.saudi;
      msgs.push(alertMsg('red', `Scenario Saudi ratio (${Engine.fmtPct(scStats.ratio)}) falls below the ${Engine.fmtPct(cfg.target)} target.`, `Add ${shortHeads} more Saudi hires (or remove ${Math.ceil(shortHeads/(1-cfg.target))} fewer non-Saudi heads) to close the gap.`));
    } else if (scMargin < 0.02) {
      msgs.push(alertMsg('amber', `Margin to target narrows to ${Engine.fmtPct(scMargin)} — limited buffer for further non-Saudi hiring.`, `Prioritize Saudi candidates for the next 2-3 open positions before adding more non-Saudi headcount.`));
    }
    capacityMatches.forEach(c => {
      if (c.hires > c.openForOff) msgs.push(alertMsg('amber', `${c.hires} hires modeled for ${c.off}, but only ${c.openForOff} open requisitions exist there today.`, `Raise ${c.hires - c.openForOff} additional requisition(s) in Demand & Supply before committing.`));
    });
    if (!msgs.length) msgs.push(alertMsg('green', 'No material regulatory or capacity risk detected in this scenario.', 'Safe to save and share for review.'));
    return msgs;
  }
  function alertMsg(sev, title, detail) {
    return `<div class="alert-row" style="cursor:default;"><div class="alert-icon ${sev==='green'?'green':sev}" style="${sev==='green'?'background:var(--c-success-tint);color:var(--c-success);':''}">${Icon(sev==='green'?'checkCircle':sev==='red'?'alertCircle':'alertTriangle')}</div><div class="alert-body"><div class="a-title">${esc(title)}</div><div class="a-detail">${esc(detail)}</div></div></div>`;
  }

  function drawCompositionDonuts(base, scenario) {
    const donut = (id, pool) => {
      const saudi = pool.filter(e => e.isSaudi).length;
      mountChart(id, {
        type: 'doughnut',
        data: { labels: ['Saudi', 'Non-Saudi'], datasets: [{ data: [saudi, pool.length - saudi], backgroundColor: [CHART_PALETTE[0], CHART_PALETTE[6]] }] },
        // maintainAspectRatio:false + a height-constrained wrapper div (see
        // the canvas markup above) — without both, Chart.js's default square
        // aspect ratio grows the doughnut to match the panel's full width
        // instead of the intended ~110px height, blowing up the whole card.
        options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { display: false } } }
      }, { labels: true, labelColor: '#fff', labelOptions: { font: { size: 9, weight: '700' } } });
    };
    donut('sim-chart-nat-base', base);
    donut('sim-chart-nat-sc', scenario);
  }

  function drawImpactChart(base, scenario) {
    const offs = Engine.uniqueSorted(base.concat(scenario), 'offering');
    mountChart('sim-chart-off', {
      type: 'bar',
      data: { labels: offs, datasets: [
        { label: 'Current', data: offs.map(o=>base.filter(e=>e.offering===o).length), backgroundColor: CHART_PALETTE[6], borderRadius: 4 },
        { label: 'Scenario', data: offs.map(o=>scenario.filter(e=>e.offering===o).length), backgroundColor: CHART_PALETTE[0], borderRadius: 4 },
      ]},
      options: { plugins: { legend: { position: 'bottom', labels:{boxWidth:10,font:baseChartFont()} } }, scales: { x: { ticks: { font: { size: 10 } } } } }
    }, { labels: true, labelColor: '#241f30', labelOptions: { anchor: 'end', align: 'top', offset: 2, font: { size: 9.5, weight: '700' }, formatter: (v) => v || '' } });
  }

  function drawProjectionCompare(base, scenario) {
    const cfg = Store.nitaqatConfig;
    const baseProj = Engine.projection(Store.employees, Store.requisitions, cfg, 12, Store.entity);
    const scenarioEmployees = Store.employees.filter(e => !(e.entity===Store.entity && e.status==='Active')).concat(scenario);
    const scProj = Engine.projection(scenarioEmployees, Store.requisitions, cfg, 12, Store.entity);
    mountChart('sim-chart-proj', {
      type: 'line',
      data: { labels: baseProj.map(p=>p.label), datasets: [
        { label: 'Current trajectory', data: baseProj.map(p=>+(p.ratio*100).toFixed(1)), borderColor: CHART_PALETTE[6], tension:.3 },
        { label: 'With scenario', data: scProj.map(p=>+(p.ratio*100).toFixed(1)), borderColor: CHART_PALETTE[0], tension:.3 },
        { label: 'Target', data: baseProj.map(p=>+(p.target*100).toFixed(1)), borderColor: CHART_PALETTE[5], borderDash:[3,3], pointRadius:0 },
      ]},
      options: { plugins: { legend: { position:'bottom', labels:{boxWidth:10,font:baseChartFont()} } }, scales: { y: { ticks: { callback:v=>v+'%' } } } }
    });
  }

  function bindEvents(root) {
    const hs = qs('#s-hs', root), hn = qs('#s-hn', root), ex = qs('#s-ex', root);
    // 'input' fires continuously while dragging — keep it cheap (headline
    // numbers only, no chart/table rebuild) so the slider stays smooth.
    hs.addEventListener('input', () => { quick.hireSaudi = +hs.value; qs('#v-hs', root).textContent = hs.value; liveUpdateHeadline(root); });
    hn.addEventListener('input', () => { quick.hireNonSaudi = +hn.value; qs('#v-hn', root).textContent = hn.value; liveUpdateHeadline(root); });
    ex.addEventListener('input', () => { quick.exits = +ex.value; qs('#v-ex', root).textContent = ex.value; liveUpdateHeadline(root); });
    // 'change' fires once on release — do the full recalculation (charts,
    // risk messages, impact tables) then.
    [hs, hn, ex].forEach(s => s.addEventListener('change', () => render(root)));

    qs('#sim-reset', root).addEventListener('click', () => { quick = { hireSaudi:0, hireNonSaudi:0, exits:0 }; moves = []; render(root); toast('Scenario reset'); });
    qs('#sim-add-move', root).addEventListener('click', () => openMoveForm(root));
    qsa('[data-rm-move]', root).forEach(b => b.addEventListener('click', () => { moves = moves.filter(m=>m.id!==b.dataset.rmMove); render(root); }));
    qs('#sim-save', root).addEventListener('click', () => {
      const base = basePool(); const scenario = applyScenario(base, quick, moves); const stats = Engine.headcountStats(scenario);
      const cfg = Store.nitaqatConfig[Store.entity]; const zone = Engine.zoneFor(stats.ratio, cfg);
      const name = prompt('Name this scenario', `Scenario ${Store.savedScenarios.length+1}`);
      if (!name) return;
      Store.saveScenario({ name, quick: Object.assign({},quick), moves: JSON.parse(JSON.stringify(moves)), entity: Store.entity, resultTotal: stats.total, resultRatio: stats.ratio, resultZone: zone.name });
      toast('Scenario saved locally');
      render(root);
    });
    qsa('[data-load-sc]', root).forEach(b => b.addEventListener('click', () => {
      const s = Store.savedScenarios.find(x=>x.id===b.dataset.loadSc); if (!s) return;
      quick = Object.assign({hireSaudi:0,hireNonSaudi:0,exits:0}, s.quick); moves = s.moves || [];
      render(root); toast(`Loaded "${s.name}"`);
    }));
    qsa('[data-del-sc]', root).forEach(b => b.addEventListener('click', () => { Store.deleteScenario(b.dataset.delSc); render(root); }));
  }

  // Cheap, chart-free recompute used while a slider is actively being dragged.
  function liveUpdateHeadline(root) {
    const base = basePool();
    const cfg = Store.nitaqatConfig[Store.entity];
    const scenario = applyScenario(base, quick, moves);
    const stats = Engine.headcountStats(scenario);
    const zone = Engine.zoneFor(stats.ratio, cfg);
    const margin = Engine.marginToTarget(stats.ratio, cfg.target);
    const baseStats = Engine.headcountStats(base);
    const baseZone = Engine.zoneFor(baseStats.ratio, cfg);
    const baseMargin = Engine.marginToTarget(baseStats.ratio, cfg.target);

    const cols = qsa('.compare-col', root);
    if (cols[1]) {
      cols[1].querySelector('.cc-value').textContent = stats.total;
      cols[1].querySelector('.text-xs').textContent = Engine.fmtPct(stats.ratio) + ' Saudi';
    }
    const rows = qsa('.flex.justify-between.mt-8', root);
    if (rows[0]) rows[0].querySelector('span:last-child').innerHTML = `${zoneChip(baseZone.name)} ${Icon('arrowRight')} ${zoneChip(zone.name)}`;
    if (rows[1]) {
      const span = rows[1].querySelector('span:last-child');
      span.className = 'mono ' + (margin>=0?'up':'down');
      span.innerHTML = `${margin>=0?'+':''}${Engine.fmtPct(margin)} <span class="text-muted">(was ${baseMargin>=0?'+':''}${Engine.fmtPct(baseMargin)})</span>`;
    }
  }

  function openMoveForm(root) {
    const overlay = openModal(`
      <div class="modal-head"><h3>Add Scenario Move</h3><button class="modal-close" data-close>${Icon('x')}</button></div>
      <div class="modal-body">
        <form id="move-form">
          <div class="form-grid">
            <div class="field"><label>Move Type</label><select name="type" id="mv-type">${['Hire','Exit','Transfer'].map(t=>`<option>${t}</option>`).join('')}</select></div>
            <div class="field"><label>Number of Employees <span class="req">*</span></label><input type="number" name="count" min="1" max="200" value="5" required/></div>
            <div class="field"><label>Nationality</label><select name="nationality"><option value="Any">Any</option><option>Saudi Arabia</option><option>Egypt</option><option>India</option><option>Jordan</option><option>Pakistan</option><option>Philippines</option></select></div>
            <div class="field"><label>Job Title / Role</label><input name="jobTitle" placeholder="e.g. Analyst II Software Engineering"/></div>
            <div class="field"><label>Profession (HRSD category)</label><select name="profession" id="mv-profession"><option value="">— Not mapped —</option>${PROFESSIONS.map(p=>`<option value="${esc(p.name)}" data-code="${p.code}">${esc(p.name)} (${p.code})</option>`).join('')}</select></div>
            <div class="field"><label>Level</label><select name="level"><option value="">Any</option>${LEVELS.map(l=>`<option>${esc(l)}</option>`).join('')}</select></div>
            <div class="field" id="mv-off-wrap"><label>Offering <span id="mv-off-label2"></span></label><select name="offering">${OFFERINGS.map(o=>`<option>${esc(o.name)}</option>`).join('')}</select></div>
            <div class="field" id="mv-acc-wrap"><label>Account</label><select name="account">${ACCOUNTS.filter(a=>a.entity==='KSA'&&a.active).map(a=>a.name).filter((v,i,a)=>a.indexOf(v)===i).map(a=>`<option>${esc(a)}</option>`).join('')}</select></div>
            <div class="field" id="mv-to-off-wrap" style="display:none;"><label>Transfer To — Offering</label><select name="toOffering">${OFFERINGS.map(o=>`<option>${esc(o.name)}</option>`).join('')}</select></div>
            <div class="field" id="mv-to-acc-wrap" style="display:none;"><label>Transfer To — Account</label><select name="toAccount">${ACCOUNTS.filter(a=>a.entity==='KSA'&&a.active).map(a=>a.name).filter((v,i,a)=>a.indexOf(v)===i).map(a=>`<option>${esc(a)}</option>`).join('')}</select></div>
            <div class="field"><label>People Manager</label><select name="managerId"><option value="">Any</option>${MANAGERS.filter(m=>m.id!=='mgr-unassigned').map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Target Start / Effective Date</label><input type="date" name="startDate" value="${new Date().toISOString().slice(0,10)}"/></div>
          </div>
        </form>
      </div>
      <div class="modal-foot"><button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" id="mv-save">${Icon('check')} Add to Scenario</button></div>
    `);
    const typeSel = qs('#mv-type', overlay);
    function syncType() {
      const isTransfer = typeSel.value === 'Transfer';
      qs('#mv-to-off-wrap', overlay).style.display = isTransfer ? '' : 'none';
      qs('#mv-to-acc-wrap', overlay).style.display = isTransfer ? '' : 'none';
    }
    typeSel.addEventListener('change', syncType); syncType();
    qsa('[data-close]', overlay).forEach(b => b.addEventListener('click', closeOverlay));
    qs('#mv-save', overlay).addEventListener('click', () => {
      const form = qs('#move-form', overlay);
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const m = { id: 'mv'+(moveSeq++) };
      fd.forEach((v,k) => { if (v !== '') m[k] = v; });
      const offMeta = OFFERINGS.find(o => o.name === m.offering);
      if (offMeta) m.serviceLine = offMeta.serviceLine;
      const profSelect = qs('#mv-profession', overlay);
      if (profSelect && profSelect.value) m.professionCode = profSelect.selectedOptions[0].dataset.code;
      moves.push(m);
      closeOverlay();
      render(root);
      toast(`${m.type} move added to scenario`);
    });
  }

  return { render };
})();
