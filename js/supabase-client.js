// ============================================================================
// Saudi Workforce 360 — Supabase client
// Project URL + anon public key only. Both are meant to be embedded in
// client-side code — Row Level Security in the database (see backend/) is
// what actually restricts access, not secrecy of these values. Never put
// the service_role key or DB password here.
// ============================================================================

const SUPABASE_URL = 'https://ykfcrlmojrpdzmdwxboi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZmNybG1vanJwZHptZHd4Ym9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4Mzk3MTMsImV4cCI6MjEwMTQxNTcxM30.yNImgVwEBi5KSvTol9zm8LzPPvd5n4_2D0Lwld93Whc';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
