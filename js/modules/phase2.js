// ============================================================================
// Phase 2 previews — Exit & Return Management, People Moments, Reports
// Center, AI Assistant. Flagged inactive/coming-soon per the brief, but each
// one runs on real current data where that's honest to do (milestones,
// exit-reentry flags, CSV exports, a data-grounded Q&A) rather than being a
// dead mockup.
// ============================================================================

var Modules = window.Modules || {};
Modules.phase2 = (() => {

  const chatLog = [];

  function render(root, routeId) {
    if (routeId === 'phase2-exit') return renderExit(root);
    if (routeId === 'phase2-visits') return renderVisits(root);
    if (routeId === 'phase2-people') return renderPeople(root);
    if (routeId === 'phase2-reports') return renderReports(root);
    if (routeId === 'phase2-ai') return renderAI(root);
    root.innerHTML = '';
  }

  function hero(title, desc) {
    return `<div class="phase2-hero"><span class="badge-p2">Phase 2</span><div><h3 style="font-size:15px;">${esc(title)}</h3><p class="text-sm text-muted mt-4">${desc}</p></div></div>`;
  }

  // -------------------------------------------------------------------------
  // EXIT & RETURN MANAGEMENT
  // -------------------------------------------------------------------------
  function renderExit(root) {
    const active = Store.employees.filter(e => e.status === 'Active' && !e.isSaudi);
    const abroad = active.filter(e => e.exitReentry);
    const upcoming = Engine.leavingSoon(Store.employees, new Date(), 90).filter(e => !e.isSaudi);

    root.innerHTML = `
      <div class="page-head"><div><h2>Exit &amp; Return Management</h2><div class="sub">International employee exit / re-entry process — Saudi work-authorization requirement</div></div></div>
      ${hero('Full workflow lands in Phase 2', 'Case tracking (Requested → Employer Ack → MOI Approved → Traveled → Returned/Final Exit), automated Absher/Qiwa status pulls, and the 10-working-day employer objection window will be modeled here. The two lists below already reflect live data.')}

      <div class="grid grid-3">
        <div class="kpi-card"><div class="kpi-top"><span class="kpi-label">Non-Saudi Active</span><span class="kpi-icon">${Icon('globe')}</span></div><div class="kpi-value">${active.length}</div></div>
        <div class="kpi-card"><div class="kpi-top"><span class="kpi-label">Currently Abroad (Exit-Re-Entry)</span><span class="kpi-icon">${Icon('flag')}</span></div><div class="kpi-value">${abroad.length}</div></div>
        <div class="kpi-card"><div class="kpi-top"><span class="kpi-label">Likely Exit Candidates · 90d</span><span class="kpi-icon">${Icon('clock')}</span></div><div class="kpi-value">${upcoming.length}</div></div>
      </div>

      <div class="panel mt-16">
        <div class="panel-head"><div><h3>Illustrative process tracker</h3><div class="sub">Conceptual — case counts are indicative</div></div></div>
        <div class="panel-body">
          <div class="grid grid-4">
            ${['Requested','Employer Acknowledged','MOI/Jawazat Approved','Traveled — Awaiting Return'].map((s,i) => `
              <div class="panel panel-pad" style="background:var(--grey-50);">
                <div class="text-xs text-muted" style="font-weight:700; text-transform:uppercase;">${s}</div>
                <div class="kpi-value" style="font-size:22px; margin-top:6px;">${[3,2,1,abroad.length][i]}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="panel-head"><div><h3>Currently on exit-re-entry</h3></div></div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Employee</th><th>Account</th><th>Return Due</th></tr></thead>
            <tbody>${abroad.map(e => `<tr><td class="cell-name">${esc(e.name)}</td><td>${esc(e.account||'—')}</td><td class="mono">${Engine.fmtDate(e.exitReentry.returnDue)}</td></tr>`).join('') || `<tr><td colspan="3" class="table-empty">No one currently on exit-re-entry.</td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Likely to need exit processing · 90 days</h3><div class="sub">Non-Saudi, contract ending or in notice</div></div></div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Employee</th><th>Nationality</th><th>Days Left</th></tr></thead>
            <tbody>${upcoming.map(e => `<tr><td class="cell-name">${esc(e.name)}</td><td>${esc(e.nationality)}</td><td class="mono">${e.contractDaysLeft<=0?'Overdue':e.contractDaysLeft+'d'}</td></tr>`).join('') || `<tr><td colspan="3" class="table-empty">None in the next 90 days.</td></tr>`}</tbody>
          </table></div>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // BUSINESS VISITS & TEMPORARY WORK — placeholder preview, entirely mock
  // data (no real backing table exists yet). Tracks short-term visitors:
  // business-visit-visa trips and temporary/secondment work visas, distinct
  // from the payroll workforce tracked everywhere else in the app.
  // -------------------------------------------------------------------------
  const VISIT_TYPES = ['Business Visit Visa', 'Temporary Work Visa', 'Secondment'];
  const VISIT_PURPOSES = ['Contract negotiation', 'Technical assessment', 'Short-term project support', 'Training delivery', 'Client workshop', 'System go-live support', 'Audit / compliance visit'];
  const VISIT_NATIONALITIES = ['India', 'Egypt', 'United Kingdom', 'Jordan', 'France', 'Philippines', 'South Africa', 'United States'];

  function mockVisits() {
    const today = new Date();
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const iso = (d) => d.toISOString().slice(0, 10);
    const accountPool = ACCOUNTS.filter(a => a.entity === 'KSA' && a.active).map(a => a.name);
    // Fixed offsets (not random) so the mock stays identical on every reload,
    // spread across already-departed / active-now / arriving-soon so the
    // dashboards below have something in every bucket.
    const offsets = [-40, -25, -10, -5, -2, 3, 7, 12, 18, 25, 33, 40, 48, 55];
    return offsets.map((startOffset, i) => {
      const durationDays = 7 + ((i * 5) % 21); // 7–27 day visits
      const entryDate = addDays(today, startOffset);
      const exitDate = addDays(entryDate, durationDays);
      const daysToExit = Math.round((exitDate - today) / 86400000);
      const status = daysToExit < 0 ? 'Completed' : daysToExit <= 7 ? 'Departing Soon' : 'Active';
      return {
        id: 'BV' + String(i + 1).padStart(3, '0'),
        name: 'Visitor ' + String(i + 1).padStart(2, '0'),
        visitType: VISIT_TYPES[i % VISIT_TYPES.length],
        sponsorAccount: accountPool[i % accountPool.length],
        nationality: VISIT_NATIONALITIES[i % VISIT_NATIONALITIES.length],
        purpose: VISIT_PURPOSES[i % VISIT_PURPOSES.length],
        entryDate: iso(entryDate),
        exitDate: iso(exitDate),
        durationDays,
        daysToExit,
        status,
      };
    });
  }

  function renderVisits(root) {
    const visits = mockVisits();
    const active = visits.filter(v => v.status !== 'Completed');
    const departingSoon = visits.filter(v => v.status === 'Departing Soon');
    const avgDuration = Math.round(visits.reduce((a, v) => a + v.durationDays, 0) / visits.length);
    const byType = Engine.groupBy(active, 'visitType');
    const byAccount = Engine.groupBy(active, 'sponsorAccount');

    root.innerHTML = `
      <div class="page-head"><div><h2>Business Visits &amp; Temporary Work</h2><div class="sub">Short-term visitors — business visit visas, temporary work visas, and secondments, distinct from the payroll workforce</div></div></div>
      ${hero('Full case tracking lands in Phase 2', 'The dashboard below is a placeholder preview on illustrative sample data — there is no real visit-tracking table yet, so nothing in it reflects an actual visitor. The regulatory reference panel on the right and the process guide below it are real, sourced information, not mock data — kept up to date separately from the visitor tracking itself.')}

      <div class="grid grid-12">
        <div style="grid-column: span 8;">
          <div class="grid grid-4">
            ${summaryCard('Currently in-country', active.length, 'globe')}
            ${summaryCard('Departing within 7 days', departingSoon.length, 'clock')}
            ${summaryCard('Avg. visit length', avgDuration + 'd', 'calendar')}
            ${summaryCard('Sponsor accounts involved', Object.keys(byAccount).length, 'building')}
          </div>

          <div class="grid grid-2 mt-16">
            <div class="panel">
              <div class="panel-head"><div><h3>Visit type mix</h3><div class="sub">Currently active or arriving, sample data</div></div></div>
              <div class="panel-body"><canvas id="bv-chart-type" height="200"></canvas></div>
            </div>
            <div class="panel">
              <div class="panel-head"><div><h3>By sponsor account</h3><div class="sub">Which accounts are drawing the most short-term visits</div></div></div>
              <div class="panel-body"><canvas id="bv-chart-account" height="200"></canvas></div>
            </div>
          </div>

          <div class="panel mt-16">
            <div class="panel-head"><div><h3>Visitor log</h3><div class="sub">Sample data — illustrative only</div></div><span class="chip chip-purple">${visits.length}</span></div>
            <div class="table-wrap"><table class="data-table">
              <thead><tr><th>Visitor</th><th>Type</th><th>Sponsor</th><th>Nationality</th><th>Purpose</th><th>Entry</th><th>Exit</th><th>Status</th></tr></thead>
              <tbody>${visits.map(v => `<tr>
                <td class="cell-name">${esc(v.name)}</td>
                <td><span class="chip ${v.visitType==='Temporary Work Visa'?'chip-info':v.visitType==='Secondment'?'chip-purple':'chip-grey'}">${esc(v.visitType)}</span></td>
                <td>${esc(v.sponsorAccount)}</td>
                <td>${esc(v.nationality)}</td>
                <td>${esc(v.purpose)}</td>
                <td class="mono">${Engine.fmtDate(v.entryDate)}</td>
                <td class="mono">${Engine.fmtDate(v.exitDate)}</td>
                <td>${v.status==='Completed'?'<span class="chip chip-grey">Completed</span>':v.status==='Departing Soon'?`<span class="chip chip-amber">Departing ${v.daysToExit}d</span>`:'<span class="chip chip-green">Active</span>'}</td>
              </tr>`).join('')}</tbody>
            </table></div>
          </div>
        </div>

        <div style="grid-column: span 4;">
          ${regulationsPanel()}
        </div>
      </div>

      ${processGuide()}
    `;
    drawDonut2('bv-chart-type', Object.keys(byType), Object.keys(byType).map(k => byType[k].length), [CHART_PALETTE[0], CHART_PALETTE[1], CHART_PALETTE[3]]);
    mountChart('bv-chart-account', {
      type: 'bar',
      data: { labels: Object.keys(byAccount), datasets: [{ label: 'Visitors', data: Object.keys(byAccount).map(k => byAccount[k].length), backgroundColor: CHART_PALETTE[2], borderRadius: 4, maxBarThickness: 30 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    }, { labels: true, labelColor: '#241f30', labelOptions: { anchor: 'end', align: 'top', offset: 2 } });
  }

  // -------------------------------------------------------------------------
  // Regulatory reference — real, sourced rules (not mock data). Visa policy
  // changes often, so this is explicitly dated and citation-linked rather
  // than presented as a standing fact; same "planning indicator, confirm
  // officially" posture the rest of the app already uses for Nitaqat figures.
  // Last researched: 6 Aug 2026.
  // -------------------------------------------------------------------------
  function regulationsPanel() {
    return `
      <div class="panel" style="position:sticky; top:16px;">
        <div class="panel-head"><div><h3>${Icon('flag','inline-icon')} Rules &amp; regulations</h3><div class="sub">Saudi government sources · reviewed 6 Aug 2026</div></div></div>
        <div class="panel-body" style="padding-top:14px;">

          <div class="section-title" style="padding:0 0 6px;">Business Visit Visa</div>
          <ul style="margin:0 0 4px; padding-left:0; list-style:none;">
            <li class="text-sm" style="padding:4px 0; display:flex; gap:6px;">${Icon('check')}<span>Requires a MOFA invitation from a Saudi host with an active Commercial Registration — for meetings/negotiations only, no productive work or Saudi-source salary.</span></li>
            <li class="text-sm" style="padding:4px 0; display:flex; gap:6px;">${Icon('check')}<span>GCC nationals (Bahrain, Kuwait, Oman, Qatar, UAE) travel visa-free. 60+ other nationalities (US, UK/EU, Australia, China, and more) are eVisa-eligible, typically issued in a few days with no embassy visit.</span></li>
            <li class="text-sm" style="padding:4px 0; display:flex; gap:6px;">${Icon('alertTriangle')}<span><b>Sponsor's own Nitaqat status matters</b> — a dip in the sponsoring entity's Saudization band can trigger visa rejection, the same zone tracked on Home and HR Workspace.</span></li>
          </ul>
          <div class="chip chip-amber mt-4" style="margin-bottom:10px;">${Icon('alertTriangle')} Update: multiple-entry visas suspended, 14 nationalities</div>
          <p class="text-xs text-muted" style="margin-bottom:16px;">Since Feb 2025, multi-entry business/visit visas have been suspended for Algeria, Bangladesh, Egypt, Ethiopia, India, Indonesia, Iraq, Jordan, Morocco, Nigeria, Pakistan, Sudan, Tunisia and Yemen — still in effect with no confirmed reinstatement date as of this review.</p>

          <div class="divider"></div>

          <div class="section-title" style="padding:12px 0 6px;">Temporary Work Visa</div>
          <ul style="margin:0 0 4px; padding-left:0; list-style:none;">
            <li class="text-sm" style="padding:4px 0; display:flex; gap:6px;">${Icon('check')}<span>For contracts up to 3 months; a separate seasonal visa covers Hajj/Umrah temporary work. Cannot bring dependents.</span></li>
            <li class="text-sm" style="padding:4px 0; display:flex; gap:6px;">${Icon('check')}<span>Applied for by the employer through Qiwa (MHRSD), independent of standard work-permit workflow. Cost ≈ SAR 1,000 per applicant.</span></li>
            <li class="text-sm" style="padding:4px 0; display:flex; gap:6px;">${Icon('check')}<span>Requires: passport valid 6+ months, Saudi-Cultural-Attaché-attested certificates, an approved-clinic medical exam, and a signed Arabic employment contract.</span></li>
          </ul>
          <div class="chip chip-amber mt-4" style="margin-bottom:10px;">${Icon('alertTriangle')} Update: instant visa caps introduced</div>
          <p class="text-xs text-muted" style="margin-bottom:4px;">Qiwa has introduced instant work-visa issuance caps and company eligibility requirements — sponsoring companies can now be limited in how many temporary work visas they can issue at once.</p>

          <div class="divider"></div>
          <div class="text-xs text-muted" style="line-height:1.6;">
            Sources: <a href="https://www.ey.com/en_gl/technical/tax-alerts/saudi-arabia-implements-significant-changes-to-business-visa-regulations" target="_blank" rel="noopener">EY — Business visa changes</a>,
            <a href="https://www.ey.com/en_gl/technical/tax-alerts/saudi-arabia-publishes-new-temporary-work-visa-regulations" target="_blank" rel="noopener">EY — Temporary work visa regulations</a>,
            <a href="https://kpmg.com/xx/en/our-insights/gms-flash-alert/2026/flash-alert-2026-157.html" target="_blank" rel="noopener">KPMG — Qiwa instant visa caps</a>,
            <a href="https://www.mofa.gov.sa/en/eservices/Pages/svc5.aspx" target="_blank" rel="noopener">MOFA — Business Visa Request</a>
          </div>
          <div class="disclaimer-box mt-8">${Icon('info')}<span>Informational only — visa policy changes frequently. Confirm directly with MOFA, Qiwa/MHRSD, or Legal before acting on any visa decision.</span></div>
        </div>
      </div>`;
  }

  // -------------------------------------------------------------------------
  // Process guide — the Saudi-government-side steps only, independent of
  // whatever internal DXC approval workflow sits in front of them.
  // -------------------------------------------------------------------------
  function processGuide() {
    const bvSteps = [
      { t: 'Verify sponsor eligibility', d: 'Confirm the Saudi host entity\'s Commercial Registration is active and its Nitaqat/Saudization band is in good standing — either blocks the next step.' },
      { t: 'Generate the MOFA invitation', d: 'The Saudi sponsor issues an official invitation letter/number through MOFA\'s Business Visa Request e-service.' },
      { t: 'Visitor applies', d: 'eVisa-eligible nationalities apply online against the invitation number, no embassy visit required. Other nationalities apply at a Saudi embassy/consulate with the invitation.' },
      { t: 'Approval & entry', d: 'Most eVisa decisions land within a few business days. The visa permits meetings/negotiations only — no paid work or Saudi-source salary.' },
    ];
    const twSteps = [
      { t: 'Secure a block-visa quota', d: 'The employer confirms it has an available visa quota allocation through Qiwa before starting an individual application.' },
      { t: 'Obtain MHRSD authorization', d: 'Qiwa\'s Temporary Work Visa e-service issues a visa authorization number once the quota and company eligibility checks pass.' },
      { t: 'Submit worker\'s application', d: 'The worker\'s passport, attested educational certificates, medical exam results, and signed Arabic contract go through the MOFA application portal.' },
      { t: 'Embassy stamping & travel', d: 'The worker attends a Saudi embassy/consulate for visa stamping, then travels — the visa covers a single contract of up to three months, no dependents.' },
    ];
    return `
      <div class="panel mt-16">
        <div class="panel-head"><div><h3>${Icon('briefcase','inline-icon')} Process guide — Saudi government side</h3><div class="sub">The steps required by Saudi authorities themselves, independent of any internal DXC approval process in front of them</div></div></div>
        <div class="panel-body grid grid-2" style="gap:24px;">
          <div>
            <div class="text-xs text-muted" style="font-weight:700; text-transform:uppercase; margin-bottom:10px;">Business Visit Visa</div>
            <div class="timeline">
              ${bvSteps.map((s, i) => `<div class="timeline-item"><div class="timeline-dot"></div><div><div class="t-date">Step ${i+1}</div><div class="t-text">${esc(s.t)}</div><div class="t-actor">${esc(s.d)}</div></div></div>`).join('')}
            </div>
          </div>
          <div>
            <div class="text-xs text-muted" style="font-weight:700; text-transform:uppercase; margin-bottom:10px;">Temporary Work Visa</div>
            <div class="timeline">
              ${twSteps.map((s, i) => `<div class="timeline-item"><div class="timeline-dot"></div><div><div class="t-date">Step ${i+1}</div><div class="t-text">${esc(s.t)}</div><div class="t-actor">${esc(s.d)}</div></div></div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }

  function drawDonut2(id, labels, data, colors) {
    mountChart(id, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors }] },
      options: { cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: baseChartFont() } } } }
    }, { labels: true, labelColor: '#fff' });
  }

  function summaryCard(label, value, icon) {
    return `<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">${esc(label)}</span><span class="kpi-icon">${Icon(icon)}</span></div><div class="kpi-value">${value}</div></div>`;
  }

  // -------------------------------------------------------------------------
  // PEOPLE MOMENTS
  // -------------------------------------------------------------------------
  const giftQueue = [];
  function renderPeople(root) {
    const active = Store.employees.filter(e => e.status === 'Active').map(e => Engine.deriveEmployee(e));
    const milestones = active.filter(e => e.upcomingMilestone).sort((a,b) => a.upcomingMilestone.daysAway - b.upcomingMilestone.daysAway);
    const nextHoliday = HOLIDAY_CALENDAR.filter(h => h.type !== 'weekly').map(h => Object.assign({}, h, { d: Engine.daysUntil(h.start) })).filter(h => h.d >= 0).sort((a,b)=>a.d-b.d)[0];

    root.innerHTML = `
      <div class="page-head"><div><h2>People Moments</h2><div class="sub">Milestones, anniversaries and special occasions — a reason to reach out</div></div></div>
      ${hero('Automated sends land in Phase 2', 'Anniversary/birthday emails, gift fulfillment, and Eid greeting broadcasts will run on schedule automatically. The milestone list below is computed live from real joining dates; birthdays need a birthdate field we don\'t currently collect, so they\'re intentionally left out rather than faked.')}

      <div class="grid grid-2">
        <div class="panel">
          <div class="panel-head"><div><h3>${Icon('star','inline-icon')} Upcoming work anniversaries · 60 days</h3></div><span class="chip chip-purple">${milestones.length}</span></div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Employee</th><th>Milestone</th><th>Date</th><th></th></tr></thead>
            <tbody>${milestones.map(e => `<tr>
              <td class="cell-name"><span class="avatar-sm">${initials(e.name)}</span>${esc(e.name)}</td>
              <td><span class="chip chip-purple">${e.upcomingMilestone.years} Years</span></td>
              <td class="mono">${Engine.fmtDate(e.upcomingMilestone.date)}</td>
              <td><button class="btn btn-secondary btn-sm" data-gift="${e.id}">${Icon('gift')} Suggest Gift</button></td>
            </tr>`).join('') || `<tr><td colspan="4" class="table-empty">No anniversaries in the next 60 days.</td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>${Icon('calendar','inline-icon')} Occasions &amp; greetings</h3></div></div>
          <div class="panel-body">
            ${nextHoliday ? `<div class="alert-row" style="cursor:default;"><div class="alert-icon amber">${Icon('calendar')}</div><div class="alert-body"><div class="a-title">${esc(nextHoliday.name)}</div><div class="a-detail">In ${nextHoliday.d} days · ${Engine.fmtDate(nextHoliday.start)}</div></div>
              <button class="btn btn-secondary btn-sm" id="draft-greeting">Draft Greeting</button>
            </div>` : `<div class="text-sm text-muted">No upcoming occasion in the calendar window.</div>`}
            <div class="mt-16" id="gift-queue-wrap">
              <div class="text-xs text-muted" style="font-weight:700; text-transform:uppercase;">Gift queue (this session)</div>
              <div id="gift-queue-list" class="mt-8"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    renderGiftQueue();
    qsa('[data-gift]', root).forEach(b => b.addEventListener('click', () => {
      const emp = active.find(e => e.id === b.dataset.gift);
      const choice = prompt(`Suggested gift for ${emp.name} (${emp.upcomingMilestone.years}-year mark). Type one: Watch, Voucher, Plaque, Custom`, 'Voucher');
      if (!choice) return;
      giftQueue.push({ name: emp.name, years: emp.upcomingMilestone.years, gift: choice, addedAt: new Date().toISOString() });
      renderGiftQueue();
      toast(`${choice} queued for ${emp.name}`);
    }));
    const draftBtn = qs('#draft-greeting', root);
    if (draftBtn) draftBtn.addEventListener('click', () => {
      const text = `On behalf of DXC Technology Saudi Arabia, wishing you and your family a blessed ${nextHoliday.name.split('(')[0].trim()}. Thank you for everything you bring to our team this year.`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => toast('Greeting copied to clipboard')).catch(() => showGreetingFallback(text));
      } else showGreetingFallback(text);
    });
    function showGreetingFallback(text) { openModal(`<div class="modal-head"><h3>Draft Greeting</h3><button class="modal-close" data-close>${Icon('x')}</button></div><div class="modal-body"><textarea style="width:100%;height:120px;">${esc(text)}</textarea></div><div class="modal-foot"><button class="btn btn-primary" data-close>Close</button></div>`); qsa('[data-close]').forEach(b=>b.addEventListener('click',closeOverlay)); }
  }
  function renderGiftQueue() {
    const el = qs('#gift-queue-list');
    if (!el) return;
    el.innerHTML = giftQueue.length ? giftQueue.map(g => `<div class="text-sm" style="padding:4px 0;">${Icon('gift')} ${esc(g.gift)} — ${esc(g.name)} (${g.years}yr)</div>`).join('') : `<div class="text-xs text-muted">Nothing queued yet — use "Suggest Gift" on a milestone.</div>`;
  }

  // -------------------------------------------------------------------------
  // REPORTS CENTER
  // -------------------------------------------------------------------------
  function renderReports(root) {
    const reports = [
      { id: 'headcount', name: 'Headcount & Saudization Summary', desc: 'Active/inactive counts, Saudi ratio, zone position by entity.' },
      { id: 'accounts', name: 'Account Saudization Breakdown', desc: 'Headcount and Saudi % per client account.' },
      { id: 'managers', name: 'Manager Scorecard', desc: 'Team size, ratio, open positions and actions per people manager.' },
      { id: 'pipeline', name: 'Demand & Supply Pipeline', desc: 'All open requisitions with stage and nationality priority.' },
      { id: 'compliance', name: 'Compliance Action Log', desc: 'Iqama, Qiwa documentation and contract-expiry flags.' },
    ];
    root.innerHTML = `
      <div class="page-head"><div><h2>Reports Center</h2><div class="sub">Board-ready exports — PowerPoint/Excel-formatted templates arrive in Phase 2</div></div></div>
      ${hero('Formatted PPT/Excel templates land in Phase 2', 'Each report below already exports live CSV data you can open in Excel today. Native PowerPoint decks and styled Excel workbooks with charts are the Phase 2 upgrade.')}
      <div class="grid grid-3">
        ${reports.map(r => `<div class="panel panel-pad">
          <div class="kpi-icon" style="margin-bottom:10px;">${Icon('file')}</div>
          <h3 style="font-size:14px;">${esc(r.name)}</h3>
          <p class="text-sm text-muted mt-4" style="min-height:36px;">${esc(r.desc)}</p>
          <div class="flex gap-8 mt-12">
            <button class="btn btn-secondary btn-sm" data-report="${r.id}">${Icon('download')} Export CSV</button>
            <button class="btn btn-ghost btn-sm" disabled title="Phase 2">PPT / Excel</button>
          </div>
        </div>`).join('')}
      </div>
    `;
    qsa('[data-report]', root).forEach(b => b.addEventListener('click', () => generateReport(b.dataset.report)));
  }

  function generateReport(id) {
    const entity = Store.entity;
    if (id === 'headcount') {
      const rows = ['KSA','RHQ'].map(ent => {
        const act = Store.employees.filter(e=>e.entity===ent && e.status==='Active');
        const s = Engine.headcountStats(act); const cfg = Store.nitaqatConfig[ent]; const z = Engine.zoneFor(s.ratio, cfg);
        return { entity: ent, active: s.total, saudi: s.saudi, ratio: Engine.fmtPct(s.ratio), target: Engine.fmtPct(cfg.target), zone: z.name };
      });
      Engine.downloadCSV('sw360-report-headcount.csv', Engine.toCSV(rows, [{label:'Entity',value:'entity'},{label:'Active',value:'active'},{label:'Saudi',value:'saudi'},{label:'Ratio',value:'ratio'},{label:'Target',value:'target'},{label:'Zone',value:'zone'}]));
    } else if (id === 'accounts') {
      const act = Store.employees.filter(e=>e.entity===entity && e.status==='Active');
      const byAcc = Engine.groupBy(act, 'account');
      const rows = Object.keys(byAcc).map(a => { const s = Engine.headcountStats(byAcc[a]); return { account: a, total: s.total, saudi: s.saudi, ratio: Engine.fmtPct(s.ratio) }; });
      Engine.downloadCSV('sw360-report-accounts.csv', Engine.toCSV(rows, [{label:'Account',value:'account'},{label:'Headcount',value:'total'},{label:'Saudi',value:'saudi'},{label:'Ratio',value:'ratio'}]));
    } else if (id === 'managers') {
      const act = Store.employees.filter(e=>e.entity===entity && e.status==='Active');
      const rows = MANAGERS.filter(m=>m.id!=='mgr-unassigned').map(m => {
        const sc = Engine.managerScorecard(m.id, act, Store.requisitions.filter(r=>r.entity===entity), Store.nitaqatConfig);
        return { manager: m.name, team: sc.stats.total, ratio: Engine.fmtPct(sc.stats.ratio), open: sc.openReqs.length, actions: sc.actionCount };
      }).filter(r=>r.team>0);
      Engine.downloadCSV('sw360-report-managers.csv', Engine.toCSV(rows, [{label:'Manager',value:'manager'},{label:'Team Size',value:'team'},{label:'Saudi Ratio',value:'ratio'},{label:'Open Positions',value:'open'},{label:'Actions',value:'actions'}]));
    } else if (id === 'pipeline') {
      const reqs = Store.requisitions.filter(r=>r.entity===entity);
      Engine.downloadCSV('sw360-report-pipeline.csv', Engine.toCSV(reqs, [{label:'Req #',value:'reqNo'},{label:'Stage',value:'stage'},{label:'Account',value:'account'},{label:'Offering',value:'offering'},{label:'Nationality',value:'nationalityPriority'},{label:'Target Start',value:'targetStartDate'}]));
    } else if (id === 'compliance') {
      const act = Store.employees.filter(e=>e.entity===entity && e.status==='Active').map(e=>Engine.deriveEmployee(e));
      const flagged = act.filter(e=>e.rag!=='green');
      Engine.downloadCSV('sw360-report-compliance.csv', Engine.toCSV(flagged, [{label:'Employee',value:'name'},{label:'RAG',value:'rag'},{label:'Flags',value:r=>r.ragReasons.join('; ')}]));
    }
    toast('Report exported as CSV');
  }

  // -------------------------------------------------------------------------
  // AI ASSISTANT
  // -------------------------------------------------------------------------
  function renderAI(root) {
    root.innerHTML = `
      <div class="page-head"><div><h2>AI Assistant</h2><div class="sub">Role-aware HR Q&amp;A — this preview answers from your live data with simple keyword matching</div></div></div>
      ${hero('Full natural-language assistant lands in Phase 2', 'This preview pattern-matches a handful of question types against live Store data so you can test the interaction model. The production version will use approved data controls and real language understanding, scoped to what the signed-in role is allowed to see.')}
      <div class="panel">
        <div class="panel-body" id="ai-log" style="max-height:360px; overflow-y:auto;"></div>
        <div class="panel-foot">
          <div class="flex gap-8" style="margin-bottom:10px; flex-wrap:wrap;">
            ${['What zone are we in?','What\'s our Saudi ratio?','Who is leaving soon?','How many open positions?','Which account needs attention?'].map(q => `<button class="subtab-btn" data-suggest="${esc(q)}">${esc(q)}</button>`).join('')}
          </div>
          <div class="flex gap-8">
            <input type="text" id="ai-input" placeholder="Ask about headcount, Nitaqat zone, pipeline or leavers…" style="flex:1; border:1px solid var(--grey-300); border-radius:8px; padding:9px 12px;"/>
            <button class="btn btn-primary" id="ai-send">${Icon('arrowRight')} Ask</button>
          </div>
        </div>
      </div>
    `;
    if (!chatLog.length) chatLog.push({ from: 'ai', text: `Hi, I'm the Workforce 360 assistant preview. Ask me about headcount, the Nitaqat zone, pipeline, or who's leaving soon — I'll answer from ${esc(Store.entity)} data live.` });
    paintChat();
    qs('#ai-send', root).addEventListener('click', send);
    qs('#ai-input', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    qsa('[data-suggest]', root).forEach(b => b.addEventListener('click', () => { qs('#ai-input', root).value = b.dataset.suggest; send(); }));

    function send() {
      const input = qs('#ai-input', root);
      const q = input.value.trim();
      if (!q) return;
      chatLog.push({ from: 'user', text: q });
      chatLog.push({ from: 'ai', text: answer(q) });
      input.value = '';
      paintChat();
    }
    function paintChat() {
      const log = qs('#ai-log', root);
      log.innerHTML = chatLog.map(m => `<div style="display:flex; ${m.from==='user'?'justify-content:flex-end;':''} margin-bottom:10px;">
        <div style="max-width:72%; padding:10px 14px; border-radius:12px; font-size:13px; line-height:1.5; ${m.from==='user' ? 'background:var(--dxc-purple); color:#fff; border-bottom-right-radius:2px;' : 'background:var(--grey-100); color:var(--grey-900); border-bottom-left-radius:2px;'}">${esc(m.text)}</div>
      </div>`).join('');
      log.scrollTop = log.scrollHeight;
    }
  }

  function answer(q) {
    const ql = q.toLowerCase();
    const entity = Store.entity;
    const active = Store.employees.filter(e => e.entity === entity && e.status === 'Active');
    const stats = Engine.headcountStats(active);
    const cfg = Store.nitaqatConfig[entity];
    const zone = Engine.zoneFor(stats.ratio, cfg);
    if (ql.includes('zone') || ql.includes('nitaqat')) return `${entity === 'KSA' ? 'DXC Saudi Arabia' : 'The RHQ entity'} is currently in the ${zone.name} zone at ${Engine.fmtPct(stats.ratio)} Saudi against a ${Engine.fmtPct(cfg.target)} target. This is a planning indicator — confirm officially in Qiwa.`;
    if (ql.includes('ratio') || (ql.includes('saudi') && !ql.includes('account'))) return `Current Saudi ratio is ${Engine.fmtPct(stats.ratio)} (${stats.saudi} of ${stats.total} active employees).`;
    if (ql.includes('leav') || ql.includes('exit') || ql.includes('resign')) { const l = Engine.leavingSoon(active); return l.length ? `${l.length} employees are leaving within 60 days: ${l.slice(0,5).map(e=>e.name).join(', ')}${l.length>5?', …':''}.` : `No one is flagged to leave in the next 60 days.`; }
    if (ql.includes('open') || ql.includes('position') || ql.includes('pipeline') || ql.includes('vacan')) { const o = Store.requisitions.filter(r=>r.entity===entity && r.status!=='Filled'); return `There are ${o.length} open requisitions, ${o.filter(r=>r.nationalityPriority==='Saudi Priority').length} of them Saudi-priority.`; }
    if (ql.includes('account') && (ql.includes('attention') || ql.includes('risk') || ql.includes('worst'))) {
      const byAcc = Engine.groupBy(active, 'account');
      const worst = Object.keys(byAcc).map(a => ({ a, s: Engine.headcountStats(byAcc[a]) })).filter(x=>x.s.total>=5).sort((x,y)=>x.s.ratio-y.s.ratio)[0];
      return worst ? `${worst.a} needs the most attention — ${Engine.fmtPct(worst.s.ratio)} Saudi across ${worst.s.total} people, below the ${Engine.fmtPct(cfg.target)} target.` : `No account currently stands out as at-risk.`;
    }
    if (ql.includes('manager')) { const top = MANAGERS.filter(m=>m.id!=='mgr-unassigned').map(m=>({m,n:active.filter(e=>e.managerId===m.id).length})).sort((a,b)=>b.n-a.n)[0]; return top ? `${top.m.name} has the largest active team at ${top.n} people.` : `No manager data available.`; }
    return `This preview can answer questions about headcount, Nitaqat zone, Saudi ratio, open pipeline, and who's leaving soon. Try one of the suggested questions above — full natural-language coverage is a Phase 2 capability.`;
  }

  return { render };
})();
