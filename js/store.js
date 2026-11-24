// The active household: its membership, the family key on this device, and every health
// record decrypted in memory. All writes are encrypted here before they reach the backend,
// so views work with plain objects and never see cipher text or call the backend for records.

import { api } from './data.js';
import { decodeKeyCode, keyMatches, loadDeviceKey, saveDeviceKey, encryptJson, decryptJson, encryptBytes, decryptBytes } from './crypto.js';
import { prepareFile } from './files.js';
import { isoDate } from './doses.js';

const ACTIVE_KEY = 'fha.active';
const SOS_PREFIX = 'fha.sos.'; // emergency cards kept on the device (encrypted) for offline use
const WRITERS = ['owner', 'admin', 'caregiver'];

const state = {
  memberships: [],
  active: null, // { group, member }
  key: null,
  people: new Map(),
  meds: new Map(),
  logs: new Map(), // `${medicineId}|${scheduledAt}` -> log (has .id = record id)
  stock: new Map(), // home pharmacy boxes (record person_id = household id: not one person's)
  appts: new Map(), // appointments (record person_id = the person)
  papers: new Map(), // papers: details here, encrypted pages in file storage
  unreadable: 0,
  loaded: false,
};

let listeners = [];
export function onChange(cb) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((x) => x !== cb); };
}
let sosTimer = null;
function changed() {
  listeners.forEach((cb) => cb());
  // Keep this device's offline copy of the emergency cards up to date (a moment later, once)
  clearTimeout(sosTimer);
  sosTimer = setTimeout(saveEmergencyCopy, 800);
}

// ---------- Households ----------

/** Forget everything decrypted when the signed-in user changes (sign out/in, demo "view as"). */
export function setUser(userId) {
  if (state.userId === userId) return;
  state.userId = userId;
  state.active = null;
  state.key = null;
  state.people.clear(); state.meds.clear(); state.logs.clear(); state.stock.clear(); state.appts.clear(); state.papers.clear(); forgetFileUrls();
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
  state.people.clear(); state.meds.clear(); state.logs.clear(); state.stock.clear(); state.appts.clear(); state.papers.clear(); forgetFileUrls();
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
  state.people.clear(); state.meds.clear(); state.logs.clear(); state.stock.clear(); state.appts.clear(); state.papers.clear(); forgetFileUrls();
  state.unreadable = 0;
  await Promise.all(rows.map(async (r) => {
    try {
      const data = await decryptJson(state.key, r.cipher, r.iv);
      const obj = { ...data, id: r.id, _updatedAt: r.updated_at };
      if (r.kind === 'person') state.people.set(r.id, obj);
      else if (r.kind === 'medicine') state.meds.set(r.id, obj);
      else if (r.kind === 'dose_log') state.logs.set(`${obj.medicineId}|${obj.scheduledAt}`, obj);
      else if (r.kind === 'stock') state.stock.set(r.id, obj);
      else if (r.kind === 'appointment') state.appts.set(r.id, obj);
      else if (r.kind === 'paper') state.papers.set(r.id, obj);
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

/** Deletes the person, their medicines (dose history goes with them) and their appointments. */
export async function deletePerson(id) {
  const g = group();
  for (const m of meds().filter((x) => x.personId === id)) await api.deleteRecord(g.id, m.id);
  for (const a of appts().filter((x) => x.personId === id)) await api.deleteRecord(g.id, a.id);
  for (const p of papers().filter((x) => x.personId === id)) await deletePaper(p.id, { quiet: true });
  await api.deleteRecord(g.id, id);
  state.people.delete(id);
  meds().filter((x) => x.personId === id).forEach((m) => state.meds.delete(m.id));
  appts().filter((x) => x.personId === id).forEach((a) => state.appts.delete(a.id));
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

// ---------- Appointments ----------

/** Appointments in time order. Each: { id, personId, name (doctor or place), at (ms), place, note }. */
export const appts = () => [...state.appts.values()].sort((a, b) => a.at - b.at);
export const appt = (id) => state.appts.get(id) || null;

export async function saveAppt(a) {
  const obj = { createdAt: Date.now(), ...a, id: a.id || newId() };
  const saved = await put('appointment', obj.personId, obj);
  state.appts.set(saved.id, saved);
  changed();
  return saved;
}

export async function deleteAppt(id) {
  await api.deleteRecord(group().id, id);
  state.appts.delete(id);
  changed();
}

// ---------- Papers ----------
// A paper is { id, personId, title, kind, date, doctor, note, files: [{ id, path, iv, type, size }] }.
// Each page is encrypted here and uploaded to <householdId>/<personId>/<fileId>; the record only
// keeps where it is and its IV. Pages are downloaded and decrypted only when a paper is opened.

/** Papers, newest date first. */
export const papers = () => [...state.papers.values()].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
export const paper = (id) => state.papers.get(id) || null;

/** Encrypts and uploads chosen files; returns their entries. onStep(done, total) reports progress. */
async function uploadPages(personId, files, onStep) {
  const g = group();
  const done = [];
  if (files.length) onStep?.(0, files.length);
  try {
    for (const file of files) {
      const { bytes, type } = await prepareFile(file);
      const { data, iv } = await encryptBytes(state.key, bytes);
      const id = newId();
      const path = `${g.id}/${personId}/${id}`;
      await api.uploadFile(path, data);
      done.push({ id, path, iv, type, size: bytes.length });
      onStep?.(done.length, files.length);
    }
  } catch (e) {
    // Don't leave half a paper behind
    try { await api.removeFiles(done.map((f) => f.path)); } catch { /* best effort */ }
    throw e;
  }
  return done;
}

/** Saves a paper's details, uploading any new files as extra pages. The person can't change later. */
export async function savePaper(p, newFiles = [], onStep) {
  const obj = { createdAt: Date.now(), files: [], ...p, id: p.id || newId() };
  const added = await uploadPages(obj.personId, newFiles, onStep);
  obj.files = [...(obj.files || []), ...added];
  try {
    const saved = await put('paper', obj.personId, obj);
    state.papers.set(saved.id, saved);
    changed();
    return saved;
  } catch (e) {
    try { await api.removeFiles(added.map((f) => f.path)); } catch { /* best effort */ }
    throw e;
  }
}

export async function deletePaperPage(paperId, fileId) {
  const p = paper(paperId);
  const f = p?.files.find((x) => x.id === fileId);
  if (!f) return;
  const saved = await put('paper', p.personId, { ...p, files: p.files.filter((x) => x.id !== fileId) });
  state.papers.set(saved.id, saved);
  try { await api.removeFiles([f.path]); } catch { /* the record no longer points at it */ }
  changed();
}

export async function deletePaper(id, { quiet = false } = {}) {
  const p = paper(id);
  if (!p) return;
  await api.deleteRecord(group().id, id);
  try { await api.removeFiles(p.files.map((f) => f.path)); } catch { /* the record is gone already */ }
  state.papers.delete(id);
  if (!quiet) changed();
}

/** Every page file of the household (used before deleting the whole household). */
export async function removeAllPaperFiles() {
  const paths = papers().flatMap((p) => p.files.map((f) => f.path));
  for (let i = 0; i < paths.length; i += 100) await api.removeFiles(paths.slice(i, i + 100));
}

const fileUrls = new Map();
function forgetFileUrls() {
  fileUrls.forEach((u) => URL.revokeObjectURL(u));
  fileUrls.clear();
}

/** Downloads and decrypts one page; returns an object URL (kept for this session). */
export async function fileUrl(f) {
  if (fileUrls.has(f.id)) return fileUrls.get(f.id);
  const data = await api.downloadFile(f.path);
  const bytes = await decryptBytes(state.key, data, f.iv);
  const url = URL.createObjectURL(new Blob([bytes], { type: f.type }));
  fileUrls.set(f.id, url);
  return url;
}

// ---------- Emergency cards ----------

/** Medicines someone is on now (as-needed included; stopped or finished courses left out). */
export function currentMeds(personId, nowMs = Date.now()) {
  const day = isoDate(new Date(nowMs));
  return meds().filter((m) => m.personId === personId && !m.stopped
    && (!m.startDate || m.startDate <= day) && (!m.endDate || m.endDate >= day));
}

/** Plain cards (what a paramedic needs) for everyone this account can see. */
export function emergencyCards() {
  return people().map((p) => ({
    id: p.id, name: p.name, birthYear: p.birthYear || null, bloodType: p.bloodType || '', color: p.color,
    allergies: p.allergies || [], conditions: p.conditions || [], contactName: p.contactName || '', contactPhone: p.contactPhone || '',
    meds: currentMeds(p.id).map((m) => ({ name: m.name, strength: m.strength || '', form: m.form, doseAmount: m.doseAmount,
      scheduleType: m.scheduleType, times: m.times || [], everyNDays: m.everyNDays || null, foodTiming: m.foodTiming })),
  }));
}

/** Saves the cards on this device, encrypted with the family key (same protection as the key itself). */
async function saveEmergencyCopy() {
  const g = group();
  if (!g || !state.key || !state.loaded) return;
  try {
    const c = await encryptJson(state.key, { savedAt: Date.now(), cards: emergencyCards() });
    localStorage.setItem(SOS_PREFIX + g.id, JSON.stringify(c));
  } catch { /* storage full or private mode: the online cards still work */ }
}

/** The offline copy for the last household used on this device: { savedAt, cards } or null. */
export async function readEmergencyCopy() {
  try {
    const gid = localStorage.getItem(ACTIVE_KEY);
    const raw = gid && localStorage.getItem(SOS_PREFIX + gid);
    const key = gid && loadDeviceKey(gid);
    if (!raw || !key) return null;
    const c = JSON.parse(raw);
    return await decryptJson(key, c.cipher, c.iv);
  } catch {
    return null;
  }
}

/** On sign out the offline cards go too, so a signed-out phone shows nothing. */
export function forgetEmergencyCopies() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(SOS_PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
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
    appointments: appts(),
    papers: papers(), // details only: the photos stay in the household's file storage
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
  // Papers point at files stored for this household, so they come back only into the same one
  if (sameHouse) for (const p of data.papers || []) { await put('paper', p.personId, p); n += 1; }
  for (const a of data.appointments || []) {
    const personId = map(a.personId);
    if (personId) { await put('appointment', personId, { ...a, id: map(a.id), personId }); n += 1; }
  }
  await reload();
  return n;
}
