// Medicines: list (#/meds), details (#/meds/:id), add (#/meds/new, #/meds/new/:personId),
// edit (#/meds/:id/edit). Only owner/admin/caregiver can add, edit, stop or delete.

import { newReadState, boxReadHtml, bindBoxRead } from './views-boxread.js';
import { t, ltr, normalizeDigits, doseWords } from './i18n.js';
import * as store from './store.js';
import { doseLine, medTitle, howOften, durationWords, suggestTimes, isoDate, addDays, foodWords } from './doses.js';
import { esc, icon, toast, confirmDialog, emptyState, $ } from './ui.js';
import { go } from './router.js';
import { personColor } from './views-family.js';
import { stockLineFor, tagsHtml } from './views-pharmacy.js';

const FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'DROPS', 'INJECTION', 'CREAM', 'SPRAY'];
const AMOUNTS = {
  TABLET: [0.5, 1, 2], CAPSULE: [1, 2], SYRUP: [2.5, 5, 10, 15], DROPS: [1, 2, 3, 5],
  INJECTION: [1], SPRAY: [1, 2], CREAM: [1],
};
const FILTER_KEY = 'fha.medsFilter';

export function render(main, params) {
  const [a, b] = params;
  if (a === 'new') return form(main, null, b || null);
  if (a && b === 'edit') return form(main, store.med(a), null);
  if (a) return details(main, a);
  return list(main);
}

function loadFilter() {
  try { return { q: '', person: '', sort: 'name', stopped: false, ...JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}') }; } catch { return { q: '', person: '', sort: 'name', stopped: false }; }
}

function list(main) {
  const f = loadFilter();
  const draw = () => {
    const people = store.people();
    const all = store.meds().filter((m) => store.person(m.personId));
    const can = store.canWrite();
    const addBtn = can && people.length ? `<a class="btn btn-primary btn-big" href="#/meds/new">${icon('plus')}${esc(t('add_med'))}</a>` : '';
    if (all.length === 0) {
      main.innerHTML = `<section class="page">${emptyState('pill', t('meds_empty_title'), t('meds_empty_body'), addBtn || (can ? `<a class="btn btn-primary btn-big" href="#/family/new">${icon('plus')}${esc(t('add_person'))}</a>` : ''))}</section>`;
      return;
    }
    const q = normalizeDigits(f.q).trim().toLowerCase();
    let shown = all.filter((m) => (f.stopped || !m.stopped) && (!f.person || m.personId === f.person)
      && (!q || `${m.name} ${m.strength} ${store.person(m.personId)?.name}`.toLowerCase().includes(q)));
    if (f.sort === 'person') shown = shown.sort((x, y) => (store.person(x.personId)?.name || '').localeCompare(store.person(y.personId)?.name || '', 'ar'));
    main.innerHTML = `
      <section class="page">
        <h1>${esc(t('tab_meds'))}</h1>
        <div class="filters">
          <input class="input" id="q" type="search" placeholder="${esc(t('search'))}" value="${esc(f.q)}">
          <select class="input" id="person"><option value="">${esc(t('filter_person'))}</option>
            ${people.map((p) => `<option value="${esc(p.id)}" ${f.person === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
          <select class="input" id="sort">
            <option value="name" ${f.sort === 'name' ? 'selected' : ''}>${esc(t('sort_name'))}</option>
            <option value="person" ${f.sort === 'person' ? 'selected' : ''}>${esc(t('sort_person'))}</option></select>
          <label class="check-row small"><input type="checkbox" id="stopped" ${f.stopped ? 'checked' : ''}> <span>${esc(t('show_stopped'))}</span></label>
        </div>
        ${shown.length ? shown.map((m) => {
          const p = store.person(m.personId);
          return `<a class="card row link" href="#/meds/${esc(m.id)}">
            <div class="grow"><div class="strong">${esc(medTitle(m))}</div>
              <div class="muted">${esc(doseLine(m))}</div>
              <div class="muted small"><span class="dot" style="background:${personColor(p?.color)}"></span>${esc(p?.name || '')} • ${esc(m.stopped ? t('med_stopped') : howOften(m))}</div></div>
            <span class="chev">›</span></a>`;
        }).join('') : `<p class="muted">${esc(t('no_results'))}</p>`}
        ${addBtn}
      </section>`;
    const save = () => { try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* ignore */ } };
    $('#q').oninput = (e) => { f.q = e.target.value; save(); const pos = e.target.selectionStart; draw(); const el = $('#q'); el.focus(); el.setSelectionRange(pos, pos); };
    $('#person').onchange = (e) => { f.person = e.target.value; save(); draw(); };
    $('#sort').onchange = (e) => { f.sort = e.target.value; save(); draw(); };
    $('#stopped').onchange = (e) => { f.stopped = e.target.checked; save(); draw(); };
  };
  draw();
  return store.onChange(draw);
}

function details(main, id) {
  const draw = () => {
    const m = store.med(id);
    if (!m) { main.innerHTML = `<section class="page">${emptyState('pill', t('no_results'), '')}</section>`; return; }
    const p = store.person(m.personId);
    const can = store.canWrite();
    main.innerHTML = `
      <section class="page">
        <a class="back" href="#/meds">${esc(t('back'))}</a>
        <div class="card">
          <h1 class="flat">${esc(medTitle(m))}</h1>
          <p class="who"><span class="dot" style="background:${personColor(p?.color)}"></span>${esc(p?.name || '')}</p>
          <p>${esc(doseLine(m))}</p>
          <p>${esc(howOften(m))}</p>
          ${m.scheduleType !== 'AS_NEEDED' ? `<p>${esc(durationWords(m))}</p>` : ''}
          ${m.stopped ? `<p class="warn-text">${esc(t('med_stopped'))}</p>` : ''}
        </div>
        ${store.canSeeStock() ? stockCard(m, can) : ''}
        ${can ? `
          <a class="btn btn-primary btn-big" href="#/meds/${esc(id)}/edit">${icon('edit')}${esc(t('edit_med'))}</a>
          <button class="btn btn-secondary" id="stop">${icon(m.stopped ? 'play' : 'stop')}${esc(t(m.stopped ? 'med_resume' : 'med_stop'))}</button>
          <button class="btn btn-danger-outline" id="del">${icon('trash')}${esc(t('delete'))}</button>` : ''}
      </section>`;
    if (!can) return;
    $('#stop').onclick = async () => {
      if (!m.stopped && !(await confirmDialog(t('med_stop_confirm', medTitle(m)), { okLabel: t('med_stop') }))) return;
      try { await store.saveMed({ ...m, stopped: !m.stopped }); toast(t('saved')); } catch { toast(t('error_generic'), 'error'); }
    };
    $('#del').onclick = async () => {
      if (!(await confirmDialog(t('med_delete_confirm', medTitle(m)), { danger: true, okLabel: t('delete') }))) return;
      try { await store.deleteMed(id); toast(t('deleted')); go('meds'); } catch { toast(t('error_generic'), 'error'); }
    };
  };
  draw();
  return store.onChange(draw);
}

/** What the home pharmacy holds for this medicine, with a way to add it if nothing. */
function stockCard(m, can) {
  const s = stockLineFor(m);
  if (s) {
    return `<a class="card row link" href="#/pharmacy">${icon('pharmacy')}<div class="grow">${esc(s.text)} ${tagsHtml(s.tags)}</div><span class="chev">›</span></a>`;
  }
  return `<div class="card row">${icon('pharmacy')}<div class="grow muted">${esc(t('med_not_in_stock'))}</div></div>
    ${can ? `<a class="btn btn-secondary" href="#/pharmacy/new/${esc(m.id)}">${icon('plus')}${esc(t('add_this_to_stock'))}</a>` : ''}`;
}

function freqOf(m) {
  if (!m) return '2';
  if (m.scheduleType === 'AS_NEEDED') return 'needed';
  if (m.scheduleType === 'EVERY_N_DAYS') return 'every';
  return String(Math.min(Math.max((m.times || []).length, 1), 4));
}

function form(main, existing, presetPerson) {
  if (!store.canWrite()) { go('meds'); return; }
  const people = store.people();
  const todayIso = isoDate(new Date());
  const s = existing ? {
    personId: existing.personId, name: existing.name, strength: existing.strength || '', form: existing.form,
    amount: existing.doseAmount, freq: freqOf(existing), everyN: existing.everyNDays || 3, food: existing.foodTiming || 'NONE',
    times: [...(existing.times || [])], forever: !existing.endDate,
    days: existing.endDate ? Math.round((Date.parse(existing.endDate) - Date.parse(existing.startDate)) / 86400000) + 1 : 7,
    start: existing.startDate,
  } : {
    personId: presetPerson || (people.length === 1 ? people[0].id : ''), name: '', strength: '', form: 'TABLET',
    amount: 1, freq: '2', everyN: 3, food: 'NONE', times: [], forever: true, days: 7, start: todayIso,
  };
  if (!existing) s.times = suggestTimes(2, 'NONE', store.person(s.personId));
  let otherAmount = AMOUNTS[s.form].includes(s.amount) ? '' : String(s.amount);
  const reading = newReadState(); // "read the box" result (new medicines only)

  const perDay = () => (s.freq === 'every' ? 1 : s.freq === 'needed' ? 0 : Number(s.freq));
  const refreshTimes = () => { s.times = perDay() ? suggestTimes(perDay(), s.food, store.person(s.personId)) : []; };

  const draw = () => {
    main.innerHTML = `
      <section class="page">
        <a class="back" href="${existing ? `#/meds/${esc(existing.id)}` : '#/meds'}">${esc(t('back'))}</a>
        <h1>${esc(t(existing ? 'edit_med' : 'add_med'))}</h1>
        ${existing ? '' : boxReadHtml(reading)}
        <form id="mf" class="card form" novalidate>
          <label>${esc(t('med_for'))}<select class="input" name="personId" id="personId">
            <option value="">—</option>
            ${people.map((p) => `<option value="${esc(p.id)}" ${s.personId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
          <p class="form-error" data-for="personId"></p>
          <label>${esc(t('med_name'))}<input class="input" name="name" value="${esc(s.name)}" placeholder="${esc(t('med_name_hint'))}" dir="ltr" maxlength="60" required></label>
          <p class="form-error" data-for="name"></p>
          <label>${esc(t('med_strength'))}<input class="input" name="strength" value="${esc(s.strength)}" placeholder="${esc(t('med_strength_hint'))}" dir="ltr" maxlength="30"></label>

          <fieldset><legend>${esc(t('med_form'))}</legend><div class="chips">
            ${FORMS.map((fm) => `<label class="chip"><input type="radio" name="form" value="${fm}" ${s.form === fm ? 'checked' : ''}><span>${esc(t(`form_${fm}`))}</span></label>`).join('')}</div></fieldset>

          ${s.form !== 'CREAM' ? `<fieldset><legend>${esc(t('med_dose'))}</legend><div class="chips">
            ${AMOUNTS[s.form].map((amt) => `<label class="chip"><input type="radio" name="amount" value="${amt}" ${!otherAmount && s.amount === amt ? 'checked' : ''}><span>${esc(ltr(doseWords(amt, s.form)))}</span></label>`).join('')}
            <label class="chip"><input type="radio" name="amount" value="other" ${otherAmount ? 'checked' : ''}><span>${esc(t('dose_other'))}</span></label></div>
            <input class="input ${otherAmount ? '' : 'hidden'}" id="otherAmount" inputmode="decimal" value="${esc(otherAmount)}" placeholder="0.25" dir="ltr">
            <p class="form-error" data-for="amount"></p></fieldset>` : ''}

          <fieldset><legend>${esc(t('med_how_often'))}</legend><div class="chips">
            ${['1', '2', '3', '4', 'every', 'needed'].map((fq) => `<label class="chip"><input type="radio" name="freq" value="${fq}" ${s.freq === fq ? 'checked' : ''}><span>${esc(t(fq === 'every' ? 'freq_every' : fq === 'needed' ? 'freq_needed' : `freq_${fq}`))}</span></label>`).join('')}</div>
            ${s.freq === 'every' ? `<label>${esc(t('every_n'))}<input class="input" id="everyN" inputmode="numeric" value="${esc(s.everyN)}" dir="ltr"></label><p class="form-error" data-for="everyN"></p>` : ''}
          </fieldset>

          ${s.freq !== 'needed' ? `
            <fieldset><legend>${esc(t('med_food'))}</legend><div class="chips">
              ${['BEFORE', 'AFTER', 'WITH', 'NONE'].map((fd) => `<label class="chip"><input type="radio" name="food" value="${fd}" ${s.food === fd ? 'checked' : ''}><span>${esc(fd === 'NONE' ? t('food_none') : foodWords(fd))}</span></label>`).join('')}</div></fieldset>
            <fieldset><legend>${esc(t('med_times'))}</legend><p class="hint">${esc(t('med_times_help'))}</p>
              <div class="times">${s.times.map((tm, i) => `<input class="input" type="time" data-time="${i}" value="${esc(tm)}">`).join('')}</div></fieldset>
            <fieldset><legend>${esc(t('med_how_long'))}</legend><div class="chips">
              <label class="chip"><input type="radio" name="dur" value="forever" ${s.forever ? 'checked' : ''}><span>${esc(t('forever'))}</span></label>
              <label class="chip"><input type="radio" name="dur" value="days" ${!s.forever ? 'checked' : ''}><span>${esc(t('for_days'))}</span></label></div>
              ${!s.forever ? `<label>${esc(t('days_count'))}<input class="input" id="days" inputmode="numeric" value="${esc(s.days)}" dir="ltr"></label><p class="form-error" data-for="days"></p>` : ''}
              <label>${esc(t('med_start'))}<input class="input" type="date" id="start" value="${esc(s.start)}"></label></fieldset>` : ''}

          <button class="btn btn-primary btn-big">${icon('check')}${esc(t('save'))}</button>
        </form>
      </section>`;
    bind();
  };

  /** Keeps typed values in `s` when the form redraws (changing form/frequency/food redraws it). */
  const capture = () => {
    const fm = $('#mf');
    s.personId = fm.personId.value;
    s.name = fm.name.value;
    s.strength = fm.strength.value;
    const other = $('#otherAmount');
    if (other) otherAmount = other.value;
    if ($('#everyN')) s.everyN = $('#everyN').value;
    if ($('#days')) s.days = $('#days').value;
    if ($('#start')) s.start = $('#start').value;
    main.querySelectorAll('[data-time]').forEach((el) => { s.times[Number(el.dataset.time)] = el.value; });
  };

  const bind = () => {
    const fm = $('#mf');
    $('#personId').onchange = () => { capture(); if (!existing) refreshTimes(); draw(); };
    fm.querySelectorAll('[name=form]').forEach((r) => { r.onchange = () => { capture(); s.form = r.value; s.amount = AMOUNTS[s.form].includes(1) ? 1 : AMOUNTS[s.form][0]; otherAmount = ''; draw(); }; });
    fm.querySelectorAll('[name=amount]').forEach((r) => { r.onchange = () => {
      capture();
      if (r.value === 'other') { otherAmount = otherAmount || ' '; } else { s.amount = Number(r.value); otherAmount = ''; }
      draw();
      if (r.value === 'other') { const o = $('#otherAmount'); o.value = o.value.trim(); o.focus(); }
    }; });
    fm.querySelectorAll('[name=freq]').forEach((r) => { r.onchange = () => { capture(); s.freq = r.value; refreshTimes(); draw(); }; });
    fm.querySelectorAll('[name=food]').forEach((r) => { r.onchange = () => { capture(); s.food = r.value; refreshTimes(); draw(); }; });
    fm.querySelectorAll('[name=dur]').forEach((r) => { r.onchange = () => { capture(); s.forever = r.value === 'forever'; draw(); }; });
    fm.onsubmit = async (ev) => { ev.preventDefault(); capture(); await submit(); };
    if (!existing) bindBoxRead(main, reading, {
      keep: capture,
      draw,
      // Name, strength and form only: dose, times and duration are always the user's
      apply: (res, name) => {
        if (name) s.name = name;
        if (res.strength) s.strength = res.strength;
        if (res.form && FORMS.includes(res.form) && res.form !== s.form) {
          s.form = res.form; s.amount = AMOUNTS[s.form].includes(1) ? 1 : AMOUNTS[s.form][0]; otherAmount = '';
        }
      },
    });
  };

  const submit = async () => {
    main.querySelectorAll('.form-error').forEach((e) => { e.textContent = ''; });
    const errs = {};
    if (!s.personId) errs.personId = t('med_person_required');
    if (!s.name.trim()) errs.name = t('med_name_required');
    let amount = s.form === 'CREAM' ? 1 : s.amount;
    if (s.form !== 'CREAM' && otherAmount.trim()) {
      amount = Number(normalizeDigits(otherAmount).replace(',', '.'));
      if (!(amount > 0 && amount <= 100)) errs.amount = t('dose_invalid');
    }
    const everyN = Number(normalizeDigits(s.everyN));
    if (s.freq === 'every' && !(Number.isInteger(everyN) && everyN >= 2 && everyN <= 90)) errs.everyN = t('every_n_invalid');
    const days = Number(normalizeDigits(s.days));
    if (s.freq !== 'needed' && !s.forever && !(Number.isInteger(days) && days >= 1 && days <= 365)) errs.days = t('days_invalid');
    if (Object.keys(errs).length) {
      Object.entries(errs).forEach(([k, v]) => { const el = main.querySelector(`[data-for=${k}]`); if (el) el.textContent = v; });
      main.querySelector('.form-error:not(:empty)')?.scrollIntoView({ block: 'center' });
      return;
    }
    const start = s.start || todayIso;
    const type = s.freq === 'needed' ? 'AS_NEEDED' : s.freq === 'every' ? 'EVERY_N_DAYS' : 'DAILY';
    try {
      const saved = await store.saveMed({
        ...existing,
        personId: s.personId, name: s.name.trim(), strength: s.strength.trim(), form: s.form, doseAmount: amount,
        scheduleType: type, times: type === 'AS_NEEDED' ? [] : [...new Set(s.times.filter(Boolean))].sort(),
        everyNDays: type === 'EVERY_N_DAYS' ? everyN : null, foodTiming: type === 'AS_NEEDED' ? 'NONE' : s.food,
        startDate: start, endDate: type === 'AS_NEEDED' || s.forever ? null : addDays(start, days - 1),
        stopped: existing?.stopped || false,
      });
      toast(t('saved'));
      go(`meds/${saved.id}`);
    } catch (e) {
      toast(t(e?.code === 'not_allowed' ? 'not_allowed' : 'error_generic'), 'error');
    }
  };

  draw();
}
