import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  'https://jjbfrrlsoelequgtwgmz.supabase.co';

const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (
  !supabaseKey ||
  !(
    supabaseKey.startsWith('sb_publishable_') ||
    supabaseKey.startsWith('eyJ')
  )
) {
  throw new Error(
    'Chave pública inválida ou ausente. Verifique VITE_SUPABASE_PUBLISHABLE_KEY.'
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
