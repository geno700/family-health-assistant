// Papers: add (#/papers/new/:personId), view (#/papers/:id), edit details (#/papers/:id/edit).
// Photos and PDFs are encrypted on the phone before upload and decrypted only when opened.
// The app stores papers; it never reads or interprets what they say.

import { t, ltr, countWords, dateLong } from './i18n.js';
import * as store from './store.js';
import { isoDate, parseDate } from './doses.js';
import { esc, icon, toast, confirmDialog, emptyState, $ } from './ui.js';
import { go } from './router.js';
import { personColor } from './views-family.js';

export const PAPER_KINDS = ['PRESCRIPTION', 'LAB', 'SCAN', 'REPORT', 'OTHER'];

const errText = (e) => t(['file_bad', 'file_too_big', 'not_allowed'].includes(e?.code) ? e.code : 'error_generic');

/** One paper as a list row (used on a person's page). */
export function paperRow(p) {
  const bits = [t(`pk_${p.kind}`), p.date ? dateLong(parseDate(p.date).getTime()) : '', countWords(p.files.length, 'PAGE')].filter(Boolean);
  return `
    <a class="list-row link" href="#/papers/${esc(p.id)}">${icon('paper')}
      <div class="grow"><div class="strong">${esc(p.title)}</div><div class="muted">${esc(bits.join(' • '))}</div></div>
      <span class="chev" aria-hidden="true">›</span></a>`;
}

export function render(main, params) {
  const [id, sub] = params;
  if (id === 'new') return form(main, null, sub);
  if (id && sub === 'edit') return form(main, store.paper(id));
  if (id) return view(main, id);
  go('family');
}

function view(main, id) {
  let shownKey = '';
  const draw = () => {
    const p = store.paper(id);
    if (!p) { main.innerHTML = `<section class="page"><a class="back" href="#/family">${esc(t('back'))}</a>${emptyState('paper', t('no_results'), '')}</section>`; return; }
    // Redraw only when the paper itself changed, so open pages don't flicker on other changes
    const key = JSON.stringify([p._updatedAt, p.title, p.kind, p.date, p.doctor, p.note, p.files.map((f) => f.id)]);
    if (key === shownKey) return;
    shownKey = key;
    const person = store.person(p.personId);
    const can = store.canWrite();
    main.innerHTML = `
      <section class="page">
        <a class="back" href="#/family/${esc(p.personId)}">${esc(t('back'))}</a>
        <div class="card">
          <div class="who"><span class="dot" style="background:${personColor(person?.color)}"></span>${esc(person?.name || '')}</div>
          <h1 class="flat">${esc(p.title)}</h1>
          <div class="muted">${esc([t(`pk_${p.kind}`), p.date ? dateLong(parseDate(p.date).getTime()) : ''].filter(Boolean).join(' • '))}</div>
          ${p.doctor ? `<p><span class="muted">${esc(t('paper_doctor'))}:</span> ${esc(p.doctor)}</p>` : ''}
          ${p.note ? `<p class="prose"><span class="muted">${esc(t('paper_note'))}:</span> ${esc(p.note)}</p>` : ''}
        </div>
        ${p.files.map((f, i) => `
          <figure class="card page-file" data-file="${esc(f.id)}">
            <figcaption class="row-between"><span class="strong">${esc(t('page_n', i + 1))}</span>
              ${can && p.files.length > 1 ? `<button class="btn btn-ghost danger btn-small" data-del="${esc(f.id)}">${icon('trash')}${esc(t('delete_page'))}</button>` : ''}</figcaption>
            <div class="page-body"><p class="muted">${esc(t('loading_page'))}</p></div>
          </figure>`).join('')}
        ${can ? `
          <label class="btn btn-secondary file-btn">${icon('plus')}${esc(t('add_pages'))}<input type="file" id="more" accept="image/*,application/pdf" multiple hidden></label>
          <p class="hint" id="progress"></p>
          <div class="btn-row">
            <a class="btn btn-secondary" href="#/papers/${esc(id)}/edit">${icon('edit')}${esc(t('edit'))}</a>
            <button class="btn btn-danger-outline" id="del">${icon('trash')}${esc(t('delete'))}</button></div>` : ''}
      </section>`;

    // Decrypt each page in turn
    p.files.forEach(async (f) => {
      const body = main.querySelector(`[data-file="${CSS.escape(f.id)}"] .page-body`);
      try {
        const url = await store.fileUrl(f);
        if (!body.isConnected) return;
        body.innerHTML = f.type === 'application/pdf'
          ? `<a class="btn btn-secondary" href="${url}" target="_blank" rel="noopener">${icon('paper')}${esc(t('open_pdf'))}</a>`
          : `<a href="${url}" target="_blank" rel="noopener" class="page-img"><img src="${url}" alt="${esc(t('page_n', p.files.indexOf(f) + 1))}"></a>
             <a class="btn btn-ghost btn-small" href="${url}" target="_blank" rel="noopener">${esc(t('open_file'))}</a>`;
      } catch {
        if (body.isConnected) body.innerHTML = `<p class="danger-text">${esc(t('file_load_failed'))}</p>`;
      }
    });

    main.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmDialog(t('page_delete_confirm'), { danger: true, okLabel: t('delete') }))) return;
        try { await store.deletePaperPage(id, b.dataset.del); toast(t('deleted')); } catch (e) { toast(errText(e), 'error'); }
      };
    });
    const more = $('#more');
    if (more) more.onchange = async () => {
      const files = [...more.files];
      more.value = '';
      if (!files.length) return;
      const progress = $('#progress');
      try {
        await store.savePaper(store.paper(id), files, (n, total) => { if (progress.isConnected) progress.textContent = t('paper_saving', n, total); });
        toast(t('saved'));
      } catch (e) {
        toast(errText(e), 'error');
        if (progress.isConnected) progress.textContent = '';
      }
    };
    const del = $('#del');
    if (del) del.onclick = async () => {
      if (!(await confirmDialog(t('paper_delete_confirm'), { danger: true, okLabel: t('delete') }))) return;
      try { await store.deletePaper(id); toast(t('deleted')); go(`family/${p.personId}`); } catch (e) { toast(errText(e), 'error'); }
    };
  };
  draw();
  return store.onChange(draw);
}

function form(main, existing, presetPerson) {
  const personId = existing?.personId || presetPerson;
  if (!store.canWrite() || !store.person(personId)) { go(existing ? `papers/${existing.id}` : 'family'); return; }
  const p = existing || { personId, title: '', kind: 'PRESCRIPTION', date: isoDate(new Date()), doctor: '', note: '', files: [] };
  const chosen = []; // new files, only when adding a paper
  const back = existing ? `#/papers/${esc(existing.id)}` : `#/family/${esc(personId)}`;
  main.innerHTML = `
    <section class="page">
      <a class="back" href="${back}">${esc(t('back'))}</a>
      <h1>${esc(existing ? t('edit_paper') : t('new_paper'))}</h1>
      <p class="muted">${esc(store.person(personId).name)}</p>
      <form id="pf" class="card form" novalidate>
        <label>${esc(t('paper_title'))}<input class="input" name="title" value="${esc(p.title)}" placeholder="${esc(t('paper_title_hint'))}" maxlength="80"></label>
        <p class="form-error" data-for="title"></p>
        <fieldset><legend>${esc(t('paper_kind'))}</legend><div class="chips">
          ${PAPER_KINDS.map((k) => `<label class="chip"><input type="radio" name="kind" value="${k}" ${p.kind === k ? 'checked' : ''}><span>${esc(t(`pk_${k}`))}</span></label>`).join('')}
        </div></fieldset>
        <label>${esc(t('paper_date'))}<input class="input" type="date" name="date" value="${esc(p.date || '')}"></label>
        <label>${esc(t('paper_doctor'))}<input class="input" name="doctor" value="${esc(p.doctor || '')}" maxlength="80"></label>
        <label>${esc(t('paper_note'))}<textarea class="input" name="note" rows="2" maxlength="500">${esc(p.note || '')}</textarea></label>
        ${existing ? '' : `
          <fieldset><legend>${esc(t('paper_files'))}</legend>
            <label class="btn btn-secondary file-btn">${icon('camera')}${esc(t('take_photo'))}<input type="file" id="cam" accept="image/*" capture="environment" hidden></label>
            <label class="btn btn-secondary file-btn">${icon('upload')}${esc(t('pick_files'))}<input type="file" id="pick" accept="image/*,application/pdf" multiple hidden></label>
            <div id="chosen" class="card list hidden"></div>
            <p class="form-error" data-for="files"></p>
            <p class="hint">${icon('key')} ${esc(t('paper_lock_note'))}</p>
          </fieldset>`}
        <p class="hint" id="progress"></p>
        <button class="btn btn-primary btn-big" id="save">${icon('check')}${esc(t('save'))}</button>
      </form>
    </section>`;

  const drawChosen = () => {
    const box = $('#chosen');
    if (!box) return;
    box.classList.toggle('hidden', !chosen.length);
    box.innerHTML = chosen.map((f, i) => `
      <div class="list-row">${icon(f.type === 'application/pdf' ? 'paper' : 'camera')}
        <div class="grow"><div class="strong" dir="auto">${esc(f.name || t('page_n', i + 1))}</div><div class="muted">${esc(t('page_n', i + 1))}</div></div>
        <button type="button" class="btn btn-ghost danger btn-small" data-rm="${i}">${icon('close')}${esc(t('remove_file'))}</button></div>`).join('');
    box.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => { chosen.splice(Number(b.dataset.rm), 1); drawChosen(); }; });
  };
  ['cam', 'pick'].forEach((idName) => {
    const input = $(`#${idName}`);
    if (input) input.onchange = () => { chosen.push(...input.files); input.value = ''; drawChosen(); };
  });

  $('#pf').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    main.querySelectorAll('.form-error').forEach((e) => { e.textContent = ''; });
    const errs = {};
    if (!f.title.trim()) errs.title = t('paper_title_required');
    if (!existing && !chosen.length) errs.files = t('paper_files_required');
    if (Object.keys(errs).length) {
      Object.entries(errs).forEach(([k, v]) => { main.querySelector(`[data-for=${k}]`).textContent = v; });
      return;
    }
    const save = $('#save');
    const progress = $('#progress');
    save.disabled = true;
    try {
      const saved = await store.savePaper({ ...existing, personId, title: f.title.trim(), kind: f.kind || 'OTHER', date: f.date || '', doctor: f.doctor.trim(), note: f.note.trim() },
        chosen, (n, total) => { if (progress.isConnected) progress.textContent = t('paper_saving', n, total); });
      toast(t('saved'));
      go(`papers/${saved.id}`);
    } catch (e) {
      toast(errText(e), 'error');
      if (progress.isConnected) progress.textContent = '';
      save.disabled = false;
    }
  };
}
