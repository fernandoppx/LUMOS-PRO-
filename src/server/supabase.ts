import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn(
    '[Supabase Server] Variáveis SUPABASE_URL ou SUPABASE_SECRET_KEY não encontradas no ambiente.'
  );
}

/**
 * Cliente Supabase exclusivo do backend (Node.js).
 * Utiliza a chave secreta do servidor com privilégios administrativos.
 * Mantém o RLS ativado nas tabelas para clientes públicos sem expor a chave secreta.
 */
export const supabaseServer = createClient(
  supabaseUrl || '',
  supabaseSecretKey || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
