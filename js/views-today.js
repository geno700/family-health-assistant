// Today: everyone's doses grouped into now / missed / later / done, plus as-needed medicines.
// Redraws every 30 s so doses move between groups on their own, and (while the app is open)
// shows a phone notification when a dose comes due.

import { t, ltr, joinList } from './i18n.js';
import * as store from './store.js';
import { today, doseLine, medTitle, hhmm } from './doses.js';
import { esc, icon, toast, toastAction, emptyState } from './ui.js';
import { personColor } from './views-family.js';
import { groupsNow } from './views-pharmacy.js';
import { needsAttention } from './stock.js';
import { apptRow, isPast, whenWords } from './views-appts.js';

const NOTIFIED_KEY = 'fha.notified';

function notified() {
  try { return new Set(JSON.parse(sessionStorage.getItem(NOTIFIED_KEY) || '[]')); } catch { return new Set(); }
}
function markNotified(keys) {
  try { sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...keys].slice(-200))); } catch { /* ignore */ }
}

export function render(main) {
  const draw = () => {
    const meds = store.meds().filter((m) => store.person(m.personId));
    const doses = today(meds, store.logs(), Date.now());
    const group = (s) => doses.filter((d) => d.state === s);
    const due = group('DUE');
    const missed = group('MISSED');
    const later = group('UPCOMING');
    const done = doses.filter((d) => d.state === 'TAKEN' || d.state === 'SKIPPED');
    const asNeeded = meds.filter((m) => m.scheduleType === 'AS_NEEDED' && !m.stopped);

    const soonAppts = store.appts().filter((a) => store.person(a.personId) && !isPast(a)
      && [t('day_today'), t('day_tomorrow')].includes(whenWords(a.at)));
    if (meds.length === 0 && !soonAppts.length) {
      main.innerHTML = `<section class="page">${emptyState('pill', t('today_empty_title'), t('today_empty_body'),
        store.canWrite() ? `<a class="btn btn-primary btn-big" href="#/family">${icon('plus')}${esc(t('add_person'))}</a>` : '')}</section>`;
      return;
    }

    const canNotify = 'Notification' in window && Notification.permission === 'default';
    main.innerHTML = `
      <section class="page">
        <h1>${esc(t('tab_today'))}</h1>
        ${stockBanner()}
        ${soonAppts.length ? `<h2>${esc(t('today_appts'))}</h2><div class="card list">${soonAppts.map((a) => apptRow(a)).join('')}</div>` : ''}
        ${canNotify ? `<button class="btn btn-secondary" id="notif">${icon('bell')}${esc(t('enable_notifications'))}</button>` : ''}
        ${due.length ? `<h2>${esc(t('today_now'))}</h2>${due.map((d) => dueCard(d, false)).join('')}` : ''}
        ${missed.length ? `<h2>${esc(t('today_missed'))}</h2><p class="hint">${esc(t('missed_note'))}</p>${missed.map((d) => dueCard(d, true)).join('')}` : ''}
        ${!due.length && !missed.length ? `
          <div class="card row">${icon('check')}<div><strong>${esc(t('today_all_clear'))}</strong>
            <div class="muted">${esc(later.length ? t('today_next_at', ltr(hhmm(later[0].at))) : t('today_none_left'))}</div></div></div>` : ''}
        ${later.length ? `<h2>${esc(t('today_later'))}</h2><div class="card list">${later.map((d) => row(d)).join('')}</div>` : ''}
        ${asNeeded.length ? `<h2>${esc(t('today_as_needed'))}</h2>${asNeeded.map(asNeededCard).join('')}` : ''}
        ${done.length ? `<h2>${esc(t('today_done'))}</h2><div class="card list">${done.map((d) => row(d, true)).join('')}</div>` : ''}
        <p class="hint">${icon('bell')} ${esc(t('reminders_note'))}</p>
      </section>`;

    main.querySelectorAll('[data-act]').forEach((btn) => {
      btn.onclick = () => act(btn.dataset.act, btn.dataset.med, Number(btn.dataset.at));
    });
    const n = main.querySelector('#notif');
    if (n) n.onclick = async () => { await Notification.requestPermission(); draw(); };
    notifyDue(due);
    notifyAppts(soonAppts);
  };

  /** While the app is open: one phone notification when an appointment is 2 hours away or less. */
  function notifyAppts(list) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const seen = notified();
    list.filter((a) => a.at - Date.now() <= 2 * 3600000).forEach((a) => {
      const key = `appt|${a.id}|${a.at}`;
      if (seen.has(key)) return;
      seen.add(key);
      try {
        new Notification(t('notify_appt', a.name), { body: `${store.person(a.personId)?.name || ''} • ${hhmm(a.at)}`, tag: key });
      } catch { /* some browsers only allow notifications from a service worker */ }
    });
    markNotified(seen);
  }

  /** Out, low or expired medicines in the home pharmacy (not shown to patients). */
  function stockBanner() {
    if (!store.canSeeStock()) return '';
    const need = needsAttention(groupsNow());
    if (!need.length) return '';
    const names = joinList(need.map((g) => ltr([g.name, g.strength].filter(Boolean).join(' '))));
    return `<a class="card row link notice" href="#/pharmacy">${icon('alert')}<div class="grow">${esc(t('today_stock_banner', names))}</div><span class="chev">›</span></a>`;
  }

  async function act(what, medId, at) {
    const m = store.med(medId);
    if (!m) return;
    const who = store.person(m.personId)?.name || '';
    try {
      if (what === 'take' || what === 'skip') {
        await (what === 'take' ? store.take(m, at) : store.skip(m, at));
        toastAction(t(what === 'take' ? 'logged_taken' : 'logged_skipped', who, medTitle(m)), t('undo'), () => store.undo(m, at));
      } else if (what === 'undo') {
        await store.undo(m, at);
      } else if (what === 'now') {
        const when = await store.takeNow(m);
        toastAction(t('logged_taken', who, medTitle(m)), t('undo'), () => store.undo(m, when));
      }
    } catch (e) {
      toast(t(e?.code === 'not_allowed' ? 'not_allowed' : 'error_generic'), 'error');
    }
  }

  function who(m) {
    const p = store.person(m.personId);
    return `<div class="who"><span class="dot" style="background:${personColor(p?.color)}"></span>${esc(p?.name || '')}</div>`;
  }

  function dueCard(d, missed) {
    const m = d.med;
    const can = store.canDose(m.personId);
    return `
      <article class="card dose ${missed ? 'dose-missed' : 'dose-due'}">
        ${who(m)}
        <div class="dose-head">
          <div><div class="dose-name">${esc(medTitle(m))}</div><div class="muted">${esc(doseLine(m))}</div></div>
          <div class="dose-time">${esc(ltr(hhmm(d.at)))}</div>
        </div>
        ${can ? `
          <button class="btn btn-primary btn-big" data-act="take" data-med="${esc(m.id)}" data-at="${d.at}">${icon('check')}${esc(t('took_it'))}</button>
          <button class="btn btn-danger-outline" data-act="skip" data-med="${esc(m.id)}" data-at="${d.at}">${icon('close')}${esc(t('skip_it'))}</button>` : ''}
      </article>`;
  }

  function row(d, isDone = false) {
    const m = d.med;
    const p = store.person(m.personId);
    const status = d.state === 'TAKEN' ? t('status_taken_at', ltr(hhmm(d.log.actedAt)))
      : d.state === 'SKIPPED' ? t('status_skipped') : doseLine(m);
    return `
      <div class="list-row">
        <div class="list-time">${esc(ltr(hhmm(d.at)))}</div>
        <div class="grow"><div class="strong">${esc(medTitle(m))}</div>
          <div class="muted"><span class="dot" style="background:${personColor(p?.color)}"></span>${esc(p?.name || '')} • ${esc(status)}</div></div>
        ${isDone && store.canDose(m.personId) ? `<button class="btn btn-ghost btn-small" data-act="undo" data-med="${esc(m.id)}" data-at="${d.at}">${icon('undo')}${esc(t('undo'))}</button>` : ''}
      </div>`;
  }

  function asNeededCard(m) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const taken = store.logs().filter((l) => l.medicineId === m.id && l.status === 'TAKEN' && l.scheduledAt >= todayStart.getTime())
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
    const can = store.canDose(m.personId);
    return `
      <article class="card dose">
        ${who(m)}
        <div class="dose-name">${esc(medTitle(m))}</div>
        <div class="muted">${esc(doseLine(m))}</div>
        ${taken.map((l) => `<div class="list-row"><div class="grow">${esc(t('status_taken_at', ltr(hhmm(l.scheduledAt))))}</div>
          ${can ? `<button class="btn btn-ghost btn-small" data-act="undo" data-med="${esc(m.id)}" data-at="${l.scheduledAt}">${icon('undo')}${esc(t('undo'))}</button>` : ''}</div>`).join('')}
        ${can ? `<button class="btn btn-secondary" data-act="now" data-med="${esc(m.id)}">${icon('pill')}${esc(t('took_now'))}</button>` : ''}
      </article>`;
  }

  /** While the app is open: one phone notification per dose that just came due. */
  function notifyDue(due) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const seen = notified();
    due.forEach((d) => {
      const key = `${d.med.id}|${d.at}`;
      if (seen.has(key)) return;
      seen.add(key);
      try {
        new Notification(t('notify_title', d.med.name), { body: `${store.person(d.med.personId)?.name || ''} • ${doseLine(d.med).replace(/[⁦-⁩]/g, '')}`, tag: key });
      } catch { /* some browsers only allow notifications from a service worker */ }
    });
    markNotified(seen);
  }

  draw();
  const off = store.onChange(draw);
  const timer = setInterval(draw, 30000);
  return () => { off(); clearInterval(timer); };
}
