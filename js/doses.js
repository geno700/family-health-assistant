// Pure schedule math, ported from the Android app's tested DosePlanner:
// which doses fall on which day and whether each is upcoming, due, missed, taken or skipped.
// Times are local wall-clock "HH:mm"; dates are "YYYY-MM-DD"; dose keys use epoch millis.

import { t, ltr, getLang, doseWords, timesPerDayWords, everyNDaysWords, forDaysWords } from './i18n.js';

/** A dose stays "due" for this long after its time, then counts as missed. */
export const DUE_WINDOW_MIN = 60;

export function isoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

export function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function daysBetween(fromIso, toIso) {
  // Noon avoids daylight-saving hours shifting the day count
  const a = parseDate(fromIso); a.setHours(12);
  const b = parseDate(toIso); b.setHours(12);
  return Math.round((b - a) / 86400000);
}

export function hhmm(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function at(iso, time) {
  const d = parseDate(iso);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** Does this medicine have planned doses on that day? Stopped and as-needed never do. */
export function isActiveOn(med, iso) {
  if (med.deleted || med.stopped || med.scheduleType === 'AS_NEEDED') return false;
  if (!med.startDate || iso < med.startDate) return false;
  if (med.endDate && iso > med.endDate) return false;
  if (med.scheduleType === 'EVERY_N_DAYS') {
    const n = med.everyNDays || 0;
    return n >= 1 && daysBetween(med.startDate, iso) % n === 0;
  }
  return true;
}

export function dosesOn(med, iso) {
  if (!isActiveOn(med, iso)) return [];
  return [...new Set(med.times || [])].filter((x) => /^\d{2}:\d{2}$/.test(x)).sort()
    .map((time) => ({ med, at: at(iso, time) }));
}

export function stateOf(atMs, log, nowMs) {
  if (log?.status === 'TAKEN') return 'TAKEN';
  if (log?.status === 'SKIPPED') return 'SKIPPED';
  if (nowMs < atMs) return 'UPCOMING';
  if (nowMs <= atMs + DUE_WINDOW_MIN * 60000) return 'DUE';
  return 'MISSED';
}

/**
 * Today's doses for everyone, in time order, with their state. Doses from before a medicine
 * was added don't count (a medicine added at 22:00 has no "missed" 20:00 dose).
 */
export function today(meds, logs, nowMs) {
  const iso = isoDate(new Date(nowMs));
  const byKey = new Map(logs.map((l) => [`${l.medicineId}|${l.scheduledAt}`, l]));
  return meds.flatMap((m) => dosesOn(m, iso))
    .filter((d) => !d.med.createdAt || d.at >= d.med.createdAt - 60000)
    .sort((a, b) => a.at - b.at)
    .map((d) => {
      const log = byKey.get(`${d.med.id}|${d.at}`) || null;
      return { ...d, log, state: stateOf(d.at, log, nowMs) };
    });
}

/** Suggested times from the person's meal times: before = 30 min earlier, after = 30 min later. */
export function suggestTimes(perDay, food, person) {
  const meal = (v, dflt) => (/^\d{2}:\d{2}$/.test(v || '') ? v : dflt);
  const b = meal(person?.breakfast, '08:00');
  const l = meal(person?.lunch, '14:00');
  const d = meal(person?.dinner, '20:00');
  const shift = perDay <= 3 ? (food === 'BEFORE' ? -30 : food === 'AFTER' ? 30 : 0) : 0;
  const add = (time, min) => {
    const [h, m] = time.split(':').map(Number);
    const total = ((h * 60 + m + min) % 1440 + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  let base;
  if (perDay === 1) base = [b];
  else if (perDay === 2) base = [b, d];
  else if (perDay === 3) base = [b, l, d];
  else base = Array.from({ length: perDay }, (_, i) => add(b, Math.round((1440 / perDay) * i)));
  return [...new Set(base.map((x) => add(x, shift)))].sort();
}

// ---- Wording ----

export function medTitle(med) {
  return ltr([med.name, med.strength].filter(Boolean).join(' '));
}

export function foodWords(food) {
  return { BEFORE: t('food_before'), AFTER: t('food_after'), WITH: t('food_with') }[food] || '';
}

/** "قرص واحد • بعد الأكل" */
export function doseLine(med) {
  return [doseWords(med.doseAmount, med.form), foodWords(med.foodTiming)].filter(Boolean).join(' • ');
}

/** "مرتين في اليوم الساعة 08:30 و 20:30" */
export function howOften(med) {
  const ar = getLang() === 'ar';
  const times = (med.times || []).map(ltr).join(ar ? ' و ' : ', ');
  const atWord = ar ? 'الساعة' : 'at';
  if (med.scheduleType === 'AS_NEEDED') return t('freq_needed');
  if (med.scheduleType === 'EVERY_N_DAYS') return `${everyNDaysWords(med.everyNDays || 1)} ${atWord} ${times}`;
  return `${timesPerDayWords((med.times || []).length)} ${atWord} ${times}`;
}

export function durationWords(med) {
  if (!med.endDate) return t('forever');
  return forDaysWords(daysBetween(med.startDate, med.endDate) + 1);
}
