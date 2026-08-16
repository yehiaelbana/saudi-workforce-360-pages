// ============================================================================
// Saudi Workforce 360 — Real data fetch (Phase 2)
// Replaces the embedded synthetic dataset in js/data-core.js with real data
// from Supabase. Called once at boot, after sign-in (see js/auth.js). RLS on
// the Supabase side already scopes which employees/requisitions rows come
// back for the signed-in user — no client-side scoping needed for that part.
//
// Reassigns the reference-data globals (SERVICE_LINES, OFFERINGS, ACCOUNTS,
// LOCATIONS, LEVELS, PROFESSIONS, PROFESSION_CATEGORIES, MANAGERS,
// SERVICE_LINE_LEADS, NITAQAT_CONFIG — all `let` now, see js/data-core.js /
// js/data-config.js) in place, so every module that reads them keeps working
// unchanged. Employees/requisitions go through Store.loadRemoteData instead,
// since those are Store-managed state.
// ============================================================================

function mapEmployeeRow(r) {
  return {
    id: r.id, eid: r.eid, name: r.name, status: r.status, entity: r.entity, gender: r.gender,
    nationality: r.nationality, isSaudi: r.is_saudi, isGCC: r.is_gcc, serviceLine: r.service_line_id,
    offering: r.offering, account: r.accounts ? r.accounts.name : null, managerId: r.manager_id,
    role: r.role, jobTitle: r.job_title, level: r.level, levelRank: r.level_rank, profession: r.profession,
    professionCode: r.profession_code, sce: r.sce, family: r.family, location: r.location,
    joiningDate: r.joining_date, endDate: r.end_date, contractType: r.contract_type,
    milestoneTag: r.milestone_tag, qiwaStatus: r.qiwa_status, iqamaExpiry: r.iqama_expiry,
    complianceDocExpiry: r.compliance_doc_expiry, exitReentry: r.exit_reentry, email: r.email, phone: r.phone,
  };
}

function mapRequisitionRow(r) {
  return {
    id: r.id, reqNo: r.req_no, status: r.status, stage: r.stage,
    account: r.accounts ? r.accounts.name : null, serviceLine: r.service_line_id, offering: r.offering,
    managerId: r.manager_id, jobTitle: r.job_title, level: r.level, profession: r.profession,
    professionCode: r.profession_code, nationalityPriority: r.nationality_priority,
    targetStartDate: r.target_start_date, createdDate: r.created_date, vacancyReason: r.vacancy_reason,
    entity: r.entity,
  };
}

async function fetchAppData() {
  const queries = {
    serviceLines: supabaseClient.from('service_lines').select('*'),
    offerings: supabaseClient.from('offerings').select('*'),
    accounts: supabaseClient.from('accounts').select('*'),
    locations: supabaseClient.from('locations').select('*'),
    levels: supabaseClient.from('levels').select('*').order('rank', { ascending: true }),
    jobTitles: supabaseClient.from('job_titles').select('*').order('name', { ascending: true }),
    professionCategories: supabaseClient.from('profession_categories').select('*'),
    professions: supabaseClient.from('professions').select('*'),
    managers: supabaseClient.from('managers').select('*, manager_offerings(offering_name)'),
    serviceLineLeads: supabaseClient.from('service_line_leads').select('*'),
    nitaqat: supabaseClient.from('nitaqat_config').select('*, nitaqat_zones(*)'),
    employees: supabaseClient.from('employees').select('*, accounts(name)'),
    requisitions: supabaseClient.from('requisitions').select('*, accounts(name)'),
  };

  const keys = Object.keys(queries);
  const results = await Promise.all(keys.map(k => queries[k]));
  const byKey = {};
  keys.forEach((k, i) => {
    if (results[i].error) throw new Error(`Loading ${k} failed: ${results[i].error.message}`);
    byKey[k] = results[i].data;
  });

  SERVICE_LINES = byKey.serviceLines.map(r => ({ id: r.id, name: r.name }));
  OFFERINGS = byKey.offerings.map(r => ({ name: r.name, serviceLine: r.service_line_id }));
  ACCOUNTS = byKey.accounts.map(r => ({ name: r.name, entity: r.entity, sector: r.sector, active: r.active }));
  LOCATIONS = byKey.locations.map(r => r.name);
  LEVELS = byKey.levels.map(r => r.name);
  JOB_TITLES = byKey.jobTitles.map(r => r.name);
  PROFESSION_CATEGORIES = byKey.professionCategories.map(r => ({ code: r.code, name: r.name, nameAr: r.name_ar, target: Number(r.target) }));
  PROFESSIONS = byKey.professions.map(r => ({ name: r.name, code: r.code }));
  MANAGERS = byKey.managers.map(r => ({
    id: r.id, name: r.name, title: r.title,
    offerings: (r.manager_offerings || []).map(o => o.offering_name),
    serviceLine: r.service_line_id, span: r.span, email: r.email, phone: r.phone,
    isServiceLineLead: r.is_service_line_lead,
  }));
  SERVICE_LINE_LEADS = byKey.serviceLineLeads.map(r => ({
    id: r.id, name: r.name, title: r.title, serviceLine: r.service_line_id, email: r.email, phone: r.phone,
  }));

  const nitCfg = {};
  byKey.nitaqat.forEach(r => {
    nitCfg[r.entity] = {
      entityLabel: r.entity_label, registeredActivity: r.registered_activity, activityRef: r.activity_ref,
      sizeCategory: r.size_category, ruleVersion: r.rule_version, lastReviewed: r.last_reviewed, reviewedBy: r.reviewed_by,
      target: Number(r.target),
      zones: (r.nitaqat_zones || [])
        .map(z => ({ name: z.name, min: Number(z.min), max: Number(z.max), key: z.key }))
        .sort((a, b) => a.min - b.min),
    };
  });
  NITAQAT_CONFIG = nitCfg;

  return {
    employees: byKey.employees.map(mapEmployeeRow),
    requisitions: byKey.requisitions.map(mapRequisitionRow),
    nitaqatConfig: NITAQAT_CONFIG,
    professionCategories: PROFESSION_CATEGORIES,
  };
}
