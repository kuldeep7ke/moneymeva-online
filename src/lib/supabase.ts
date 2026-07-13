import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isDemo = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder');

function createMockClient(): any {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => {},
      signInWithOAuth: () => {},
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          then: (cb: (v: any) => void) => { cb({ data: null, error: null }); return Promise.resolve({ data: null, error: null }); },
        }),
        then: (cb: (v: any) => void) => { cb({ data: [], error: null }); return Promise.resolve({ data: [], error: null }); },
      }),
      upsert: () => Promise.resolve({ error: null }),
      insert: () => Promise.resolve({ error: null }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  };
}

export const supabase: any = isDemo
  ? createMockClient()
  : createClient(supabaseUrl, supabaseAnonKey);
