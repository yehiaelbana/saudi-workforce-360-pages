// ============================================================================
// Saudi Workforce 360 — Authentication
// Real Supabase Auth (magic-link email), replacing the old client-side role
// dropdown. Boot sequence: check session -> fetch this user's `profiles` row
// -> pending role shows a waiting screen, any other role boots the app shell
// with Store populated from that real profile.
// ============================================================================

function authHeroHtml() {
  return `
    <div class="auth-hero">
      <div class="auth-hero-brand">
        <div class="dxc-logo-mark">DXC</div>
        <div class="dxc-wordmark"><b>Workforce 360</b><span>Saudi Arabia · HR Control Tower</span></div>
      </div>
      <div class="auth-hero-headline">One place to see, plan, and stay compliant on Saudization.</div>
      <div class="auth-hero-points">
        <div class="auth-hero-point">${Icon('shield')}<span>Live Nitaqat zone tracking, tied directly to your workforce register</span></div>
        <div class="auth-hero-point">${Icon('pipeline')}<span>Demand &amp; supply pipeline, from requisition to onboarding</span></div>
        <div class="auth-hero-point">${Icon('sliders')}<span>Scenario simulator for hiring, attrition, and localization planning</span></div>
        <div class="auth-hero-point">${Icon('lock')}<span>Access enforced at the database level — you only ever see what your role allows</span></div>
      </div>
      <div class="auth-hero-foot">DXC Technology — Saudi Arabia</div>
    </div>`;
}

function authShell(innerHtml) {
  const root = document.getElementById('app-shell');
  root.innerHTML = `<div class="auth-page"><div class="auth-shell">${authHeroHtml()}<div class="auth-panel">${innerHtml}</div></div></div>`;
  return root;
}

function authBrandHtml() {
  return `
    <div class="auth-brand">
      <div class="dxc-logo-mark">DXC</div>
      <div class="dxc-wordmark"><b>Workforce 360</b><span>Saudi Arabia · HR Control Tower</span></div>
    </div>`;
}

function renderAuthLoading(message) {
  authShell(`
    ${authBrandHtml()}
    <div class="auth-status">
      <div class="auth-spinner"></div>
      <p>${esc(message || 'Checking your sign-in status…')}</p>
    </div>
  `);
}

function renderLoginScreen(notice) {
  const root = authShell(`
    ${authBrandHtml()}
    <h2>Sign in</h2>
    <div class="auth-sub">Enter your DXC email — we'll send you a one-time sign-in link, no password needed.</div>
    ${notice ? `<div class="disclaimer-box mt-4" style="margin-bottom:16px;">${Icon('alertTriangle')}<span>${esc(notice)}</span></div>` : ''}
    <form id="login-form">
      <div class="field">
        <label>Work email</label>
        <input type="email" id="login-email" placeholder="you@dxc.com" required autofocus />
      </div>
      <button type="submit" class="btn btn-primary btn-block" id="login-submit">Send sign-in link</button>
    </form>
    <div class="auth-foot">You'll only get in once HR has granted your account access.</div>
  `);

  qs('#login-form', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = qs('#login-email', root).value.trim();
    if (!email) return;
    const btn = qs('#login-submit', root);
    btn.disabled = true;
    btn.textContent = 'Sending…';
    const redirectTo = window.location.href.split('#')[0];
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      renderLoginScreen(`Couldn't send the link: ${error.message}`);
      return;
    }
    renderCheckEmailScreen(email);
  });
}

function renderCheckEmailScreen(email) {
  const root = authShell(`
    ${authBrandHtml()}
    <div class="auth-status">
      ${Icon('mail')}
      <p>Sign-in link sent to<br/><span class="auth-status-email">${esc(email)}</span></p>
    </div>
    <div class="auth-foot">Click the link in that email to finish signing in. You can close this tab.</div>
    <button type="button" class="btn btn-secondary btn-block mt-16" id="login-back">Use a different email</button>
  `);
  qs('#login-back', root).addEventListener('click', () => renderLoginScreen());
}

function renderPendingScreen(profile) {
  const root = authShell(`
    ${authBrandHtml()}
    <div class="auth-status">
      ${Icon('clock')}
      <p>Signed in as <span class="auth-status-email">${esc(profile.email)}</span>, but your account doesn't have access yet.</p>
    </div>
    <div class="auth-foot">HR needs to assign you a role before you can use Workforce 360. Reach out to HR & Admin, or check back later.</div>
    <button type="button" class="btn btn-secondary btn-block mt-16" id="pending-signout">Sign out</button>
  `);
  qs('#pending-signout', root).addEventListener('click', signOut);
}

function renderAuthError(message) {
  const root = authShell(`
    ${authBrandHtml()}
    <div class="auth-status">
      ${Icon('alertCircle')}
      <p>${esc(message)}</p>
    </div>
    <button type="button" class="btn btn-secondary btn-block mt-16" id="error-signout">Sign out and try again</button>
  `);
  qs('#error-signout', root).addEventListener('click', signOut);
}

async function handleSession(session) {
  renderAuthLoading();
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    renderAuthError('Could not load your account profile. Try refreshing, or contact HR if this keeps happening.');
    return;
  }
  if (profile.role === 'pending') {
    renderPendingScreen(profile);
    return;
  }
  Store.setProfile(profile);

  renderAuthLoading('Loading your workspace…');
  try {
    const data = await fetchAppData();
    Store.loadRemoteData(data);
  } catch (err) {
    renderAuthError('Signed in, but could not load workforce data: ' + err.message + '. Try refreshing.');
    return;
  }
  renderShell();
}

async function signOut() {
  await supabaseClient.auth.signOut();
  Store.clearProfile();
}

function initAuth() {
  renderAuthLoading();
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) handleSession(session);
    else renderLoginScreen();
  });
}
