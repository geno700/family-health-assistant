// The active household: its membership, the family key on this device, and every health
// record decrypted in memory. All writes are encrypted here before they reach the backend,
// so views work with plain objects and never see cipher text or call the backend for records.

import { api } from './data.js';
import { decodeKeyCode, keyMatches, loadDeviceKey, saveDeviceKey, encryptJson, decryptJson } from './crypto.js';

const ACTIVE_KEY = 'fha.active';
const WRITERS = ['owner', 'admin', 'caregiver'];

const state = {
  memberships: [],
  active: null, // { group, member }
  key: null,
  people: new Map(),
  meds: new Map(),
  logs: new Map(), // `${medicineId}|${scheduledAt}` -> log (has .id = record id)
  stock: new Map(), // home pharmacy boxes (record person_id = household id: not one person's)
  unreadable: 0,
  loaded: false,
};

let listeners = [];
export function onChange(cb) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((x) => x !== cb); };
}
function changed() {
  listeners.forEach((cb) => cb());
}

// ---------- Households ----------

/** Forget everything decrypted when the signed-in user changes (sign out/in, demo "view as"). */
export function setUser(userId) {
  if (state.userId === userId) return;
  state.userId = userId;
  state.active = null;
  state.key = null;
  state.people.clear(); state.meds.clear(); state.logs.clear(); state.stock.clear();
  state.loaded = false;
  state.unreadable = 0;
}

export async function loadMemberships() {
  state.memberships = await api.myMemberships();
  let wanted = null;
  try { wanted = localStorage.getItem(ACTIVE_KEY); } catch { /* ignore */ }
  const usable = state.memberships.filter((x) => x.member.status === 'active' && !x.group.disabled);
  const pick = usable.find((x) => x.group.id === wanted) || usable[0] || null;
  setActiveInternal(pick);
  return state.memberships;
}

function setActiveInternal(m) {
  // Same household as before: keep the decrypted data, only refresh role/membership
  if (m && state.active && state.active.group.id === m.group.id && state.key) {
    state.active = m;
    return;
  }
  state.active = m;
  state.key = m ? loadDeviceKey(m.group.id) : null;
  state.people.clear(); state.meds.clear(); state.logs.clear(); state.stock.clear();
  state.loaded = false;
  state.unreadable = 0;
  if (m) { try { localStorage.setItem(ACTIVE_KEY, m.group.id); } catch { /* ignore */ } }
}

export async function switchTo(groupId) {
  const m = state.memberships.find((x) => x.group.id === groupId && x.member.status === 'active');
  setActiveInternal(m || null);
  if (m && state.key) await reload();
  changed();
}

export const memberships = () => state.memberships;
export const active = () => state.active;
export const group = () => state.active?.group || null;
export const member = () => state.active?.member || null;
export const role = () => state.active?.member.role || null;
export const hasKey = () => !!state.key;
export const isLoaded = () => state.loaded;
export const unreadableCount = () => state.unreadable;

export const canWrite = () => WRITERS.includes(role());
export const isAdmin = () => ['owner', 'admin'].includes(role());
/** Patients may mark only their own doses; writers may mark anyone's. */
export const canDose = (personId) => canWrite() || (role() === 'patient' && member()?.person_id === personId);

/** Checks a typed family key against the household's test value; keeps it on this device if right. */
export async function unlock(code) {
  const bytes = decodeKeyCode(code);
  const g = group();
  if (!bytes || !g) return false;
  const ok = await keyMatches(bytes, { cipher: g.key_check_cipher, iv: g.key_check_iv });
  if (!ok) return false;
  saveDeviceKey(g.id, bytes);
  state.key = bytes;
  await reload();
  changed();
  return true;
}

export const currentKey = () => state.key;

// ---------- Records ----------

export async function reload() {
  const g = group();
  if (!g || !state.key) return;
  const rows = await api.listRecords(g.id);
  state.people.clear(); state.meds.clear(); state.logs.clear(); state.stock.clear();
  state.unreadable = 0;
  await Promise.all(rows.map(async (r) => {
    try {
      const data = await decryptJson(state.key, r.cipher, r.iv);
      const obj = { ...data, id: r.id, _updatedAt: r.updated_at };
      if (r.kind === 'person') state.people.set(r.id, obj);
      else if (r.kind === 'medicine') state.meds.set(r.id, obj);
      else if (r.kind === 'dose_log') state.logs.set(`${obj.medicineId}|${obj.scheduledAt}`, obj);
      else if (r.kind === 'stock') state.stock.set(r.id, obj);
    } catch {
      state.unreadable += 1; // made with another key: skipped, never shown garbled
    }
  }));
  state.loaded = true;
  changed();
}

async function put(kind, personId, obj) {
  const g = group();
  const { id, _updatedAt, ...data } = obj;
  const c = await encryptJson(state.key, { ...data, id });
  await api.saveRecord(g.id, { id, kind, person_id: personId, cipher: c.cipher, iv: c.iv });
  return { ...data, id };
}

const newId = () => crypto.randomUUID();
const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ar');

export const people = () => [...state.people.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
export const person = (id) => state.people.get(id) || null;
export const meds = () => [...state.meds.values()].sort(byName);
export const med = (id) => state.meds.get(id) || null;
export const logs = () => [...state.logs.values()];
export const stockBoxes = () => [...state.stock.values()];
export const stockBox = (id) => state.stock.get(id) || null;
/** Patients only see their own person's records, so the shared pharmacy isn't theirs to see. */
export const canSeeStock = () => role() !== 'patient';

export async function savePerson(p) {
  const obj = { createdAt: Date.now(), ...p, id: p.id || newId() };
  const saved = await put('person', obj.id, obj);
  state.people.set(saved.id, saved);
  changed();
  return saved;
}

/** Deletes the person and their medicines (their dose history goes with the medicines). */
export async function deletePerson(id) {
  const g = group();
  for (const m of meds().filter((x) => x.personId === id)) await api.deleteRecord(g.id, m.id);
  await api.deleteRecord(g.id, id);
  state.people.delete(id);
  meds().filter((x) => x.personId === id).forEach((m) => state.meds.delete(m.id));
  changed();
}

export async function saveMed(m) {
  const obj = { createdAt: Date.now(), ...m, id: m.id || newId() };
  const saved = await put('medicine', obj.personId, obj);
  state.meds.set(saved.id, saved);
  changed();
  return saved;
}

export async function deleteMed(id) {
  await api.deleteRecord(group().id, id);
  state.meds.delete(id);
  changed();
}

// ---------- Home pharmacy ----------

/** A box belongs to the household, not to one person: its server person_id is the household id. */
export async function saveStock(box) {
  const obj = { createdAt: Date.now(), countedAt: Date.now(), ...box, id: box.id || newId() };
  const saved = await put('stock', group().id, obj);
  state.stock.set(saved.id, saved);
  changed();
  return saved;
}

export async function deleteStock(id) {
  await api.deleteRecord(group().id, id);
  state.stock.delete(id);
  changed();
}

// ---------- Doses ----------

async function answer(m, scheduledAt, status) {
  const key = `${m.id}|${scheduledAt}`;
  const existing = state.logs.get(key);
  // amount is kept so the pharmacy subtracts what was taken then, even if the dose changes later
  const log = { id: existing?.id || newId(), medicineId: m.id, scheduledAt, status, amount: m.doseAmount, actedAt: Date.now(), actedBy: member()?.display_name || '' };
  const saved = await put('dose_log', m.personId, log);
  state.logs.set(key, saved);
  changed();
}

export const take = (m, at) => answer(m, at, 'TAKEN');
export const skip = (m, at) => answer(m, at, 'SKIPPED');

/** "تراجع": the dose is open again. */
export async function undo(m, scheduledAt) {
  const key = `${m.id}|${scheduledAt}`;
  const existing = state.logs.get(key);
  if (!existing) return;
  await api.deleteRecord(group().id, existing.id);
  state.logs.delete(key);
  changed();
}

/** As-needed medicines are logged at the moment they're taken. Returns that moment. */
export async function takeNow(m) {
  const at = Date.now();
  await answer(m, at, 'TAKEN');
  return at;
}

// ---------- Backup ----------

export function exportData() {
  return {
    app: 'family-health-assistant',
    version: 1,
    exportedAt: new Date().toISOString(),
    household: group()?.name || '',
    householdId: group()?.id || '',
    people: people(),
    medicines: meds(),
    doseLogs: logs(),
    stock: stockBoxes(),
  };
}

/** Restores a backup file into the active household (same ids are replaced). Returns the count. */
export async function importData(data) {
  if (!data || data.app !== 'family-health-assistant') throw Object.assign(new Error('bad_file'), { code: 'bad_file' });
  // Record ids are unique across all households on the server, so a backup from another
  // household gets fresh ids (links between people, medicines and doses kept).
  const sameHouse = data.householdId && data.householdId === group()?.id;
  const ids = new Map();
  const map = (id) => {
    if (sameHouse || !id) return id;
    if (!ids.has(id)) ids.set(id, newId());
    return ids.get(id);
  };
  let n = 0;
  for (const p of data.people || []) { const id = map(p.id); await put('person', id, { ...p, id }); n += 1; }
  const medPerson = new Map();
  for (const m of data.medicines || []) {
    const personId = map(m.personId);
    const med = { ...m, id: map(m.id), personId };
    medPerson.set(med.id, personId);
    await put('medicine', personId, med); n += 1;
  }
  for (const l of data.doseLogs || []) {
    const medicineId = map(l.medicineId);
    const personId = medPerson.get(medicineId) || state.meds.get(medicineId)?.personId;
    if (personId) { await put('dose_log', personId, { ...l, id: map(l.id), medicineId }); n += 1; }
  }
  for (const b of data.stock || []) { await put('stock', group().id, { ...b, id: map(b.id) }); n += 1; }
  await reload();
  return n;
}
