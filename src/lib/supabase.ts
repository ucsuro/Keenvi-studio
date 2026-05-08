import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. The application will not be able to fetch data. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
}

let supabaseClient;
try {
  supabaseClient = createClient(
    supabaseUrl || 'https://placeholder-url.supabase.co', 
    supabaseAnonKey || 'placeholder-key'
  );
} catch (e) {
  console.error('Supabase client failed to initialize:', e);
  supabaseClient = null as any;
}

export const supabase = supabaseClient;

export const auth = supabase?.auth;
