// Start-up, routing and the app shell (header + bottom tabs).
// Order on start: disclaimer → signed in? → a household? → family key on this device? → app.

import { applyLang, t } from './i18n.js';
import { api, isDemo } from './data.js';
import * as store from './store.js';
import { esc, icon, toast, $ } from './ui.js';
import { go, setRerender } from './router.js';
import * as auth from './views-auth.js';
import * as todayView from './views-today.js';
import * as medsView from './views-meds.js';
import * as pharmacyView from './views-pharmacy.js';
import * as familyView from './views-family.js';
import * as apptsView from './views-appts.js';
import * as emergencyView from './views-emergency.js';
import * as papersView from './views-papers.js';
import * as reportView from './views-report.js';
import * as settingsView from './views-settings.js';
import * as adminView from './views-admin.js';
import * as ownerView from './views-owner.js';

const DISCLAIMER_KEY = 'fha.disclaimer.v1';

const TABS = [
  { route: 'today', label: 'tab_today', icon: 'today' },
  { route: 'meds', label: 'tab_meds', icon: 'pill' },
  { route: 'pharmacy', label: 'tab_pharmacy', icon: 'pharmacy' },
  { route: 'family', label: 'tab_family', icon: 'family' },
  { route: 'settings', label: 'tab_settings', icon: 'settings' },
];

let user = null;
let recovering = false;
let cleanup = null;

function parseRoute() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'today').split('/').filter(Boolean);
  return { name: parts[0] || 'today', params: parts.slice(1) };
}

function disclaimerAccepted() {
  try { return localStorage.getItem(DISCLAIMER_KEY) === 'yes'; } catch { return false; }
}

/** Re-runs the whole start-up decision and draws the right screen. */
async function render() {
  if (cleanup) { cleanup(); cleanup = null; }
  applyLang();
  const main = $('#main');
  const shell = $('#app');

  const bare = (fn, ...args) => {
    shell.classList.add('bare');
    drawHeader(false);
    $('#tabs').innerHTML = '';
    cleanup = fn(main, ...args) || null;
  };

  if (!disclaimerAccepted()) {
    return bare(auth.disclaimer, () => { localStorage.setItem(DISCLAIMER_KEY, 'yes'); render(); });
  }
  const route = parseRoute();
  // No internet: keep going only if this session's data is already loaded; otherwise show the
  // offline screen, which can still open the emergency cards saved on this device.
  const offline = !navigator.onLine;
  if (offline && !(user && store.isLoaded())) return bare(offlineScreen, route);
  if (!offline) {
    user = await api.getUser();
    store.setUser(user?.id || null);
  }
  if (recovering && user) return bare(auth.setPassword, () => { recovering = false; render(); });
  if (!user) return bare(auth.signIn, render);

  if (route.name === 'owner') {
    shell.classList.remove('bare');
    drawHeader(true);
    drawTabs(null);
    cleanup = ownerView.render(main) || null;
    return;
  }

  if (!offline) {
    await store.loadMemberships();
    // An admin changed the family key since this phone last opened the household
    if (store.hasKey() && !(await store.keyStillValid())) store.dropKey();
  }
  if (!store.active()) {
    const pending = store.memberships().filter((x) => x.member.status === 'pending');
    const disabled = store.memberships().filter((x) => x.group.disabled);
    return bare(auth.onboarding, { pending, disabled, user, onDone: render });
  }
  if (!store.hasKey()) {
    return bare(auth.enterKey, store.group(), async (code) => {
      const ok = await store.unlock(code);
      if (ok) render();
      return ok;
    });
  }
  if (route.name === 'start') {
    // Already in a household: start or join another one (Settings → "another household")
    const toToday = async () => { await store.loadMemberships(); go('today'); render(); };
    return bare(auth.onboarding, { pending: [], user, onDone: toToday, onCancel: () => go('settings') });
  }
  if (!store.isLoaded()) await store.reload();

  shell.classList.remove('bare');
  drawHeader(true);
  drawTabs(['appts', 'papers', 'report'].includes(route.name) ? 'family' : route.name);
  const views = {
    today: () => todayView.render(main),
    meds: () => medsView.render(main, route.params),
    pharmacy: () => pharmacyView.render(main, route.params),
    family: () => familyView.render(main, route.params),
    appts: () => apptsView.render(main, route.params),
    papers: () => papersView.render(main, route.params),
    report: () => reportView.render(main, route.params),
    emergency: () => {
      const draw = () => emergencyView.render(main, route.params, { cards: store.emergencyCards() });
      draw();
      return store.onChange(draw);
    },
    settings: () => settingsView.render(main, { user }),
    admin: () => adminView.render(main, { user, params: route.params }),
  };
  cleanup = (views[route.name] || views.today)() || null;
  if (store.unreadableCount() > 0) toast(t('key_wrong'), 'error');
}

function drawHeader(full) {
  const memberships = full ? store.memberships().filter((x) => x.member.status === 'active') : [];
  const g = store.group();
  $('#header').classList.toggle('full', full);
  $('#header').innerHTML = `
    <div class="brand">${icon('home')}<span>${esc(t('app_name'))}</span>${isDemo ? `<span class="badge-demo">${esc(t('demo'))}</span>` : ''}</div>
    ${full ? `<a class="sos-pill" href="#/emergency">${icon('alert')}<span>${esc(t('sos'))}</span></a>` : ''}
    ${full && memberships.length > 0 ? `
      <label class="house-switch">
        <span class="sr-only">${esc(t('switch_house'))}</span>
        <select id="houseSelect">
          ${memberships.map((x) => `<option value="${esc(x.group.id)}" ${x.group.id === g?.id ? 'selected' : ''} ${x.group.disabled ? 'disabled' : ''}>${esc(x.group.name)}</option>`).join('')}
        </select>
      </label>` : ''}`;
  const sel = $('#houseSelect');
  if (sel) sel.onchange = async () => { await store.switchTo(sel.value); go('today'); render(); };
}

function drawTabs(current) {
  // A patient sees only their own person's records, so no shared pharmacy tab
  $('#tabs').innerHTML = TABS.filter((tab) => tab.route !== 'pharmacy' || store.canSeeStock()).map((tab) => `
    <a href="#/${tab.route}" class="tab ${tab.route === current ? 'active' : ''}" ${tab.route === current ? 'aria-current="page"' : ''}>
      ${icon(tab.icon)}<span>${esc(t(tab.label))}</span>
    </a>`).join('');
}

/** No internet and nothing loaded yet: say so, and offer the emergency cards kept on this device. */
function offlineScreen(main, route) {
  let alive = true;
  store.readEmergencyCopy().then((copy) => {
    if (!alive) return;
    if (route.name === 'emergency') {
      emergencyView.render(main, route.params, { cards: copy?.cards || [], offlineAt: copy?.savedAt || Date.now(), backHref: '#/' });
      return;
    }
    main.innerHTML = `
      <section class="page narrow">
        <div class="empty">${icon('alert')}<h2>${esc(t('offline_title'))}</h2><p>${esc(t('offline_body'))}</p></div>
        <a class="btn btn-danger btn-big" href="#/emergency">${icon('alert')}${esc(t('open_emergency'))}</a>
        <button class="btn btn-secondary" id="retry">${icon('refresh')}${esc(t('retry'))}</button>
      </section>`;
    $('#retry').onclick = () => location.reload();
  });
  return () => { alive = false; };
}

// ---------- Start ----------

async function start() {
  applyLang();
  try {
    await api.init();
  } catch (e) {
    // Usually no internet on the very first load: the emergency cards may still be on the phone
    window.addEventListener('online', () => location.reload());
    window.addEventListener('hashchange', () => { drawHeader(false); offlineScreen($('#main'), parseRoute()); });
    drawHeader(false);
    offlineScreen($('#main'), parseRoute());
    return;
  }
  api.onAuthChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recovering = true;
    if (event === 'SIGNED_OUT') store.forgetEmergencyCopies();
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') render();
  });
  setRerender(render);
  window.addEventListener('hashchange', render);
  window.addEventListener('online', () => render());
  await render();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
      });
    });
  }).catch(() => { /* offline or blocked: the app still works */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}

function showUpdate(worker) {
  const bar = document.createElement('div');
  bar.className = 'update-bar';
  bar.innerHTML = `<span>${esc(t('update_ready'))}</span><button class="btn btn-small">${esc(t('reload'))}</button>`;
  bar.querySelector('button').onclick = () => worker.postMessage('skipWaiting');
  document.body.appendChild(bar);
}

start();
