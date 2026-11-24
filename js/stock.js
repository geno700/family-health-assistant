// Home pharmacy maths (pure functions, no storage): which boxes a medicine draws from, how much
// is left after the doses taken since each box was counted, how long it lasts, and its tags.
//
// A box is { id, name, strength, form, count, countedAt, expiry: 'YYYY-MM' | '', note }.
// "count" is what the user saw at "countedAt". Taken doses after that moment are subtracted
// here, from the box that expires first, so undoing a dose (deleting its log) puts it back and
// a patient marking their own dose needs no permission to change the pharmacy.

import { isoDate } from './doses.js';

/** Forms counted one by one (tablets, capsules, injections); the others are counted in packs. */
export const COUNTED = ['TABLET', 'CAPSULE', 'INJECTION'];
export const isCounted = (form) => COUNTED.includes(form);

const LOW_DAYS = 7; // "running low" when it lasts a week or less
const EXPIRING_DAYS = 60; // "expires soon" when the expiry month ends within two months

export const normName = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const normStrength = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

/** Same medicine: same name, and the same strength when both have one. */
export function sameMedicine(a, b) {
  if (normName(a.name) !== normName(b.name)) return false;
  const sa = normStrength(a.strength);
  const sb = normStrength(b.strength);
  return !sa || !sb || sa === sb;
}

/** Last moment of the expiry month (the medicine is good through that month). */
export function expiryEnd(expiry) {
  const m = /^(\d{4})-(\d{2})$/.exec(expiry || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]), 1).getTime() - 1;
}

export function expiryState(expiry, nowMs) {
  const end = expiryEnd(expiry);
  if (end === null) return '';
  if (nowMs > end) return 'expired';
  if (end - nowMs <= EXPIRING_DAYS * 86400000) return 'expiring';
  return '';
}

function usingNow(box, meds, nowMs) {
  const today = isoDate(new Date(nowMs));
  return meds.filter((m) => !m.stopped && m.scheduleType !== 'AS_NEEDED' && sameMedicine(m, box)
    && (!m.startDate || m.startDate <= today) && (!m.endDate || m.endDate >= today));
}
const perDayOf = (m) => {
  const perDay = (m.times || []).length * (Number(m.doseAmount) || 0);
  return m.scheduleType === 'EVERY_N_DAYS' ? perDay / Math.max(m.everyNDays || 1, 1) : perDay;
};

/** Units used per day by the medicines that draw from this box (scheduled doses only). */
export function dailyUse(box, meds, nowMs) {
  return usingNow(box, meds, nowMs).reduce((sum, m) => sum + perDayOf(m), 0);
}

/** Units needed over the next week, counting a course only until its end date. */
function neededSoon(box, meds, nowMs) {
  const today = isoDate(new Date(nowMs));
  return usingNow(box, meds, nowMs).reduce((sum, m) => {
    const daysLeft = m.endDate ? Math.round((Date.parse(m.endDate) - Date.parse(today)) / 86400000) + 1 : LOW_DAYS + 1;
    return sum + perDayOf(m) * Math.min(daysLeft, LOW_DAYS + 1);
  }, 0);
}

/**
 * Units left in each box: count minus the taken doses (after countedAt) it supplied.
 * Each dose comes from the matching box that expires first and wasn't expired at that time.
 */
export function leftByBox(boxes, meds, logs) {
  const left = new Map(boxes.map((b) => [b.id, Math.max(Number(b.count) || 0, 0)]));
  const medById = new Map(meds.map((m) => [m.id, m]));
  const taken = logs.filter((l) => l.status === 'TAKEN')
    .map((l) => ({ l, m: medById.get(l.medicineId) }))
    .filter((x) => x.m && isCounted(x.m.form))
    .sort((a, b) => (a.l.actedAt || a.l.scheduledAt) - (b.l.actedAt || b.l.scheduledAt));
  for (const { l, m } of taken) {
    const at = l.actedAt || l.scheduledAt;
    let need = Number(l.amount ?? m.doseAmount) || 0;
    const from = boxes
      .filter((b) => isCounted(b.form) && sameMedicine(b, m) && (b.countedAt || 0) <= at && left.get(b.id) > 0
        && !(expiryEnd(b.expiry) !== null && at > expiryEnd(b.expiry)))
      .sort((a, b) => (expiryEnd(a.expiry) ?? Infinity) - (expiryEnd(b.expiry) ?? Infinity) || (a.countedAt || 0) - (b.countedAt || 0));
    for (const b of from) {
      if (need <= 0) break;
      const use = Math.min(need, left.get(b.id));
      left.set(b.id, Math.round((left.get(b.id) - use) * 100) / 100);
      need -= use;
    }
  }
  return left;
}

/**
 * Boxes grouped by medicine (name + strength), with totals and tags, sorted by name.
 * Each group: { key, name, strength, form, counted, boxes: [{ ...box, left, expiryState }],
 *   usable, daily, days, users: [personId], tags: Set('out'|'low'|'expiring'|'expired') }
 */
export function pharmacy(boxes, meds, logs, nowMs) {
  const left = leftByBox(boxes, meds, logs);
  const groups = new Map();
  for (const b of boxes) {
    const key = `${normName(b.name)}|${normStrength(b.strength)}`;
    if (!groups.has(key)) groups.set(key, { key, name: b.name, strength: b.strength || '', form: b.form, boxes: [] });
    groups.get(key).boxes.push({ ...b, left: left.get(b.id) ?? 0, expiryState: expiryState(b.expiry, nowMs) });
  }
  const out = [];
  for (const g of groups.values()) {
    g.boxes.sort((a, b) => (expiryEnd(a.expiry) ?? Infinity) - (expiryEnd(b.expiry) ?? Infinity));
    g.counted = isCounted(g.form);
    g.usable = g.boxes.filter((b) => b.expiryState !== 'expired').reduce((s, b) => s + b.left, 0);
    g.daily = g.counted ? dailyUse(g, meds, nowMs) : 0;
    g.days = g.daily > 0 ? Math.floor(g.usable / g.daily) : null;
    g.users = [...new Set(meds.filter((m) => !m.stopped && sameMedicine(m, g)).map((m) => m.personId))];
    g.tags = new Set();
    if (g.usable <= 0) g.tags.add('out');
    // Low: won't last past next week, unless that already covers the rest of a course
    else if (g.days !== null && g.days <= LOW_DAYS && g.usable < neededSoon(g, meds, nowMs)) g.tags.add('low');
    if (g.boxes.some((b) => b.expiryState === 'expired')) g.tags.add('expired');
    if (g.boxes.some((b) => b.expiryState === 'expiring' && b.left > 0)) g.tags.add('expiring');
    out.push(g);
  }
  return out.sort((a, b) => normName(a.name).localeCompare(normName(b.name)));
}

/** Groups whose name contains the typed text (or the other way round, for a longer search). */
export function search(groups, query) {
  const q = normName(query).replace(/\s+/g, '');
  if (!q) return groups;
  return groups.filter((g) => {
    const n = normName(g.name).replace(/\s+/g, '');
    const full = (n + normStrength(g.strength));
    return n.includes(q) || full.includes(q) || (q.length >= 4 && q.includes(n));
  });
}

/** Groups that need buying again: out, running low, or only expired boxes left. */
export const needsBuying = (groups) => groups.filter((g) => g.tags.has('out') || g.tags.has('low'));
export const needsAttention = (groups) => groups.filter((g) => g.tags.has('out') || g.tags.has('low') || g.tags.has('expired'));
