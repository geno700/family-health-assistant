// Supabase connection for the shared "github apps" project.
// Only the project URL and the PUBLISHABLE (anon) key belong here. Never the service_role or
// a secret key. Leave both empty to run the app in demo mode (sample data in this browser).
export const SUPABASE_URL = '';
export const SUPABASE_PUBLISHABLE_KEY = '';

// Schema that holds this app's tables (must be listed under Data API > Exposed schemas).
export const SUPABASE_SCHEMA = 'fha';
