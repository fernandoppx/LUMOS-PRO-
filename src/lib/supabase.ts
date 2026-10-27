import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  'https://jjbfrrlsoelequgtwgmz.supabase.co';

const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseKey) {
  throw new Error(
    'Chave pública do Supabase não configurada.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
