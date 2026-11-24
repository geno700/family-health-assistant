// The "read the medicine box with the camera" button used by the add-medicine and add-box forms.
// The form keeps a small state object `r` so the result survives its redraws. What was read only
// fills the form; the user checks it and taps Save. Doses and times are never read.

import { t, ltr, joinList } from './i18n.js';
import { esc, icon } from './ui.js';
import { readBox, foundAnything } from './box-reader.js';

export const newReadState = () => ({ busy: false, result: null, error: '' });

export function boxReadHtml(r) {
  const res = r.result;
  let status = '';
  if (r.busy) status = `<p class="hint" id="readStatus" role="status">${esc(t('read_box_busy', '0'))}</p>`;
  else if (r.error) status = `<p class="form-error">${esc(r.error)}</p>`;
  else if (res && !foundAnything(res)) status = `<div class="card notice">${esc(t('read_box_nothing'))}</div>`;
  else if (res) {
    const got = [
      res.names.length ? t('f_name') : '', res.strength ? t('f_strength') : '', res.form ? t('f_form') : '',
      res.count != null && r.useCount ? t('f_count') : '', res.expiry && r.useExpiry ? t('f_expiry') : '',
    ].filter(Boolean);
    status = `<div class="card answer-yes read-result">
      <div>${icon('check')} ${esc(t('read_box_done', joinList(got)))}</div>
      ${res.names.length > 1 ? `<div class="hint">${esc(t('read_box_names'))}</div>
        <div class="chips">${res.names.map((n, i) => `<button type="button" class="chip-btn ${n === r.pickedName ? 'on' : ''}" data-name="${i}">${esc(ltr(n))}</button>`).join('')}</div>` : ''}
      <div class="hint">${esc(t('read_box_never'))}</div></div>`;
  }
  return `
    <div class="read-box">
      <label class="btn btn-secondary file-btn ${r.busy ? 'disabled' : ''}">${icon('camera')}${esc(t('read_box'))}
        <input type="file" id="boxPhoto" accept="image/*" capture="environment" hidden ${r.busy ? 'disabled' : ''}></label>
      ${status || `<p class="hint">${esc(t('read_box_hint'))}</p>`}
    </div>`;
}

/**
 * main: the page; r: the form's read state; keep(): copies what the user typed into the form's
 * state; draw(): redraws the form; apply(result, name): fills the form's state with what was read
 * (only the fields that were found; name = the chosen name or the first one).
 */
export function bindBoxRead(main, r, { keep, draw, apply }) {
  const input = main.querySelector('#boxPhoto');
  if (input) input.onchange = async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    keep();
    Object.assign(r, { busy: true, result: null, error: '', pickedName: '' });
    draw();
    const here = location.hash;
    try {
      const res = await readBox(file, (p) => {
        const el = main.querySelector('#readStatus');
        if (el) el.textContent = t('read_box_busy', String(Math.round(p * 100)));
      });
      if (location.hash !== here) return; // the user left the form meanwhile
      keep(); // the user may have typed while the box was being read
      r.result = res;
      r.pickedName = res.names[0] || '';
      apply(res, r.pickedName);
    } catch (e) {
      if (location.hash !== here) return;
      r.error = t(e?.code === 'file_bad' ? 'file_bad' : e?.code === 'read_offline' ? 'read_box_offline' : 'read_box_failed');
    }
    r.busy = false;
    draw();
  };
  main.querySelectorAll('[data-name]').forEach((b) => {
    b.onclick = () => {
      keep();
      r.pickedName = r.result.names[Number(b.dataset.name)];
      apply({ ...r.result, strength: null, form: null, count: null, expiry: null }, r.pickedName);
      draw();
    };
  });
}
