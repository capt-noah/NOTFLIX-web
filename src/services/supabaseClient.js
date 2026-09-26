import { createClient } from '@supabase/supabase-js';

// Hardcoded production defaults (capt-noah project)
const DEFAULT_SUPABASE_URL = 'https://ijcptfcyltdrpkrrewzc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqY3B0ZmN5bHRkcnBrcnJld3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMTE1MTIsImV4cCI6MjEwNTY4NzUxMn0.ycwuFsFf_W_aKh8Cs8niglASGDbKc2dpeIC2dmJ2BM4';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || import.meta.env?.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, storageKey: 'supabase-auth-token' }
});
export const supabaseAnon = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'supabase-anon-token',
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
  }
});
