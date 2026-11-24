// Screens before the app: disclaimer, sign in / sign up / reset, new password,
// create or join a household, the new family key, and typing the family key.

import { t } from './i18n.js';
import { api, isDemo } from './data.js';
import * as store from './store.js';
import { encodeKeyCode, newKeyBytes, makeKeyCheck, saveDeviceKey } from './crypto.js';
import { esc, icon, toast, copyText, $ } from './ui.js';

export function errMsg(e) {
  const map = {
    not_allowed: 'not_allowed', join_not_found: 'join_not_found', invalid_login: 'error_generic',
  };
  return t(map[e?.code] || 'error_generic');
}

const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function disclaimer(main, onAccept) {
  main.innerHTML = `
    <section class="page narrow">
      <h1>${esc(t('disclaimer_title'))}</h1>
      <div class="card prose">${esc(t('disclaimer_body')).replace(/\n/g, '<br>')}</div>
      <label class="check-row"><input type="checkbox" id="agree"> <span>${esc(t('disclaimer_check'))}</span></label>
      <button class="btn btn-primary btn-big" id="ok" disabled>${icon('check')}${esc(t('disclaimer_ok'))}</button>
    </section>`;
  $('#agree').onchange = (e) => { $('#ok').disabled = !e.target.checked; };
  $('#ok').onclick = onAccept;
}

export function signIn(main, onDone) {
  let mode = 'signin'; // signin | signup | reset
  const draw = () => {
    const title = { signin: 'auth_title', signup: 'auth_signup_title', reset: 'forgot' }[mode];
    main.innerHTML = `
      <section class="page narrow">
        <div class="hero">${icon('shield')}<h1>${esc(t(title))}</h1></div>
        <form id="authForm" class="card form" novalidate>
          ${mode === 'signup' ? `<label>${esc(t('your_name'))}<input class="input" name="name" autocomplete="name" required></label>` : ''}
          <label>${esc(t('email'))}<input class="input" name="email" type="email" autocomplete="email" dir="ltr" required></label>
          ${mode !== 'reset' ? `<label>${esc(t('password'))}<input class="input" name="password" type="password" dir="ltr" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required></label>` : ''}
          <p class="form-error" id="err" role="alert"></p>
          <button class="btn btn-primary btn-big">${icon('check')}${esc(t(mode === 'signup' ? 'sign_up' : mode === 'reset' ? 'forgot' : 'sign_in'))}</button>
        </form>
        <div class="link-row">
          ${mode !== 'signin' ? `<button class="btn btn-ghost" data-mode="signin">${esc(t('have_account'))}</button>` : ''}
          ${mode !== 'signup' ? `<button class="btn btn-ghost" data-mode="signup">${esc(t('no_account'))}</button>` : ''}
          ${mode === 'signin' ? `<button class="btn btn-ghost" data-mode="reset">${esc(t('forgot'))}</button>` : ''}
        </div>
        ${isDemo ? `<p class="hint">${esc('owner@example.com · sara@example.com · mama@example.com · khaled@example.com')}</p>` : ''}
      </section>`;
    main.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { mode = b.dataset.mode; draw(); }; });
    $('#authForm').onsubmit = async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      const err = $('#err');
      err.textContent = '';
      const email = (f.email || '').trim();
      if (!emailOk(email)) { err.textContent = t('email_invalid'); return; }
      if (mode !== 'reset' && !isDemo && (f.password || '').length < 8) { err.textContent = t('password_short'); return; }
      try {
        if (mode === 'reset') { await api.sendReset(email); toast(t('reset_sent')); mode = 'signin'; draw(); return; }
        if (mode === 'signup') {
          const r = await api.signUp(email, f.password, (f.name || '').trim());
          if (r.needsConfirm) { toast(t('check_email'), 'info', 6000); mode = 'signin'; draw(); return; }
        } else {
          await api.signIn(email, f.password);
        }
        onDone();
      } catch (e) {
        err.textContent = errMsg(e);
      }
    };
  };
  draw();
}

export function setPassword(main, onDone) {
  main.innerHTML = `
    <section class="page narrow">
      <h1>${esc(t('set_password'))}</h1>
      <form id="pwForm" class="card form">
        <label>${esc(t('new_password'))}<input class="input" name="password" type="password" dir="ltr" autocomplete="new-password" required></label>
        <p class="form-error" id="err" role="alert"></p>
        <button class="btn btn-primary btn-big">${icon('check')}${esc(t('save'))}</button>
      </form>
    </section>`;
  $('#pwForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const pw = new FormData(ev.target).get('password');
    if (String(pw).length < 8) { $('#err').textContent = t('password_short'); return; }
    try { await api.updatePassword(pw); toast(t('password_changed')); onDone(); } catch (e) { $('#err').textContent = errMsg(e); }
  };
}

/** No usable household yet: create one, join with a code, or wait for approval. */
export function onboarding(main, { pending, user, onDone, onCancel }) {
  const draw = (mode = 'choose') => {
    if (mode === 'create') return drawCreate();
    main.innerHTML = `
      <section class="page narrow">
        <div class="hero">${icon('home')}<h1>${esc(t(pending.length ? 'waiting_title' : 'onboard_title'))}</h1></div>
        ${pending.map((p) => `<div class="card notice">${esc(t('waiting_body', p.group.name))}</div>`).join('')}
        ${pending.length ? `<button class="btn btn-secondary" id="refresh">${icon('refresh')}${esc(t('refresh'))}</button>` : `<p class="lead">${esc(t('onboard_body'))}</p>`}
        <button class="btn btn-primary btn-big" id="create">${icon('plus')}${esc(t('create_house'))}</button>
        <form id="joinForm" class="card form">
          <label>${esc(t('join_code'))}<input class="input code-input" name="code" maxlength="6" autocomplete="off" dir="ltr" required></label>
          <p class="form-error" id="err" role="alert"></p>
          <button class="btn btn-secondary btn-big">${icon('key')}${esc(t('join_house'))}</button>
        </form>
        ${onCancel
          ? `<button class="btn btn-ghost" id="out">${esc(t('back'))}</button>`
          : `<button class="btn btn-ghost" id="out">${icon('out')}${esc(t('sign_out'))}</button>`}
      </section>`;
    $('#create').onclick = () => draw('create');
    $('#out').onclick = () => (onCancel ? onCancel() : api.signOut());
    if ($('#refresh')) $('#refresh').onclick = onDone;
    $('#joinForm').onsubmit = async (ev) => {
      ev.preventDefault();
      const code = String(new FormData(ev.target).get('code') || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) { $('#err').textContent = t('join_code_invalid'); return; }
      try {
        await api.joinGroup(code, user.name);
        toast(t('join_sent'));
        onDone();
      } catch (e) {
        $('#err').textContent = errMsg(e);
      }
    };
  };

  /** New household: the family key is made here and shown once before anything is created. */
  const drawCreate = () => {
    const keyBytes = newKeyBytes();
    const code = encodeKeyCode(keyBytes);
    main.innerHTML = `
      <section class="page narrow">
        <h1>${esc(t('create_house'))}</h1>
        <form id="createForm" class="card form">
          <label>${esc(t('house_name'))}<input class="input" name="name" placeholder="${esc(t('house_name_hint'))}" required maxlength="60"></label>
          <p class="hint">${esc(t('house_name_help'))}</p>
          <h2>${icon('key')} ${esc(t('key_title'))}</h2>
          <p>${esc(t('key_new_body'))}</p>
          <div class="key-code" dir="ltr">${esc(code)}</div>
          <button type="button" class="btn btn-secondary" id="copy">${icon('copy')}${esc(t('key_copy'))}</button>
          <label class="check-row"><input type="checkbox" id="savedIt"> <span>${esc(t('key_saved_check'))}</span></label>
          <p class="form-error" id="err" role="alert"></p>
          <button class="btn btn-primary btn-big" id="go" disabled>${icon('check')}${esc(t('key_continue'))}</button>
        </form>
        <button class="btn btn-ghost" id="back">${esc(t('back'))}</button>
      </section>`;
    $('#copy').onclick = async () => { if (await copyText(code)) toast(t('key_copied')); };
    $('#savedIt').onchange = (e) => { $('#go').disabled = !e.target.checked; };
    $('#back').onclick = () => draw();
    $('#createForm').onsubmit = async (ev) => {
      ev.preventDefault();
      const name = String(new FormData(ev.target).get('name') || '').trim();
      if (!name) { $('#err').textContent = t('house_name'); return; }
      try {
        const g = await api.createGroup(name, await makeKeyCheck(keyBytes), user.name);
        saveDeviceKey(g.id, keyBytes);
        try { localStorage.setItem('fha.active', g.id); } catch { /* ignore */ }
        onDone();
      } catch (e) {
        $('#err').textContent = errMsg(e);
      }
    };
  };

  draw();
}

/** Approved, but this device doesn't have the family key yet. */
export function enterKey(main, group, onSubmit) {
  main.innerHTML = `
    <section class="page narrow">
      <div class="hero">${icon('key')}<h1>${esc(t('key_enter_title'))}</h1></div>
      <p class="lead">${esc(group.name)}</p>
      <form id="keyForm" class="card form">
        ${store.wasKeyChanged() ? `<div class="card notice">${esc(t('key_changed_note'))}</div>` : ''}
        <p>${esc(t('key_enter_body'))}</p>
        <textarea class="input key-input" name="code" rows="3" dir="ltr" autocomplete="off" spellcheck="false" required></textarea>
        <p class="form-error" id="err" role="alert"></p>
        <button class="btn btn-primary btn-big">${icon('check')}${esc(t('key_continue'))}</button>
      </form>
      <p class="hint">${esc(t('key_no_have'))}</p>
      ${store.memberships().filter((x) => x.member.status === 'active').length > 1 ? `
        <label class="house-switch-inline">${esc(t('switch_house'))}
          <select id="other">${store.memberships().filter((x) => x.member.status === 'active').map((x) => `<option value="${esc(x.group.id)}" ${x.group.id === group.id ? 'selected' : ''}>${esc(x.group.name)}</option>`).join('')}</select>
        </label>` : ''}
      <button class="btn btn-ghost" id="out">${icon('out')}${esc(t('sign_out'))}</button>
    </section>`;
  $('#out').onclick = () => api.signOut();
  if ($('#other')) $('#other').onchange = async (e) => { await store.switchTo(e.target.value); location.reload(); };
  $('#keyForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const ok = await onSubmit(new FormData(ev.target).get('code'));
    if (!ok) $('#err').textContent = t('key_wrong');
  };
}
