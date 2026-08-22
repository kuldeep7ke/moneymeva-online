// Fallback runtime config: values are baked at build time from NEXT_PUBLIC_* env vars.
// The hardcoded fallbacks guarantee Google sign-in and sync work even if env vars are
// missing at build time (e.g. an APK built without .env.local). The Supabase anon key
// is a public client key (already present in every deployed web bundle) — row-level
// security on the database protects the actual data.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://orpgmbrycnmjwtalupce.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycGdtYnJ5Y25tand0YWx1cGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NDk0MjUsImV4cCI6MjEwMjUyNTQyNX0.-TEONoqeaJzbPcJZnMoQDZznmoGajlNpXLrSESSIv4U';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://moneymevaonline.pages.dev';

// jsonbin.io Bin IDs (for broadcast & banner — edit via jsonbin.io dashboard)
export const BROADCAST_BIN_ID = process.env.NEXT_PUBLIC_BROADCAST_BIN_ID || '';
export const BANNER_BIN_ID = process.env.NEXT_PUBLIC_BANNER_BIN_ID || '';
