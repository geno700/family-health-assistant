// Settings: language, backup/restore, CSV export, the family key, account, household links,
// and (demo only) viewing the app as each role.

import { t, getLang, setLang } from './i18n.js';
import { api, isDemo } from './data.js';
import * as store from './store.js';
import { encodeKeyCode } from './crypto.js';
import { medTitle, doseLine, howOften, hhmm, isoDate } from './doses.js';
import { esc, icon, toast, confirmDialog, download, toCsv, copyText, plain, $ } from './ui.js';
import { rerender } from './router.js';
import { groupsNow } from './views-pharmacy.js';

export function render(main, { user }) {
  const draw = async () => {
    const g = store.group();
    const m = store.member();
    const platformAdmin = await api.isPlatformAdmin();
    const demoUsers = isDemo ? api.demoUsers() : [];
    main.innerHTML = `
      <section class="page">
        <h1>${esc(t('tab_settings'))}</h1>

        <div class="card">
          <h2 class="flat">${esc(t('settings_lang'))}</h2>
          <div class="chips">
            <label class="chip"><input type="radio" name="lang" value="ar" ${getLang() === 'ar' ? 'checked' : ''}><span>${esc(t('lang_ar'))}</span></label>
            <label class="chip"><input type="radio" name="lang" value="en" ${getLang() === 'en' ? 'checked' : ''}><span>${esc(t('lang_en'))}</span></label>
          </div>
        </div>

        <div class="card">
          <h2 class="flat">${esc(g?.name || '')}</h2>
          <p class="muted">${esc(t(`role_${m?.role}`))}</p>
          ${store.isAdmin() ? `<a class="btn btn-secondary" href="#/admin">${icon('home')}${esc(t('manage_house'))}</a>` : ''}
          <button class="btn btn-secondary" id="showKey">${icon('key')}${esc(t('key_show'))}</button>
          <a class="btn btn-secondary" href="#/start">${icon('plus')}${esc(t('another_house'))}</a>
          ${m?.role !== 'owner' ? `<button class="btn btn-danger-outline" id="leave">${icon('out')}${esc(t('leave_house'))}</button>` : ''}
        </div>

        <div class="card">
          <h2 class="flat">${esc(t('settings_data'))}</h2>
          <p class="hint">${esc(t('backup_hint'))}</p>
          <button class="btn btn-secondary" id="backup">${icon('download')}${esc(t('backup'))}</button>
          ${store.canWrite() ? `<label class="btn btn-secondary file-btn">${icon('upload')}${esc(t('restore'))}<input type="file" id="restore" accept="application/json,.json" hidden></label>` : ''}
          <button class="btn btn-secondary" id="csvMeds">${icon('download')}${esc(t('export_meds_csv'))}</button>
          <button class="btn btn-secondary" id="csvDoses">${icon('download')}${esc(t('export_doses_csv'))}</button>
          ${store.canSeeStock() ? `<button class="btn btn-secondary" id="csvStock">${icon('download')}${esc(t('export_stock_csv'))}</button>` : ''}
        </div>

        ${isDemo ? `
          <div class="card">
            <h2 class="flat">${esc(t('demo_role'))}</h2>
            <p class="hint">${esc(t('demo_role_help'))}</p>
            <select class="input" id="demoUser">
              ${demoUsers.map((u) => `<option value="${esc(u.id)}" ${u.id === user.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
            </select>
            <button class="btn btn-ghost" id="demoReset">${icon('refresh')}${esc(t('demo_reset'))}</button>
          </div>` : ''}

        <div class="card">
          <h2 class="flat">${esc(t('settings_account'))}</h2>
          <p class="muted" dir="auto">${esc(t('signed_in_as', user.email))}</p>
          ${platformAdmin ? `<a class="btn btn-secondary" href="#/owner">${icon('shield')}${esc(t('owner_page'))}</a>` : ''}
          <button class="btn btn-secondary" id="out">${icon('out')}${esc(t('sign_out'))}</button>
        </div>

        <div class="card"><h2 class="flat">${esc(t('about'))}</h2><p class="muted">${esc(t('about_body'))}</p></div>
      </section>`;

    main.querySelectorAll('[name=lang]').forEach((r) => { r.onchange = () => { setLang(r.value); rerender(); }; });
    $('#out').onclick = () => api.signOut();
    $('#showKey').onclick = async () => {
      if (!(await confirmDialog(t('key_show_confirm')))) return;
      const code = encodeKeyCode(store.currentKey());
      if (await confirmDialog(code, { okLabel: t('key_copy') })) { if (await copyText(code)) toast(t('key_copied')); }
    };
    const leave = $('#leave');
    if (leave) leave.onclick = async () => {
      if (!(await confirmDialog(t('leave_confirm', g.name), { danger: true, okLabel: t('leave_house') }))) return;
      try { await api.leaveGroup(g.id); rerender(); } catch { toast(t('error_generic'), 'error'); }
    };
    $('#backup').onclick = () => download(`family-health-${isoDate(new Date())}.json`, JSON.stringify(store.exportData(), null, 2));
    const restore = $('#restore');
    if (restore) restore.onchange = async () => {
      const file = restore.files[0];
      restore.value = '';
      if (!file || !(await confirmDialog(t('restore_confirm')))) return;
      try {
        const n = await store.importData(JSON.parse(await file.text()));
        toast(t('restored', n));
      } catch (e) {
        toast(t(e?.code === 'bad_file' || e instanceof SyntaxError ? 'restore_bad' : e?.code === 'not_allowed' ? 'not_allowed' : 'error_generic'), 'error');
      }
    };
    $('#csvMeds').onclick = () => {
      const rows = [['person', 'medicine', 'dose', 'schedule', 'start', 'end', 'stopped']].concat(
        store.meds().map((x) => [store.person(x.personId)?.name || '', plain(medTitle(x)), plain(doseLine(x)), plain(howOften(x)), x.startDate, x.endDate || '', x.stopped ? 'yes' : '']));
      download(`medicines-${isoDate(new Date())}.csv`, toCsv(rows), 'text/csv');
    };
    $('#csvDoses').onclick = () => {
      const rows = [['date', 'time', 'person', 'medicine', 'status', 'by']].concat(
        store.logs().sort((a, b) => a.scheduledAt - b.scheduledAt).map((l) => {
          const x = store.med(l.medicineId);
          return [isoDate(new Date(l.scheduledAt)), hhmm(l.scheduledAt), store.person(x?.personId)?.name || '', x ? plain(medTitle(x)) : '', l.status, l.actedBy || ''];
        }));
      download(`doses-${isoDate(new Date())}.csv`, toCsv(rows), 'text/csv');
    };
    if ($('#csvStock')) $('#csvStock').onclick = () => {
      const rows = [['medicine', 'strength', 'form', 'left', 'expiry', 'note']].concat(
        groupsNow().flatMap((g) => g.boxes.map((b) => [b.name, b.strength || '', b.form, String(b.left), b.expiry || '', b.note || ''])));
      download(`pharmacy-${isoDate(new Date())}.csv`, toCsv(rows), 'text/csv');
    };
    if (isDemo) {
      $('#demoUser').onchange = (e) => api.demoSwitchUser(e.target.value);
      $('#demoReset').onclick = async () => { if (await confirmDialog(t('demo_reset_confirm'))) { await api.demoReset(); location.hash = '#/today'; } };
    }
  };
  draw();
}

