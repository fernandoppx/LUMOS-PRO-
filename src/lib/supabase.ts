import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://ffddntdnirpkjbxuaqxl.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZGRudGRuaXJwa2pieHVhcXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTgzMDQsImV4cCI6MjEwODMzNDMwNH0.wHIbdr-s0Px88vkABIpmjyz0qzedigWSth-yzOi5Rt8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
