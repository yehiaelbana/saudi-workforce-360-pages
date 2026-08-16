// ============================================================================
// Saudi Workforce 360 — Configuration layer
// Roles, Nitaqat/regulatory configuration, and reference content.
// Everything in NITAQAT_CONFIG is intentionally HR-editable at runtime via the
// Administration module — this file only supplies the starting values, sourced
// from the DXC KSA workbook's own "Saudization Zones" table (Info sheet) plus
// public HRSD/Qiwa guidance current as of mid-2026.
// ============================================================================

// ---------------------------------------------------------------------------
// ROLES — the five audiences named in the brief. `nav` controls which modules
// appear in the sidebar for that role; `perms` controls in-page capabilities.
// ---------------------------------------------------------------------------
const ROLES = [
  {
    id: 'hr',
    label: 'HR & Admin',
    short: 'HR',
    description: 'Full control tower access — regulatory workspace, workforce register, administration.',
    nav: ['home', 'employees', 'managers', 'pipeline', 'hrworkspace', 'simulator', 'administration'],
    perms: { addEmployee: true, editEmployee: true, deleteEmployee: true, addRequisition: true, editRequisition: true, seeAlerts: true, seeAllTeams: true, editConfig: true, exportData: true },
  },
  {
    id: 'exec',
    label: 'Country Management / Executive',
    short: 'Exec',
    description: 'Country-level performance, risk and health — decision-focused view.',
    nav: ['home', 'employees', 'managers', 'pipeline', 'simulator'],
    perms: { addEmployee: false, editEmployee: false, deleteEmployee: false, addRequisition: false, editRequisition: false, seeAlerts: false, seeAllTeams: true, editConfig: false, exportData: true },
  },
  {
    id: 'ta',
    label: 'Talent Acquisition',
    short: 'TA',
    description: 'Demand & supply pipeline ownership plus workforce lookups.',
    nav: ['home', 'pipeline', 'employees'],
    perms: { addEmployee: false, editEmployee: false, deleteEmployee: false, addRequisition: true, editRequisition: true, seeAlerts: false, seeAllTeams: false, editConfig: false, exportData: true },
  },
  {
    id: 'pm',
    label: 'People Manager',
    short: 'PM',
    description: 'My Team cockpit — own team roster, joiners/leavers, approved-field edits.',
    nav: ['home', 'managers', 'employees', 'pipeline'],
    perms: { addEmployee: false, editEmployee: 'scoped', deleteEmployee: false, addRequisition: true, editRequisition: 'scoped', seeAlerts: false, seeAllTeams: false, editConfig: false, exportData: true },
  },
  {
    id: 'slm',
    label: 'Service Line Manager',
    short: 'SLM',
    description: 'Service-line rollup across every account and people manager in scope.',
    nav: ['home', 'managers', 'pipeline', 'employees'],
    perms: { addEmployee: false, editEmployee: false, deleteEmployee: false, addRequisition: true, editRequisition: 'scoped', seeAlerts: false, seeAllTeams: false, editConfig: false, exportData: true },
  },
];

function getRole(id) { return ROLES.find(r => r.id === id) || ROLES[0]; }

// ---------------------------------------------------------------------------
// NITAQAT / SAUDIZATION CONFIGURATION — editable via Administration.
// Zone bands for the KSA entity are taken directly from the workbook's own
// "Saudization Zones 2024" reference table. RHQ entity bands are an
// illustrative small-entity-category estimate pending confirmation.
// ---------------------------------------------------------------------------
let NITAQAT_CONFIG = {
  KSA: {
    entityLabel: 'DXC Saudi Arabia — Main Commercial Registration',
    registeredActivity: 'Computer Programming, Consultancy & Related Activities (IT Services)',
    activityRef: 'ISIC J62–63 · HRSD sub-activity Saudization table',
    sizeCategory: 'Large entity band (HRSD headcount-tiered classification)',
    ruleVersion: 'HRSD Nitaqat reform cycle — effective 26 Apr 2026 (new 3-year cycle; Yellow zone retired)',
    lastReviewed: '2026-06-27',
    reviewedBy: 'HR Workforce Planning — pending Legal / official Qiwa confirmation',
    target: 0.5607,
    zones: [
      { name: 'Platinum', min: 0.648, max: 1.0001, key: 'platinum' },
      { name: 'High Green', min: 0.5607, max: 0.648, key: 'green-high' },
      { name: 'Mid Green', min: 0.4464, max: 0.5607, key: 'green-mid' },
      { name: 'Low Green', min: 0.3808, max: 0.4464, key: 'green-low' },
      { name: 'Red', min: 0, max: 0.3808, key: 'red' },
    ],
  },
  RHQ: {
    entityLabel: 'DXC Regional Headquarters (MISA RHQ Program entity)',
    registeredActivity: 'Regional Headquarters — Management & Support Activities',
    activityRef: 'MISA RHQ Program license',
    sizeCategory: 'Small entity band (illustrative — separate CR from main KSA entity)',
    ruleVersion: 'HRSD Nitaqat reform cycle — effective 26 Apr 2026',
    lastReviewed: '2026-06-27',
    reviewedBy: 'HR Workforce Planning — pending Legal / official Qiwa confirmation',
    target: 0.24,
    zones: [
      { name: 'Platinum', min: 0.45, max: 1.0001, key: 'platinum' },
      { name: 'High Green', min: 0.32, max: 0.45, key: 'green-high' },
      { name: 'Mid Green', min: 0.24, max: 0.32, key: 'green-mid' },
      { name: 'Low Green', min: 0.16, max: 0.24, key: 'green-low' },
      { name: 'Red', min: 0, max: 0.16, key: 'red' },
    ],
  },
};

const ZONE_CONSEQUENCES = {
  'Platinum': { tag: 'Best standing', points: [
    'Priority visa and work-permit processing at MHRSD/Qiwa',
    'Unrestricted transfer rights for expatriate employees, in and out',
    'Preferred access to government tenders via Etimad',
    'May recruit expatriates directly from Red-zone establishments without their approval',
  ]},
  'High Green': { tag: 'Compliant', points: [
    'Standard visa issuance and iqama renewal timelines',
    'Full transfer rights for expatriate staff',
    'Eligible for new expatriate work-visa quotas',
  ]},
  'Mid Green': { tag: 'Compliant — limited headroom', points: [
    'Standard visa issuance, under closer monitoring',
    'Some transfer-in restrictions may apply case-by-case',
  ]},
  'Low Green': { tag: 'At risk', points: [
    'Visa issuance possible but slower to process',
    'Transfer-in of expatriates from other establishments restricted',
    'One band above Red — limited margin for adverse movement',
  ]},
  'Red': { tag: 'Non-compliant', points: [
    'New expatriate work visas suspended',
    'Iqama renewals delayed or blocked',
    'Excluded from Etimad government tenders',
    'Subject to MHRSD enforcement action and fines',
  ]},
};

const QIWA_RULE_NOTE = "Effective 15 Apr 2026, HRSD counts a Saudi employee toward the Nitaqat ratio only if that employee's contract is documented electronically on Qiwa. An undocumented contract does not count toward Saudization credit even if the employee is actively working — this makes Qiwa documentation status a direct driver of zone position, not just an admin formality.";

const GOSI_WEIGHT_NOTE = "HRSD's calculator gives 0.5 weight to employees earning under SAR 4,000/month, and treats qualifying GCC nationals as Saudi-equivalent. Both rules are configurable below and are currently OFF, matching how the source workbook's own 60.71% figure was produced.";

// ---------------------------------------------------------------------------
// PROFESSION-CATEGORY LOCALIZATION TARGETS live in data-core.js
// (PROFESSION_CATEGORIES, PROFESSIONS) — pulled directly from the workbook's
// own HRSD-aligned "Saudization of Professions" reference table.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RECENT DECISION TIMELINE (Home) — hand-curated illustrative narrative
// ---------------------------------------------------------------------------
const RECENT_EVENTS = [
  { date: '2026-08-01', type: 'compliance', text: 'Qiwa contract documentation swept for 342 KSA records — 3 Saudi contracts flagged undocumented', actor: 'HR Workspace' },
  { date: '2026-07-29', type: 'hire', text: '6 new joiners confirmed at Saudi Payments (ITO & Cloud) — 5 Saudi, 1 non-Saudi', actor: 'Talent Acquisition' },
  { date: '2026-07-24', type: 'review', text: 'Quarterly Nitaqat position reviewed with Legal — entity remains in High Green zone at 60.7%', actor: 'HR Leadership' },
  { date: '2026-07-18', type: 'transfer', text: '2 Analysts transferred from Custom Apps to Enterprise Apps to cover SAMA SAP go-live', actor: 'Omar Abdel Malak' },
  { date: '2026-07-10', type: 'contract', text: '9 fixed-term contracts renewed ahead of expiry; 1 allowed to lapse (role redundant)', actor: 'HR & Admin' },
  { date: '2026-07-02', type: 'req', text: '5 new requisitions opened against SAMA growth plan (Enterprise Apps, SAP skillset)', actor: 'Talent Acquisition' },
  { date: '2026-06-27', type: 'data', text: 'Monthly workforce data refresh completed — 342 KSA + 18 RHQ records validated', actor: 'HR Operations' },
  { date: '2026-06-15', type: 'exit', text: '3 non-Saudi employees completed final exit formalities after contract end', actor: 'HR & Admin' },
];

// ---------------------------------------------------------------------------
// HOLIDAY CALENDAR (Administration + People Moments preview)
// ---------------------------------------------------------------------------
const HOLIDAY_CALENDAR = [
  { name: 'Founding Day', start: '2026-02-22', end: '2026-02-22', type: 'fixed' },
  { name: 'Eid al-Fitr (estimated — Hijri, confirmed by Supreme Court moon sighting)', start: '2026-03-20', end: '2026-03-23', type: 'lunar' },
  { name: 'Eid al-Adha & Arafah Day (estimated — Hijri)', start: '2026-05-27', end: '2026-05-30', type: 'lunar' },
  { name: 'Saudi National Day', start: '2026-09-23', end: '2026-09-23', type: 'fixed' },
  { name: 'Weekly weekend', start: 'Friday', end: 'Saturday', type: 'weekly' },
];

// ---------------------------------------------------------------------------
// NOTIFICATION TEMPLATES (Administration reference — Phase 2 wiring)
// ---------------------------------------------------------------------------
const NOTIFICATION_TEMPLATES = [
  { id: 'nt1', name: 'Iqama Expiring — 60 Day Notice', channel: 'Email', owner: 'HR Operations', status: 'Active' },
  { id: 'nt2', name: 'Fixed-Term Contract Renewal Reminder', channel: 'Email', owner: 'HR Operations', status: 'Active' },
  { id: 'nt3', name: 'Qiwa Documentation Overdue', channel: 'Email + Task', owner: 'HR Compliance', status: 'Active' },
  { id: 'nt4', name: 'New Requisition Approved', channel: 'Email', owner: 'Talent Acquisition', status: 'Active' },
  { id: 'nt5', name: 'Work Anniversary — 5 / 10 / 15 Years', channel: 'Email', owner: 'People Experience', status: 'Phase 2' },
  { id: 'nt6', name: 'Birthday Greeting', channel: 'Email', owner: 'People Experience', status: 'Phase 2' },
  { id: 'nt7', name: 'Eid Greeting — All Staff', channel: 'Email', owner: 'HR Leadership', status: 'Phase 2' },
];

// ---------------------------------------------------------------------------
// WORKFLOW / APPROVAL MATRIX (Administration reference)
// ---------------------------------------------------------------------------
const APPROVAL_MATRIX = [
  { action: 'Add Employee Record', requestor: 'HR & Admin', approver: 'HR Lead', slaDays: 1 },
  { action: 'Edit Core Employment Fields', requestor: 'HR & Admin / People Manager (scoped)', approver: 'HR Lead', slaDays: 1 },
  { action: 'Open New Requisition', requestor: 'Talent Acquisition / People Manager', approver: 'Service Line Manager', slaDays: 2 },
  { action: 'Adjust Nitaqat Target / Zone Config', requestor: 'HR & Admin', approver: 'Country HR Director + Legal', slaDays: 5 },
  { action: 'Export Workforce Data', requestor: 'Any role', approver: 'Auto-approved, logged', slaDays: 0 },
];

// ---------------------------------------------------------------------------
// DATA SOURCES (Administration reference — mirrors "future state" mapping)
// ---------------------------------------------------------------------------
const DATA_SOURCES = [
  { name: 'Workforce Register (Employees)', current: 'Resources KSA workbook (manual)', future: 'SharePoint List + Power Automate sync', refresh: 'Manual, ad hoc', owner: 'HR Operations' },
  { name: 'Demand & Supply (Requisitions)', current: 'Forecast tab, workbook', future: 'SharePoint List', refresh: 'Weekly', owner: 'Talent Acquisition' },
  { name: 'Nitaqat / Qiwa Position', current: 'Manual HRSD/Qiwa portal check', future: 'Qiwa API (subject to availability) + Power BI', refresh: 'Monthly', owner: 'HR Compliance' },
  { name: 'Org Reference (Service Line / Offering / Account / Manager)', current: 'Workbook pivot tabs', future: 'Controlled SharePoint reference lists', refresh: 'On change', owner: 'HR Operations' },
];

// ---------------------------------------------------------------------------
// EMPLOYEE FIELD CONFIGURATION (Administration reference)
// ---------------------------------------------------------------------------
const FIELD_CONFIG = [
  { field: 'EID', group: 'Identity', visibleTo: 'All roles', editableBy: 'HR & Admin only', sensitive: false },
  { field: 'Name', group: 'Identity', visibleTo: 'All roles', editableBy: 'HR & Admin only', sensitive: false },
  { field: 'National ID / Iqama Number', group: 'Identity', visibleTo: 'HR & Admin only', editableBy: 'HR & Admin only', sensitive: true },
  { field: 'Phone / Email', group: 'Contact', visibleTo: 'HR & Admin, People Manager (own team)', editableBy: 'HR & Admin only', sensitive: true },
  { field: 'Nationality', group: 'Regulatory', visibleTo: 'All roles', editableBy: 'HR & Admin only', sensitive: false },
  { field: 'Legal Profession (Qiwa mapping)', group: 'Regulatory', visibleTo: 'HR & Admin, TA', editableBy: 'HR & Admin only', sensitive: false },
  { field: 'Family Status', group: 'Personal', visibleTo: 'HR & Admin only', editableBy: 'HR & Admin only', sensitive: true },
  { field: 'Service Line / Offering / Account / Manager', group: 'Organization', visibleTo: 'All roles', editableBy: 'HR & Admin', sensitive: false },
  { field: 'Job Title (standardized, dropdown)', group: 'Organization', visibleTo: 'All roles', editableBy: 'HR & Admin, People Manager (own team)', sensitive: false },
  { field: 'Role (real title as recorded)', group: 'Organization', visibleTo: 'All roles', editableBy: 'HR & Admin, People Manager (own team)', sensitive: false },
  { field: 'Compensation / Grade', group: 'Compensation', visibleTo: 'Not in this phase', editableBy: 'Not in this phase', sensitive: true },
];

// ---------------------------------------------------------------------------
// ROLES & PERMISSIONS MATRIX (display copy for Administration; ROLES above is
// the functional source of truth used by the router)
// ---------------------------------------------------------------------------
const PERMISSION_LABELS = {
  addEmployee: 'Add employee record',
  editEmployee: 'Edit employee record',
  deleteEmployee: 'Deactivate employee record',
  addRequisition: 'Raise requisition',
  editRequisition: 'Edit requisition',
  seeAlerts: 'See HR compliance action queue',
  seeAllTeams: 'See all teams (not just own scope)',
  editConfig: 'Edit regulatory configuration',
  exportData: 'Export data',
};
