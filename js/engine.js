// ============================================================================
// Saudi Workforce 360 — Calculation Engine
// Pure functions only: everything here takes data in and returns data out, so
// every module (Home, HR Workspace, Simulator, Managers...) computes from the
// SAME logic instead of hard-coded numbers. This is what makes filters, the
// simulator sliders, and role switching actually recalculate instead of
// showing static content.
// ============================================================================

const Engine = (() => {

  function toDate(d) { return (d instanceof Date) ? d : new Date(d); }

  function daysBetween(a, b) {
    const MS = 1000 * 60 * 60 * 24;
    return Math.round((toDate(b) - toDate(a)) / MS);
  }

  function daysUntil(dateStr, asOf) {
    if (!dateStr) return null;
    asOf = asOf || new Date();
    return daysBetween(asOf, dateStr);
  }

  function tenure(joiningDateStr, asOf) {
    asOf = asOf || new Date();
    const start = toDate(joiningDateStr);
    let years = asOf.getFullYear() - start.getFullYear();
    let months = asOf.getMonth() - start.getMonth();
    if (asOf.getDate() < start.getDate()) months -= 1;
    if (months < 0) { years -= 1; months += 12; }
    if (years < 0) { years = 0; months = 0; }
    const totalMonths = years * 12 + months;
    const label = years > 0 ? `${years}y ${months}m` : `${months}m`;
    return { years, months, totalMonths, label };
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = toDate(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = toDate(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function fmtPct(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return (n * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  }

  function fmtNum(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  }

  // -------------------------------------------------------------------------
  // NITAQAT ZONE LOGIC
  // -------------------------------------------------------------------------
  function zoneFor(ratio, entityConfig) {
    const zones = entityConfig.zones;
    for (const z of zones) {
      if (ratio >= z.min && ratio < z.max) return z;
    }
    // ratio >= highest max (i.e. ==1 edge) or below 0 guard. Found via the
    // zones[0] gauge-order bug: this assumed zones[0]/zones[last] were the
    // highest/lowest bands specifically because the array used to always
    // arrive Platinum-first — don't assume order, find them directly.
    const highest = zones.reduce((a, b) => (b.min > a.min ? b : a));
    const lowest = zones.reduce((a, b) => (b.min < a.min ? b : a));
    if (ratio >= highest.min) return highest;
    return lowest;
  }

  function zoneIndex(entityConfig, zoneName) {
    // Explicitly sorted ascending by min — never trust the caller's array
    // order (see zoneFor's comment: real NITAQAT_CONFIG data from
    // data-remote.js arrives sorted ascending by min, i.e. Red-first, not
    // Platinum-first like the old hardcoded config used to be).
    const zones = entityConfig.zones.slice().sort((a, b) => a.min - b.min);
    return zones.findIndex(z => z.name === zoneName);
  }

  // How many additional Saudis (at current total headcount) would be needed to
  // reach the next-better zone. Returns null if already in the best zone.
  // Found via unit testing (2026-08-16): this previously assumed
  // `entityConfig.zones[idx - 1]` was always the next-BETTER zone, which
  // only holds if the array happens to arrive Platinum-first. With the real
  // app's actual (ascending, Red-first) zone order this was backwards: a
  // company in Red got told "Already at Platinum — best available standing"
  // (idx 0 read as "already best"), and everyone else got shown gap-to a
  // WORSE zone than their current one. Fixed the same way zoneFor/
  // renderZoneGauge were: sort explicitly, don't trust array order.
  function nextZoneGap(ratio, saudiCount, totalCount, entityConfig) {
    const zones = entityConfig.zones.slice().sort((a, b) => a.min - b.min); // ascending, explicit
    const current = zoneFor(ratio, entityConfig);
    const idx = zones.findIndex(z => z.name === current.name);
    if (idx === -1 || idx === zones.length - 1) return null; // already in the best (highest-min) zone
    const next = zones[idx + 1];
    const neededRatio = next.min;
    const neededSaudi = Math.ceil(neededRatio * totalCount);
    const headsShort = Math.max(0, neededSaudi - saudiCount);
    return { nextZoneName: next.name, neededRatio, headsShort };
  }

  function marginToTarget(ratio, target) { return ratio - target; }

  // -------------------------------------------------------------------------
  // HEADCOUNT / RATIO STATS
  // -------------------------------------------------------------------------
  function headcountStats(employees) {
    const total = employees.length;
    const saudi = employees.filter(e => e.isSaudi).length;
    const gcc = employees.filter(e => e.isGCC).length;
    const ratio = total ? saudi / total : 0;
    return { total, saudi, nonSaudi: total - saudi, gcc, ratio };
  }

  function activeOf(employees, entity) {
    return employees.filter(e => e.status === 'Active' && (!entity || e.entity === entity));
  }

  // -------------------------------------------------------------------------
  // PER-EMPLOYEE DERIVED STATE (tenure, contract/iqama/qiwa/compliance status,
  // RAG, milestone). Called once per render — cheap enough at this data size.
  // -------------------------------------------------------------------------
  function deriveEmployee(emp, asOf) {
    asOf = asOf || new Date();
    const t = tenure(emp.joiningDate, asOf);
    const reasons = [];
    let rag = 'green';

    // Contract / fixed-term status
    let contractStatus = 'Indefinite';
    let contractDaysLeft = null;
    if (emp.contractType === 'Fixed-Term' && emp.endDate && emp.status === 'Active') {
      contractDaysLeft = daysUntil(emp.endDate, asOf);
      if (contractDaysLeft < 0) { contractStatus = 'Expired'; rag = 'red'; reasons.push('Fixed-term contract expired'); }
      else if (contractDaysLeft <= 60) { contractStatus = 'Expiring Soon'; if (rag !== 'red') rag = 'amber'; reasons.push(`Fixed-term contract ends in ${contractDaysLeft}d`); }
      else { contractStatus = 'Active — Fixed-Term'; }
    }

    // Iqama (non-Saudi only)
    let iqamaStatus = 'N/A';
    let iqamaDaysLeft = null;
    if (!emp.isSaudi && emp.status === 'Active') {
      if (emp.iqamaExpiry) {
        iqamaDaysLeft = daysUntil(emp.iqamaExpiry, asOf);
        if (iqamaDaysLeft < 0) { iqamaStatus = 'Expired'; rag = 'red'; reasons.push('Iqama expired'); }
        else if (iqamaDaysLeft <= 60) { iqamaStatus = 'Expiring Soon'; if (rag !== 'red') rag = 'amber'; reasons.push(`Iqama expires in ${iqamaDaysLeft}d`); }
        else { iqamaStatus = 'Valid'; }
      } else {
        iqamaStatus = 'Not on File'; if (rag !== 'red') rag = 'amber'; reasons.push('Iqama expiry not on file');
      }
    }

    // Qiwa documentation
    if (emp.qiwaStatus === 'Not Documented') {
      rag = 'red';
      reasons.push(emp.isSaudi ? 'Undocumented Qiwa contract — excluded from Saudization credit' : 'Undocumented Qiwa contract');
    } else if (emp.qiwaStatus === 'Pending Documentation') {
      if (rag !== 'red') rag = 'amber';
      reasons.push('Qiwa documentation pending');
    }

    // Generic compliance doc (insurance / mandatory training)
    let complianceStatus = 'Current';
    let complianceDaysLeft = null;
    if (emp.status === 'Active' && emp.complianceDocExpiry) {
      complianceDaysLeft = daysUntil(emp.complianceDocExpiry, asOf);
      if (complianceDaysLeft < 0) { complianceStatus = 'Expired'; rag = 'red'; reasons.push('Mandatory training/insurance record expired'); }
      else if (complianceDaysLeft <= 45) { complianceStatus = 'Expiring Soon'; if (rag !== 'red') rag = 'amber'; reasons.push(`Compliance record renews in ${complianceDaysLeft}d`); }
    }

    // Data completeness
    if (!emp.managerId || emp.managerId === 'mgr-unassigned') { if (rag !== 'red') rag = 'amber'; reasons.push('No people manager assigned'); }
    if (!emp.location) { reasons.push('Location not on file'); }
    if (!emp.profession) { if (rag !== 'red') rag = 'amber'; reasons.push('Legal Profession / Qiwa mapping missing'); }

    // Milestone (upcoming within 60 days, based on join-date anniversary)
    let upcomingMilestone = null;
    // Guard against a missing/invalid joiningDate on an Active record — found
    // via unit testing: without this, toISOString() below throws on an
    // Invalid Date and crashes the whole render for that employee, not just
    // this one panel. Real data always has joiningDate today, but this is a
    // cheap defensive backstop against a bad/incomplete future record.
    if (emp.status === 'Active' && emp.joiningDate && !isNaN(toDate(emp.joiningDate))) {
      const years = t.years;
      [5, 10, 15, 20].forEach(mark => {
        const anniv = new Date(toDate(emp.joiningDate));
        anniv.setFullYear(toDate(emp.joiningDate).getFullYear() + mark);
        const dleft = daysUntil(anniv.toISOString().slice(0,10), asOf);
        if (dleft !== null && dleft >= -3 && dleft <= 60 && !upcomingMilestone) {
          upcomingMilestone = { years: mark, daysAway: dleft, date: anniv.toISOString().slice(0,10) };
        }
      });
    }

    return Object.assign({}, emp, {
      tenureLabel: t.label, tenureMonths: t.totalMonths, tenureYears: t.years,
      contractStatus, contractDaysLeft, iqamaStatus, iqamaDaysLeft,
      complianceStatus, complianceDaysLeft, rag, ragReasons: reasons,
      upcomingMilestone,
    });
  }

  // -------------------------------------------------------------------------
  // PROFESSION-CATEGORY (job-localization) COMPLIANCE
  // -------------------------------------------------------------------------
  function professionCompliance(employees, categories) {
    return categories.filter(c => c.target > 0).map(cat => {
      const pool = employees.filter(e => e.professionCode === cat.code);
      const total = pool.length;
      const saudi = pool.filter(e => e.isSaudi).length;
      const actual = total ? saudi / total : null;
      let status = 'No Headcount';
      if (total > 0) status = (actual >= cat.target) ? 'On Target' : 'Below Target';
      const gapHeads = (total > 0 && actual < cat.target) ? Math.ceil(cat.target * total) - saudi : 0;
      return Object.assign({}, cat, { total, saudi, actual, status, gapHeads });
    });
  }

  // -------------------------------------------------------------------------
  // JOB-TITLE-LEVEL SAUDIZATION DISTRIBUTION — finer-grained than the 7 HRSD
  // categories: shows the actual job title, its category, and how that
  // specific job is tracking against the category's target (e.g. two
  // "Engineer" job titles can sit in the same EP category but be at very
  // different Saudi ratios).
  // -------------------------------------------------------------------------
  function jobTitleCompliance(employees, categories) {
    const catByCode = {};
    categories.forEach(c => { catByCode[c.code] = c; });
    const pool = employees.filter(e => e.jobTitle);
    const groups = groupBy(pool, 'jobTitle');
    return Object.keys(groups).map(title => {
      const g = groups[title];
      const total = g.length;
      const saudi = g.filter(e => e.isSaudi).length;
      const actual = total ? saudi / total : null;
      const codes = uniqueSorted(g, 'professionCode');
      const code = codes.length === 1 ? codes[0] : (codes.length > 1 ? 'Mixed' : null);
      const cat = catByCode[code];
      const target = cat ? cat.target : null;
      let status = 'No Category Mapped';
      if (cat && cat.target > 0) status = actual >= target ? 'On Target' : 'Below Target';
      else if (cat && cat.target === 0) status = 'Not Saudization-Mandated';
      return { jobTitle: title, total, saudi, actual, professionCode: code, categoryName: cat ? cat.name : null, target, status };
    }).sort((a, b) => b.total - a.total);
  }

  // -------------------------------------------------------------------------
  // ACTION QUEUE — HR-only, computed live from current state
  // -------------------------------------------------------------------------
  function actionQueue(employees, requisitions, entityConfig, asOf) {
    asOf = asOf || new Date();
    const active = activeOf(employees);
    const derived = active.map(e => deriveEmployee(e, asOf));
    const items = [];

    const iqamaExpired = derived.filter(e => e.iqamaStatus === 'Expired');
    const iqamaSoon = derived.filter(e => e.iqamaStatus === 'Expiring Soon');
    const contractExpired = derived.filter(e => e.contractStatus === 'Expired');
    const contractSoon = derived.filter(e => e.contractStatus === 'Expiring Soon');
    const qiwaMissing = derived.filter(e => e.qiwaStatus === 'Not Documented');
    const qiwaPending = derived.filter(e => e.qiwaStatus === 'Pending Documentation');
    const qiwaMissingSaudi = qiwaMissing.filter(e => e.isSaudi);
    const noManager = derived.filter(e => !e.managerId || e.managerId === 'mgr-unassigned');
    const complianceExpired = derived.filter(e => e.complianceStatus === 'Expired');
    const noProfession = derived.filter(e => !e.profession);

    if (iqamaExpired.length) items.push({ severity: 'red', title: 'Iqama expired', detail: `${iqamaExpired.length} active employees have an expired residence permit — final-exit risk / illegal-stay exposure.`, count: iqamaExpired.length, filter: { iqamaStatus: 'Expired' }, owner: 'HR Operations — Government Relations' });
    if (qiwaMissingSaudi.length) items.push({ severity: 'red', title: 'Saudi contracts undocumented on Qiwa', detail: `${qiwaMissingSaudi.length} Saudi employees are not counted toward your Saudization ratio because their contract isn't Qiwa-documented.`, count: qiwaMissingSaudi.length, filter: { qiwaStatus: 'Not Documented', isSaudi: true }, owner: 'HR Compliance' });
    if (contractExpired.length) items.push({ severity: 'red', title: 'Fixed-term contracts already expired', detail: `${contractExpired.length} active records show a fixed-term end date in the past — regularize or process exit.`, count: contractExpired.length, filter: { contractStatus: 'Expired' }, owner: 'HR Operations' });
    if (complianceExpired.length) items.push({ severity: 'red', title: 'Compliance record expired', detail: `${complianceExpired.length} employees have an expired mandatory training/insurance record.`, count: complianceExpired.length, filter: { complianceStatus: 'Expired' }, owner: 'HR Compliance' });

    if (iqamaSoon.length) items.push({ severity: 'amber', title: 'Iqama expiring within 60 days', detail: `${iqamaSoon.length} active non-Saudi employees need renewal action.`, count: iqamaSoon.length, filter: { iqamaStatus: 'Expiring Soon' }, owner: 'HR Operations — Government Relations' });
    if (contractSoon.length) items.push({ severity: 'amber', title: 'Fixed-term contracts ending within 60 days', detail: `${contractSoon.length} contracts need a renew/exit decision.`, count: contractSoon.length, filter: { contractStatus: 'Expiring Soon' }, owner: 'HR Operations + People Manager' });
    if (qiwaPending.length) items.push({ severity: 'amber', title: 'Qiwa documentation pending', detail: `${qiwaPending.length} contracts are mid-process on Qiwa — follow up before they age into non-compliance.`, count: qiwaPending.length, filter: { qiwaStatus: 'Pending Documentation' }, owner: 'HR Compliance' });
    if (noManager.length) items.push({ severity: 'amber', title: 'No people manager assigned', detail: `${noManager.length} active employees have no owning people manager on file.`, count: noManager.length, filter: { managerId: 'mgr-unassigned' }, owner: 'HR Operations — Data Quality' });
    if (noProfession.length) items.push({ severity: 'amber', title: 'Legal Profession / Qiwa mapping missing', detail: `${noProfession.length} employees are missing the Legal Profession mapping used for job-localization compliance.`, count: noProfession.length, filter: { profession: '__missing' }, owner: 'HR Compliance' });

    // Account / offering below target
    const ksaActive = active.filter(e => e.entity === 'KSA');
    const byAccount = groupBy(ksaActive, 'account');
    Object.keys(byAccount).forEach(acc => {
      if (!acc || acc === 'undefined') return;
      const stats = headcountStats(byAccount[acc]);
      if (stats.total >= 5 && stats.ratio < entityConfig.KSA.target - 0.05) {
        items.push({ severity: 'amber', title: `${acc} account below Saudization target`, detail: `${acc}: ${fmtPct(stats.ratio)} Saudi against a ${fmtPct(entityConfig.KSA.target)} company target (${stats.total} resources).`, count: stats.total, filter: { account: acc }, owner: 'Account Delivery Manager + HR Business Partner' });
      }
    });

    items.sort((a, b) => (a.severity === b.severity) ? b.count - a.count : (a.severity === 'red' ? -1 : 1));
    return items;
  }

  function groupBy(arr, key) {
    const out = {};
    arr.forEach(item => {
      const k = item[key] || 'Unassigned';
      (out[k] = out[k] || []).push(item);
    });
    return out;
  }

  // -------------------------------------------------------------------------
  // JOINING SOON / LEAVING SOON
  // -------------------------------------------------------------------------
  function joiningSoon(requisitions, asOf, horizonDays) {
    asOf = asOf || new Date();
    horizonDays = horizonDays || 45;
    return requisitions
      .filter(r => r.status !== 'Filled' && r.stage !== 'Filled')
      .map(r => Object.assign({}, r, { daysToStart: daysUntil(r.targetStartDate, asOf) }))
      .filter(r => r.daysToStart !== null && r.daysToStart <= horizonDays)
      .sort((a, b) => a.daysToStart - b.daysToStart);
  }

  function leavingSoon(employees, asOf, horizonDays) {
    asOf = asOf || new Date();
    horizonDays = horizonDays || 60;
    // Deliberately not activeOf() here — that only keeps status === 'Active',
    // which was silently dropping every already-Attrition employee BEFORE
    // the filter below (which explicitly checks for 'Attrition') ever ran.
    // Found via unit testing (2026-08-16): the Attrition branch was dead
    // code, so Manager cockpit's "Resignation in notice" row, Home's
    // "Leaving Soon" count, and the employees __leavingSoon quick-filter
    // were all silently undercounting by however many people are already
    // in Attrition status.
    const pool = employees.filter(e => e.status === 'Active' || e.status === 'Attrition');
    return pool
      .map(e => deriveEmployee(e, asOf))
      .filter(e => e.status === 'Attrition' || (e.contractDaysLeft !== null && e.contractDaysLeft <= horizonDays))
      .sort((a, b) => (a.contractDaysLeft ?? -1) - (b.contractDaysLeft ?? -1));
  }

  // -------------------------------------------------------------------------
  // MONTHLY PROJECTION — headcount & Saudi ratio forward view
  // -------------------------------------------------------------------------
  function projection(employees, requisitions, entityConfig, months, entity, asOf) {
    asOf = asOf || new Date();
    months = months || 18;
    entity = entity || 'KSA';
    let pool = activeOf(employees, entity).map(e => Object.assign({}, e));
    const pipeline = requisitions.filter(r => r.entity === entity && r.status !== 'Filled');
    const out = [];
    const monthlyAttritionRate = 0.006; // ~0.6%/month indefinite-contract attrition assumption

    let cursor = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
    for (let m = 0; m < months; m++) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

      // Leavers this month: fixed-term contracts ending in this window
      const leaversThisMonth = pool.filter(e => e.contractType === 'Fixed-Term' && e.endDate && toDate(e.endDate) >= monthStart && toDate(e.endDate) <= monthEnd);
      pool = pool.filter(e => !leaversThisMonth.includes(e));

      // Modeled attrition on indefinite population (expected value, fractional heads)
      const modeledAttrition = pool.length * monthlyAttritionRate;

      // Joiners this month: pipeline requisitions targeted to start in this window
      const joinersThisMonth = pipeline.filter(r => { const d = toDate(r.targetStartDate); return d >= monthStart && d <= monthEnd; });
      joinersThisMonth.forEach(r => {
        pool.push({ isSaudi: r.nationalityPriority === 'Saudi Priority', entity, synthetic: true });
      });

      const stats = headcountStats(pool);
      const netHeadcount = stats.total - modeledAttrition;
      const zone = zoneFor(stats.ratio, entityConfig[entity]);

      out.push({
        month: monthStart.toISOString().slice(0, 7),
        label: monthStart.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        headcount: Math.round(netHeadcount),
        saudi: stats.saudi,
        nonSaudi: stats.nonSaudi,
        ratio: stats.ratio,
        target: entityConfig[entity].target,
        zone: zone.name,
        joiners: joinersThisMonth.length,
        leavers: leaversThisMonth.length,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // MANAGER SCORECARD
  // -------------------------------------------------------------------------
  function managerScorecard(managerId, employees, requisitions, entityConfig, asOf) {
    asOf = asOf || new Date();
    const team = employees.filter(e => e.managerId === managerId);
    const activeTeam = team.filter(e => e.status === 'Active');
    const stats = headcountStats(activeTeam);
    const derived = activeTeam.map(e => deriveEmployee(e, asOf));
    const openReqs = requisitions.filter(r => r.managerId === managerId && r.status !== 'Filled');
    const jSoon = joiningSoon(openReqs, asOf);
    const lSoon = leavingSoon(team, asOf);
    const actionCount = derived.filter(e => e.rag !== 'green').length;
    const zone = zoneFor(stats.ratio, entityConfig.KSA);
    const offeringsCovered = uniqueSorted(activeTeam, 'offering');
    const accountsCovered = uniqueSorted(activeTeam, 'account');
    const levelSpread = groupBy(activeTeam, 'level');
    const natSpread = groupBy(activeTeam, 'nationality');
    const locSpread = groupBy(activeTeam, 'location');
    return {
      managerId, team, activeTeam, stats, zone, openReqs, joiningSoon: jSoon, leavingSoon: lSoon,
      actionCount, offeringsCovered, accountsCovered, levelSpread, natSpread, locSpread,
      derived,
    };
  }

  function uniqueSorted(arr, key) {
    return Array.from(new Set(arr.map(x => x[key]).filter(Boolean))).sort();
  }

  // -------------------------------------------------------------------------
  // FILTERING
  // -------------------------------------------------------------------------
  const DERIVED_KEYS = ['rag', 'iqamaStatus', 'contractStatus', 'complianceStatus'];

  function applyFilters(employees, filters) {
    const needsDerive = Object.keys(filters).some(k => DERIVED_KEYS.includes(k) && filters[k]);
    return employees.filter(e => {
      const d = needsDerive ? deriveEmployee(e) : null;
      for (const key in filters) {
        const val = filters[key];
        if (val === undefined || val === null || val === '' || val === 'all') continue;
        if (key === 'search') {
          const q = val.toLowerCase();
          const hay = `${e.name} ${e.eid} ${e.email} ${e.jobTitle}`.toLowerCase();
          if (!hay.includes(q)) return false;
        } else if (key === 'profession' && val === '__missing') {
          if (e.profession) return false;
        } else if (key === 'managerId' && val === 'mgr-unassigned') {
          if (e.managerId !== 'mgr-unassigned' && e.managerId) return false;
        } else if (key === 'tenureMin') {
          if (tenure(e.joiningDate).years < Number(val)) return false;
        } else if (DERIVED_KEYS.includes(key)) {
          if (d[key] !== val) return false;
        } else if (key === 'isSaudi') {
          if (!!e.isSaudi !== !!val) return false;
        } else {
          if (String(e[key]) !== String(val)) return false;
        }
      }
      return true;
    });
  }

  // -------------------------------------------------------------------------
  // CSV EXPORT
  // -------------------------------------------------------------------------
  function toCSV(rows, columns) {
    const esc = v => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = columns.map(c => esc(c.label)).join(',');
    const lines = rows.map(row => columns.map(c => esc(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(','));
    return [header, ...lines].join('\n');
  }

  function downloadCSV(filename, csvText) {
    const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return {
    toDate, daysBetween, daysUntil, tenure, fmtDate, fmtDateTime, fmtPct, fmtNum,
    zoneFor, zoneIndex, nextZoneGap, marginToTarget,
    headcountStats, activeOf, deriveEmployee, professionCompliance, jobTitleCompliance,
    actionQueue, joiningSoon, leavingSoon, projection, managerScorecard,
    uniqueSorted, groupBy, applyFilters, toCSV, downloadCSV,
  };
})();
