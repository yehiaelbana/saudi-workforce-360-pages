// ============================================================================
// Saudi Workforce 360 — Client-side State Store
// Everything the app mutates (adding an employee, editing a record, raising a
// requisition, changing role/entity, saving a simulator scenario) goes through
// here. State persists to localStorage so a refresh mid-test doesn't lose your
// changes; "Reset Demo Data" in Administration clears back to the generated
// baseline. No backend — structured so each method maps cleanly onto a future
// SharePoint List / Power Automate flow (see Administration → Data Sources).
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
  }

  function roleLabel() { return getRole(state.role).label; }

  function nextId(prefix) { state.seq += 1; return `${prefix}${state.seq}`; }

  // --- Employees -----------------------------------------------------------
  function addEmployee(data) {
    const emp = Object.assign({
      id: nextId('E'), eid: 11500000 + state.seq, status: 'Active', entity: 'KSA',
      contractType: 'Indefinite', qiwaStatus: 'Pending Documentation', isSaudi: data.nationality === 'Saudi Arabia',
      isGCC: false,
    }, data);
    state.employees.push(emp);
    log('Add Employee', `${emp.name} (${emp.eid}) added — ${emp.jobTitle || ''}, ${emp.offering || ''}, ${emp.account || ''}`);
    persist();
    return emp;
  }

  function updateEmployee(id, patch) {
    const idx = state.employees.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const before = state.employees[idx];
    const after = Object.assign({}, before, patch, { isSaudi: (patch.nationality || before.nationality) === 'Saudi Arabia' });
    state.employees[idx] = after;
    const changedFields = Object.keys(patch).filter(k => before[k] !== patch[k]);
    log('Edit Employee', `${after.name} (${after.eid}) — updated ${changedFields.join(', ') || 'record'}`);
    persist();
    return after;
  }

  function deactivateEmployee(id, reason) {
    return updateEmployee(id, { status: 'Inactive', endDate: new Date().toISOString().slice(0,10), separationReason: reason || 'Not specified' });
  }

  // --- Requisitions ----------------------------------------------------------
  function addRequisition(data) {
    const req = Object.assign({
      id: nextId('R'), reqNo: 51600000 + state.seq, status: 'In Progress', stage: 'Sourcing',
      entity: 'KSA', createdDate: new Date().toISOString().slice(0,10),
    }, data);
    state.requisitions.push(req);
    log('Raise Requisition', `Req ${req.reqNo} opened — ${req.jobTitle || ''}, ${req.account || ''} (${req.vacancyReason || 'Growth'})`);
    persist();
    return req;
  }

  function updateRequisition(id, patch) {
    const idx = state.requisitions.findIndex(r => r.id === id);
    if (idx === -1) return null;
    state.requisitions[idx] = Object.assign({}, state.requisitions[idx], patch);
    log('Edit Requisition', `Req ${state.requisitions[idx].reqNo} — updated ${Object.keys(patch).join(', ')}`);
    persist();
    return state.requisitions[idx];
  }

  // --- Scenarios ---------------------------------------------------------
  function saveScenario(scenario) {
    scenario.id = nextId('SC');
    scenario.savedAt = new Date().toISOString();
    state.savedScenarios.unshift(scenario);
    log('Save Scenario', `Scenario "${scenario.name}" saved`);
    persist();
    return scenario;
  }

  function deleteScenario(id) {
    state.savedScenarios = state.savedScenarios.filter(s => s.id !== id);
    persist();
  }

  // --- Config ---------------------------------------------------------------
  function updateNitaqatConfig(entity, patch) {
    state.nitaqatConfig[entity] = Object.assign({}, state.nitaqatConfig[entity], patch);
    log('Regulatory Config Change', `${entity} entity — ${Object.keys(patch).join(', ')} updated`);
    persist();
  }

  function updateProfessionTargets(newCategories) {
    state.professionCategories = newCategories;
    log('Regulatory Config Change', 'Profession-category Saudization targets updated');
    persist();
  }

  // --- Remote data (real employees/requisitions/config from Supabase) -------
  function loadRemoteData(data) {
    state.employees = data.employees;
    state.requisitions = data.requisitions;
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
