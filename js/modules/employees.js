// ============================================================================
// Employees — Workforce Register. Real filtering, sorting, pagination, CSV
// export, a tabbed profile drawer, and working Add/Edit forms that mutate
// Store and re-render the table immediately.
// ============================================================================

var Modules = window.Modules || {};
Modules.employees = (() => {

  let filters = {};
  let sortKey = 'name', sortDir = 'asc';
  let page = 1;
  const PAGE_SIZE = 25;

  function scopedBase() {
    let base = Store.employees.filter(e => e.entity === Store.entity);
    const role = currentRole();
    if (role.id === 'pm' && Store.scopeManagerId) base = base.filter(e => e.managerId === Store.scopeManagerId);
    if (role.id === 'slm' && Store.scopeServiceLine) base = base.filter(e => e.serviceLine === Store.scopeServiceLine);
    return base;
  }

  function render(root) {
    // consume drill-down hand-offs
    if (Router.pendingFilters) { filters = Object.assign({}, Router.pendingFilters); page = 1; Router.pendingFilters = null; }
    if (Router.pendingSearch) { filters.search = Router.pendingSearch; page = 1; Router.pendingSearch = null; }

    const role = currentRole();
    const base = scopedBase();
    let working = base;
    if (filters.__leavingSoon) {
      const ids = new Set(Engine.leavingSoon(base).map(e => e.id));
      working = base.filter(e => ids.has(e.id));
    }
    const activeFilters = Object.assign({}, filters); delete activeFilters.__leavingSoon;
    working = Engine.applyFilters(working, activeFilters);
    working = working.map(e => Engine.deriveEmployee(e));
    working = sortRows(working);

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h2>Workforce Register</h2>
          <div class="sub">${esc(Store.entity === 'KSA' ? 'DXC Saudi Arabia' : 'DXC Regional HQ')} · ${base.length} records in scope ${role.id==='pm'||role.id==='slm' ? '(team-scoped)' : ''}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="emp-export">${Icon('download')} Export Filtered (CSV)</button>
          ${role.perms.addEmployee ? `<button class="btn btn-primary" id="emp-add">${Icon('plus')} Add Employee</button>` : ''}
        </div>
      </div>

      <div class="grid grid-4 mt-16">
        <div class="panel panel-pad" style="min-width:0;"><div class="text-xs text-muted" style="font-weight:700; margin-bottom:6px;">Nationality — filtered set</div><div style="position:relative; height:120px; width:100%; overflow:hidden;"><canvas id="emp-chart-nat" style="width:100%; height:100%;"></canvas></div></div>
        <div class="panel panel-pad" style="min-width:0;"><div class="text-xs text-muted" style="font-weight:700; margin-bottom:6px;">Gender — filtered set</div><div style="position:relative; height:120px; width:100%; overflow:hidden;"><canvas id="emp-chart-gender" style="width:100%; height:100%;"></canvas></div></div>
        <div class="panel panel-pad" style="min-width:0;"><div class="text-xs text-muted" style="font-weight:700; margin-bottom:6px;">Status — filtered set</div><div style="position:relative; height:120px; width:100%; overflow:hidden;"><canvas id="emp-chart-status" style="width:100%; height:100%;"></canvas></div></div>
        <div class="panel panel-pad" style="min-width:0;"><div class="text-xs text-muted" style="font-weight:700; margin-bottom:6px;">RAG — filtered set</div><div style="position:relative; height:120px; width:100%; overflow:hidden;"><canvas id="emp-chart-rag" style="width:100%; height:100%;"></canvas></div></div>
      </div>

      <div class="panel mt-16">
        ${filterBarHtml(base)}
        <div class="table-toolbar">
          <div class="table-count">${working.length} of ${base.length} employees match current filters</div>
          <div class="legend">
            <span><i style="background:var(--c-success)"></i> On track</span>
            <span><i style="background:var(--c-warning)"></i> Needs attention</span>
            <span><i style="background:var(--c-danger)"></i> At risk</span>
          </div>
        </div>
        <div class="table-wrap"><table class="data-table" id="emp-table"></table></div>
        <div class="pagination" id="emp-pagination"></div>
      </div>
    `;

    renderTable(working);
    renderPagination(working.length);
    drawCompositionCharts(working);
    bindFilterBar(root, base);

    qs('#emp-export', root).addEventListener('click', () => exportCSV(working));
    const addBtn = qs('#emp-add', root);
    if (addBtn) addBtn.addEventListener('click', () => openEmployeeForm(null));
  }

  // -------------------------------------------------------------------------
  function filterBarHtml(base) {
    const opt = (arr, cur) => arr.map(v => `<option value="${esc(v)}" ${cur===v?'selected':''}>${esc(v)}</option>`).join('');
    return `
      <div class="filter-bar">
        <div class="search-box">${Icon('search')}<input type="text" id="f-search" placeholder="Name, EID, email…" value="${esc(filters.search||'')}"/></div>
        <select id="f-status"><option value="">Status: All</option>${opt(['Active','Inactive','Attrition'], filters.status)}</select>
        <select id="f-servicel"><option value="">Service Line: All</option>${SERVICE_LINES.map(s=>`<option value="${s.id}" ${filters.serviceLine===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
        <select id="f-offering"><option value="">Offering: All</option>${opt(OFF_NAMES_SAFE(), filters.offering)}</select>
        <select id="f-account"><option value="">Account: All</option>${opt(Engine.uniqueSorted(base,'account'), filters.account)}</select>
        <select id="f-manager"><option value="">Manager: All</option>${MANAGERS.map(m=>`<option value="${m.id}" ${filters.managerId===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select>
        <select id="f-nationality"><option value="">Nationality: All</option><option value="__saudi" ${filters.isSaudi===true?'selected':''}>Saudi only</option><option value="__nonsaudi" ${filters.isSaudi===false?'selected':''}>Non-Saudi only</option>${opt(Engine.uniqueSorted(base,'nationality'), filters.nationality)}</select>
        <select id="f-level"><option value="">Level: All</option>${opt(LEVELS, filters.level)}</select>
        <select id="f-location"><option value="">Location: All</option>${opt(LOCATIONS, filters.location)}</select>
        <select id="f-jobtitle"><option value="">Job Title: All</option>${opt(Engine.uniqueSorted(base,'jobTitle'), filters.jobTitle)}</select>
        <select id="f-proscat"><option value="">Saudization Category: All</option>${PROFESSION_CATEGORIES.map(c=>`<option value="${c.code}" ${filters.professionCode===c.code?'selected':''}>${esc(c.name)} (${c.code})</option>`).join('')}</select>
        <select id="f-rag"><option value="">RAG: All</option><option value="green" ${filters.rag==='green'?'selected':''}>On track</option><option value="amber" ${filters.rag==='amber'?'selected':''}>Needs attention</option><option value="red" ${filters.rag==='red'?'selected':''}>At risk</option></select>
        <button class="btn btn-ghost btn-sm" id="f-clear">${Icon('x')} Clear</button>
      </div>`;
  }

  function OFF_NAMES_SAFE() { return OFFERINGS.map(o => o.name); }

  function drawCompositionCharts(rows) {
    const smallDonut = (id, labels, data, colors) => mountChart(id, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors }] },
      options: { maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9.5 } } } } }
    }, { labels: true, labelColor: '#fff', labelOptions: { font: { size: 9, weight: '700' } } });

    const saudi = rows.filter(e => e.isSaudi).length;
    smallDonut('emp-chart-nat', ['Saudi', 'Non-Saudi'], [saudi, rows.length - saudi], [CHART_PALETTE[0], CHART_PALETTE[6]]);

    const byGender = Engine.groupBy(rows, 'gender');
    const genderLabels = Object.keys(byGender).filter(k => k !== 'undefined' && k !== 'null');
    smallDonut('emp-chart-gender', genderLabels, genderLabels.map(g => byGender[g].length), [CHART_PALETTE[1], CHART_PALETTE[2], CHART_PALETTE[6]]);

    const byStatus = Engine.groupBy(rows, 'status');
    const statusLabels = Object.keys(byStatus);
    smallDonut('emp-chart-status', statusLabels, statusLabels.map(s => byStatus[s].length), statusLabels.map(s => s==='Active'?'#147A50':s==='Attrition'?'#92600E':'#969696'));

    const byRag = { green: 0, amber: 0, red: 0 };
    rows.forEach(e => { if (byRag[e.rag] !== undefined) byRag[e.rag] += 1; });
    smallDonut('emp-chart-rag', ['On track', 'Needs attention', 'At risk'], [byRag.green, byRag.amber, byRag.red], ['#147A50', '#92600E', '#96281D']);
  }

  function bindFilterBar(root, base) {
    const map = { 'f-status':'status', 'f-servicel':'serviceLine', 'f-offering':'offering', 'f-account':'account', 'f-manager':'managerId', 'f-level':'level', 'f-location':'location', 'f-jobtitle':'jobTitle', 'f-proscat':'professionCode', 'f-rag':'rag' };
    Object.keys(map).forEach(id => {
      const el = qs('#'+id, root);
      if (el) el.addEventListener('change', () => { filters[map[id]] = el.value || undefined; page = 1; rerender(); });
    });
    const nat = qs('#f-nationality', root);
    if (nat) nat.addEventListener('change', () => {
      delete filters.isSaudi; delete filters.nationality;
      if (nat.value === '__saudi') filters.isSaudi = true;
      else if (nat.value === '__nonsaudi') filters.isSaudi = false;
      else if (nat.value) filters.nationality = nat.value;
      page = 1; rerender();
    });
    const search = qs('#f-search', root);
    if (search) search.addEventListener('input', debounce(() => { filters.search = search.value || undefined; page = 1; rerender(); }, 250));
    const clear = qs('#f-clear', root);
    if (clear) clear.addEventListener('click', () => { filters = {}; page = 1; rerender(); });

    function rerender() { render(qs('#route-container')); }
  }

  function sortRows(rows) {
    const dir = sortDir === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      let av, bv;
      if (sortKey === 'tenure') { av = a.tenureMonths; bv = b.tenureMonths; }
      else if (sortKey === 'joiningDate') { av = a.joiningDate; bv = b.joiningDate; }
      else { av = (a[sortKey] || '').toString().toLowerCase(); bv = (b[sortKey] || '').toString().toLowerCase(); }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function renderTable(rows) {
    const el = qs('#emp-table');
    const pageRows = rows.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
    const arrow = (key) => sortKey === key ? `<span class="sort-arrow">${sortDir==='asc'?'▲':'▼'}</span>` : '';
    el.innerHTML = `
      <thead><tr>
        <th class="sortable" data-sort="name">Employee ${arrow('name')}</th>
        <th>Nationality</th>
        <th>Service Line / Offering</th>
        <th>Account</th>
        <th>Manager</th>
        <th>Level / Title</th>
        <th class="sortable" data-sort="tenure">Tenure ${arrow('tenure')}</th>
        <th>Contract / Iqama</th>
        <th>RAG</th>
        <th></th>
      </tr></thead>
      <tbody>
        ${pageRows.map(rowHtml).join('') || `<tr><td colspan="10" class="table-empty">${Icon('search')}<br/>No employees match these filters.</td></tr>`}
      </tbody>`;
    qsa('th.sortable', el).forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (sortKey === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc'; else { sortKey = k; sortDir = 'asc'; }
      renderTable(rows);
    }));
    qsa('tr[data-emp]', el).forEach(tr => tr.addEventListener('click', () => openProfileDrawer(tr.dataset.emp)));
  }

  function rowHtml(e) {
    const mgr = MANAGERS.find(m => m.id === e.managerId);
    const contractBit = !e.isSaudi
      ? (e.iqamaStatus === 'Expired' ? `<span class="chip chip-red">Iqama expired</span>` : e.iqamaStatus === 'Expiring Soon' ? `<span class="chip chip-amber">Iqama ${e.iqamaDaysLeft}d</span>` : e.iqamaStatus === 'Not on File' ? `<span class="chip chip-amber">Iqama missing</span>` : `<span class="chip chip-grey">Iqama OK</span>`)
      : (e.contractStatus === 'Expired' ? `<span class="chip chip-red">Contract ended</span>` : e.contractStatus === 'Expiring Soon' ? `<span class="chip chip-amber">Ends ${e.contractDaysLeft}d</span>` : `<span class="chip chip-grey">${esc(e.contractType||'Indefinite')}</span>`);
    return `<tr class="clickable" data-emp="${e.id}">
      <td><span class="avatar-sm">${initials(e.name)}</span><span class="cell-name">${esc(e.name)}</span><br/><span class="cell-sub" style="margin-left:34px;">${e.eid} · ${statusDot(e.status)} ${esc(e.status)}</span></td>
      <td>${esc(e.nationality)}${e.isSaudi?' <span class="chip chip-purple">SA</span>':''}</td>
      <td>${esc((SERVICE_LINES.find(s=>s.id===e.serviceLine)||{}).name || '—')}<br/><span class="cell-sub">${esc(e.offering||'—')}</span></td>
      <td>${esc(e.account||'—')}</td>
      <td>${mgr ? esc(mgr.name) : '<span class="text-muted">Unassigned</span>'}</td>
      <td>${esc(e.level||'—')}<br/><span class="cell-sub">${esc(e.jobTitle||'—')}</span>${e.role && e.role !== e.jobTitle ? `<br/><span class="cell-sub" style="font-style:italic;">${esc(e.role)}</span>` : ''}</td>
      <td class="mono">${esc(e.tenureLabel)}</td>
      <td>${contractBit}</td>
      <td>${ragChip(e.rag)}</td>
      <td>${Icon('chevronRight')}</td>
    </tr>`;
  }

  function renderPagination(total) {
    const el = qs('#emp-pagination');
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
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
      render(qs('#route-container'));
    }));
  }

  function exportCSV(rows) {
    const cols = [
      { label: 'EID', value: 'eid' }, { label: 'Name', value: 'name' }, { label: 'Status', value: 'status' },
      { label: 'Nationality', value: 'nationality' }, { label: 'Gender', value: 'gender' },
      { label: 'Service Line', value: r => (SERVICE_LINES.find(s=>s.id===r.serviceLine)||{}).name || '' },
      { label: 'Offering', value: 'offering' }, { label: 'Account', value: 'account' },
      { label: 'Manager', value: r => (MANAGERS.find(m=>m.id===r.managerId)||{}).name || '' },
      { label: 'Role', value: 'role' }, { label: 'Job Title', value: 'jobTitle' }, { label: 'Level', value: 'level' },
      { label: 'Legal Profession', value: 'profession' }, { label: 'Location', value: 'location' },
      { label: 'Joining Date', value: 'joiningDate' }, { label: 'Tenure', value: 'tenureLabel' },
      { label: 'Contract Type', value: 'contractType' }, { label: 'End Date', value: 'endDate' },
      { label: 'Qiwa Status', value: 'qiwaStatus' }, { label: 'Iqama Status', value: 'iqamaStatus' },
      { label: 'RAG', value: 'rag' }, { label: 'Email', value: 'email' }, { label: 'Phone', value: 'phone' },
    ];
    const csv = Engine.toCSV(rows, cols);
    Engine.downloadCSV(`sw360-employees-${Store.entity}-${new Date().toISOString().slice(0,10)}.csv`, csv);
    toast(`Exported ${rows.length} employee records`);
  }

  // -------------------------------------------------------------------------
  // PROFILE DRAWER
  // -------------------------------------------------------------------------
  function openProfileDrawer(empId) {
    const emp0 = Store.employees.find(e => e.id === empId);
    if (!emp0) return;
    let tab = 'overview';

    function paint() {
      const emp = Engine.deriveEmployee(Store.employees.find(e => e.id === empId));
      const mgr = MANAGERS.find(m => m.id === emp.managerId);
      const overlay = openDrawer(drawerShell(emp));
      qs('.tabs', overlay).addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn'); if (!btn) return;
        tab = btn.dataset.tab; paint();
      });
      qs('#drawer-body', overlay).innerHTML = tabBody(emp, mgr, tab);
      wireDrawerActions(overlay, emp);
    }

    function drawerShell(emp) {
      const canEdit = editPermission(emp);
      return `
        <div class="drawer-head">
          <div class="flex justify-between items-center">
            <div class="drawer-profile-top">
              <div class="drawer-avatar">${initials(emp.name)}</div>
              <div>
                <h3>${esc(emp.name)}</h3>
                <div class="role-line">${esc(emp.role||emp.jobTitle||'—')} · ${esc(emp.level||'—')}</div>
                <div class="mt-4">${statusDot(emp.status)} ${esc(emp.status)} &nbsp; ${ragChip(emp.rag)}</div>
              </div>
            </div>
            <button class="modal-close" id="drawer-x">${Icon('x')}</button>
          </div>
        </div>
        <div class="tabs">
          ${['overview','employment','contract','lifecycle','documents','audit'].map(t => `<div class="tab-btn ${tab===t?'active':''}" data-tab="${t}">${tabLabel(t)}</div>`).join('')}
        </div>
        <div class="drawer-body" id="drawer-body"></div>
        <div class="drawer-foot">
          <button class="btn btn-secondary btn-sm" id="drawer-close2">Close</button>
          <div class="flex gap-8">
            ${canEdit ? `<button class="btn btn-secondary" id="drawer-edit">${Icon('edit')} Edit</button>` : ''}
            ${currentRole().perms.deleteEmployee && emp.status==='Active' ? `<button class="btn btn-danger" id="drawer-deactivate">${Icon('logout')} Deactivate</button>` : ''}
          </div>
        </div>`;
    }

    function tabLabel(t) {
      return { overview:'Overview', employment:'Employment & Org', contract:'Contract & Compliance', lifecycle:'Lifecycle & Milestones', documents:'Documents', audit:'Audit History' }[t];
    }

    function wireDrawerActions(overlay, emp) {
      qs('#drawer-x', overlay).addEventListener('click', closeOverlay);
      qs('#drawer-close2', overlay).addEventListener('click', closeOverlay);
      const editBtn = qs('#drawer-edit', overlay);
      if (editBtn) editBtn.addEventListener('click', () => openEmployeeForm(emp.id));
      const deactivateBtn = qs('#drawer-deactivate', overlay);
      if (deactivateBtn) deactivateBtn.addEventListener('click', () => {
        openModal(`
          <div class="modal-head"><h3>Deactivate ${esc(emp.name)}</h3><button class="modal-close" data-close>${Icon('x')}</button></div>
          <div class="modal-body">
            <div class="field"><label>Separation reason</label>
              <select id="deact-reason"><option>Resignation</option><option>Contract End</option><option>Transfer Out</option><option>Termination</option><option>Other</option></select>
            </div>
          </div>
          <div class="modal-foot">
            <span class="text-xs text-muted" style="margin-right:auto;">${Icon('info')} Local to this session only.</span>
            <button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-danger" id="deact-confirm">Deactivate Record</button>
          </div>
        `);
        qsa('[data-close]').forEach(b => b.addEventListener('click', () => { closeOverlay(); paint(); }));
        qs('#deact-confirm').addEventListener('click', () => {
          Store.deactivateEmployee(emp.id, qs('#deact-reason').value);
          closeOverlay();
          toast(`${emp.name} marked Inactive`);
          render(qs('#route-container'));
        });
      });
      // documents tab uploads
      qsa('[data-upload]', overlay).forEach(btn => btn.addEventListener('click', () => {
        const input = document.createElement('input'); input.type = 'file';
        input.addEventListener('change', () => {
          if (!input.files[0]) return;
          const docs = Object.assign({}, emp.documents || {});
          docs[btn.dataset.upload] = { name: input.files[0].name, uploadedAt: new Date().toISOString() };
          Store.updateEmployee(emp.id, { documents: docs });
          toast(`${input.files[0].name} attached`);
          paint();
        });
        input.click();
      }));
    }

    paint();
  }

  function editPermission(emp) {
    const role = currentRole();
    if (role.perms.editEmployee === true) return true;
    if (role.perms.editEmployee === 'scoped') return emp.managerId === Store.scopeManagerId;
    return false;
  }

  function tabBody(emp, mgr, tab) {
    if (tab === 'overview') return `
      <div class="info-list">
        <div class="info-item"><label>EID</label><div>${emp.eid}</div></div>
        <div class="info-item"><label>Nationality</label><div>${esc(emp.nationality)}</div></div>
        <div class="info-item"><label>Gender</label><div>${esc(emp.gender||'—')}</div></div>
        <div class="info-item"><label>Location</label><div>${esc(emp.location||'Not on file')}</div></div>
        <div class="info-item"><label>Phone</label><div>${esc(emp.phone||'—')}</div></div>
        <div class="info-item"><label>Email</label><div>${esc(emp.email||'—')}</div></div>
        <div class="info-item"><label>Family Status</label><div>${esc(emp.family||'Not disclosed')}</div></div>
        <div class="info-item"><label>SCE Registered</label><div>${esc(emp.sce||'N/A')}</div></div>
      </div>
      ${emp.ragReasons.length ? `<div class="section-title">Why this RAG</div><div style="padding:0 24px 16px;">${emp.ragReasons.map(r=>`<div class="text-sm" style="padding:5px 0; display:flex; gap:8px;">${Icon(emp.rag==='red'?'alertCircle':'alertTriangle')}<span>${esc(r)}</span></div>`).join('')}</div>` : `<div style="padding:0 24px 16px;" class="text-sm text-muted">${Icon('checkCircle')} No open compliance or data-quality flags on this record.</div>`}
    `;
    if (tab === 'employment') return `
      <div class="info-list">
        <div class="info-item"><label>Service Line</label><div>${esc((SERVICE_LINES.find(s=>s.id===emp.serviceLine)||{}).name||'—')}</div></div>
        <div class="info-item"><label>Offering</label><div>${esc(emp.offering||'—')}</div></div>
        <div class="info-item"><label>Account</label><div>${esc(emp.account||'—')}</div></div>
        <div class="info-item"><label>People Manager</label><div>${mgr?esc(mgr.name):'Unassigned'}</div></div>
        <div class="info-item"><label>Role</label><div>${esc(emp.role||'—')}</div></div>
        <div class="info-item"><label>Job Title</label><div>${esc(emp.jobTitle||'—')}</div></div>
        <div class="info-item"><label>Level</label><div>${esc(emp.level||'—')}</div></div>
        <div class="info-item"><label>Legal Profession</label><div>${esc(emp.profession||'Missing')} ${emp.professionCode?`<span class="chip chip-grey">${emp.professionCode}</span>`:''}</div></div>
        <div class="info-item"><label>Joining Date</label><div>${Engine.fmtDate(emp.joiningDate)}</div></div>
      </div>`;
    if (tab === 'contract') return `
      <div class="section-title">Contract</div>
      <div class="info-list">
        <div class="info-item"><label>Contract Type</label><div>${esc(emp.contractType||'Indefinite')}</div></div>
        <div class="info-item"><label>End Date</label><div>${emp.endDate?Engine.fmtDate(emp.endDate):'—'} ${emp.contractStatus==='Expiring Soon'?`<span class="chip chip-amber">${emp.contractDaysLeft}d left</span>`:emp.contractStatus==='Expired'?`<span class="chip chip-red">Expired</span>`:''}</div></div>
        <div class="info-item"><label>Qiwa Documentation</label><div>${qiwaChip(emp.qiwaStatus)}</div></div>
        <div class="info-item"><label>Work Authorization / Iqama</label><div>${emp.isSaudi?'N/A — Saudi National':(emp.iqamaExpiry?`Expires ${Engine.fmtDate(emp.iqamaExpiry)}`:'Not on file')} ${emp.iqamaStatus==='Expiring Soon'?`<span class="chip chip-amber">${emp.iqamaDaysLeft}d left</span>`:emp.iqamaStatus==='Expired'?`<span class="chip chip-red">Expired</span>`:''}</div></div>
        <div class="info-item"><label>Compliance Doc (Insurance/Training)</label><div>${emp.complianceDocExpiry?Engine.fmtDate(emp.complianceDocExpiry):'Not tracked'} ${emp.complianceStatus==='Expiring Soon'?`<span class="chip chip-amber">Renews soon</span>`:emp.complianceStatus==='Expired'?`<span class="chip chip-red">Expired</span>`:''}</div></div>
        <div class="info-item"><label>Exit / Re-Entry</label><div>${emp.exitReentry ? `${esc(emp.exitReentry.status)} — due ${Engine.fmtDate(emp.exitReentry.returnDue)}` : 'Not applicable'}</div></div>
      </div>
      <div style="padding:0 24px;"><div class="disclaimer-box">${Icon('info')}<span>${QIWA_RULE_NOTE}</span></div></div>
    `;
    if (tab === 'lifecycle') {
      const milestones = [5,10,15].filter(m => emp.tenureYears >= m);
      return `
      <div class="section-title">Tenure</div>
      <div style="padding:0 24px;"><div class="kpi-value" style="font-size:22px;">${esc(emp.tenureLabel)}</div><div class="text-sm text-muted">since ${Engine.fmtDate(emp.joiningDate)}</div></div>
      ${emp.upcomingMilestone ? `<div style="padding:14px 24px;"><div class="chip chip-purple">${Icon('star')} ${emp.upcomingMilestone.years}-year anniversary in ${emp.upcomingMilestone.daysAway}d — ${Engine.fmtDate(emp.upcomingMilestone.date)}</div></div>` : ''}
      <div class="section-title">Timeline</div>
      <div class="timeline" style="padding:8px 24px;">
        <div class="timeline-item"><div class="timeline-dot"></div><div><div class="t-date">${Engine.fmtDate(emp.joiningDate)}</div><div class="t-text">Joined DXC — ${esc(emp.role||emp.jobTitle||'')}</div></div></div>
        ${milestones.map(m => `<div class="timeline-item"><div class="timeline-dot"></div><div><div class="t-date">${m}-Year Mark</div><div class="t-text">${m}-year service milestone reached</div></div></div>`).join('')}
        ${emp.status!=='Active' ? `<div class="timeline-item"><div class="timeline-dot" style="background:var(--grey-400)"></div><div><div class="t-date">${emp.endDate?Engine.fmtDate(emp.endDate):'—'}</div><div class="t-text">Status changed to ${esc(emp.status)}${emp.separationReason?': '+esc(emp.separationReason):''}</div></div></div>` : ''}
      </div>`;
    }
    if (tab === 'documents') {
      const docs = emp.documents || {};
      const list = [
        { key: 'contract', label: 'Employment Contract', auto: true },
        { key: 'iqama', label: emp.isSaudi ? 'National ID Copy' : 'Iqama Copy', auto: !emp.isSaudi && emp.iqamaExpiry },
        { key: 'qiwa', label: 'Qiwa Contract Confirmation', auto: emp.qiwaStatus === 'Documented' },
        { key: 'insurance', label: 'Insurance / Medical Card', auto: !!emp.complianceDocExpiry },
      ];
      return `<div style="padding:10px 24px 20px;">
        ${list.map(d => {
          const uploaded = docs[d.key];
          const onFile = uploaded || d.auto;
          return `<div class="flex items-center justify-between" style="padding:12px 0; border-bottom:1px solid var(--grey-100);">
            <div class="flex items-center gap-10">${Icon('file')}<div><div style="font-weight:700; font-size:13px;">${esc(d.label)}</div><div class="text-xs text-muted">${uploaded ? `${esc(uploaded.name)} · ${Engine.fmtDate(uploaded.uploadedAt)}` : onFile ? 'On file (linked from record data)' : 'Not uploaded'}</div></div></div>
            <div class="flex items-center gap-8">${onFile ? '<span class="chip chip-green">On File</span>' : '<span class="chip chip-amber">Missing</span>'}<button class="btn btn-secondary btn-sm" data-upload="${d.key}">${Icon('download')} ${uploaded?'Replace':'Upload'}</button></div>
          </div>`;
        }).join('')}
      </div>`;
    }
    if (tab === 'audit') {
      const entries = Store.auditLog.filter(l => l.detail && (l.detail.includes(emp.name) || l.detail.includes(String(emp.eid))));
      return `<div class="timeline" style="padding:14px 24px;">
        <div class="timeline-item"><div class="timeline-dot"></div><div><div class="t-date">${Engine.fmtDate(emp.joiningDate)}</div><div class="t-text">Record created in Workforce Register</div></div></div>
        ${entries.map(l => `<div class="timeline-item"><div class="timeline-dot"></div><div><div class="t-date">${new Date(l.ts).toLocaleString('en-GB')}</div><div class="t-text">${esc(l.action)} — ${esc(l.detail)}</div><div class="t-actor">${esc(l.actor)}</div></div></div>`).join('')}
        ${entries.length===0 ? `<div class="text-sm text-muted">No edits recorded yet in this session.</div>` : ''}
      </div>`;
    }
    return '';
  }

  function qiwaChip(status) {
    if (status === 'Documented') return `<span class="chip chip-green">Documented</span>`;
    if (status === 'Pending Documentation') return `<span class="chip chip-amber">Pending</span>`;
    return `<span class="chip chip-red">Not Documented</span>`;
  }

  // -------------------------------------------------------------------------
  // ADD / EDIT FORM
  // -------------------------------------------------------------------------
  function openEmployeeForm(empId) {
    const editing = !!empId;
    const emp = editing ? Store.employees.find(e => e.id === empId) : {};
    const scoped = editing && currentRole().perms.editEmployee === 'scoped';
    const scopedFields = ['role', 'jobTitle', 'level', 'location', 'phone', 'family'];
    const disabled = (field) => scoped && !scopedFields.includes(field) ? 'disabled' : '';

    const overlay = openModal(`
      <div class="modal-head"><h3>${editing ? 'Edit Employee' : 'Add Employee'}</h3><button class="modal-close" data-close>${Icon('x')}</button></div>
      <div class="modal-body">
        ${scoped ? `<div class="disclaimer-box mt-8" style="margin-bottom:14px;">${Icon('info')}<span>People Manager role can edit approved team fields only (role, job title, level, location, phone, family status). Other fields are read-only in this role.</span></div>` : ''}
        <form id="emp-form">
          <div class="form-grid">
            <div class="field"><label>Full Name <span class="req">*</span></label><input name="name" required ${disabled('name')} value="${esc(emp.name||'')}"/></div>
            <div class="field"><label>Gender</label><select name="gender" ${disabled('gender')}><option ${!emp.gender?'selected':''}></option><option ${emp.gender==='Male'?'selected':''}>Male</option><option ${emp.gender==='Female'?'selected':''}>Female</option></select></div>
            <div class="field"><label>Nationality <span class="req">*</span></label>
              <select name="nationality" required ${disabled('nationality')}>${allNationalities().map(n=>`<option ${emp.nationality===n?'selected':''}>${esc(n)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Status</label><select name="status" ${disabled('status')}>${['Active','Inactive','Attrition'].map(s=>`<option ${emp.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
            <div class="field"><label>Offering <span class="req">*</span></label><select name="offering" required ${disabled('offering')}>${OFFERINGS.map(o=>`<option ${emp.offering===o.name?'selected':''}>${esc(o.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Account <span class="req">*</span></label><select name="account" required ${disabled('account')}>${ACCOUNTS.filter(a=>a.entity==='KSA').map(a=>a.name).filter((v,i,arr)=>arr.indexOf(v)===i).map(a=>`<option ${emp.account===a?'selected':''}>${esc(a)}</option>`).join('')}</select></div>
            <div class="field"><label>People Manager</label><select name="managerId" ${disabled('managerId')}>${MANAGERS.map(m=>`<option value="${m.id}" ${emp.managerId===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Role <span class="req">*</span></label><input name="role" required ${disabled('role')} value="${esc(emp.role||'')}"/><div class="text-xs text-muted mt-4">The real title as recorded — free text, not a controlled list.</div></div>
            <div class="field"><label>Job Title <span class="req">*</span></label><select name="jobTitle" required ${disabled('jobTitle')}>${JOB_TITLES.map(t=>`<option ${emp.jobTitle===t?'selected':''}>${esc(t)}</option>`).join('')}</select><div class="text-xs text-muted mt-4">Standardized title, used for grouping/stats (e.g. Nitaqat-by-title).</div></div>
            <div class="field"><label>Level <span class="req">*</span></label><select name="level" required>${LEVELS.map(l=>`<option ${emp.level===l?'selected':''}>${esc(l)}</option>`).join('')}</select></div>
            <div class="field"><label>Legal Profession</label><select name="profession" ${disabled('profession')}><option value="">— Not mapped —</option>${PROFESSIONS.map(p=>`<option value="${esc(p.name)}" data-code="${p.code}" ${emp.profession===p.name?'selected':''}>${esc(p.name)} (${p.code})</option>`).join('')}</select><div class="text-xs text-muted mt-4">Used for Nitaqat/Saudization stats (Qiwa mapping).</div></div>
            <div class="field"><label>Location</label><select name="location">${LOCATIONS.map(l=>`<option ${emp.location===l?'selected':''}>${esc(l)}</option>`).join('')}</select></div>
            <div class="field"><label>Joining Date <span class="req">*</span></label><input type="date" name="joiningDate" required ${disabled('joiningDate')} value="${emp.joiningDate||''}"/></div>
            <div class="field"><label>Contract Type</label><select name="contractType" ${disabled('contractType')}>${['Indefinite','Fixed-Term'].map(c=>`<option ${emp.contractType===c?'selected':''}>${c}</option>`).join('')}</select></div>
            <div class="field"><label>Contract / Fixed-Term End Date</label><input type="date" name="endDate" ${disabled('contractType')} value="${emp.endDate||''}"/></div>
            <div class="field"><label>Phone</label><input name="phone" value="${esc(emp.phone||'')}"/></div>
            <div class="field"><label>Email</label><input name="email" ${disabled('email')} value="${esc(emp.email||'')}"/></div>
            <div class="field"><label>Family Status</label><select name="family"><option value="">Not disclosed</option>${['Yes','No'].map(f=>`<option ${emp.family===f?'selected':''}>${f}</option>`).join('')}</select></div>
            <div class="field"><label>SCE Registered (Engineers)</label><select name="sce" ${disabled('sce')}><option value="">N/A</option>${['Yes','No'].map(f=>`<option ${emp.sce===f?'selected':''}>${f}</option>`).join('')}</select></div>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <span class="text-xs text-muted" style="margin-right:auto;">${Icon('info')} Saved to this browser session only — not yet synced to the shared database (write-back is coming in a later phase).</span>
        <button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" id="emp-save">${Icon('check')} ${editing?'Save Changes':'Add Employee'}</button>
      </div>
    `, { wide: true });

    qsa('[data-close]', overlay).forEach(b => b.addEventListener('click', closeOverlay));
    qs('#emp-save', overlay).addEventListener('click', () => {
      const form = qs('#emp-form', overlay);
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const data = {};
      fd.forEach((v, k) => { if (v !== '') data[k] = v; });
      const profSelect = form.querySelector('[name=profession]');
      if (profSelect && profSelect.value) {
        data.professionCode = profSelect.selectedOptions[0].dataset.code;
      }
      data.isGCC = false;
      if (editing) {
        Store.updateEmployee(empId, data);
        toast(`${data.name || emp.name} updated`);
      } else {
        const created = Store.addEmployee(data);
        toast(`${created.name} added to the register`);
      }
      closeOverlay();
      render(qs('#route-container'));
    });
  }

  function allNationalities() {
    const set = new Set(Store.employees.map(e => e.nationality).filter(Boolean));
    set.add('Saudi Arabia');
    return Array.from(set).sort((a,b) => a === 'Saudi Arabia' ? -1 : b === 'Saudi Arabia' ? 1 : a.localeCompare(b));
  }

  return { render, openEmployeeForm, openProfileDrawer };
})();
