// Picks the backend once at start: demo (localStorage) when config.js has no Supabase values
// or the URL has ?demo, otherwise the real Supabase project. Views never import a backend
// directly; they use this module (through store.js for health records).

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';

const wantDemo = new URLSearchParams(location.search).has('demo') || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY;

export const api = wantDemo ? await import('./data-demo.js') : await import('./data-supabase.js');

export const isDemo = api.isDemo;
