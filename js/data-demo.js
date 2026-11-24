// Demo backend: a pretend server kept in this browser's localStorage, with the same functions
// as data-supabase.js and the same permission rules as the database (RLS), so demo mode
// behaves like the real thing. Health records are stored encrypted here too.

import { encryptJson, encryptBytes, makeKeyCheck, newKeyBytes, saveDeviceKey } from './crypto.js';

const DB_KEY = 'fha.demo.db.v4'; // v4: papers + dose history (v3: appointments, v2: pharmacy + MSA)
const USER_KEY = 'fha.demo.user';
const WRITERS = ['owner', 'admin', 'caregiver'];
const ADMINS = ['owner', 'admin'];

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function load() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)); } catch { return null; }
}
function store(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}
function fail(code) {
  const e = new Error(code);
  e.code = code;
  throw e;
}

let listeners = [];
function emit(event) {
  listeners.forEach((cb) => cb(event, getUserSync()));
}

function getUserSync() {
  const db = load();
  const id = localStorage.getItem(USER_KEY);
  return db?.users.find((u) => u.id === id) || null;
}

function me() {
  return getUserSync() || fail('not_signed_in');
}

function memberOf(db, groupId, userId) {
  const g = db.groups.find((x) => x.id === groupId);
  if (!g || g.disabled) return null;
  return db.members.find((m) => m.group_id === groupId && m.user_id === userId && m.status === 'active') || null;
}

function needRole(db, groupId, roles) {
  const m = memberOf(db, groupId, me().id);
  if (!m || !roles.includes(m.role)) fail('not_allowed');
  return m;
}

function joinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => chars[b % chars.length]).join('');
}

function log(db, groupId, action, extra = {}) {
  db.activity.unshift({ id: uid(), group_id: groupId, user_id: me().id, at: now(), action, ...extra });
  db.activity = db.activity.slice(0, 500);
}

// ---------- Sample data ----------

/** Builds the sample household with encrypted records. Fake names and medicines only. */
async function seed() {
  const key = newKeyBytes();
  const gid = uid();
  const p = { mama: uid(), baba: uid(), ahmed: uid() };
  const users = [
    { id: 'demo-owner', email: 'owner@example.com', name: 'أحمد' },
    { id: 'demo-care', email: 'sara@example.com', name: 'سارة' },
    { id: 'demo-patient', email: 'mama@example.com', name: 'الأم' },
    { id: 'demo-viewer', email: 'khaled@example.com', name: 'خالد' },
    { id: 'demo-new', email: 'mona@example.com', name: 'منى' },
  ];
  const t0 = now();
  const db = {
    users,
    platform_admins: ['demo-owner'],
    groups: [{ id: gid, name: 'المنزل', join_code: joinCode(), disabled: false, created_at: t0, created_by: 'demo-owner', ...(await prefix('key_check', makeKeyCheck(key))) }],
    members: [
      { id: uid(), group_id: gid, user_id: 'demo-owner', role: 'owner', status: 'active', person_id: null, display_name: users[0].name, created_at: t0 },
      { id: uid(), group_id: gid, user_id: 'demo-care', role: 'caregiver', status: 'active', person_id: null, display_name: users[1].name, created_at: t0 },
      { id: uid(), group_id: gid, user_id: 'demo-patient', role: 'patient', status: 'active', person_id: p.mama, display_name: users[2].name, created_at: t0 },
      { id: uid(), group_id: gid, user_id: 'demo-viewer', role: 'viewer', status: 'active', person_id: null, display_name: users[3].name, created_at: t0 },
      { id: uid(), group_id: gid, user_id: 'demo-new', role: 'viewer', status: 'pending', person_id: null, display_name: users[4].name, created_at: t0 },
    ],
    records: [],
    activity: [],
  };
  // A second, disabled household shows the platform owner panel with more than one row
  db.groups.push({ id: uid(), name: 'منزل تجريبي 2', join_code: joinCode(), disabled: true, created_at: t0, created_by: 'demo-new', key_check_cipher: '', key_check_iv: '' });

  const today = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const start = new Date(today); start.setDate(start.getDate() - 20);
  const week = new Date(today); week.setDate(week.getDate() + 6);
  const created = Date.now() - 20 * 86400000;
  const items = [
    ['person', p.mama, { name: 'الأم', birthYear: 1962, bloodType: 'O+', allergies: ['Penicillin'], conditions: ['ضغط الدم'], contactName: 'أحمد', contactPhone: '01000000000', breakfast: '08:00', lunch: '14:00', dinner: '20:00', color: 0 }],
    ['person', p.baba, { name: 'الأب', birthYear: 1958, bloodType: 'A+', allergies: [], conditions: ['السكري'], contactName: 'سارة', contactPhone: '01111111111', breakfast: '07:30', lunch: '14:30', dinner: '21:00', color: 1 }],
    ['person', p.ahmed, { name: 'أحمد', birthYear: 1990, bloodType: '', allergies: [], conditions: [], contactName: '', contactPhone: '', breakfast: '09:00', lunch: '15:00', dinner: '21:00', color: 2 }],
    ['medicine', uid(), { personId: p.mama, name: 'Concor', strength: '5 mg', form: 'TABLET', doseAmount: 1, scheduleType: 'DAILY', times: ['08:30', '20:30'], foodTiming: 'AFTER', startDate: iso(start), endDate: null, stopped: false, createdAt: created }],
    ['medicine', uid(), { personId: p.mama, name: 'Eltroxin', strength: '50 mcg', form: 'TABLET', doseAmount: 1, scheduleType: 'DAILY', times: ['07:30'], foodTiming: 'BEFORE', startDate: iso(start), endDate: null, stopped: false, createdAt: created }],
    ['medicine', uid(), { personId: p.baba, name: 'Glucophage', strength: '500 mg', form: 'TABLET', doseAmount: 1, scheduleType: 'DAILY', times: ['08:00', '14:30', '21:30'], foodTiming: 'WITH', startDate: iso(start), endDate: null, stopped: false, createdAt: created }],
    ['medicine', uid(), { personId: p.baba, name: 'Vidrop', strength: '2800 IU', form: 'DROPS', doseAmount: 2, scheduleType: 'EVERY_N_DAYS', everyNDays: 7, times: ['10:00'], foodTiming: 'NONE', startDate: iso(today), endDate: null, stopped: false, createdAt: created }],
    ['medicine', uid(), { personId: p.ahmed, name: 'Augmentin', strength: '1 g', form: 'TABLET', doseAmount: 1, scheduleType: 'DAILY', times: ['09:00', '21:00'], foodTiming: 'AFTER', startDate: iso(today), endDate: iso(week), stopped: false, createdAt: created }],
    ['medicine', uid(), { personId: p.ahmed, name: 'Panadol', strength: '500 mg', form: 'TABLET', doseAmount: 2, scheduleType: 'AS_NEEDED', times: [], foodTiming: 'NONE', startDate: iso(start), endDate: null, stopped: false, createdAt: created }],
  ];
  // Home pharmacy: boxes counted yesterday, with expiry months around today
  const ym = (months) => { const d = new Date(today.getFullYear(), today.getMonth() + months, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const counted = Date.now() - 86400000;
  const boxes = [
    { name: 'Concor', strength: '5 mg', form: 'TABLET', count: 26, expiry: ym(1), note: 'دولاب المطبخ' },
    { name: 'Concor', strength: '5 mg', form: 'TABLET', count: 30, expiry: ym(11), note: 'دولاب المطبخ' },
    { name: 'Eltroxin', strength: '50 mcg', form: 'TABLET', count: 5, expiry: ym(9), note: '' },
    { name: 'Glucophage', strength: '500 mg', form: 'TABLET', count: 60, expiry: ym(14), note: '' },
    { name: 'Augmentin', strength: '1 g', form: 'TABLET', count: 14, expiry: ym(6), note: 'درج الأدوية' },
    { name: 'Panadol', strength: '500 mg', form: 'TABLET', count: 20, expiry: ym(18), note: '' },
    { name: 'Brufen', strength: '400 mg', form: 'TABLET', count: 18, expiry: ym(10), note: '' },
    { name: 'Antinal', strength: '200 mg', form: 'CAPSULE', count: 12, expiry: ym(7), note: '' },
    { name: 'Otrivin', strength: '0.1%', form: 'DROPS', count: 1, expiry: ym(-1), note: '' },
    { name: 'Fucidin', strength: '2%', form: 'CREAM', count: 1, expiry: ym(8), note: '' },
    { name: 'Vidrop', strength: '2800 IU', form: 'DROPS', count: 1, expiry: ym(5), note: '' },
  ];
  boxes.forEach((b) => items.push(['stock', uid(), { ...b, countedAt: counted, createdAt: created }]));
  // Appointments: tomorrow, in 5 days and one last month
  const at = (days, h, m) => { const d = new Date(today); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.getTime(); };
  items.push(['appointment', uid(), { personId: p.mama, name: 'د. سامي (عيادة القلب)', at: at(1, 18, 30), place: 'مستشفى المدينة، الدور الثالث', note: 'أحضري نتيجة رسم القلب الأخيرة.', createdAt: created }]);
  items.push(['appointment', uid(), { personId: p.baba, name: 'معمل التحاليل', at: at(5, 9, 0), place: 'معمل النور', note: 'صائمًا 8 ساعات قبل التحليل.', createdAt: created }]);
  items.push(['appointment', uid(), { personId: p.baba, name: 'د. منى (السكري)', at: at(-30, 17, 0), place: '', note: '', createdAt: created }]);
  // Dose history for Mum's medicines, up to the day before the pharmacy count (so stock is unchanged)
  items.filter(([k, , d]) => k === 'medicine' && d.personId === p.mama).forEach(([, medId, m]) => {
    for (let i = 14; i >= 2; i--) {
      for (const time of m.times) {
        const [h, mi] = time.split(':').map(Number);
        const d = new Date(today); d.setDate(d.getDate() - i); d.setHours(h, mi, 0, 0);
        const skipped = (i === 6 && time === m.times[0]) || (i === 9 && m.times.length > 1 && time === m.times[1]);
        if (i === 4 && time === m.times[0]) continue; // one dose nobody recorded
        items.push(['dose_log', uid(), { medicineId: medId, personId: p.mama, scheduledAt: d.getTime(), status: skipped ? 'SKIPPED' : 'TAKEN', amount: m.doseAmount, actedAt: d.getTime() + 600000, actedBy: 'سارة' }]);
      }
    }
  });
  // Papers: drawn sample pages (clearly marked as samples), encrypted like real ones
  const samplePapers = [
    { personId: p.mama, title: 'روشتة د. سامي', kind: 'PRESCRIPTION', date: iso(start), doctor: 'د. سامي (عيادة القلب)', lines: ['Rx', 'Concor 5 mg', '1 x 2', 'Eltroxin 50 mcg', '1 x 1'] },
    { personId: p.baba, title: 'تحليل السكر', kind: 'LAB', date: iso(start), doctor: 'معمل النور', lines: ['LAB REPORT', 'Test: ......', 'Result: ......'] },
  ];
  const files = [];
  for (const sp of samplePapers) {
    const bytes = await samplePage(sp.lines);
    const { data, iv } = await encryptBytes(key, bytes);
    const fileId = uid();
    const path = `${gid}/${sp.personId}/${fileId}`;
    files.push([path, data]);
    const { lines, ...meta } = sp;
    items.push(['paper', uid(), { ...meta, note: '', files: [{ id: fileId, path, iv, type: 'image/jpeg', size: bytes.length }], createdAt: created }]);
  }
  try { await filesTx('readwrite', (s) => { s.clear(); files.forEach(([path, data]) => s.put(data, path)); }); } catch { /* no IndexedDB: papers show "couldn't load" */ }
  for (const [kind, id, data] of items) {
    const personId = kind === 'person' ? id : kind === 'stock' ? gid : data.personId;
    const c = await encryptJson(key, { ...data, id });
    db.records.push({ id, group_id: gid, kind, person_id: personId, cipher: c.cipher, iv: c.iv, version: 1, created_at: t0, created_by: 'demo-owner', updated_at: t0, updated_by: 'demo-owner', deleted_at: null });
  }
  try { ['fha.demo.db.v2', 'fha.demo.db.v3'].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } // older sample data
  // The demo device already "knows" the family key, as if the owner typed it
  saveDeviceKey(gid, key);
  store(db);
  localStorage.setItem(USER_KEY, 'demo-owner');
  return db;
}

async function prefix(name, promise) {
  const v = await promise;
  return { [`${name}_cipher`]: v.cipher, [`${name}_iv`]: v.iv };
}

// ---------- Auth ----------

export const isDemo = true;

export async function init() {
  if (!load()) await seed();
}

export function getUser() {
  return Promise.resolve(getUserSync());
}

export function onAuthChange(cb) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((x) => x !== cb); };
}

export async function signIn(email) {
  const db = load();
  const u = db.users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
  if (!u) fail('invalid_login');
  localStorage.setItem(USER_KEY, u.id);
  emit('SIGNED_IN');
}

export async function signUp(email, _password, name) {
  const db = load();
  if (db.users.some((x) => x.email.toLowerCase() === email.toLowerCase())) fail('user_exists');
  const u = { id: uid(), email, name: name || email.split('@')[0] };
  db.users.push(u);
  store(db);
  localStorage.setItem(USER_KEY, u.id);
  emit('SIGNED_IN');
  return { needsConfirm: false };
}

export async function signOut() {
  localStorage.removeItem(USER_KEY);
  emit('SIGNED_OUT');
}

export async function sendReset() { /* demo: nothing to send */ }
export async function updatePassword() { /* demo: passwords aren't stored */ }

// ---------- Households and members ----------

export async function myMemberships() {
  const db = load();
  const user = me();
  return db.members
    .filter((m) => m.user_id === user.id && m.status !== 'removed')
    .map((m) => ({ member: m, group: db.groups.find((g) => g.id === m.group_id) }))
    .filter((x) => x.group);
}

export async function createGroup(name, keyCheck, displayName) {
  const db = load();
  const user = me();
  const g = { id: uid(), name: name.trim(), join_code: joinCode(), disabled: false, created_at: now(), created_by: user.id, key_check_cipher: keyCheck.cipher, key_check_iv: keyCheck.iv };
  db.groups.push(g);
  db.members.push({ id: uid(), group_id: g.id, user_id: user.id, role: 'owner', status: 'active', person_id: null, display_name: displayName || user.name, created_at: now() });
  log(db, g.id, 'group_created');
  store(db);
  return g;
}

export async function joinGroup(code, displayName) {
  const db = load();
  const user = me();
  const g = db.groups.find((x) => x.join_code === String(code).toUpperCase().trim() && !x.disabled);
  if (!g) fail('join_not_found');
  const existing = db.members.find((m) => m.group_id === g.id && m.user_id === user.id);
  if (existing) {
    if (existing.status === 'removed') { existing.status = 'pending'; existing.role = 'viewer'; }
  } else {
    db.members.push({ id: uid(), group_id: g.id, user_id: user.id, role: 'viewer', status: 'pending', person_id: null, display_name: displayName || user.name, created_at: now() });
  }
  store(db);
  return { name: g.name };
}

export async function listMembers(groupId) {
  const db = load();
  if (!memberOf(db, groupId, me().id)) fail('not_allowed');
  return db.members.filter((m) => m.group_id === groupId && m.status !== 'removed')
    .map((m) => ({ ...m, email: db.users.find((u) => u.id === m.user_id)?.email || '' }));
}

function memberRow(db, memberId) {
  return db.members.find((m) => m.id === memberId) || fail('not_found');
}

export async function approveMember(memberId, role, personId) {
  const db = load();
  const m = memberRow(db, memberId);
  needRole(db, m.group_id, ADMINS);
  if (role === 'owner') fail('not_allowed');
  if (role === 'patient' && !personId) fail('need_person');
  Object.assign(m, { status: 'active', role, person_id: role === 'patient' ? personId : null });
  log(db, m.group_id, 'member_approved', { detail: { member: m.display_name, role } });
  store(db);
}

export async function rejectMember(memberId) {
  const db = load();
  const m = memberRow(db, memberId);
  needRole(db, m.group_id, ADMINS);
  m.status = 'removed';
  log(db, m.group_id, 'member_rejected', { detail: { member: m.display_name } });
  store(db);
}

export async function setRole(memberId, role, personId) {
  const db = load();
  const m = memberRow(db, memberId);
  const actor = needRole(db, m.group_id, ADMINS);
  if (m.role === 'owner' || role === 'owner') fail('not_allowed');
  if (actor.role === 'admin' && m.role === 'admin' && m.user_id !== actor.user_id) fail('not_allowed');
  if (role === 'patient' && !personId) fail('need_person');
  const before = m.role;
  Object.assign(m, { role, person_id: role === 'patient' ? personId : null });
  log(db, m.group_id, 'role_changed', { detail: { member: m.display_name, from: before, to: role } });
  store(db);
}

export async function removeMember(memberId) {
  const db = load();
  const m = memberRow(db, memberId);
  needRole(db, m.group_id, ADMINS);
  if (m.role === 'owner') fail('not_allowed');
  m.status = 'removed';
  log(db, m.group_id, 'member_removed', { detail: { member: m.display_name } });
  store(db);
}

export async function leaveGroup(groupId) {
  const db = load();
  const m = db.members.find((x) => x.group_id === groupId && x.user_id === me().id && x.status !== 'removed') || fail('not_found');
  if (m.role === 'owner') fail('owner_cannot_leave');
  m.status = 'removed';
  log(db, groupId, 'member_left', { detail: { member: m.display_name } });
  store(db);
}

export async function regenerateJoinCode(groupId) {
  const db = load();
  needRole(db, groupId, ADMINS);
  const g = db.groups.find((x) => x.id === groupId);
  g.join_code = joinCode();
  log(db, groupId, 'join_code_changed');
  store(db);
  return g.join_code;
}

export async function renameGroup(groupId, name) {
  const db = load();
  needRole(db, groupId, ADMINS);
  if (!name.trim()) fail('name_required');
  const g = db.groups.find((x) => x.id === groupId);
  const before = g.name;
  g.name = name.trim();
  log(db, groupId, 'group_renamed', { detail: { from: before, to: g.name } });
  store(db);
}

export async function transferOwnership(groupId, memberId) {
  const db = load();
  const actor = needRole(db, groupId, ['owner']);
  const target = memberRow(db, memberId);
  if (target.group_id !== groupId || target.status !== 'active') fail('not_allowed');
  actor.role = 'admin';
  Object.assign(target, { role: 'owner', person_id: null });
  log(db, groupId, 'ownership_transferred', { detail: { to: target.display_name } });
  store(db);
}

export async function deleteGroup(groupId) {
  const db = load();
  needRole(db, groupId, ['owner']);
  db.groups = db.groups.filter((g) => g.id !== groupId);
  db.members = db.members.filter((m) => m.group_id !== groupId);
  db.records = db.records.filter((r) => r.group_id !== groupId);
  db.activity = db.activity.filter((a) => a.group_id !== groupId);
  store(db);
}

// ---------- Encrypted records ----------

function canRead(m, r) {
  return m.role !== 'patient' || r.person_id === m.person_id;
}
function canWrite(m, kind, personId) {
  return WRITERS.includes(m.role) || (m.role === 'patient' && kind === 'dose_log' && personId === m.person_id);
}

export async function listRecords(groupId) {
  const db = load();
  const m = memberOf(db, groupId, me().id) || fail('not_allowed');
  return db.records.filter((r) => r.group_id === groupId && !r.deleted_at && canRead(m, r));
}

/** Insert or update one record ({ id, kind, person_id, cipher, iv }). Returns the stored row. */
export async function saveRecord(groupId, rec) {
  const db = load();
  const m = memberOf(db, groupId, me().id) || fail('not_allowed');
  if (!canWrite(m, rec.kind, rec.person_id)) fail('not_allowed');
  const existing = db.records.find((r) => r.id === rec.id && r.group_id === groupId);
  if (existing && !canWrite(m, existing.kind, existing.person_id)) fail('not_allowed');
  const t = now();
  if (existing) {
    log(db, groupId, existing.deleted_at ? 'insert' : 'update', { kind: rec.kind, record_id: rec.id, before_cipher: existing.cipher, before_iv: existing.iv, after_cipher: rec.cipher, after_iv: rec.iv });
    Object.assign(existing, { kind: rec.kind, person_id: rec.person_id, cipher: rec.cipher, iv: rec.iv, version: existing.version + 1, updated_at: t, updated_by: me().id, deleted_at: null });
    store(db);
    return existing;
  }
  const row = { id: rec.id, group_id: groupId, kind: rec.kind, person_id: rec.person_id, cipher: rec.cipher, iv: rec.iv, version: 1, created_at: t, created_by: me().id, updated_at: t, updated_by: me().id, deleted_at: null };
  db.records.push(row);
  log(db, groupId, 'insert', { kind: rec.kind, record_id: rec.id, after_cipher: rec.cipher, after_iv: rec.iv });
  store(db);
  return row;
}

export async function deleteRecord(groupId, id) {
  const db = load();
  const m = memberOf(db, groupId, me().id) || fail('not_allowed');
  const r = db.records.find((x) => x.id === id && x.group_id === groupId);
  if (!r) return;
  if (!canWrite(m, r.kind, r.person_id)) fail('not_allowed');
  r.deleted_at = now();
  log(db, groupId, 'delete', { kind: r.kind, record_id: id, before_cipher: r.cipher, before_iv: r.iv });
  store(db);
}

export async function listActivity(groupId, limit = 100) {
  const db = load();
  needRole(db, groupId, ADMINS);
  return db.activity.filter((a) => a.group_id === groupId).slice(0, limit)
    .map((a) => ({ ...a, user_name: db.members.find((m) => m.group_id === groupId && m.user_id === a.user_id)?.display_name || '' }));
}

// ---------- Platform owner (#/owner) ----------

export async function isPlatformAdmin() {
  const user = getUserSync();
  return !!user && load().platform_admins.includes(user.id);
}

function needPlatformAdmin() {
  if (!load().platform_admins.includes(me().id)) fail('not_allowed');
}

export async function ownerStats() {
  needPlatformAdmin();
  const db = load();
  const weekAgo = Date.now() - 7 * 86400000;
  return {
    groups: db.groups.length,
    users: db.users.length,
    week_activity: db.activity.filter((a) => Date.parse(a.at) > weekAgo).length,
  };
}

export async function ownerGroups(search = '') {
  needPlatformAdmin();
  const db = load();
  const q = search.trim().toLowerCase();
  return db.groups
    .filter((g) => !q || g.name.toLowerCase().includes(q))
    .map((g) => ({
      id: g.id, name: g.name, disabled: g.disabled, created_at: g.created_at,
      members: db.members.filter((m) => m.group_id === g.id && m.status === 'active').length,
      records: db.records.filter((r) => r.group_id === g.id && !r.deleted_at).length,
      last_activity: db.activity.find((a) => a.group_id === g.id)?.at || null,
    }));
}

export async function ownerSetDisabled(groupId, disabled) {
  needPlatformAdmin();
  const db = load();
  const g = db.groups.find((x) => x.id === groupId) || fail('not_found');
  g.disabled = !!disabled;
  store(db);
}

/** A plain drawn page for the sample papers, marked SAMPLE so it never looks real. */
async function samplePage(lines) {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 1000;
  const g = c.getContext('2d');
  g.fillStyle = '#fffdf6'; g.fillRect(0, 0, 800, 1000);
  g.strokeStyle = '#1F6F5C'; g.lineWidth = 6; g.strokeRect(30, 30, 740, 940);
  g.fillStyle = '#1E2A26'; g.font = 'bold 56px sans-serif';
  lines.forEach((l, i) => g.fillText(l, 80, 160 + i * 90));
  g.save(); g.translate(400, 760); g.rotate(-0.25);
  g.fillStyle = 'rgba(198,40,40,.35)'; g.font = 'bold 110px sans-serif'; g.textAlign = 'center';
  g.fillText('SAMPLE', 0, 0); g.restore();
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
  return new Uint8Array(await blob.arrayBuffer());
}

// ---------- Encrypted files (papers) ----------
// Kept in this browser's IndexedDB (localStorage is too small for photos), with the same
// rules as the Storage policies: path <groupId>/<personId>/<fileId>; members read (a patient
// only their own person); owner/admin/caregiver add and remove.

const FILES_DB = 'fha-demo-files';

function filesDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FILES_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function filesTx(mode, fn) {
  const db = await filesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', mode);
    const out = fn(tx.objectStore('files'));
    tx.oncomplete = () => { db.close(); resolve(out?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function checkPath(path, write) {
  const [g, p, f] = String(path).split('/');
  if (!g || !p || !f) fail('not_allowed');
  const db = load();
  if (write) return needRole(db, g, WRITERS);
  const m = memberOf(db, g, me().id) || fail('not_allowed');
  if (m.role === 'patient' && m.person_id !== p) fail('not_allowed');
  return m;
}

export async function uploadFile(path, bytes) {
  checkPath(path, true);
  await filesTx('readwrite', (s) => s.put(bytes, path));
}

export async function downloadFile(path) {
  checkPath(path, false);
  const data = await filesTx('readonly', (s) => s.get(path));
  return data || fail('not_found');
}

export async function removeFiles(paths) {
  paths.forEach((p) => checkPath(p, true));
  await filesTx('readwrite', (s) => paths.forEach((p) => s.delete(p)));
}

// ---------- Demo only ----------

export function demoUsers() {
  return load()?.users.filter((u) => u.id.startsWith('demo-')) || [];
}

export function demoSwitchUser(userId) {
  localStorage.setItem(USER_KEY, userId);
  emit('SIGNED_IN');
}

export async function demoReset() {
  localStorage.removeItem(DB_KEY);
  try { await filesTx('readwrite', (s) => s.clear()); } catch { /* no files yet */ }
  await seed();
  emit('SIGNED_IN');
}
