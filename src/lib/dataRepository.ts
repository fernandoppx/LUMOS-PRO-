import { supabase } from './supabase';
import {
  Cliente,
  Diagnostico,
  Avaliacao,
  ScoreDiagnosticoView,
  ScorePilarView,
  PublicReportData,
  Pilar,
  Criterio,
} from '../types/database';
import {
  DEFAULT_PILARES,
  DEFAULT_CRITERIOS,
} from '../data/diagnosticData';
import { getFaixaFromMedia } from '../utils/formatters';

// Todas as chamadas privadas utilizam a sessão real do Supabase Auth.
// Sem autenticação, nenhuma chamada ou dado privado em cache é liberado.
let activeUserId: string | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  activeUserId = session?.user.id ?? null;
});

const privateDataKeys = new Set([
  'lumos_pro_clientes', 'lumos_pro_diagnosticos', 'lumos_pro_avaliacoes',
  'lumos_pro_pending_changes', 'lumos_pro_pre_migration_backup',
]);
function scopedKey(key: string): string | null {
  if (!privateDataKeys.has(key)) return key;
  return activeUserId ? `${key}:${activeUserId}` : null;
}

class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token || !data.session?.user.id) {
    throw new Error('Sessão expirada ou usuário não autenticado. Entre novamente.');
  }
  activeUserId = data.session.user.id;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  // Não interpretar HTML da Vercel como dados nem contornar erros de autorização.
  if (!response.ok) {
    const body = (response.headers.get('content-type') || '').includes('application/json')
      ? await response.clone().json().catch(() => null)
      : null;
    throw new ApiError(body?.error || `Falha na API: HTTP ${response.status} em ${url}`, response.status);
  }
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    throw new Error(`A rota ${url} retornou HTML em vez de JSON. Verifique o backend da Vercel.`);
  }
  return response;
}

// Storage keys for local persistence / offline contingency
const STORAGE_KEYS = {
  CLIENTES: 'lumos_pro_clientes',
  DIAGNOSTICOS: 'lumos_pro_diagnosticos',
  AVALIACOES: 'lumos_pro_avaliacoes',
  PILARES: 'lumos_pro_pilares',
  CRITERIOS: 'lumos_pro_criterios',
} as const;

function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage || !scopedKey(key)) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(scopedKey(key)!);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[Lumos Storage] Falha ao ler ${key}:`, err);
    return fallback;
  }
}

function saveStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined' || !window.localStorage || !scopedKey(key)) {
    return;
