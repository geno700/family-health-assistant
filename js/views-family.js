// Family: people list (#/family), a person's page (#/family/:id), add/edit (#/family/new,
// #/family/:id/edit). Only owner/admin/caregiver can add, edit or delete.

import { t, ltr, normalizeDigits } from './i18n.js';
import * as store from './store.js';
import { doseLine, medTitle, howOften } from './doses.js';
import { esc, icon, toast, confirmDialog, emptyState, $ } from './ui.js';
import { go } from './router.js';

const COLORS = ['#2E7D6B', '#3B6EA5', '#8E5BA8', '#B0683A', '#5C7A2E', '#A2496A'];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const personColor = (i) => COLORS[((Number(i) || 0) % COLORS.length + COLORS.length) % COLORS.length];

export function age(birthYear) {
  const y = Number(birthYear);
  const a = new Date().getFullYear() - y;
  return y && a >= 0 && a <= 130 ? a : null;
}

export function render(main, params) {
  const [id, sub] = params;
  if (id === 'new') return form(main, null);
  if (id && sub === 'edit') return form(main, store.person(id));
  if (id) return page(main, id);
  return list(main);
}

function list(main) {
  const draw = () => {
    const people = store.people();
    const can = store.canWrite();
    const addBtn = can ? `<a class="btn btn-primary btn-big" href="#/family/new">${icon('plus')}${esc(t('add_person'))}</a>` : '';
    if (people.length === 0) {
      main.innerHTML = `<section class="page">${emptyState('family', t('family_empty_title'), t('family_empty_body'), addBtn)}</section>`;
      return;
    }
    main.innerHTML = `
      <section class="page">
        <h1>${esc(t('tab_family'))}</h1>
        ${people.map((p) => {
          const facts = [age(p.birthYear) != null ? t('age_years', age(p.birthYear)) : '', p.bloodType ? t('blood', ltr(p.bloodType)) : ''].filter(Boolean).join(' • ');
          return `<a class="card row link" href="#/family/${esc(p.id)}">
            <span class="avatar" style="background:${personColor(p.color)}">${esc((p.name || '?').trim().charAt(0))}</span>
            <div class="grow"><div class="strong">${esc(p.name)}</div>${facts ? `<div class="muted">${esc(facts)}</div>` : ''}</div>
            <span class="chev" aria-hidden="true">›</span></a>`;
        }).join('')}
        ${addBtn}
      </section>`;
  };
  draw();
  return store.onChange(draw);
}

function page(main, id) {
  const draw = () => {
    const p = store.person(id);
    if (!p) { main.innerHTML = `<section class="page">${emptyState('family', t('no_results'), '')}</section>`; return; }
    const can = store.canWrite();
    const meds = store.meds().filter((m) => m.personId === id);
    main.innerHTML = `
      <section class="page">
        <a class="back" href="#/family">${esc(t('back'))}</a>
        <div class="card">
          <div class="row"><span class="avatar big" style="background:${personColor(p.color)}">${esc((p.name || '?').charAt(0))}</span>
            <div class="grow"><h1 class="flat">${esc(p.name)}</h1>
              <div class="muted">${esc([age(p.birthYear) != null ? t('age_years', age(p.birthYear)) : '', p.bloodType ? t('blood', ltr(p.bloodType)) : ''].filter(Boolean).join(' • '))}</div></div></div>
          ${(p.allergies || []).length ? `<p class="danger-text">${esc(t('allergy_line', p.allergies.map(ltr).join('، ')))}</p>` : ''}
          ${(p.conditions || []).length ? `<p>${esc(t('conditions_line', p.conditions.join('، ')))}</p>` : ''}
          ${p.contactPhone ? `<p><a class="btn btn-secondary" href="tel:${esc(p.contactPhone)}">${esc(p.contactName || '')} ${esc(ltr(p.contactPhone))}</a></p>` : ''}
          ${can ? `<div class="btn-row">
            <a class="btn btn-secondary" href="#/family/${esc(id)}/edit">${icon('edit')}${esc(t('edit_person'))}</a>
            <button class="btn btn-danger-outline" id="del">${icon('trash')}${esc(t('delete'))}</button></div>` : ''}
        </div>
        <h2>${esc(t('person_meds'))}</h2>
        ${meds.length ? `<div class="card list">${meds.map((m) => `
          <a class="list-row link" href="#/meds/${esc(m.id)}"><div class="grow"><div class="strong">${esc(medTitle(m))}</div>
            <div class="muted">${esc(m.stopped ? t('med_stopped') : `${doseLine(m)} • ${howOften(m)}`)}</div></div><span class="chev">›</span></a>`).join('')}</div>`
          : `<p class="muted">${esc(t('meds_empty_body'))}</p>`}
        ${can ? `<a class="btn btn-primary btn-big" href="#/meds/new/${esc(id)}">${icon('plus')}${esc(t('add_med'))}</a>` : ''}
      </section>`;
    const del = $('#del');
    if (del) del.onclick = async () => {
      if (!(await confirmDialog(t('person_delete_confirm', p.name), { danger: true, okLabel: t('delete') }))) return;
      try { await store.deletePerson(id); toast(t('deleted')); go('family'); } catch { toast(t('error_generic'), 'error'); }
    };
  };
  draw();
  return store.onChange(draw);
}

function form(main, existing) {
  if (!store.canWrite()) { go('family'); return; }
  const p = existing || { name: '', birthYear: '', bloodType: '', allergies: [], conditions: [], contactName: '', contactPhone: '', breakfast: '08:00', lunch: '14:00', dinner: '20:00', color: nextColor() };
  main.innerHTML = `
    <section class="page">
      <a class="back" href="${existing ? `#/family/${esc(existing.id)}` : '#/family'}">${esc(t('back'))}</a>
      <h1>${esc(existing ? t('edit_person') : t('new_person'))}</h1>
      <form id="pf" class="card form" novalidate>
        <label>${esc(t('person_name'))}<input class="input" name="name" value="${esc(p.name)}" placeholder="${esc(t('person_name_hint'))}" maxlength="40" required></label>
        <p class="form-error" data-for="name"></p>
        <label>${esc(t('birth_year'))}<input class="input" name="birthYear" value="${esc(p.birthYear || '')}" inputmode="numeric" placeholder="1965" maxlength="4" dir="ltr"></label>
        <p class="form-error" data-for="birthYear"></p>
        <label>${esc(t('blood_type'))}<select class="input" name="bloodType">
          <option value="">${esc(t('unknown'))}</option>
          ${BLOOD.map((b) => `<option value="${b}" ${p.bloodType === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
        <label>${esc(t('allergies'))}<input class="input" name="allergies" value="${esc((p.allergies || []).join('، '))}" placeholder="${esc(t('allergies_hint'))}"></label>
        <label>${esc(t('conditions'))}<input class="input" name="conditions" value="${esc((p.conditions || []).join('، '))}" placeholder="${esc(t('conditions_hint'))}"></label>
        <label>${esc(t('contact_name'))}<input class="input" name="contactName" value="${esc(p.contactName || '')}" maxlength="40"></label>
        <label>${esc(t('contact_phone'))}<input class="input" name="contactPhone" value="${esc(p.contactPhone || '')}" inputmode="tel" placeholder="01xxxxxxxxx" dir="ltr"></label>
        <p class="form-error" data-for="contactPhone"></p>
        <fieldset><legend>${esc(t('meals'))}</legend><p class="hint">${esc(t('meals_help'))}</p>
          <div class="grid3">
            <label>${esc(t('breakfast'))}<input class="input" type="time" name="breakfast" value="${esc(p.breakfast || '08:00')}"></label>
            <label>${esc(t('lunch'))}<input class="input" type="time" name="lunch" value="${esc(p.lunch || '14:00')}"></label>
            <label>${esc(t('dinner'))}<input class="input" type="time" name="dinner" value="${esc(p.dinner || '20:00')}"></label>
          </div></fieldset>
        <div class="swatches" role="radiogroup">
          ${COLORS.map((c, i) => `<label class="swatch" style="background:${c}"><input type="radio" name="color" value="${i}" ${Number(p.color) === i ? 'checked' : ''}><span class="sr-only">${i + 1}</span></label>`).join('')}
        </div>
        <button class="btn btn-primary btn-big">${icon('check')}${esc(t('save'))}</button>
      </form>
    </section>`;

  $('#pf').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    main.querySelectorAll('.form-error').forEach((e) => { e.textContent = ''; });
    const errs = {};
    const name = f.name.trim();
    if (!name) errs.name = t('person_name_required');
    const year = normalizeDigits(f.birthYear).trim();
    if (year && !(/^\d{4}$/.test(year) && +year >= 1900 && +year <= new Date().getFullYear())) errs.birthYear = t('birth_year_invalid');
    const phone = normalizeDigits(f.contactPhone).replace(/\D/g, '');
    if (phone && !(phone.startsWith('01') ? phone.length === 11 : phone.startsWith('0') && phone.length >= 9 && phone.length <= 10)) errs.contactPhone = t('phone_invalid');
    if (Object.keys(errs).length) {
      Object.entries(errs).forEach(([k, v]) => { main.querySelector(`[data-for=${k}]`).textContent = v; });
      return;
    }
    const split = (s) => [...new Set(String(s).split(/[,،]/).map((x) => x.trim()).filter(Boolean))];
    try {
      const saved = await store.savePerson({
        ...existing, name, birthYear: year ? Number(year) : null, bloodType: f.bloodType,
        allergies: split(f.allergies), conditions: split(f.conditions),
        contactName: f.contactName.trim(), contactPhone: phone,
        breakfast: f.breakfast, lunch: f.lunch, dinner: f.dinner, color: Number(f.color ?? p.color),
      });
      toast(t('saved'));
      go(`family/${saved.id}`);
    } catch (e) {
      toast(t(e?.code === 'not_allowed' ? 'not_allowed' : 'error_generic'), 'error');
    }
  };
}

function nextColor() {
  const used = new Set(store.people().map((p) => Number(p.color)));
  const free = COLORS.findIndex((_, i) => !used.has(i));
  return free >= 0 ? free : store.people().length % COLORS.length;
}
