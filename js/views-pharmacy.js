// Home pharmacy: search "is it at home?" (#/pharmacy), one box (#/pharmacy/:id), add
// (#/pharmacy/new, #/pharmacy/new/:medicineId fills in that medicine), edit (#/pharmacy/:id/edit).
// Owner/admin/caregiver change boxes; a viewer reads; a patient doesn't see the pharmacy.

import { newReadState, boxReadHtml, bindBoxRead } from './views-boxread.js';
import { t, ltr, normalizeDigits, countWords, unitPlural, monthYear, joinList } from './i18n.js';
import * as store from './store.js';
import { pharmacy, search, needsBuying, isCounted, sameMedicine } from './stock.js';
import { esc, icon, toast, confirmDialog, formDialog, emptyState, copyText, $ } from './ui.js';
import { go } from './router.js';

const FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'DROPS', 'INJECTION', 'CREAM', 'SPRAY'];
const FILTER_KEY = 'fha.pharmacyFilter';
const PREFILL_KEY = 'fha.stockPrefill';

export function render(main, params) {
  if (!store.canSeeStock()) { go('today'); return null; }
  const [a, b] = params;
  if (a === 'new') return form(main, null, b || null);
  if (a && b === 'edit') return form(main, store.stockBox(a), null);
  if (a) return details(main, a);
  return list(main);
}

/** Groups for the whole household, worked out now. */
export function groupsNow() {
  return pharmacy(store.stockBoxes(), store.meds(), store.logs(), Date.now());
}

/** "45 قرصًا" / "2 packs": what is left, in the group's own unit. */
export function amountWords(n, form) {
  return countWords(n, isCounted(form) ? form : 'PACK');
}

function title(x) {
  return ltr([x.name, x.strength].filter(Boolean).join(' '));
}

function tagsHtml(tags) {
  return [...tags].map((tag) => `<span class="tag ${tag === 'out' || tag === 'expired' ? 'tag-red' : 'tag-amber'}">${esc(t(`tag_${tag}`))}</span>`).join(' ');
}

function usersLine(g) {
  if (!g.users.length) return t('stock_not_used');
  return t('stock_used_by', joinList(g.users.map((id) => store.person(id)?.name).filter(Boolean)));
}

/** One medicine with its boxes. */
function groupCard(g) {
  const lasts = g.days !== null ? ` • ${t('stock_lasts', countWords(g.days, 'DAY'))}` : '';
  return `
    <article class="card">
      <div class="row-between"><h2 class="flat">${esc(title(g))}</h2><div>${tagsHtml(g.tags)}</div></div>
      <div><strong>${esc(t('stock_left', amountWords(g.usable, g.form)))}</strong>${esc(lasts)}</div>
      <div class="muted small">${esc(usersLine(g))}</div>
      <div class="list">${g.boxes.map((b) => `
        <a class="list-row link" href="#/pharmacy/${esc(b.id)}">
          <div class="grow"><div>${esc(amountWords(b.left, b.form))}</div>
            <div class="muted small">${esc(b.expiry ? t('stock_expires', ltr(monthYear(b.expiry))) : t('stock_no_expiry'))}${b.note ? ` • ${esc(b.note)}` : ''}</div></div>
          ${b.expiryState ? `<span class="tag ${b.expiryState === 'expired' ? 'tag-red' : 'tag-amber'}">${esc(t(`tag_${b.expiryState}`))}</span>` : ''}
          <span class="chev">›</span>
        </a>`).join('')}</div>
    </article>`;
}

function loadFilter() {
  // Only the filter chip is remembered; the search box starts empty each time
  try { return { show: 'all', ...JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}'), q: '' }; } catch { return { q: '', show: 'all' }; }
}

function list(main) {
  const f = loadFilter();
  const draw = () => {
    const can = store.canWrite();
    const all = groupsNow();
    const addBtn = can ? `<a class="btn btn-primary btn-big" href="#/pharmacy/new" id="add">${icon('plus')}${esc(t('add_stock'))}</a>` : '';
    if (all.length === 0) {
      main.innerHTML = `<section class="page"><h1>${esc(t('pharmacy_title'))}</h1>${emptyState('pharmacy', t('pharmacy_empty_title'), t('pharmacy_intro'), addBtn)}</section>`;
      return;
    }
    const found = search(all, normalizeDigits(f.q));
    const byFilter = (g) => f.show === 'all' || (f.show === 'low' ? g.tags.has('low') || g.tags.has('out') : g.tags.has(f.show));
    const shown = found.filter(byFilter);
    const q = f.q.trim();
    main.innerHTML = `
      <section class="page">
        <h1>${esc(t('pharmacy_title'))}</h1>
        <label for="q" class="search-q">${esc(t('pharmacy_search'))}</label>
        <div class="search-big">${icon('search')}
          <input class="input" id="q" type="search" autocomplete="off" value="${esc(f.q)}" placeholder="${esc(t('pharmacy_search_hint'))}"></div>
        ${q ? (found.length
          ? `<div class="card answer answer-yes">${icon('check')}<strong>${esc(t('pharmacy_found'))}</strong></div>`
          : `<div class="card answer answer-no">${icon('close')}<div><strong>${esc(t('pharmacy_not_found'))}</strong>
               <div class="muted small">${esc(t('pharmacy_not_found_hint'))}</div></div></div>
             ${can ? `<button class="btn btn-secondary" id="addTyped">${icon('plus')}${esc(t('add_this_to_stock'))}</button>` : ''}`) : ''}
        <div class="chips" role="radiogroup">
          ${['all', 'low', 'expiring', 'expired'].map((k) => `<label class="chip"><input type="radio" name="show" value="${k}" ${f.show === k ? 'checked' : ''}><span>${esc(t(k === 'all' ? 'all' : `filter_${k}`))}</span></label>`).join('')}
        </div>
        ${shown.length ? shown.map(groupCard).join('') : (q && !found.length ? '' : `<p class="muted">${esc(t('no_results'))}</p>`)}
        ${addBtn}
        <button class="btn btn-secondary" id="shop">${icon('share')}${esc(t('shopping_share'))}</button>
        <p class="hint">${esc(t('stock_auto_note'))}</p>
        <p class="hint">${esc(t('pharmacy_ask_note'))}</p>
      </section>`;
    const save = () => { try { sessionStorage.setItem(FILTER_KEY, JSON.stringify({ show: f.show })); } catch { /* ignore */ } };
    $('#q').oninput = (e) => { f.q = e.target.value; save(); const pos = e.target.selectionStart; draw(); const el = $('#q'); el.focus(); el.setSelectionRange(pos, pos); };
    main.querySelectorAll('input[name=show]').forEach((r) => { r.onchange = () => { f.show = r.value; save(); draw(); }; });
    if ($('#addTyped')) $('#addTyped').onclick = () => {
      try { sessionStorage.setItem(PREFILL_KEY, f.q.trim()); } catch { /* ignore */ }
      go('pharmacy/new');
    };
    $('#shop').onclick = () => shareShopping(all);
  };
  draw();
  return store.onChange(draw);
}

async function shareShopping(groups) {
  const need = needsBuying(groups);
  if (!need.length) { toast(t('shopping_empty')); return; }
  const text = [t('shopping_title'), ...need.map((g) => `- ${[g.name, g.strength].filter(Boolean).join(' ')}`)].join('\n');
  if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* cancelled */ } }
  if (await copyText(text)) toast(t('key_copied'));
}

function details(main, id) {
  const draw = () => {
    const box = store.stockBox(id);
    if (!box) { main.innerHTML = `<section class="page"><a class="back" href="#/pharmacy">${esc(t('back'))}</a>${emptyState('pharmacy', t('no_results'), '')}</section>`; return; }
    const g = groupsNow().find((x) => x.boxes.some((b) => b.id === id));
    const b = g.boxes.find((x) => x.id === id);
    const can = store.canWrite();
    main.innerHTML = `
      <section class="page">
        <a class="back" href="#/pharmacy">${esc(t('back'))}</a>
        <div class="card">
          <h1 class="flat">${esc(title(box))}</h1>
          <p class="muted">${esc(t(`form_${box.form}`))}</p>
          <p><strong>${esc(t('stock_left', amountWords(b.left, box.form)))}</strong></p>
          <p>${esc(box.expiry ? t('stock_expires', ltr(monthYear(box.expiry))) : t('stock_no_expiry'))}
            ${b.expiryState ? `<span class="tag ${b.expiryState === 'expired' ? 'tag-red' : 'tag-amber'}">${esc(t(`tag_${b.expiryState}`))}</span>` : ''}</p>
          ${box.note ? `<p>${esc(box.note)}</p>` : ''}
          <p class="muted">${esc(usersLine(g))}</p>
        </div>
        ${isCounted(box.form) ? `<p class="hint">${esc(t('stock_auto_note'))}</p>` : ''}
        ${can ? `
          <button class="btn btn-primary btn-big" id="count">${icon('edit')}${esc(t('stock_update_count'))}</button>
          <a class="btn btn-secondary" href="#/pharmacy/${esc(id)}/edit">${icon('edit')}${esc(t('edit_stock'))}</a>
          <button class="btn btn-danger-outline" id="del">${icon('trash')}${esc(t('stock_delete'))}</button>` : ''}
      </section>`;
    if (!can) return;
    $('#count').onclick = async () => {
      const v = await formDialog(`<label>${esc(t('stock_new_count'))}
        <input class="input" name="count" inputmode="decimal" dir="ltr" required value="${esc(String(b.left))}"></label>
        <p class="hint">${esc(amountWords(b.left, box.form))}</p>`);
      if (!v) return;
      const n = Number(normalizeDigits(v.count).trim());
      if (!Number.isFinite(n) || n < 0 || n > 100000) { toast(t('stock_count_invalid'), 'error'); return; }
      try { await store.saveStock({ ...box, count: n, countedAt: Date.now() }); toast(t('saved')); } catch { toast(t('error_generic'), 'error'); }
    };
    $('#del').onclick = async () => {
      if (!(await confirmDialog(t('stock_delete_confirm', title(box)), { danger: true, okLabel: t('stock_delete') }))) return;
      try { await store.deleteStock(id); toast(t('deleted')); go('pharmacy'); } catch { toast(t('error_generic'), 'error'); }
    };
  };
  draw();
  return store.onChange(draw);
}

function form(main, existing, fromMedId) {
  if (!store.canWrite()) { go('pharmacy'); return null; }
  let typed = '';
  try { typed = sessionStorage.getItem(PREFILL_KEY) || ''; sessionStorage.removeItem(PREFILL_KEY); } catch { /* ignore */ }
  const fromMed = fromMedId ? store.med(fromMedId) : null;
  // The count field shows what is left now; saving a different number re-counts the box today
  const leftNow = existing ? (groupsNow().flatMap((g) => g.boxes).find((b) => b.id === existing.id)?.left ?? existing.count) : '';
  const s = existing
    ? { name: existing.name, strength: existing.strength || '', form: existing.form, count: String(leftNow), expiry: existing.expiry || '', note: existing.note || '' }
    : { name: fromMed?.name || typed, strength: fromMed?.strength || '', form: fromMed?.form || 'TABLET', count: '', expiry: '', note: '' };
  const reading = { ...newReadState(), useCount: true, useExpiry: true }; // "read the box" (new boxes only)

  const draw = () => {
    main.innerHTML = `
      <section class="page">
        <a class="back" href="${existing ? `#/pharmacy/${esc(existing.id)}` : '#/pharmacy'}">${esc(t('back'))}</a>
        <h1>${esc(t(existing ? 'edit_stock' : 'add_stock'))}</h1>
        ${existing ? '' : boxReadHtml(reading)}
        <form id="sf" class="card form" novalidate>
          <label>${esc(t('med_name'))}<input class="input" name="name" value="${esc(s.name)}" placeholder="${esc(t('med_name_hint'))}" dir="ltr" maxlength="60" required></label>
          <p class="form-error" data-for="name"></p>
          <label>${esc(t('med_strength'))}<input class="input" name="strength" value="${esc(s.strength)}" placeholder="${esc(t('med_strength_hint'))}" dir="ltr" maxlength="30"></label>
          <fieldset><legend>${esc(t('med_form'))}</legend><div class="chips">
            ${FORMS.map((fm) => `<label class="chip"><input type="radio" name="form" value="${fm}" ${s.form === fm ? 'checked' : ''}><span>${esc(t(`form_${fm}`))}</span></label>`).join('')}</div></fieldset>
          <label>${esc(isCounted(s.form) ? t('stock_count_units', unitPlural(s.form)) : t('stock_count_packs'))}
            <input class="input" name="count" inputmode="decimal" dir="ltr" value="${esc(s.count)}" required></label>
          <p class="form-error" data-for="count"></p>
          <label>${esc(t('stock_expiry'))}<input class="input" type="month" name="expiry" value="${esc(s.expiry)}" dir="ltr"></label>
          <label>${esc(t('stock_note'))}<input class="input" name="note" value="${esc(s.note)}" maxlength="80"></label>
          <button class="btn btn-primary btn-big">${icon('check')}${esc(t('save'))}</button>
        </form>
      </section>`;
    const fm = $('#sf');
    const keep = () => {
      const d = new FormData(fm);
      Object.assign(s, { name: d.get('name'), strength: d.get('strength'), form: d.get('form') || s.form, count: d.get('count'), expiry: d.get('expiry'), note: d.get('note') });
    };
    fm.querySelectorAll('input[name=form]').forEach((r) => { r.onchange = () => { keep(); draw(); }; });
    if (!existing) bindBoxRead(main, reading, {
      keep,
      draw,
      apply: (res, name) => {
        if (name) s.name = name;
        if (res.strength) s.strength = res.strength;
        if (res.form && FORMS.includes(res.form)) s.form = res.form;
        if (res.count != null && isCounted(res.form || s.form)) s.count = String(res.count);
        if (res.expiry) s.expiry = res.expiry;
      },
    });
    fm.onsubmit = async (ev) => {
      ev.preventDefault();
      keep();
      fm.querySelectorAll('.form-error').forEach((e) => { e.textContent = ''; });
      const name = String(s.name || '').trim();
      const n = Number(normalizeDigits(s.count).trim());
      let bad = false;
      if (!name) { fm.querySelector('[data-for=name]').textContent = t('med_name_required'); bad = true; }
      if (String(s.count).trim() === '' || !Number.isFinite(n) || n < 0 || n > 100000) { fm.querySelector('[data-for=count]').textContent = t('stock_count_invalid'); bad = true; }
      if (bad) return;
      const recount = !existing || n !== Number(leftNow);
      const box = {
        ...(existing || {}), name, strength: String(s.strength || '').trim(), form: s.form, expiry: s.expiry || '', note: String(s.note || '').trim(),
        count: recount ? n : existing.count, countedAt: recount ? Date.now() : existing.countedAt,
      };
      try {
        const saved = await store.saveStock(box);
        toast(t('saved'));
        go(`pharmacy/${saved.id}`);
      } catch (e) {
        toast(t(e?.code === 'not_allowed' ? 'not_allowed' : 'error_generic'), 'error');
      }
    };
  };
  draw();
  return null;
}

/** Text for a medicine's details page: what the pharmacy holds for it. */
export function stockLineFor(med) {
  const g = groupsNow().find((x) => sameMedicine(x, med));
  if (!g) return null;
  const lasts = g.days !== null ? ` • ${t('stock_lasts', countWords(g.days, 'DAY'))}` : '';
  return { text: t('med_in_stock', amountWords(g.usable, g.form)) + lasts, tags: g.tags };
}

export { tagsHtml };
