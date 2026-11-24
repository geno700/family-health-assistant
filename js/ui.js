// Small UI helpers shared by every view: escaping, toasts, dialogs, downloads, icons.

import { t } from './i18n.js';

/** Escapes text for HTML. Every value from the user or the data goes through this. */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Short message at the bottom. kind: 'ok' | 'error' | 'info'. */
export function toast(msg, kind = 'ok', ms = 2800) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

/** Toast with an action button (e.g. "تراجع"). */
export function toastAction(msg, actionLabel, onAction, ms = 7000) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast toast-info show-action';
  el.innerHTML = `<span>${esc(msg)}</span><button type="button" class="btn btn-small">${esc(actionLabel)}</button>`;
  el.querySelector('button').onclick = () => { onAction(); el.remove(); };
  box.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

/**
 * Confirm dialog. Resolves true/false. With typeToConfirm, the confirm button only works
 * after the user types that exact text (used for deleting a household).
 */
export function confirmDialog(message, { danger = false, okLabel, typeToConfirm } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog';
    dlg.innerHTML = `
      <form method="dialog">
        <p class="dialog-text">${esc(message)}</p>
        ${typeToConfirm ? `<input class="input" name="typed" autocomplete="off" placeholder="${esc(typeToConfirm)}">` : ''}
        <div class="dialog-actions">
          <button value="cancel" class="btn btn-secondary">${esc(t('cancel'))}</button>
          <button value="ok" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(okLabel || t('confirm'))}</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => {
      const typed = dlg.querySelector('[name=typed]')?.value?.trim();
      const ok = dlg.returnValue === 'ok' && (!typeToConfirm || typed === typeToConfirm);
      dlg.remove();
      resolve(ok);
    });
    dlg.showModal();
  });
}

/** Dialog with arbitrary HTML content; resolves with the form's values or null if cancelled. */
export function formDialog(innerHtml, { okLabel } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog';
    dlg.innerHTML = `
      <form method="dialog">
        ${innerHtml}
        <div class="dialog-actions">
          <button value="cancel" class="btn btn-secondary" formnovalidate>${esc(t('cancel'))}</button>
          <button value="ok" class="btn btn-primary">${esc(okLabel || t('save'))}</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => {
      const values = dlg.returnValue === 'ok' ? Object.fromEntries(new FormData(dlg.querySelector('form'))) : null;
      dlg.remove();
      resolve(values);
    });
    dlg.showModal();
  });
}

export function download(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** CSV with a BOM so Excel opens Arabic correctly. */
export function toCsv(rows) {
  const cell = (v) => {
    const s = String(v ?? '').replace(/[⁦-⁩]/g, '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\n');
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Plain text without the invisible direction marks (for sharing/clipboard). */
export function plain(s) {
  return String(s ?? '').replace(/[⁦-⁩]/g, '');
}

export function emptyState(icon, title, body, actionHtml = '') {
  return `<div class="empty">${ICONS[icon] || ''}<h2>${esc(title)}</h2><p>${esc(body)}</p>${actionHtml}</div>`;
}

/** Simple line icons (inline SVG, currentColor). */
export const ICONS = {
  today: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  pill: '<svg viewBox="0 0 24 24" class="icon"><rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M9.2 7.9l5.6 8.2"/></svg>',
  family: '<svg viewBox="0 0 24 24" class="icon"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.5-3.5 2.8-5.5 5.5-5.5s5 2 5.5 5.5M14 20c.3-2.6 1.6-4.3 3.5-4.3S20.7 17.4 21 20"/></svg>',
  settings: '<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  check: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" class="icon"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  undo: '<svg viewBox="0 0 24 24" class="icon"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  key: '<svg viewBox="0 0 24 24" class="icon"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M18 5l2 2"/></svg>',
  copy: '<svg viewBox="0 0 24 24" class="icon"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  download: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>',
  share: '<svg viewBox="0 0 24 24" class="icon"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  stop: '<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></svg>',
  play: '<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" class="icon"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  out: '<svg viewBox="0 0 24 24" class="icon"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
  shield: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/></svg>',
  pharmacy: '<svg viewBox="0 0 24 24" class="icon"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
  search: '<svg viewBox="0 0 24 24" class="icon"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  paper: '<svg viewBox="0 0 24 24" class="icon"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  camera: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  print: '<svg viewBox="0 0 24 24" class="icon"><path d="M7 9V3h10v6M7 17H4V9h16v8h-3"/><path d="M7 14h10v7H7z"/></svg>',
  home: '<svg viewBox="0 0 24 24" class="icon"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" class="icon"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
};

export function icon(name) {
  return ICONS[name] || '';
}
