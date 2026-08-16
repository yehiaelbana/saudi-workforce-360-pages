// ============================================================================
// Saudi Workforce 360 — Client-side State Store
// Everything the app mutates (adding an employee, editing a record, raising a
// requisition, changing role/entity, saving a simulator scenario) goes through
// here. State persists to localStorage as a fast-reload cache; the real
// source of truth is Supabase (Phase 3, 2026-08-16) — every mutation method
// below writes there for real, then syncs local state from what the server
// returns (RLS-checked, so what comes back is guaranteed to be what actually
// landed, including anything the DB computed).
// ============================================================================

const Store = (() => {
  const LS_KEY = 'sw360_state_v2';
  let state = null;

  function freshState() {
    return {
      employees: JSON.parse(JSON.stringify(EMPLOYEES)),
      requisitions: JSON.parse(JSON.stringify(REQUISITIONS)),
      nitaqatConfig: JSON.parse(JSON.stringify(NITAQAT_CONFIG)),
      professionCategories: JSON.parse(JSON.stringify(PROFESSION_CATEGORIES)),
      auditLog: [
        { ts: new Date().toISOString(), actor: 'System', action: 'Data Load', detail: 'Synthetic demo dataset generated from workbook structure (342 KSA + 18 RHQ records, 72 requisitions).' },
      ],
      savedScenarios: [],
      profile: null,
      role: 'pending',
      scopeManagerId: null,
      scopeServiceLine: null,
      entity: 'KSA',
      seq: 10000,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        state = JSON.parse(raw);
        state.entity = 'KSA'; // single-entity app now — force past any stale RHQ value from before this was removed
        return;
      }
    } catch (e) { /* localStorage unavailable (e.g. some file:// sandboxes) — fall back to memory */ }
    state = freshState();
  }

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* memory-only fallback */ }
  }

  function reset() {
    state = freshState();
    persist();
  }

  function log(action, detail) {
    state.auditLog.unshift({ ts: new Date().toISOString(), actor: roleLabel(), action, detail });
    if (state.auditLog.length > 300) state.auditLog.length = 300;
    // Best-effort real insert alongside the fast local copy above (used by
    // the in-drawer "Audit History" tab). Never blocks or fails the caller's
    // actual mutation — losing one durable audit-log row isn't worth
    // surfacing an error for an action that itself already succeeded.
    if (state.profile && supabaseClient) {
      supabaseClient.from('audit_log').insert({
        actor: state.profile.id, actor_email: state.profile.email, action, detail,
      }).then(({ error }) => { if (error) console.warn('audit_log insert failed (non-fatal):', error.message); });
    }
  }

  function roleLabel() { return getRole(state.role).label; }

  function nextId(prefix) {
    // Text PK, not DB-generated — crypto.randomUUID() keeps this
    // collision-safe across concurrent users/sessions (the old sequential
    // in-memory counter only ever worked within a single local session).
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  // eid/req_no are "human" numbers with a `unique` constraint in the DB —
  // random within the same magnitude as the real seeded data (11500000+ /
  // 51600000+). The DB's own uniqueness constraint is the hard backstop: a
  // collision surfaces as a clear error toast at the call site, not silent
  // data corruption, and is extremely unlikely at this app's real scale.
  function nextEid() { return 11500000 + Math.floor(Math.random() * 400000); }
  function nextReqNo() { return 51600000 + Math.floor(Math.random() * 400000); }

  // --- Write-side mappers (app camelCase -> DB snake_case) -------------------
  // Mirror image of js/data-remote.js's mapEmployeeRow/mapRequisitionRow,
  // which do the DB -> app direction. Only maps keys actually present in
  // `data` (so a partial edit patch doesn't clobber untouched DB columns).
  function mapEmployeeToRow(data) {
    const row = {};
    if ('name' in data) row.name = data.name;
    if ('gender' in data) row.gender = data.gender;
    if ('nationality' in data) { row.nationality = data.nationality; row.is_saudi = data.nationality === 'Saudi Arabia'; }
    if ('status' in data) row.status = data.status;
    if ('offering' in data) {
      row.offering = data.offering;
      const off = OFFERINGS.find(o => o.name === data.offering);
      row.service_line_id = off ? off.serviceLine : null;
    }
    if ('account' in data) {
      const acc = ACCOUNTS.find(a => a.name === data.account && a.entity === 'KSA');
      row.account_id = acc ? acc.id : null;
    }
    if ('managerId' in data) row.manager_id = data.managerId;
    if ('role' in data) row.role = data.role;
    if ('jobTitle' in data) row.job_title = data.jobTitle;
    if ('level' in data) row.level = data.level;
    if ('profession' in data) row.profession = data.profession;
    if ('professionCode' in data) row.profession_code = data.professionCode;
    if ('location' in data) row.location = data.location;
    if ('joiningDate' in data) row.joining_date = data.joiningDate;
    if ('contractType' in data) row.contract_type = data.contractType;
    if ('endDate' in data) row.end_date = data.endDate;
    if ('separationReason' in data) row.separation_reason = data.separationReason;
    if ('phone' in data) row.phone = data.phone;
    if ('email' in data) row.email = data.email;
    if ('family' in data) row.family = data.family;
    if ('sce' in data) row.sce = data.sce;
    if ('isGCC' in data) row.is_gcc = data.isGCC;
    row.updated_by = state.profile ? state.profile.id : null;
    return row;
  }

  function mapRequisitionToRow(data) {
    const row = {};
    if ('jobTitle' in data) row.job_title = data.jobTitle;
    if ('profession' in data) row.profession = data.profession;
    if ('professionCode' in data) row.profession_code = data.professionCode;
    if ('account' in data) {
      const acc = ACCOUNTS.find(a => a.name === data.account && a.entity === 'KSA');
      row.account_id = acc ? acc.id : null;
    }
    if ('offering' in data) row.offering = data.offering;
    if ('serviceLine' in data) row.service_line_id = data.serviceLine;
    if ('managerId' in data) row.manager_id = data.managerId;
    if ('level' in data) row.level = data.level;
    if ('nationalityPriority' in data) row.nationality_priority = data.nationalityPriority;
    if ('vacancyReason' in data) row.vacancy_reason = data.vacancyReason;
    if ('stage' in data) row.stage = data.stage;
    if ('status' in data) row.status = data.status;
    if ('targetStartDate' in data) row.target_start_date = data.targetStartDate;
    if ('entity' in data) row.entity = data.entity;
    row.updated_by = state.profile ? state.profile.id : null;
    return row;
  }

  // --- Employees -------------------------------------------------------------
  async function addEmployee(data) {
    const row = Object.assign(mapEmployeeToRow(data), {
      id: nextId('E'), eid: nextEid(), status: data.status || 'Active', entity: 'KSA',
      contract_type: data.contractType || 'Indefinite', qiwa_status: 'Pending Documentation',
      is_gcc: 'isGCC' in data ? data.isGCC : false,
    });
    const { data: inserted, error } = await supabaseClient.from('employees').insert(row).select('*, accounts(name)').single();
    if (error) throw error;
    const emp = mapEmployeeRow(inserted);
    state.employees.push(emp);
    log('Add Employee', `${emp.name} (${emp.eid}) added — ${emp.jobTitle || ''}, ${emp.offering || ''}, ${emp.account || ''}`);
    persist();
    return emp;
  }

  async function updateEmployee(id, patch) {
    const idx = state.employees.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const before = state.employees[idx];
    const row = mapEmployeeToRow(patch);
    const { data: updated, error } = await supabaseClient.from('employees').update(row).eq('id', id).select('*, accounts(name)').single();
    if (error) throw error;
    // Merge, don't replace: mapEmployeeRow's fixed key set doesn't include
    // app-only fields with no DB column (e.g. `documents`, the simulated
    // file-upload list) — a plain replace would silently drop them.
    const after = Object.assign({}, before, mapEmployeeRow(updated));
    state.employees[idx] = after;
    const changedFields = Object.keys(patch).filter(k => before[k] !== patch[k]);
    log('Edit Employee', `${after.name} (${after.eid}) — updated ${changedFields.join(', ') || 'record'}`);
    persist();
    return after;
  }

  function deactivateEmployee(id, reason) {
    return updateEmployee(id, { status: 'Inactive', endDate: new Date().toISOString().slice(0,10), separationReason: reason || 'Not specified' });
  }

  // --- Requisitions ------------------------------------------------------------
  async function addRequisition(data) {
    const row = Object.assign(mapRequisitionToRow(data), {
      id: nextId('R'), req_no: nextReqNo(), status: data.status || 'In Progress', stage: data.stage || 'Sourcing',
      entity: 'KSA', created_date: new Date().toISOString().slice(0,10),
    });
    const { data: inserted, error } = await supabaseClient.from('requisitions').insert(row).select('*, accounts(name)').single();
    if (error) throw error;
    const req = mapRequisitionRow(inserted);
    state.requisitions.push(req);
    log('Raise Requisition', `Req ${req.reqNo} opened — ${req.jobTitle || ''}, ${req.account || ''} (${req.vacancyReason || 'Growth'})`);
    persist();
    return req;
  }

  async function updateRequisition(id, patch) {
    const idx = state.requisitions.findIndex(r => r.id === id);
    if (idx === -1) return null;
    const row = mapRequisitionToRow(patch);
    const { data: updated, error } = await supabaseClient.from('requisitions').update(row).eq('id', id).select('*, accounts(name)').single();
    if (error) throw error;
    const after = mapRequisitionRow(updated);
    state.requisitions[idx] = after;
    log('Edit Requisition', `Req ${after.reqNo} — updated ${Object.keys(patch).join(', ')}`);
    persist();
    return after;
  }

  // --- Scenarios ---------------------------------------------------------
  async function saveScenario(scenario) {
    const id = nextId('SC');
    const { name } = scenario;
    const payload = Object.assign({}, scenario); delete payload.name;
    const row = { id, name, created_by: state.profile ? state.profile.id : null, payload };
    const { data: inserted, error } = await supabaseClient.from('scenarios').insert(row).select('*').single();
    if (error) throw error;
    const saved = Object.assign({ id: inserted.id, name: inserted.name, savedAt: inserted.created_at }, inserted.payload || {});
    state.savedScenarios.unshift(saved);
    log('Save Scenario', `Scenario "${saved.name}" saved`);
    persist();
    return saved;
  }

  async function deleteScenario(id) {
    const { error } = await supabaseClient.from('scenarios').delete().eq('id', id);
    if (error) throw error;
    state.savedScenarios = state.savedScenarios.filter(s => s.id !== id);
    persist();
  }

  // --- Config ---------------------------------------------------------------
  async function updateNitaqatConfig(entity, patch) {
    const row = {};
    if ('registeredActivity' in patch) row.registered_activity = patch.registeredActivity;
    if ('target' in patch) row.target = patch.target;
    if ('lastReviewed' in patch) row.last_reviewed = patch.lastReviewed;
    if ('activityRef' in patch) row.activity_ref = patch.activityRef;
    if ('sizeCategory' in patch) row.size_category = patch.sizeCategory;
    if ('ruleVersion' in patch) row.rule_version = patch.ruleVersion;
    if ('reviewedBy' in patch) row.reviewed_by = patch.reviewedBy;
    const { error } = await supabaseClient.from('nitaqat_config').update(row).eq('entity', entity);
    if (error) throw error;
    state.nitaqatConfig[entity] = Object.assign({}, state.nitaqatConfig[entity], patch);
    log('Regulatory Config Change', `${entity} entity — ${Object.keys(patch).join(', ')} updated`);
    persist();
  }

  async function updateProfessionTargets(newCategories) {
    // One update per changed category — profession_categories has no bulk
    // upsert-by-list shape here, and this list is small (≈7 HRSD categories).
    const changed = newCategories.filter(nc => {
      const old = state.professionCategories.find(c => c.code === nc.code);
      return old && old.target !== nc.target;
    });
    for (const cat of changed) {
      const { error } = await supabaseClient.from('profession_categories').update({ target: cat.target }).eq('code', cat.code);
      if (error) throw error;
    }
    state.professionCategories = newCategories;
    log('Regulatory Config Change', 'Profession-category Saudization targets updated');
    persist();
  }

  // --- Remote data (real employees/requisitions/scenarios/config from Supabase) --
  function loadRemoteData(data) {
    state.employees = data.employees;
    state.requisitions = data.requisitions;
    state.savedScenarios = data.scenarios || [];
    state.nitaqatConfig = data.nitaqatConfig;
    state.professionCategories = data.professionCategories;
    persist();
  }

  // --- Identity (from the real Supabase `profiles` row, set on sign-in) -----
  function setProfile(profile) {
    state.profile = profile;
    state.role = profile.role;
    state.scopeManagerId = profile.manager_id || null;
    state.scopeServiceLine = profile.service_line_id || null;
    persist();
  }
  function clearProfile() {
    state.profile = null;
    state.role = 'pending';
    state.scopeManagerId = null;
    state.scopeServiceLine = null;
    persist();
  }
  function setEntity(id) { state.entity = id; persist(); }

  load();

  return {
    get employees() { return state.employees; },
    get requisitions() { return state.requisitions; },
    get nitaqatConfig() { return state.nitaqatConfig; },
    get professionCategories() { return state.professionCategories; },
    get auditLog() { return state.auditLog; },
    get savedScenarios() { return state.savedScenarios; },
    get profile() { return state.profile; },
    get role() { return state.role; },
    get scopeManagerId() { return state.scopeManagerId; },
    get scopeServiceLine() { return state.scopeServiceLine; },
    get entity() { return state.entity; },
    addEmployee, updateEmployee, deactivateEmployee,
    addRequisition, updateRequisition,
    saveScenario, deleteScenario,
    updateNitaqatConfig, updateProfessionTargets,
    setProfile, clearProfile, setEntity, loadRemoteData,
    reset, log, persist,
  };
})();
