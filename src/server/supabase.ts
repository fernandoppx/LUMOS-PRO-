import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    '[Lumos Pro] Configure SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente do servidor.'
  );
}

/**
 * Cliente administrativo exclusivo do backend.
 *
 * Nunca importar este arquivo no frontend React.
 * Nunca expor SUPABASE_SECRET_KEY em variáveis VITE_*.
 */
export const supabaseServer = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

// Compatibilidade com o middleware security.ts
export const supabase = supabaseServer;
