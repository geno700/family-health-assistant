// Platform owner panel (#/owner), only for user ids in fha.platform_admins. Shows counts and
// household names only: health content is encrypted and never visible here, by design.

import { t } from './i18n.js';
import { api } from './data.js';
import { esc, icon, toast, confirmDialog, $ } from './ui.js';

export function render(main) {
  let search = '';
  const draw = async () => {
    if (!(await api.isPlatformAdmin())) {
      main.innerHTML = `<section class="page"><div class="empty">${icon('shield')}<h2>${esc(t('owner_only'))}</h2>
        <a class="btn btn-secondary" href="#/today">${esc(t('back'))}</a></div></section>`;
      return;
    }
    let stats = { groups: 0, users: 0, week_activity: 0 };
    let groups = [];
    try {
      [stats, groups] = await Promise.all([api.ownerStats(), api.ownerGroups(search)]);
    } catch {
      toast(t('error_generic'), 'error');
    }
    const day = (iso) => (iso ? new Date(iso).toLocaleDateString(document.documentElement.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB') : '—');
    main.innerHTML = `
      <section class="page">
        <a class="back" href="#/settings">${esc(t('back'))}</a>
        <h1>${esc(t('owner_title'))}</h1>
        <p class="hint">${icon('shield')} ${esc(t('owner_privacy'))}</p>
        <div class="stats">
          <div class="stat"><div class="stat-n">${esc(stats.groups)}</div><div class="muted">${esc(t('stat_groups'))}</div></div>
          <div class="stat"><div class="stat-n">${esc(stats.users)}</div><div class="muted">${esc(t('stat_users'))}</div></div>
          <div class="stat"><div class="stat-n">${esc(stats.week_activity)}</div><div class="muted">${esc(t('stat_week'))}</div></div>
        </div>
        <input class="input" type="search" id="search" placeholder="${esc(t('owner_search'))}" value="${esc(search)}">
        <div class="card list">
          ${groups.length ? groups.map((g) => `
            <div class="list-row">
              <div class="grow"><div class="strong">${esc(g.name)} ${g.disabled ? `<span class="tag tag-red">${esc(t('disabled'))}</span>` : ''}</div>
                <div class="muted small">${esc(t('members_count', g.members))} • ${esc(t('records_count', g.records))} • ${esc(day(g.last_activity || g.created_at))}</div></div>
              <button class="btn btn-small ${g.disabled ? 'btn-secondary' : 'btn-danger-outline'}" data-toggle="${esc(g.id)}" data-disabled="${g.disabled ? '1' : '0'}" data-name="${esc(g.name)}">
                ${esc(t(g.disabled ? 'enable' : 'disable'))}</button>
            </div>`).join('') : `<p class="muted">${esc(t('no_results'))}</p>`}
        </div>
      </section>`;
    let timer;
    $('#search').oninput = (e) => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        search = e.target.value;
        await draw();
        const el = $('#search');
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }, 300);
    };
    main.querySelectorAll('[data-toggle]').forEach((b) => { b.onclick = async () => {
      const disable = b.dataset.disabled === '0';
      if (disable && !(await confirmDialog(t('disable_confirm', b.dataset.name), { danger: true, okLabel: t('disable') }))) return;
      try { await api.ownerSetDisabled(b.dataset.toggle, disable); draw(); } catch { toast(t('error_generic'), 'error'); }
    }; });
  };
  draw();
}
