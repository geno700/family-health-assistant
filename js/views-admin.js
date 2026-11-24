// Household admin (#/admin), owner and admins only: approve/reject joiners, roles, remove,
// join code and invite, rename, activity log (decrypted here), export, transfer, delete.

import { t } from './i18n.js';
import { api } from './data.js';
import * as store from './store.js';
import { decryptJson } from './crypto.js';
import { esc, icon, toast, confirmDialog, formDialog, download, copyText, $ } from './ui.js';
import { rerender, go } from './router.js';
import { isoDate } from './doses.js';

const ROLES = ['admin', 'caregiver', 'patient', 'viewer'];

function roleOptions(selected) {
  return ROLES.map((r) => `<option value="${r}" ${r === selected ? 'selected' : ''}>${esc(t(`role_${r}`))}</option>`).join('');
}
function personOptions(selected) {
  return store.people().map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}

/** Role (and, for a patient, which family member) in one dialog. */
async function askRole(title, role, personId) {
  const v = await formDialog(`
    <p class="dialog-text">${esc(title)}</p>
    <label>${esc(t('change_role'))}<select class="input" name="role">${roleOptions(role)}</select></label>
    <label>${esc(t('link_person'))}<select class="input" name="person"><option value="">—</option>${personOptions(personId)}</select></label>
    <p class="hint">${esc(t('approve_need_person'))}</p>`, { okLabel: t('save') });
  if (!v) return null;
  if (v.role === 'patient' && !v.person) { toast(t('approve_need_person'), 'error'); return null; }
  return v;
}

export function render(main, { user }) {
  if (!store.isAdmin()) { go('settings'); return; }
  const g = store.group();
  const isOwner = store.role() === 'owner';

  const draw = async () => {
    let members = [];
    let activity = [];
    try {
      [members, activity] = await Promise.all([api.listMembers(g.id), api.listActivity(g.id, 60)]);
    } catch {
      toast(t('error_generic'), 'error');
    }
    const pending = members.filter((m) => m.status === 'pending');
    const active = members.filter((m) => m.status === 'active');
    const lines = await Promise.all(activity.map(activityLine));
    const inviteUrl = location.origin + location.pathname;

    main.innerHTML = `
      <section class="page">
        <a class="back" href="#/settings">${esc(t('back'))}</a>
        <h1>${esc(t('admin_title'))}</h1>

        ${pending.length ? `<h2>${esc(t('pending'))}</h2>${pending.map((m) => `
          <div class="card">
            <div class="strong">${esc(m.display_name)}</div><div class="muted" dir="ltr">${esc(m.email || '')}</div>
            <div class="btn-row">
              <button class="btn btn-primary" data-approve="${esc(m.id)}">${icon('check')}${esc(t('approve'))}</button>
              <button class="btn btn-danger-outline" data-reject="${esc(m.id)}">${icon('close')}${esc(t('reject'))}</button>
            </div></div>`).join('')}` : ''}

        <h2>${esc(t('members'))}</h2>
        <div class="card list">
          ${active.map((m) => `
            <div class="list-row">
              <div class="grow"><div class="strong">${esc(m.display_name)} ${m.user_id === user.id ? esc(t('you')) : ''}</div>
                <div class="muted">${esc(t(`role_${m.role}`))}${m.role === 'patient' && store.person(m.person_id) ? ` • ${esc(store.person(m.person_id).name)}` : ''}</div></div>
              ${m.role !== 'owner' && m.user_id !== user.id ? `
                <button class="btn btn-ghost btn-small" data-role="${esc(m.id)}">${icon('edit')}${esc(t('change_role'))}</button>
                <button class="btn btn-ghost btn-small danger" data-remove="${esc(m.id)}">${icon('trash')}${esc(t('remove'))}</button>` : ''}
            </div>`).join('')}
        </div>

        <h2>${esc(t('join_code_title'))}</h2>
        <div class="card">
          <div class="join-code" dir="ltr">${esc(g.join_code || '')}</div>
          <div class="btn-row">
            <button class="btn btn-secondary" id="share">${icon('share')}${esc(t('share_invite'))}</button>
            <button class="btn btn-secondary" id="newCode">${icon('refresh')}${esc(t('new_join_code'))}</button>
          </div>
          <p class="hint">${esc(t('key_new_body'))}</p>
        </div>

        <div class="card">
          <button class="btn btn-secondary" id="rename">${icon('edit')}${esc(t('rename_house'))}</button>
          <button class="btn btn-secondary" id="export">${icon('download')}${esc(t('export_json'))}</button>
          ${isOwner ? `
            <button class="btn btn-secondary" id="transfer">${icon('shield')}${esc(t('transfer_owner'))}</button>
            <button class="btn btn-danger" id="delete">${icon('trash')}${esc(t('delete_house'))}</button>` : ''}
        </div>

        <h2>${esc(t('activity'))}</h2>
        <div class="card list">${lines.length ? lines.join('') : `<p class="muted">${esc(t('activity_empty'))}</p>`}</div>
      </section>`;

    const act = async (fn) => {
      try { await fn(); toast(t('saved')); await store.loadMemberships(); draw(); } catch (e) { toast(t(e?.code === 'not_allowed' ? 'not_allowed' : 'error_generic'), 'error'); }
    };
    main.querySelectorAll('[data-approve]').forEach((b) => { b.onclick = async () => {
      const m = members.find((x) => x.id === b.dataset.approve);
      const v = await askRole(t('approve_as', m.display_name), 'viewer', null);
      if (v) act(() => api.approveMember(m.id, v.role, v.role === 'patient' ? v.person : null));
    }; });
    main.querySelectorAll('[data-reject]').forEach((b) => { b.onclick = async () => {
      const m = members.find((x) => x.id === b.dataset.reject);
      if (await confirmDialog(t('reject_confirm', m.display_name), { danger: true, okLabel: t('reject') })) act(() => api.rejectMember(m.id));
    }; });
    main.querySelectorAll('[data-role]').forEach((b) => { b.onclick = async () => {
      const m = members.find((x) => x.id === b.dataset.role);
      const v = await askRole(m.display_name, m.role, m.person_id);
      if (v) act(() => api.setRole(m.id, v.role, v.role === 'patient' ? v.person : null));
    }; });
    main.querySelectorAll('[data-remove]').forEach((b) => { b.onclick = async () => {
      const m = members.find((x) => x.id === b.dataset.remove);
      if (await confirmDialog(t('remove_confirm', m.display_name), { danger: true, okLabel: t('remove') })) act(() => api.removeMember(m.id));
    }; });

    $('#share').onclick = async () => {
      const text = t('invite_text', g.name, g.join_code, inviteUrl);
      if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* cancelled */ } }
      if (await copyText(text)) toast(t('key_copied'));
    };
    $('#newCode').onclick = async () => {
      if (!(await confirmDialog(t('new_code_confirm')))) return;
      try { g.join_code = await api.regenerateJoinCode(g.id); toast(t('saved')); draw(); } catch { toast(t('error_generic'), 'error'); }
    };
    $('#rename').onclick = async () => {
      const v = await formDialog(`<label>${esc(t('house_name'))}<input class="input" name="name" value="${esc(g.name)}" maxlength="60" required></label><p class="hint">${esc(t('house_name_help'))}</p>`);
      if (v?.name?.trim()) act(async () => { await api.renameGroup(g.id, v.name.trim()); g.name = v.name.trim(); await store.loadMemberships(); rerender(); });
    };
    $('#export').onclick = () => download(`family-health-${isoDate(new Date())}.json`, JSON.stringify(store.exportData(), null, 2));
    if (isOwner) {
      $('#transfer').onclick = async () => {
        const others = active.filter((m) => m.user_id !== user.id);
        if (!others.length) return;
        const v = await formDialog(`<label>${esc(t('transfer_owner'))}<select class="input" name="member">${others.map((m) => `<option value="${esc(m.id)}">${esc(m.display_name)}</option>`).join('')}</select></label>`, { okLabel: t('confirm') });
        if (!v) return;
        const target = others.find((m) => m.id === v.member);
        if (await confirmDialog(t('transfer_confirm', target.display_name), { danger: true })) {
          try { await api.transferOwnership(g.id, target.id); toast(t('saved')); rerender(); } catch { toast(t('error_generic'), 'error'); }
        }
      };
      $('#delete').onclick = async () => {
        if (!(await confirmDialog(t('delete_house_confirm'), { danger: true, okLabel: t('delete_house'), typeToConfirm: g.name }))) return;
        try { await api.deleteGroup(g.id); toast(t('deleted')); location.hash = '#/today'; rerender(); } catch { toast(t('error_generic'), 'error'); }
      };
    }
  };

  /** One activity line. Record changes are decrypted here (the server only has cipher text). */
  async function activityLine(a) {
    const when = new Date(a.at).toLocaleString(document.documentElement.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
    let what;
    if (['insert', 'update', 'delete'].includes(a.action)) {
      let name = '';
      const c = a.after_cipher ? [a.after_cipher, a.after_iv] : a.before_cipher ? [a.before_cipher, a.before_iv] : null;
      if (c && store.currentKey()) {
        try {
          const obj = await decryptJson(store.currentKey(), c[0], c[1]);
          name = obj.name || (obj.medicineId ? `${store.med(obj.medicineId)?.name || ''} ${obj.status === 'TAKEN' ? '✓' : '✗'}` : '');
        } catch { /* made with another key */ }
      }
      what = `${t(`act_${a.action}`)} ${t(`kind_${a.kind}`)}${name ? `: ${name}` : ''}`;
    } else {
      const d = a.detail || {};
      const label = t(`ev_${a.action}`);
      const verb = label === `ev_${a.action}` ? a.action.replace(/_/g, ' ') : label;
      // detail keys (same in data-demo.js and schema.sql): member, role, from, to
      const role = a.action === 'role_changed' ? d.to : d.role;
      const target = a.action === 'group_renamed' ? `: ${d.to || ''}`
        : (d.member || (a.action === 'ownership_transferred' ? d.to : '')) ? ` ${d.member || d.to}` : '';
      what = `${verb}${target}${role ? ` (${t(`role_${role}`)})` : ''}`;
    }
    return `<div class="list-row"><div class="grow"><div>${esc(what)}</div><div class="muted small">${esc(a.user_name || '')} • ${esc(when)}</div></div></div>`;
  }

  draw();
}
