// ============================================================================
// Saudi Workforce 360 — App shell: router, sidebar, topbar, role & entity
// switching. Modules (js/modules/*.js) each expose Modules.<id>.render(el).
// ============================================================================

const ROUTES = [
  { id: 'home', label: 'Home', icon: 'home', crumb: 'Country Command Center' },
  { id: 'employees', label: 'Employees', icon: 'users', crumb: 'Workforce Register' },
  { id: 'managers', label: 'People Managers', icon: 'manager', crumb: 'Team & Capacity by Manager' },
  { id: 'pipeline', label: 'Demand & Supply', icon: 'pipeline', crumb: 'Workforce Pipeline' },
  { id: 'hrworkspace', label: 'HR Workspace', icon: 'shield', crumb: 'Saudi Regulatory Control Room', hrOnly: true },
  { id: 'simulator', label: 'Simulator', icon: 'sliders', crumb: 'Scenario Planning' },
  { id: 'administration', label: 'Administration', icon: 'settings', crumb: 'System Configuration', hrOnly: true },
];

const PHASE2_ROUTES = [
  { id: 'phase2-exit', label: 'Exit & Return Mgmt', icon: 'globe', crumb: 'Phase 2 Preview' },
  { id: 'phase2-visits', label: 'Business Visits', icon: 'briefcase', crumb: 'Phase 2 Preview' },
  { id: 'phase2-people', label: 'People Moments', icon: 'gift', crumb: 'Phase 2 Preview' },
  { id: 'phase2-reports', label: 'Reports Center', icon: 'file', crumb: 'Phase 2 Preview' },
  { id: 'phase2-ai', label: 'AI Assistant', icon: 'bot', crumb: 'Phase 2 Preview' },
];

const Router = { current: 'home', pendingSearch: null, pendingFilters: null, pendingManagerId: null, pendingServiceLine: null };

// Drill-down helper used by Home / HR Workspace / Managers / Simulator so a
// KPI card, chart segment, or alert row jumps to a *filtered* list — not a toast.
function goTo(routeId, filters, managerId) {
  Router.pendingFilters = filters || null;
  Router.pendingManagerId = managerId || null;
  navigate(routeId);
}

function moduleKey(routeId) {
  return routeId.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function currentRole() { return getRole(Store.role); }

function routeAllowed(routeId) {
  const role = currentRole();
  const r = ROUTES.find(x => x.id === routeId);
  if (!r) return true; // phase2 always reachable (preview)
  return role.nav.includes(routeId);
}

function navigate(routeId) {
  if (location.hash.slice(1) === routeId) { renderRoute(routeId); return; }
  location.hash = '#' + routeId;
}

window.addEventListener('hashchange', () => renderRoute(location.hash.slice(1) || 'home'));

function renderRoute(routeId) {
  if (!routeId) routeId = 'home';
  if (!routeAllowed(routeId)) {
    // fall back to role's first available route rather than a dead page
    routeId = currentRole().nav[0] || 'home';
  }
  Router.current = routeId;
  renderSidebar();
  renderTopbar();
  const mount = qs('#content-mount');
  mount.innerHTML = '';
  mount.scrollTop = 0;
  window.scrollTo(0, 0);

  const roleBanner = renderRoleBanner();
  if (roleBanner) mount.appendChild(roleBanner);

  const container = document.createElement('div');
  container.id = 'route-container';
  mount.appendChild(container);

  const key = moduleKey(routeId);
  if (routeId.startsWith('phase2-')) {
    Modules.phase2.render(container, routeId);
  } else if (Modules[key] && Modules[key].render) {
    Modules[key].render(container);
  } else {
    container.innerHTML = `<div class="empty-state">${Icon('alertCircle')}<h4>Module not found</h4></div>`;
  }
}

// ---------------------------------------------------------------------------
// SIDEBAR
// ---------------------------------------------------------------------------
function renderSidebar() {
  const el = qs('#sidebar-nav');
  if (!el) return;
  const role = currentRole();
  const alerts = Engine.actionQueue(Store.employees, Store.requisitions, Store.nitaqatConfig);
  const redCount = alerts.filter(a => a.severity === 'red').length;

  let html = '<div class="nav-section-label">Control Tower</div>';
  ROUTES.forEach(r => {
    const allowed = role.nav.includes(r.id);
    if (!allowed) return;
    const active = Router.current === r.id;
    const badge = (r.id === 'hrworkspace' && redCount > 0) ? `<span class="nav-badge">${redCount}</span>` : '';
    html += `<div class="nav-item ${active ? 'active' : ''}" data-route="${r.id}">${Icon(r.icon)}<span>${r.label}</span>${badge}</div>`;
  });

  html += '<div class="nav-section-label">Phase 2 · Coming Soon</div>';
  PHASE2_ROUTES.forEach(r => {
    const active = Router.current === r.id;
    html += `<div class="nav-item ${active ? 'active' : ''}" data-route="${r.id}">${Icon(r.icon)}<span>${r.label}</span><span class="phase-tag">SOON</span></div>`;
  });

  el.innerHTML = html;
  qsa('.nav-item', el).forEach(item => item.addEventListener('click', () => navigate(item.dataset.route)));
}

// ---------------------------------------------------------------------------
// TOPBAR
// ---------------------------------------------------------------------------
function renderTopbar() {
  const el = qs('#topbar-mount');
  if (!el) return;
  const route = ROUTES.find(r => r.id === Router.current) || PHASE2_ROUTES.find(r => r.id === Router.current) || ROUTES[0];
  const role = currentRole();
  const alerts = Engine.actionQueue(Store.employees, Store.requisitions, Store.nitaqatConfig);
  const redCount = alerts.filter(a => a.severity === 'red').length;

  el.innerHTML = `
    <div class="topbar-title">
      <span class="crumb">${esc(route.crumb || 'Saudi Workforce 360')}</span>
      <h1>${esc(route.label)}</h1>
    </div>
    <div class="topbar-search">
      ${Icon('search')}
      <input type="text" id="global-search" placeholder="Search employee, EID, or req #…" />
    </div>
    <div class="icon-btn" id="notif-btn" title="HR action queue">
      ${Icon('bell')}
      ${redCount > 0 ? '<span class="dot"></span>' : ''}
    </div>
    <div class="role-switcher">
      <div class="role-pill" title="${esc(Store.profile ? Store.profile.email : '')}">
        <span class="role-avatar">${role.short}</span>
        <span>${esc(role.label)}</span>
      </div>
    </div>
    <div class="icon-btn" id="signout-btn" title="Sign out">${Icon('logout')}</div>
  `;

  const search = qs('#global-search', el);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && search.value.trim()) {
      Router.pendingSearch = search.value.trim();
      navigate('employees');
    }
  });

  qs('#notif-btn', el).addEventListener('click', () => {
    if (role.perms.seeAlerts) navigate('hrworkspace');
    else toast('The compliance action queue is visible to HR & Admin roles.');
  });
  qs('#signout-btn', el).addEventListener('click', signOut);
}

// ---------------------------------------------------------------------------
// ROLE CONTEXT BANNER + SCOPE SELECTOR (People Manager / Service Line Manager)
// ---------------------------------------------------------------------------
function renderRoleBanner() {
  const role = currentRole();
  if (role.id === 'pm') {
    const managers = MANAGERS.filter(m => m.id !== 'mgr-unassigned');
    const mgr = managers.find(m => m.id === Store.scopeManagerId);
    const div = document.createElement('div');
    div.className = 'role-context-banner';
    div.innerHTML = `${Icon('manager')} Viewing as People Manager — acting as lead of
      <b>${mgr ? esc(mgr.name) : 'an unassigned team — contact HR'}</b> · Employees, Managers and Pipeline are scoped to this team; Home stays country-wide for context.`;
    return div;
  }
  if (role.id === 'slm') {
    const sl = SERVICE_LINES.find(s => s.id === Store.scopeServiceLine);
    const div = document.createElement('div');
    div.className = 'role-context-banner';
    div.innerHTML = `${Icon('briefcase')} Viewing as Service Line Manager — acting as lead of
      <b>${sl ? esc(sl.name) : 'an unassigned service line — contact HR'}</b> · Managers and Pipeline roll up this service line; Home stays country-wide for context.`;
    return div;
  }
  if (role.id === 'exec') {
    const div = document.createElement('div');
    div.className = 'role-context-banner';
    div.innerHTML = `${Icon('star')} Viewing as Country Management / Executive — country-wide, read-focused view.`;
    return div;
  }
  if (role.id === 'ta') {
    const div = document.createElement('div');
    div.className = 'role-context-banner';
    div.innerHTML = `${Icon('pipeline')} Viewing as Talent Acquisition — demand & supply ownership across all accounts.`;
    return div;
  }
  return null;
}

// ---------------------------------------------------------------------------
// SHELL BOOTSTRAP
// ---------------------------------------------------------------------------
function renderShell() {
  const root = qs('#app-shell');
  root.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-brand">
        <div class="dxc-logo-mark">DXC</div>
        <div class="dxc-wordmark"><b>Workforce 360</b><span>Saudi Arabia · HR Control Tower</span></div>
      </div>
      <div class="sidebar-scroll" id="sidebar-nav"></div>
    </div>
    <div class="main-col">
      <div class="topbar" id="topbar-mount"></div>
      <div class="content" id="content-mount"></div>
    </div>
  `;
  renderRoute(location.hash.slice(1) || 'home');
}
