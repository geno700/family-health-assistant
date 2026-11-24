// End-to-end encryption of health records with the household's family key.
// The key is made here, shown once to the owner, and kept only on devices (localStorage).
// The server only ever receives { cipher, iv }.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // base32 (RFC 4648)
const KEY_CHECK_TEXT = 'fha-key-check-v1';
const STORE_PREFIX = 'fha.key.';

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** 32 random bytes as 52 base32 characters in groups of 4 ("ABCD-EFGH-…"). */
export function encodeKeyCode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out.match(/.{1,4}/g).join('-');
}

/** Accepts the code with or without dashes/spaces, any letter case. Returns 32 bytes or null. */
export function decodeKeyCode(code) {
  // Base32 has no 0, 1 or 8, so read those as the letters people mistake them for
  const clean = String(code || '').toUpperCase()
    .replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B')
    .replace(/[^A-Z2-7]/g, '');
  if (clean.length !== 52) return null;
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return out.length >= 32 ? new Uint8Array(out.slice(0, 32)) : null;
}

export function newKeyBytes() {
  return crypto.getRandomValues(new Uint8Array(32));
}

async function importKey(bytes) {
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Encrypts any JSON-able value. Returns { cipher, iv } as base64 strings. */
export async function encryptJson(keyBytes, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importKey(keyBytes);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { cipher: toB64(new Uint8Array(data)), iv: toB64(iv) };
}

/** Decrypts { cipher, iv }. Throws if the key is wrong or the data was changed. */
export async function decryptJson(keyBytes, cipher, iv) {
  const key = await importKey(keyBytes);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(cipher));
  return JSON.parse(dec.decode(data));
}

/** Encrypts file bytes (a photo or PDF). Returns { data: Uint8Array, iv: base64 }. */
export async function encryptBytes(keyBytes, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importKey(keyBytes);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { data: new Uint8Array(data), iv: toB64(iv) };
}

/** Decrypts file bytes. Throws if the key is wrong or the file was changed. */
export async function decryptBytes(keyBytes, data, iv) {
  const key = await importKey(keyBytes);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, data));
}

/** The encrypted test value stored with the household, used to check a typed key. */
export function makeKeyCheck(keyBytes) {
  return encryptJson(keyBytes, KEY_CHECK_TEXT);
}

export async function keyMatches(keyBytes, check) {
  if (!check || !check.cipher) return false;
  try {
    return (await decryptJson(keyBytes, check.cipher, check.iv)) === KEY_CHECK_TEXT;
  } catch {
    return false;
  }
}

// ---- Keys kept on this device ----

export function saveDeviceKey(groupId, keyBytes) {
  try { localStorage.setItem(STORE_PREFIX + groupId, toB64(keyBytes)); } catch { /* private mode */ }
}

export function loadDeviceKey(groupId) {
  try {
    const v = localStorage.getItem(STORE_PREFIX + groupId);
    return v ? fromB64(v) : null;
  } catch {
    return null;
  }
}

export function forgetDeviceKey(groupId) {
  try { localStorage.removeItem(STORE_PREFIX + groupId); } catch { /* ignore */ }
}
