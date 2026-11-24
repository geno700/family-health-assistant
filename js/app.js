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
  user = await api.getUser();
  store.setUser(user?.id || null);
  if (recovering && user) return bare(auth.setPassword, () => { recovering = false; render(); });
  if (!user) return bare(auth.signIn, render);

  const route = parseRoute();
  if (route.name === 'owner') {
    shell.classList.remove('bare');
    drawHeader(true);
    drawTabs(null);
    cleanup = ownerView.render(main) || null;
    return;
  }

  await store.loadMemberships();
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
  drawTabs(route.name);
  const views = {
    today: () => todayView.render(main),
    meds: () => medsView.render(main, route.params),
    pharmacy: () => pharmacyView.render(main, route.params),
    family: () => familyView.render(main, route.params),
    settings: () => settingsView.render(main, { user }),
    admin: () => adminView.render(main, { user }),
  };
  cleanup = (views[route.name] || views.today)() || null;
  if (store.unreadableCount() > 0) toast(t('key_wrong'), 'error');
}

function drawHeader(full) {
  const memberships = full ? store.memberships().filter((x) => x.member.status === 'active') : [];
  const g = store.group();
  $('#header').innerHTML = `
    <div class="brand">${icon('home')}<span>${esc(t('app_name'))}</span>${isDemo ? `<span class="badge-demo">${esc(t('demo'))}</span>` : ''}</div>
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

// ---------- Start ----------

async function start() {
  applyLang();
  try {
    await api.init();
  } catch (e) {
    $('#main').innerHTML = `<div class="empty"><h2>${esc(t('error_generic'))}</h2></div>`;
    return;
  }
  api.onAuthChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recovering = true;
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') render();
  });
  setRerender(render);
  window.addEventListener('hashchange', render);
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
