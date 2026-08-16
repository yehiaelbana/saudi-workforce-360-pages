// ============================================================================
// Administration — HR/Admin only. Roles & permissions, reference data,
// regulatory configuration (genuinely editable — feeds HR Workspace and
// Home directly), workflow/data-source mapping, audit log, and demo reset.
// ============================================================================

var Modules = window.Modules || {};
Modules.administration = (() => {

  let tab = 'roles';
  let profilesCache = null;   // null = not loaded yet; array once fetched
  let profilesError = null;
  let repaint = null;         // set by render(); lets async loads trigger a re-paint

  function render(root) {
    if (!currentRole().perms.editConfig) {
      root.innerHTML = `<div class="empty-state">${Icon('lock')}<h4>HR &amp; Admin access only</h4><p>Switch role to "HR &amp; Admin" to open Administration.</p></div>`;
      return;
    }
    const tabs = [
      { id: 'roles', label: 'Roles & Permissions' },
      { id: 'users', label: 'Users & Access' },
      { id: 'fields', label: 'Employee Fields' },
      { id: 'reference', label: 'Reference Data' },
      { id: 'regulatory', label: 'Regulatory Config' },
      { id: 'workflow', label: 'Workflow & Data Sources' },
      { id: 'notify', label: 'Notifications & Calendar' },
      { id: 'audit', label: 'Audit & System' },
    ];
    root.innerHTML = `
      <div class="page-head"><div><h2>Administration</h2><div class="sub">System configuration — structured to map onto SharePoint Lists / Power Platform later</div></div></div>
      <div class="panel">
        <div class="tabs">${tabs.map(t => `<div class="tab-btn ${tab===t.id?'active':''}" data-tab="${t.id}">${t.label}</div>`).join('')}</div>
        <div class="tab-panel" id="admin-body"></div>
      </div>
    `;
    repaint = paint;
    paint();
    qsa('.tab-btn', root).forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; qsa('.tab-btn',root).forEach(x=>x.classList.toggle('active',x===b)); paint(); }));

    function paint() {
      const body = qs('#admin-body', root);
      if (tab === 'roles') body.innerHTML = rolesTab();
      else if (tab === 'users') { body.innerHTML = usersTab(); if (profilesCache === null && !profilesError) loadProfiles(); else drawUsersChart(); }
      else if (tab === 'fields') body.innerHTML = fieldsTab();
      else if (tab === 'reference') { body.innerHTML = referenceTab(); drawReferenceCharts(); }
      else if (tab === 'regulatory') body.innerHTML = regulatoryTab();
      else if (tab === 'workflow') body.innerHTML = workflowTab();
      else if (tab === 'notify') body.innerHTML = notifyTab();
      else if (tab === 'audit') body.innerHTML = auditTab();
      wireTab(body);
    }

    function wireTab(body) {
      if (tab === 'users') wireUsersTab(body);
      const editTargets = qs('#admin-edit-targets', body);
      if (editTargets) editTargets.addEventListener('click', openProfessionTargetsForm);
      const editKsa = qs('#admin-edit-ksa', body);
      if (editKsa) editKsa.addEventListener('click', () => openRegConfigInline('KSA'));
      const resetBtn = qs('#admin-reset', body);
      if (resetBtn) resetBtn.addEventListener('click', () => {
        if (confirm('Reset all demo data back to the original generated baseline? This clears every edit, saved scenario and audit entry from this session.')) {
          Store.reset();
          toast('Demo data reset to baseline');
          navigate('home');
        }
      });
      const exportAudit = qs('#admin-export-audit', body);
      if (exportAudit) exportAudit.addEventListener('click', () => {
        const cols = [{label:'Timestamp',value:r=>new Date(r.ts).toLocaleString('en-GB')},{label:'Actor',value:'actor'},{label:'Action',value:'action'},{label:'Detail',value:'detail'}];
        Engine.downloadCSV('sw360-audit-log.csv', Engine.toCSV(Store.auditLog, cols));
        toast('Audit log exported');
      });
    }

    function openProfessionTargetsForm() {
      const cats = Store.professionCategories;
      const overlay = openModal(`
        <div class="modal-head"><h3>Edit Profession-Category Targets</h3><button class="modal-close" data-close>${Icon('x')}</button></div>
        <div class="modal-body">
          <div class="disclaimer-box" style="margin-bottom:14px;">${Icon('info')}<span>These are HRSD-aligned Saudization-of-professions minimums, independent of the overall Nitaqat ratio. Changing a target recalculates the compliance table in HR Workspace immediately.</span></div>
          <form id="pt-form">
            ${cats.map(c => `<div class="flex items-center justify-between" style="padding:8px 0; border-bottom:1px solid var(--grey-100);">
              <div><b style="font-size:13px;">${esc(c.name)}</b> <span class="chip chip-grey">${c.code}</span></div>
              <input type="number" min="0" max="100" step="1" name="t-${c.code}" value="${(c.target*100).toFixed(0)}" style="width:70px; border:1px solid var(--grey-300); border-radius:6px; padding:6px 8px;"/>
            </div>`).join('')}
          </form>
        </div>
        <div class="modal-foot">
          <span class="text-xs text-muted" style="margin-right:auto;">${Icon('info')} Saved to this browser session only — not yet synced to the shared database.</span>
          <button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" id="pt-save">${Icon('check')} Save Targets</button>
        </div>
      `);
      qsa('[data-close]', overlay).forEach(b => b.addEventListener('click', closeOverlay));
      qs('#pt-save', overlay).addEventListener('click', () => {
        const fd = new FormData(qs('#pt-form', overlay));
        const updated = cats.map(c => Object.assign({}, c, { target: Number(fd.get('t-'+c.code))/100 }));
        Store.updateProfessionTargets(updated);
        closeOverlay();
        toast('Profession-category targets updated');
        paint();
      });
    }

    function openRegConfigInline(entity) {
      const cfg = Store.nitaqatConfig[entity];
      const overlay = openModal(`
        <div class="modal-head"><h3>Edit Regulatory Configuration — ${entity}</h3><button class="modal-close" data-close>${Icon('x')}</button></div>
        <div class="modal-body">
          <form id="rc-form">
            <div class="form-grid">
              <div class="field full"><label>Registered Activity</label><input name="registeredActivity" value="${esc(cfg.registeredActivity)}"/></div>
              <div class="field"><label>Current Planning Target (%)</label><input type="number" step="0.01" name="targetPct" value="${(cfg.target*100).toFixed(2)}"/></div>
              <div class="field"><label>Last Reviewed</label><input type="date" name="lastReviewed" value="${cfg.lastReviewed}"/></div>
            </div>
          </form>
        </div>
        <div class="modal-foot">
          <span class="text-xs text-muted" style="margin-right:auto;">${Icon('info')} Saved to this browser session only — not yet synced to the shared database.</span>
          <button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" id="rc-save">${Icon('check')} Save</button>
        </div>
      `);
      qsa('[data-close]', overlay).forEach(b => b.addEventListener('click', closeOverlay));
      qs('#rc-save', overlay).addEventListener('click', () => {
        const fd = new FormData(qs('#rc-form', overlay));
        Store.updateNitaqatConfig(entity, { registeredActivity: fd.get('registeredActivity'), target: Number(fd.get('targetPct'))/100, lastReviewed: fd.get('lastReviewed') });
        closeOverlay(); toast(`${entity} regulatory config updated`); paint();
      });
    }
  }

  // -------------------------------------------------------------------------
  function rolesTab() {
    const permKeys = Object.keys(PERMISSION_LABELS);
    return `
      <p class="text-sm text-muted" style="margin-bottom:14px;">Defines what each of the five audiences can see and do. The role switcher in the top bar uses this exact model — switch roles anywhere in the app to see it enforced live.</p>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Role</th><th>Landing Modules</th>${permKeys.map(k=>`<th>${esc(PERMISSION_LABELS[k])}</th>`).join('')}</tr></thead>
        <tbody>${ROLES.map(r => `<tr>
          <td class="cell-name">${esc(r.label)}<br/><span class="cell-sub">${esc(r.description)}</span></td>
          <td>${r.nav.map(n=>`<span class="chip chip-grey" style="margin:1px;">${esc(n)}</span>`).join('')}</td>
          ${permKeys.map(k => `<td>${permCell(r.perms[k])}</td>`).join('')}
        </tr>`).join('')}</tbody>
      </table></div>`;
  }
  function permCell(v) {
    if (v === true) return `<span class="chip chip-green">${Icon('check')} Full</span>`;
    if (v === 'scoped') return `<span class="chip chip-amber">Own Team</span>`;
    return `<span class="chip chip-grey">—</span>`;
  }

  // -------------------------------------------------------------------------
  // USERS & ACCESS — real Supabase profiles, role assignment. HR can read
  // every profile (RLS: `auth_role() = 'hr'`) and change role/scope on any
  // of them ("hr manages roles" policy). There is no way to invite someone
  // by email or delete an account from here — those need the Supabase
  // service_role key, which per this project's own rules never leaves the
  // dashboard. New people get in by signing in themselves (magic link) and
  // landing here as "pending"; HR grants access from that point on.
  // -------------------------------------------------------------------------
  const ASSIGNABLE_ROLES = ['pending', 'hr', 'exec', 'ta', 'pm', 'slm'];

  async function loadProfiles() {
    profilesError = null;
    const { data, error } = await supabaseClient.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { profilesError = error.message; profilesCache = null; }
    else { profilesCache = data; }
    if (repaint) repaint();
  }

  function usersTab() {
    if (profilesError) {
      return `<div class="empty-state">${Icon('alertCircle')}<h4>Couldn't load users</h4><p>${esc(profilesError)}</p></div>
        <div style="text-align:center;"><button class="btn btn-secondary btn-sm" id="users-retry">${Icon('refresh')} Retry</button></div>`;
    }
    if (profilesCache === null) {
      return `<div class="empty-state">${Icon('clock')}<h4>Loading users…</h4></div>`;
    }
    const rows = profilesCache;
    const pendingCount = rows.filter(r => r.role === 'pending').length;
    return `
      <p class="text-sm text-muted" style="margin-bottom:14px;">
        Everyone who has ever signed in with a DXC email appears here. New sign-ins land as <b>pending</b> with zero
        access until a role is assigned below — that's enforced by the database itself, not just this screen.
        ${pendingCount ? `<span class="chip chip-amber" style="margin-left:6px;">${pendingCount} awaiting a role</span>` : ''}
      </p>
      ${rows.length ? `<div class="panel panel-pad mb-16" style="max-width:340px;"><div class="text-xs text-muted" style="font-weight:700; margin-bottom:6px;">Access by role</div><canvas id="admin-chart-roles" height="160"></canvas></div>` : ''}
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Email</th><th>Role</th><th>Scope</th><th>Signed up</th><th></th></tr></thead>
        <tbody>${rows.map(p => usersRow(p)).join('') || `<tr><td colspan="5" class="table-empty">No one has signed in yet.</td></tr>`}</tbody>
      </table></div>
      <div class="text-xs text-muted mt-12">To grant someone access for the first time: ask them to open the app and sign in with their DXC email (no invite needed) — they'll appear here as "pending" within a few seconds, ready to assign a role. "Revoke" returns someone to pending; it does not delete their account.</div>
    `;
  }

  function usersRow(p) {
    const isSelf = Store.profile && Store.profile.id === p.id;
    const roleOpts = ASSIGNABLE_ROLES.map(r => `<option value="${r}" ${p.role===r?'selected':''}>${esc(r === 'pending' ? 'Pending (no access)' : getRole(r).label)}</option>`).join('');
    const isPm = p.role === 'pm', isSlm = p.role === 'slm';
    const mgrOpts = MANAGERS.filter(m=>m.id!=='mgr-unassigned').map(m => `<option value="${m.id}" ${p.manager_id===m.id?'selected':''}>${esc(m.name)}</option>`).join('');
    const slOpts = SERVICE_LINES.map(s => `<option value="${s.id}" ${p.service_line_id===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
    return `<tr data-profile="${p.id}">
      <td class="cell-name">${esc(p.email)}${isSelf ? ' <span class="chip chip-purple">You</span>' : ''}${p.full_name ? `<br/><span class="cell-sub">${esc(p.full_name)}</span>` : ''}</td>
      <td>
        ${isSelf
          ? `<span class="chip chip-grey" title="You can't change your own role here — ask another HR admin, or use the SQL Editor.">${esc(getRole(p.role).label)} (locked)</span>`
          : `<select class="u-role" style="border:1px solid var(--grey-300); border-radius:6px; padding:5px 8px; font-size:12.5px;">${roleOpts}</select>`}
      </td>
      <td>
        <select class="u-scope-mgr" style="border:1px solid var(--grey-300); border-radius:6px; padding:5px 8px; font-size:12.5px; ${isPm && !isSelf?'':'display:none;'}">${mgrOpts}</select>
        <select class="u-scope-sl" style="border:1px solid var(--grey-300); border-radius:6px; padding:5px 8px; font-size:12.5px; ${isSlm && !isSelf?'':'display:none;'}">${slOpts}</select>
        ${(!isPm && !isSlm) || isSelf ? '<span class="text-xs text-muted">—</span>' : ''}
      </td>
      <td class="mono cell-sub">${p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : '—'}</td>
      <td class="flex gap-6">
        ${isSelf ? '' : `<button class="btn btn-primary btn-sm u-save">${Icon('check')} Save</button>
        ${p.role !== 'pending' ? `<button class="btn btn-secondary btn-sm u-revoke">Revoke</button>` : ''}`}
      </td>
    </tr>`;
  }

  function wireUsersTab(body) {
    const retry = qs('#users-retry', body);
    if (retry) retry.addEventListener('click', () => { profilesCache = null; profilesError = null; if (repaint) repaint(); });

    qsa('tr[data-profile]', body).forEach(tr => {
      const roleSel = qs('.u-role', tr);
      if (!roleSel) return; // self-row: locked, nothing to wire
      const mgrSel = qs('.u-scope-mgr', tr);
      const slSel = qs('.u-scope-sl', tr);
      roleSel.addEventListener('change', () => {
        mgrSel.style.display = roleSel.value === 'pm' ? '' : 'none';
        slSel.style.display = roleSel.value === 'slm' ? '' : 'none';
      });
      const saveBtn = qs('.u-save', tr);
      saveBtn.addEventListener('click', () => saveProfileRow(tr.dataset.profile, roleSel.value, mgrSel.value, slSel.value, saveBtn));
      const revokeBtn = qs('.u-revoke', tr);
      if (revokeBtn) revokeBtn.addEventListener('click', () => {
        if (confirm('Revoke this person\'s access? They\'ll go back to "pending" and see nothing until re-granted a role.')) {
          saveProfileRow(tr.dataset.profile, 'pending', null, null, revokeBtn);
        }
      });
    });
  }

  async function saveProfileRow(profileId, role, mgrId, slId, btn) {
    btn.disabled = true;
    const patch = {
      role,
      manager_id: role === 'pm' ? (mgrId || null) : null,
      service_line_id: role === 'slm' ? (slId || null) : null,
    };
    const { error } = await supabaseClient.from('profiles').update(patch).eq('id', profileId);
    if (error) {
      toast('Could not update role: ' + error.message);
      btn.disabled = false;
      return;
    }
    Store.log('Role Change', `Updated access for profile ${profileId} → ${role}`);
    toast('Access updated');
    profilesCache = null; // force refetch so the table reflects the real DB state
    if (repaint) repaint();
  }

  function fieldsTab() {
    return `<p class="text-sm text-muted" style="margin-bottom:14px;">Field-level visibility and edit rights. National ID, contact details and family status are treated as sensitive and are restricted regardless of role.</p>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Field</th><th>Group</th><th>Visible To</th><th>Editable By</th><th>Sensitive</th></tr></thead>
      <tbody>${FIELD_CONFIG.map(f => `<tr><td class="cell-name">${esc(f.field)}</td><td>${esc(f.group)}</td><td>${esc(f.visibleTo)}</td><td>${esc(f.editableBy)}</td><td>${f.sensitive?'<span class="chip chip-amber">Sensitive</span>':'<span class="chip chip-grey">Standard</span>'}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  function referenceTab() {
    const emp = Store.employees;
    const countFor = (key, val) => emp.filter(e => e.status==='Active' && e[key]===val).length;
    return `
      <div class="grid grid-2" style="align-items:start;">
        <div class="panel panel-pad"><div class="text-xs text-muted" style="font-weight:700; margin-bottom:6px;">Active headcount by service line</div><canvas id="admin-chart-sl" height="160"></canvas></div>
        <div class="panel panel-pad"><div class="text-xs text-muted" style="font-weight:700; margin-bottom:6px;">Active headcount by level</div><canvas id="admin-chart-level" height="160"></canvas></div>
      </div>
      <div class="grid grid-2 mt-16" style="align-items:start;">
        <div>
          <div class="section-title" style="padding-left:0;">Service Lines → Offerings</div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Service Line</th><th>Offerings</th><th>Active HC</th></tr></thead>
            <tbody>${SERVICE_LINES.map(sl => `<tr><td class="cell-name">${esc(sl.name)}</td><td>${OFFERINGS.filter(o=>o.serviceLine===sl.id).map(o=>`<span class="chip chip-grey" style="margin:1px;">${esc(o.name)}</span>`).join('')}</td><td class="mono">${emp.filter(e=>e.status==='Active'&&e.serviceLine===sl.id).length}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>
        <div>
          <div class="section-title" style="padding-left:0;">Accounts</div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Account</th><th>Entity</th><th>Sector</th><th>Status</th><th>Active HC</th></tr></thead>
            <tbody>${ACCOUNTS.map(a => `<tr><td class="cell-name">${esc(a.name)}</td><td>${a.entity}</td><td>${esc(a.sector)}</td><td>${a.active?'<span class="chip chip-green">Active</span>':'<span class="chip chip-grey">Closed</span>'}</td><td class="mono">${emp.filter(e=>e.status==='Active'&&e.entity===a.entity&&e.account===a.name).length}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>
      </div>
      <div class="grid grid-2 mt-16" style="align-items:start;">
        <div>
          <div class="section-title" style="padding-left:0;">People Managers</div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Manager</th><th>Title</th><th>Service Line</th><th>Active Team</th></tr></thead>
            <tbody>${MANAGERS.filter(m=>m.id!=='mgr-unassigned').map(m => `<tr><td class="cell-name">${esc(m.name)}</td><td>${esc(m.title)}</td><td>${esc((SERVICE_LINES.find(s=>s.id===m.serviceLine)||{}).name||'—')}</td><td class="mono">${emp.filter(e=>e.status==='Active'&&e.managerId===m.id).length}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>
        <div>
          <div class="section-title" style="padding-left:0;">Job Levels</div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Level</th><th>Active HC</th></tr></thead>
            <tbody>${LEVELS.map(l => `<tr><td class="cell-name">${esc(l)}</td><td class="mono">${emp.filter(e=>e.status==='Active'&&e.level===l).length}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>
      </div>`;
  }

  function drawReferenceCharts() {
    const active = Store.employees.filter(e => e.status === 'Active');
    const bySl = Engine.groupBy(active, 'serviceLine');
    const slRows = SERVICE_LINES.map(s => ({ name: s.name, n: (bySl[s.id]||[]).length })).filter(r => r.n > 0);
    mountChart('admin-chart-sl', {
      type: 'pie',
      data: { labels: slRows.map(r=>r.name), datasets: [{ data: slRows.map(r=>r.n), backgroundColor: CHART_PALETTE }] },
      options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, font: { size: 10 } } } } }
    }, { labels: true, labelColor: '#fff', labelOptions: { font: { size: 9.5, weight: '700' } } });

    const byLevel = Engine.groupBy(active, 'level');
    const levelRows = LEVELS.map(l => ({ l, n: (byLevel[l]||[]).length })).filter(r => r.n > 0);
    mountChart('admin-chart-level', {
      type: 'bar',
      data: { labels: levelRows.map(r=>r.l), datasets: [{ data: levelRows.map(r=>r.n), backgroundColor: CHART_PALETTE[3], borderRadius: 4, maxBarThickness: 22 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 9.5 } } } } }
    }, { labels: true, labelColor: '#241f30', labelOptions: { anchor: 'end', align: 'right', offset: 2 } });
  }

  function drawUsersChart() {
    const el = document.getElementById('admin-chart-roles');
    if (!el || !profilesCache) return;
    const byRole = {};
    profilesCache.forEach(p => { byRole[p.role] = (byRole[p.role]||0) + 1; });
    const labels = Object.keys(byRole);
    mountChart('admin-chart-roles', {
      type: 'doughnut',
      data: { labels: labels.map(r => r==='pending' ? 'Pending' : getRole(r).label), datasets: [{ data: labels.map(r=>byRole[r]), backgroundColor: CHART_PALETTE }] },
      options: { cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, font: { size: 10 } } } } }
    }, { labels: true, labelColor: '#fff' });
  }

  function regulatoryTab() {
    const ksa = Store.nitaqatConfig.KSA;
    return `
      <div class="panel panel-pad">
        <div class="flex justify-between items-center"><h3 style="font-size:14px;">DXC Saudi Arabia</h3><button class="btn btn-secondary btn-sm" id="admin-edit-ksa">${Icon('edit')} Edit</button></div>
        <div class="info-list" style="padding-left:0; padding-right:0; grid-template-columns:1fr;">
          <div class="info-item"><label>Activity</label><div>${esc(ksa.registeredActivity)}</div></div>
          <div class="info-item"><label>Target</label><div>${Engine.fmtPct(ksa.target)}</div></div>
          <div class="info-item"><label>Rule Version</label><div>${esc(ksa.ruleVersion)}</div></div>
        </div>
      </div>
      <div class="panel panel-pad mt-16">
        <div class="flex justify-between items-center"><h3 style="font-size:14px;">Profession-Category Saudization Targets</h3><button class="btn btn-secondary btn-sm" id="admin-edit-targets">${Icon('edit')} Edit Targets</button></div>
        <div class="table-wrap mt-12"><table class="data-table">
          <thead><tr><th>Category</th><th>Code</th><th>Target</th></tr></thead>
          <tbody>${Store.professionCategories.map(c=>`<tr><td>${esc(c.name)}</td><td><span class="chip chip-grey">${c.code}</span></td><td class="mono">${Engine.fmtPct(c.target,0)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  }

  function workflowTab() {
    return `
      <div class="section-title" style="padding-left:0;">Approval Matrix</div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Action</th><th>Requestor</th><th>Approver</th><th>SLA</th></tr></thead>
        <tbody>${APPROVAL_MATRIX.map(a => `<tr><td class="cell-name">${esc(a.action)}</td><td>${esc(a.requestor)}</td><td>${esc(a.approver)}</td><td class="mono">${a.slaDays===0?'Instant':a.slaDays+'d'}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="section-title" style="padding-left:0;">Data Sources &amp; Refresh (Current → Future State)</div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Data Set</th><th>Current Source</th><th>Future State</th><th>Refresh</th><th>Owner</th></tr></thead>
        <tbody>${DATA_SOURCES.map(d => `<tr><td class="cell-name">${esc(d.name)}</td><td>${esc(d.current)}</td><td>${esc(d.future)}</td><td>${esc(d.refresh)}</td><td>${esc(d.owner)}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }

  function notifyTab() {
    return `
      <div class="section-title" style="padding-left:0;">Notification Templates</div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Template</th><th>Channel</th><th>Owner</th><th>Status</th></tr></thead>
        <tbody>${NOTIFICATION_TEMPLATES.map(n => `<tr><td class="cell-name">${esc(n.name)}</td><td>${esc(n.channel)}</td><td>${esc(n.owner)}</td><td>${n.status==='Active'?'<span class="chip chip-green">Active</span>':'<span class="chip chip-purple">Phase 2</span>'}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="section-title" style="padding-left:0;">Holiday Calendar 2026</div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Holiday</th><th>Dates</th></tr></thead>
        <tbody>${HOLIDAY_CALENDAR.map(h => `<tr><td class="cell-name">${esc(h.name)}</td><td class="mono">${h.type==='weekly' ? esc(h.start)+' – '+esc(h.end) : Engine.fmtDate(h.start)+(h.end!==h.start?' – '+Engine.fmtDate(h.end):'')}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }

  function auditTab() {
    return `
      <div class="flex justify-between items-center" style="margin-bottom:12px;">
        <p class="text-sm text-muted">Every Add/Edit Employee, requisition change, and configuration edit made in this session is logged here — live, not illustrative.</p>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm" id="admin-export-audit">${Icon('download')} Export Log</button>
          <button class="btn btn-danger btn-sm" id="admin-reset">${Icon('refresh')} Reset Demo Data</button>
        </div>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Timestamp</th><th>Actor (role)</th><th>Action</th><th>Detail</th></tr></thead>
        <tbody>${Store.auditLog.map(l => `<tr><td class="mono">${new Date(l.ts).toLocaleString('en-GB')}</td><td>${esc(l.actor)}</td><td><span class="chip chip-info">${esc(l.action)}</span></td><td>${esc(l.detail)}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }

  return { render };
})();
