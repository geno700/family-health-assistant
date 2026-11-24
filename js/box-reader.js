// Reading a medicine box photo, entirely on the phone: Tesseract.js (pinned, from jsDelivr)
// finds the printed Latin text, then parseBox() picks out name, strength, form, count and expiry.
// Ported from the Android app's BoxTextParser: rule-based, nothing invented. It never reads a
// dose, a time or a duration, and nothing is saved until the user checks the form and taps Save.

import { prepareFile } from './files.js';

const LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const PATHS = {
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
};

// ---------- Parsing (pure) ----------

const strengthRx = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|g|ml|iu|i\.u\.|%)(?:\s*\/\s*(\d+(?:[.,]\d+)?)\s*(ml|g|tab|dose))?/i;
const stripsRx = /(\d{1,2})\s*(?:strips?|blisters?|sheets?)\s*(?:x|×|\*|of)\s*(\d{1,3})/i;
const countRx = /(\d{1,3})\s*(?:film[\s-]*coated\s+|f\.c\.\s*|chewable\s+|effervescent\s+|scored\s+|oral\s+)?(tablets?|tabs?|capsules?|caps?|ampoules?|amp|vials?|sachets?|suppositor(?:y|ies)|doses?|puffs?)\b/i;
const expLabelRx = /\b(exp|expiry|expiration|exp\.?\s*date|use\s+before|best\s+before|ex)\b/i;
const mfgLabelRx = /\b(mfg|mfd|manufactured|prod|production|made|batch|lot|b\.?\s*no)\b/i;
const monthYearRx = /\b(0?[1-9]|1[0-2])\s*[/.\-]\s*(20\d{2}|\d{2})\b/g;
const yearMonthRx = /\b(20\d{2})\s*[/.\-]\s*(0?[1-9]|1[0-2])\b/g;
const monthNameRx = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*[/.\-]?\s*(20\d{2}|\d{2})\b/gi;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NOT_NAME_WORDS = 'tablets?|tabs?|capsules?|caps?|film|coated|mg|mcg|ml|exp|expiry|mfg|batch|lot|reg|no\\.?|price|le|egp|'
  + 'pharma|pharmaceuticals?|industries|company|ltd|s\\.a\\.e|egypt|cairo|made|in|for|oral|use|'
  + 'keep|store|below|temperature|children|reach|dosage|composition|each|contains|syrup|suspension|drops|'
  + 'injection|ampoules?|cream|ointment|gel|spray|inhaler|sachets?|effervescent|chewable|prescription|only|rx';
const notNameWord = new RegExp(`^(${NOT_NAME_WORDS})$`, 'i');
const notNameAny = new RegExp(`\\b(${NOT_NAME_WORDS})\\b`, 'i');

const cleanStrength = (s) => s.replace(/\s*\/\s*/g, '/').replace(/(\d)([a-zA-Zµ%])/g, '$1 $2').replace(/\s+/g, ' ').trim();

export function readForm(text) {
  const t = text.toLowerCase();
  if (/\b(capsules?|caps)\b/.test(t)) return 'CAPSULE';
  if (/\b(tablets?|tabs?|f\.c\.)(?=\W|$)/.test(t)) return 'TABLET';
  if (/\b(syrup|suspension|oral solution|elixir)\b/.test(t)) return 'SYRUP';
  if (/\b(eye drops|ear drops|nasal drops|drops)\b/.test(t)) return 'DROPS';
  if (/\b(injection|ampoules?|vials?|i\.m\.|i\.v\.|prefilled syringe)(?=\W|$)/.test(t)) return 'INJECTION';
  if (/\b(cream|ointment|gel|lotion)\b/.test(t)) return 'CREAM';
  if (/\b(spray|inhaler|aerosol|puffs?)\b/.test(t)) return 'SPRAY';
  return null;
}

export function readCount(text) {
  const s = stripsRx.exec(text);
  if (s) { const total = Number(s[1]) * Number(s[2]); if (total >= 1 && total <= 1000) return total; }
  const c = countRx.exec(text);
  const n = c ? Number(c[1]) : NaN;
  return n >= 1 && n <= 1000 ? n : null;
}

function allDates(s, thisYear) {
  const year = (y) => { const n = Number(y); return n < 100 ? 2000 + n : n; };
  const found = [];
  for (const m of s.matchAll(yearMonthRx)) found.push([Number(m[2]), year(m[1])]);
  for (const m of s.matchAll(monthYearRx)) found.push([Number(m[1]), year(m[2])]);
  for (const m of s.matchAll(monthNameRx)) {
    const month = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)) + 1;
    if (month > 0) found.push([month, year(m[2])]);
  }
  return found.filter(([, y]) => y >= thisYear - 5 && y <= thisYear + 10);
}

/** [month, year] of the printed expiry: a labelled EXP date first; MFG / batch lines ignored. */
export function readExpiry(lines, thisYear) {
  const texts = lines.map((l) => l.text);
  for (let i = 0; i < texts.length; i++) {
    const m = expLabelRx.exec(texts[i]);
    if (!m) continue;
    const after = texts[i].slice(m.index + m[0].length);
    const next = texts[i + 1] && !mfgLabelRx.test(texts[i + 1]) ? allDates(texts[i + 1], thisYear)[0] : null;
    const d = allDates(after, thisYear)[0] || next;
    if (d) return d;
  }
  const dates = texts.filter((x) => !mfgLabelRx.test(x)).flatMap((x) => allDates(x, thisYear));
  const best = dates.sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  return best && best[1] >= thisYear - 1 ? best : null;
}

/** Big, mostly-letter lines that aren't strengths, counts, dates or company words. */
export function nameCandidates(lines) {
  const seen = new Set();
  return lines
    .map((l) => ({ ...l, text: l.text.trim() }))
    .filter(({ text }) => {
      const letters = [...text].filter((ch) => /\p{L}/u.test(ch) && ch.charCodeAt(0) < 0x0600).length; // Latin only
      return letters >= 3 && letters / text.length >= 0.6 && text.length <= 30;
    })
    .map((l) => {
      // Keep the words before any strength or form word: "Concor 5 mg" -> "Concor"
      const words = [];
      for (const w of l.text.split(/\s+/)) {
        if (/^\d/.test(w) || notNameWord.test(w.replace(/[.,:]+$/, ''))) break;
        words.push(w);
      }
      return { ...l, text: words.join(' ').replace(/^[\s\-,.:®™]+|[\s\-,.:®™]+$/g, '') };
    })
    .filter((l) => [...l.text].filter((ch) => /\p{L}/u.test(ch)).length >= 3 && !notNameAny.test(l.text))
    .sort((a, b) => b.height - a.height)
    .map((l) => l.text)
    .filter((n) => { const k = n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 4);
}

/** lines: [{ text, height }]. Returns { names, strength, form, count, expiry: 'YYYY-MM' | null }. */
export function parseBox(lines, thisYear = new Date().getFullYear()) {
  const all = lines.map((l) => l.text).join('\n');
  const st = strengthRx.exec(all);
  const exp = readExpiry(lines, thisYear);
  return {
    names: nameCandidates(lines),
    strength: st ? cleanStrength(st[0]) : null,
    form: readForm(all),
    count: readCount(all),
    expiry: exp ? `${exp[1]}-${String(exp[0]).padStart(2, '0')}` : null,
  };
}

export const foundAnything = (r) => r.names.length > 0 || !!r.strength || !!r.form || r.count != null || !!r.expiry;

// ---------- Reading the photo ----------

let libPromise = null;
function loadLib() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  libPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LIB;
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => { libPromise = null; reject(Object.assign(new Error('read_offline'), { code: 'read_offline' })); };
    document.head.appendChild(s);
  });
  return libPromise;
}

/** Reads a box photo on the phone. onProgress(0..1) while the reader loads and works. */
export async function readBox(file, onProgress) {
  const { bytes } = await prepareFile(file); // shrinks the photo (and rejects non-images)
  const Tesseract = await loadLib();
  let pass = 0;
  const worker = await Tesseract.createWorker('eng', 1, {
    ...PATHS,
    // Loading counts for the first third, then the two readings
    logger: (m) => {
      if (typeof m.progress !== 'number') return;
      if (m.status !== 'recognizing text') onProgress?.(m.progress / 3);
      else { pass = m.progress === 1 ? pass + 1 : pass; onProgress?.(Math.min(1, 1 / 3 + (Math.min(pass, 1) + (m.progress === 1 ? 0 : m.progress)) / 3)); }
    },
  });
  try {
    // Tesseract tends to skip very large print (often the brand name), so the photo is read at
    // full size and at half size; the lines are merged top to bottom (duplicates dropped).
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    const canvasAt = (f) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bitmap.width * f));
      c.height = Math.max(1, Math.round(bitmap.height * f));
      c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
      return c;
    };
    const full = canvasAt(1);
    const half = canvasAt(0.5);
    bitmap.close?.();
    const lines = [];
    for (const [image, scale] of [[full, 1], [half, 2]]) {
      const { data } = await worker.recognize(image);
      for (const l of data.lines || []) {
        const text = l.text.replace(/\s+/g, ' ').trim();
        if (text) lines.push({ text, height: ((l.bbox?.y1 || 0) - (l.bbox?.y0 || 0)) * scale, top: (l.bbox?.y0 || 0) * scale });
      }
    }
    const seen = new Map();
    for (const l of lines) {
      const k = l.text.toLowerCase();
      if (!seen.has(k) || seen.get(k).height < l.height) seen.set(k, l);
    }
    return parseBox([...seen.values()].sort((a, b) => a.top - b.top));
  } finally {
    await worker.terminate();
  }
}
