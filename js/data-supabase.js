// Real backend: the shared Supabase project, schema "fha". Same functions as data-demo.js.
// Health content arrives here already encrypted (cipher + iv); nothing readable is sent.
// Permissions are enforced by Row Level Security and security definer RPCs in schema.sql.

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SCHEMA } from '../config.js';

let sb = null;

export const isDemo = false;

export async function init() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { db: { schema: SUPABASE_SCHEMA } });
}

function check({ data, error }) {
  if (error) {
    const e = new Error(error.message);
    e.code = error.code === '42501' ? 'not_allowed' : (error.message || 'error');
    throw e;
  }
  return data;
}

/** Where auth emails (confirm, reset) send the user back to: this exact page. */
const redirectTo = () => location.origin + location.pathname;

// ---------- Auth ----------

export async function getUser() {
  const { data } = await sb.auth.getUser();
  const u = data?.user;
  return u ? { id: u.id, email: u.email, name: u.user_metadata?.name || u.email.split('@')[0] } : null;
}

export function onAuthChange(cb) {
  const { data } = sb.auth.onAuthStateChange((event) => cb(event));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { const e = new Error(error.message); e.code = 'invalid_login'; throw e; }
}

export async function signUp(email, password, name) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: redirectTo() } });
  if (error) { const e = new Error(error.message); e.code = 'signup_failed'; throw e; }
  return { needsConfirm: !data.session };
}

export async function signOut() {
  await sb.auth.signOut();
}

export async function sendReset(email) {
  check(await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() }));
}

export async function updatePassword(password) {
  check(await sb.auth.updateUser({ password }));
}

// ---------- Households and members ----------

export async function myMemberships() {
  const user = await getUser();
  if (!user) return [];
  const rows = check(await sb.from('members')
    .select('id, group_id, user_id, role, status, person_id, display_name, created_at, groups(id, name, join_code, disabled, key_check_cipher, key_check_iv, created_at)')
    .eq('user_id', user.id)
    .neq('status', 'removed'));
  return rows.filter((r) => r.groups).map(({ groups, ...member }) => ({ member, group: groups }));
}

export async function createGroup(name, keyCheck, displayName) {
  return check(await sb.rpc('create_group', {
    p_name: name, p_key_check_cipher: keyCheck.cipher, p_key_check_iv: keyCheck.iv, p_display_name: displayName,
  }));
}

export async function joinGroup(code, displayName) {
  const name = check(await sb.rpc('join_group', { p_code: String(code).toUpperCase().trim(), p_display_name: displayName }));
  if (!name) { const e = new Error('join_not_found'); e.code = 'join_not_found'; throw e; }
  return { name };
}

export async function listMembers(groupId) {
  return check(await sb.rpc('list_members', { p_group: groupId }));
}

export async function approveMember(memberId, role, personId) {
  check(await sb.rpc('approve_member', { p_member: memberId, p_role: role, p_person: personId || null }));
}
export async function rejectMember(memberId) { check(await sb.rpc('reject_member', { p_member: memberId })); }
export async function setRole(memberId, role, personId) {
  check(await sb.rpc('set_role', { p_member: memberId, p_role: role, p_person: personId || null }));
}
export async function removeMember(memberId) { check(await sb.rpc('remove_member', { p_member: memberId })); }
export async function leaveGroup(groupId) { check(await sb.rpc('leave_group', { p_group: groupId })); }
export async function regenerateJoinCode(groupId) { return check(await sb.rpc('regenerate_join_code', { p_group: groupId })); }
export async function renameGroup(groupId, name) { check(await sb.rpc('rename_group', { p_group: groupId, p_name: name })); }
export async function transferOwnership(groupId, memberId) {
  check(await sb.rpc('transfer_ownership', { p_group: groupId, p_member: memberId }));
}
export async function deleteGroup(groupId) { check(await sb.rpc('delete_group', { p_group: groupId })); }

// ---------- Encrypted records ----------

const RECORD_COLS = 'id, group_id, kind, person_id, cipher, iv, version, created_at, created_by, updated_at, updated_by';

export async function listRecords(groupId) {
  return check(await sb.from('records').select(RECORD_COLS).eq('group_id', groupId).is('deleted_at', null));
}

export async function saveRecord(groupId, rec) {
  const row = { id: rec.id, group_id: groupId, kind: rec.kind, person_id: rec.person_id, cipher: rec.cipher, iv: rec.iv, deleted_at: null };
  return check(await sb.from('records').upsert(row, { onConflict: 'id' }).select(RECORD_COLS).single());
}

export async function deleteRecord(groupId, id) {
  check(await sb.from('records').update({ deleted_at: new Date().toISOString() }).eq('group_id', groupId).eq('id', id));
}

// ---------- Encrypted files (papers) ----------
// Path: <groupId>/<personId>/<fileId>. The bytes are already encrypted; Storage rules in schema.sql.

const BUCKET = 'fha-papers';

export async function uploadFile(path, bytes) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  check(await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'application/octet-stream', upsert: false }));
}

export async function downloadFile(path) {
  const blob = check(await sb.storage.from(BUCKET).download(path));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function removeFiles(paths) {
  if (paths.length) check(await sb.storage.from(BUCKET).remove(paths));
}

export async function listActivity(groupId, limit = 100) {
  return check(await sb.rpc('list_activity', { p_group: groupId, p_limit: limit }));
}

// ---------- Platform owner (#/owner) ----------

export async function isPlatformAdmin() {
  const { data, error } = await sb.rpc('is_platform_admin');
  return !error && data === true;
}
export async function ownerStats() { return check(await sb.rpc('owner_stats')); }
export async function ownerGroups(search = '') { return check(await sb.rpc('owner_groups', { p_search: search })); }
export async function ownerSetDisabled(groupId, disabled) {
  check(await sb.rpc('owner_set_disabled', { p_group: groupId, p_disabled: !!disabled }));
}
