// Appointments: list (#/appts), add (#/appts/new, #/appts/new/:personId), details (#/appts/:id),
// edit (#/appts/:id/edit). Owner/admin/caregiver write; a patient sees only their own (RLS).
// Reminders: Today shows appointments for today and tomorrow, and "add to the phone's calendar"
// gives a real reminder even with the app closed (an .ics file with two alarms).

import { t, ltr, countWords, dateLong } from './i18n.js';
import * as store from './store.js';
import { isoDate, hhmm, parseDate } from './doses.js';
import { esc, icon, toast, confirmDialog, emptyState, download, $ } from './ui.js';
import { go } from './router.js';
import { personColor } from './views-family.js';

/** After this long past its time an appointment counts as past. */
const PAST_AFTER_MS = 2 * 3600000;

export const isPast = (a, nowMs = Date.now()) => a.at + PAST_AFTER_MS < nowMs;

/** "اليوم" / "غدًا" / "بعد 3 أيام" / "" (past or far away: the date says it). */
export function whenWords(at, nowMs = Date.now()) {
  const day = (ms) => { const d = new Date(ms); d.setHours(12, 0, 0, 0); return d.getTime(); };
  const days = Math.round((day(at) - day(nowMs)) / 86400000);
  if (days === 0) return t('day_today');
  if (days === 1) return t('day_tomorrow');
  if (days > 1 && days <= 14) return t('appt_in', countWords(days, 'DAY'));
  return '';
}

/** One appointment as a list row (used here, on Today and on a person's page). */
export function apptRow(a, { showPerson = true } = {}) {
  const p = store.person(a.personId);
  const soon = whenWords(a.at);
  const past = isPast(a);
  return `
    <a class="list-row link" href="#/appts/${esc(a.id)}">
      <div class="appt-date ${past ? 'muted' : ''}"><div class="strong">${esc(ltr(hhmm(a.at)))}</div>${soon && !past ? `<div class="tag tag-green">${esc(soon)}</div>` : ''}</div>
      <div class="grow"><div class="strong">${esc(a.name)}</div>
        <div class="muted">${showPerson ? `<span class="dot" style="background:${personColor(p?.color)}"></span>${esc(p?.name || '')} • ` : ''}${esc(dateLong(a.at))}</div></div>
      <span class="chev" aria-hidden="true">›</span></a>`;
}

export function render(main, params) {
  const [id, sub] = params;
  if (id === 'new') return form(main, null, sub);
  if (id && sub === 'edit') return form(main, store.appt(id));
  if (id) return details(main, id);
  return list(main);
}

function list(main) {
  const draw = () => {
    const all = store.appts().filter((a) => store.person(a.personId));
    const upcoming = all.filter((a) => !isPast(a));
    const past = all.filter((a) => isPast(a)).reverse().slice(0, 20);
    const can = store.canWrite();
    const addBtn = can ? `<a class="btn btn-primary btn-big" href="#/appts/new">${icon('plus')}${esc(t('add_appt'))}</a>` : '';
    if (all.length === 0) {
      main.innerHTML = `<section class="page"><a class="back" href="#/family">${esc(t('back'))}</a>
        ${emptyState('today', t('appts_empty_title'), t('appts_empty_body'), addBtn)}</section>`;
      return;
    }
    main.innerHTML = `
      <section class="page">
        <a class="back" href="#/family">${esc(t('back'))}</a>
        <h1>${esc(t('appts_title'))}</h1>
        ${addBtn}
        <h2>${esc(t('appts_upcoming'))}</h2>
        ${upcoming.length ? `<div class="card list">${upcoming.map((a) => apptRow(a)).join('')}</div>` : `<p class="muted">${esc(t('no_appts'))}</p>`}
        ${past.length ? `<h2>${esc(t('appts_past'))}</h2><div class="card list">${past.map((a) => apptRow(a)).join('')}</div>` : ''}
      </section>`;
  };
  draw();
  return store.onChange(draw);
}

function details(main, id) {
  const draw = () => {
    const a = store.appt(id);
    if (!a) { main.innerHTML = `<section class="page"><a class="back" href="#/appts">${esc(t('back'))}</a>${emptyState('today', t('no_results'), '')}</section>`; return; }
    const p = store.person(a.personId);
    const can = store.canWrite();
    const past = isPast(a);
    const soon = whenWords(a.at);
    main.innerHTML = `
      <section class="page">
        <a class="back" href="#/appts">${esc(t('back'))}</a>
        <div class="card">
          <div class="who"><span class="dot" style="background:${personColor(p?.color)}"></span>${esc(p?.name || '')}</div>
          <h1 class="flat">${esc(a.name)}</h1>
          <div class="appt-when">${esc(dateLong(a.at))} • ${esc(ltr(hhmm(a.at)))}
            ${past ? `<span class="tag tag-muted">${esc(t('appt_done'))}</span>` : soon ? `<span class="tag tag-green">${esc(soon)}</span>` : ''}</div>
          ${a.place ? `<p><span class="muted">${esc(t('appt_place'))}:</span> ${esc(a.place)}</p>` : ''}
          ${a.note ? `<p class="prose"><span class="muted">${esc(t('appt_note'))}:</span> ${esc(a.note)}</p>` : ''}
        </div>
        ${!past ? `<button class="btn btn-secondary" id="ics">${icon('today')}${esc(t('appt_calendar'))}</button>
          <p class="hint">${esc(t('appt_calendar_hint'))}</p>` : ''}
        ${can ? `<div class="btn-row">
          <a class="btn btn-secondary" href="#/appts/${esc(id)}/edit">${icon('edit')}${esc(t('edit_appt'))}</a>
          <button class="btn btn-danger-outline" id="del">${icon('trash')}${esc(t('delete'))}</button></div>` : ''}
      </section>`;
    const ics = $('#ics');
    if (ics) ics.onclick = () => download(`appointment-${isoDate(new Date(a.at))}.ics`, icsFor(a, p), 'text/calendar');
    const del = $('#del');
    if (del) del.onclick = async () => {
      if (!(await confirmDialog(t('appt_delete_confirm'), { danger: true, okLabel: t('delete') }))) return;
      try { await store.deleteAppt(id); toast(t('deleted')); go('appts'); } catch (e) { toast(t(e?.code === 'not_allowed' ? 'not_allowed' : 'error_generic'), 'error'); }
    };
  };
  draw();
  return store.onChange(draw);
}

function form(main, existing, presetPerson) {
  if (!store.canWrite()) { go(existing ? `appts/${existing.id}` : 'appts'); return; }
  const people = store.people();
  if (!people.length) { go('family/new'); return; }
  const a = existing || { personId: presetPerson || (people.length === 1 ? people[0].id : ''), name: '', at: null, place: '', note: '' };
  const back = existing ? `#/appts/${esc(existing.id)}` : presetPerson ? `#/family/${esc(presetPerson)}` : '#/appts';
  main.innerHTML = `
    <section class="page">
      <a class="back" href="${back}">${esc(t('back'))}</a>
      <h1>${esc(existing ? t('edit_appt') : t('new_appt'))}</h1>
      <form id="af" class="card form" novalidate>
        <label>${esc(t('appt_for'))}<select class="input" name="personId">
          <option value="">—</option>
          ${people.map((p) => `<option value="${esc(p.id)}" ${a.personId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <p class="form-error" data-for="personId"></p>
        <label>${esc(t('appt_name'))}<input class="input" name="name" value="${esc(a.name)}" placeholder="${esc(t('appt_name_hint'))}" maxlength="80"></label>
        <p class="form-error" data-for="name"></p>
        <div class="grid2">
          <label>${esc(t('appt_date'))}<input class="input" type="date" name="date" value="${a.at ? isoDate(new Date(a.at)) : ''}"></label>
          <label>${esc(t('appt_time'))}<input class="input" type="time" name="time" value="${a.at ? hhmm(a.at) : ''}"></label>
        </div>
        <p class="form-error" data-for="when"></p>
        <label>${esc(t('appt_place'))}<input class="input" name="place" value="${esc(a.place || '')}" placeholder="${esc(t('appt_place_hint'))}" maxlength="120"></label>
        <label>${esc(t('appt_note'))}<textarea class="input" name="note" rows="3" maxlength="500" placeholder="${esc(t('appt_note_hint'))}">${esc(a.note || '')}</textarea></label>
        <button class="btn btn-primary btn-big">${icon('check')}${esc(t('save'))}</button>
      </form>
    </section>`;

  $('#af').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    main.querySelectorAll('.form-error').forEach((e) => { e.textContent = ''; });
    const errs = {};
    if (!f.personId) errs.personId = t('appt_person_required');
    if (!f.name.trim()) errs.name = t('appt_name_required');
    const d = parseDate(f.date);
    if (!d || !/^\d{2}:\d{2}$/.test(f.time)) errs.when = t('appt_when_required');
    if (Object.keys(errs).length) {
      Object.entries(errs).forEach(([k, v]) => { main.querySelector(`[data-for=${k}]`).textContent = v; });
      return;
    }
    const [h, m] = f.time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    try {
      const saved = await store.saveAppt({ ...existing, personId: f.personId, name: f.name.trim(), at: d.getTime(), place: f.place.trim(), note: f.note.trim() });
      toast(t('saved'));
      go(`appts/${saved.id}`);
    } catch (e) {
      toast(t(e?.code === 'not_allowed' ? 'not_allowed' : 'error_generic'), 'error');
    }
  };
}

/** Calendar file with alarms a day before and 2 hours before (local time, no time zone). */
function icsFor(a, p) {
  const two = (n) => String(n).padStart(2, '0');
  const stamp = (ms) => { const d = new Date(ms); return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}T${two(d.getHours())}${two(d.getMinutes())}00`; };
  const text = (s) => String(s || '').replace(/[⁦-⁩]/g, '').replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
  const summary = t('appt_calendar_title', p?.name || '', a.name);
  const alarm = (trigger) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(summary)}`, `TRIGGER:${trigger}`, 'END:VALARM'];
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//family-health-assistant//EN', 'BEGIN:VEVENT',
    `UID:${a.id}@family-health-assistant`, `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(a.at)}`, `DTEND:${stamp(a.at + 3600000)}`,
    `SUMMARY:${text(summary)}`,
    a.place ? `LOCATION:${text(a.place)}` : '',
    a.note ? `DESCRIPTION:${text(a.note)}` : '',
    ...alarm('-P1D'), ...alarm('-PT2H'),
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}
