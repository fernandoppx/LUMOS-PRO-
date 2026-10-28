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
  CurrentUser,
  AdminUser,
  LumosRole,
} from '../types/database';
import {
  DEFAULT_PILARES,
  DEFAULT_CRITERIOS,
} from '../data/diagnosticData';
import { getFaixaFromMedia } from '../utils/formatters';

// Controle da sessão ativa do usuário para isolar cache local
let activeUserId: string | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  activeUserId = session?.user.id ?? null;
});

const privateDataKeys = new Set([
  'lumos_pro_clientes',
  'lumos_pro_diagnosticos',
  'lumos_pro_avaliacoes',
  'lumos_pro_pending_changes',
  'lumos_pro_pre_migration_backup',
]);

function scopedKey(key: string): string | null {
  if (!privateDataKeys.has(key)) return key;
  return activeUserId ? `${key}:${activeUserId}` : null;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Requisições autenticadas usando o token Supabase Auth
async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (error || !token || !data.session?.user.id) {
    throw new ApiError('Sessão expirada ou usuário não autenticado. Faça login novamente.', 401);
  }

  activeUserId = data.session.user.id;

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' });

  if (!response.ok) {
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    const body = isJson ? await response.clone().json().catch(() => null) : null;
    const errorMsg = body?.error || `Falha na requisição (HTTP ${response.status}) em ${url}`;
    throw new ApiError(errorMsg, response.status);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`A rota ${url} retornou resposta inesperada em vez de JSON.`);
  }

  return response;
}

// Chaves para contingência e cache por usuário
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
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  const sKey = scopedKey(key);
  if (!sKey) return fallback;

  try {
    const raw = window.localStorage.getItem(sKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[Lumos Storage] Falha ao ler ${key}:`, err);
    return fallback;
  }
}

function saveStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const sKey = scopedKey(key);
  if (!sKey) return;

  try {
    window.localStorage.setItem(sKey, JSON.stringify(data));
  } catch (err) {
    console.warn(`[Lumos Storage] Falha ao salvar ${key}:`, err);
  }
}

// Cálculo das pontuações dos diagnósticos preservando todas as fórmulas oficiais
export function computeDiagnosticScores(
  diag: Diagnostico,
  clientName: string,
  avaliacoes: Avaliacao[],
  pilares: Pilar[] = DEFAULT_PILARES,
  criterios: Criterio[] = DEFAULT_CRITERIOS
): { diagScore: ScoreDiagnosticoView; pilaresScore: ScorePilarView[] } {
  const evalsMap = new Map<string, Avaliacao>();
  avaliacoes.forEach((a) => {
    if (a.criterio_id) {
      evalsMap.set(a.criterio_id, a);
    }
  });

  const pilaresScore: ScorePilarView[] = pilares.map((pilar) => {
    const pCrit = criterios.filter((c) => c.pilar_id === pilar.id);
    const total_criterios = pCrit.length;

    const pEvals = pCrit
      .map((c) => evalsMap.get(c.id))
      .filter((a): a is Avaliacao => a !== undefined && a.nota !== null && a.nota !== undefined);

    const avaliados = pEvals.length;
    const soma = pEvals.reduce((acc, curr) => acc + (Number(curr.nota) || 0), 0);
    const media = avaliados > 0 ? soma / avaliados : null;
    const percentual = media !== null ? Math.max(0, Math.min(100, ((media - 1) / 2) * 100)) : null;
    const faixa = getFaixaFromMedia(media);

    return {
      diagnostico_id: diag.id,
      cliente_id: diag.cliente_id,
      pilar_id: pilar.id,
      slug: pilar.slug,
      nome: pilar.nome,
      ordem: pilar.ordem,
      total_criterios,
      avaliados,
      media,
      percentual,
      faixa,
    };
  });

  const validMedias = pilaresScore
    .map((p) => p.media)
    .filter((m): m is number => m !== null && m !== undefined && !isNaN(m));

  const media_geral =
    validMedias.length > 0 ? validMedias.reduce((a, b) => a + b, 0) / validMedias.length : null;

  const percentual_geral =
    media_geral !== null ? Math.max(0, Math.min(100, ((media_geral - 1) / 2) * 100)) : null;

  const faixa_geral = getFaixaFromMedia(media_geral);

  const instaScore = pilaresScore.find((p) => p.slug === 'instagram')?.media ?? null;
  const trafegoScore = pilaresScore.find((p) => p.slug === 'trafego')?.media ?? null;
  const comercialScore = pilaresScore.find((p) => p.slug === 'comercial')?.media ?? null;

  const totalAvaliados = pilaresScore.reduce((acc, p) => acc + p.avaliados, 0);
  const totalCrit = pilaresScore.reduce((acc, p) => acc + p.total_criterios, 0);

  const diagScore: ScoreDiagnosticoView = {
    diagnostico_id: diag.id,
    cliente_id: diag.cliente_id,
    cliente_nome: clientName,
    data_referencia: diag.data_referencia,
    status: diag.status,
    media_instagram: instaScore,
    media_trafego: trafegoScore,
    media_comercial: comercialScore,
    media_geral,
    percentual_geral,
    faixa_geral,
    avaliados: totalAvaliados,
    total_criterios: totalCrit,
  };

  return { diagScore, pilaresScore };
}

export const dataRepository = {
  // Pilares e Critérios
  async getPilares(): Promise<Pilar[]> {
    return DEFAULT_PILARES;
  },

  async getCriterios(): Promise<Criterio[]> {
    return DEFAULT_CRITERIOS;
  },

  // Clientes
  async getClients(): Promise<Cliente[]> {
    try {
      const res = await authenticatedFetch('/api/clientes');
      const list: Cliente[] = await res.json();
      saveStorage(STORAGE_KEYS.CLIENTES, list);
      return list;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        throw err;
      }
      // Contingência offline somente se houver dados em cache do usuário ativo
      const cached = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
      if (cached.length > 0) return cached;
      throw err;
    }
  },

  async getClientById(id: string): Promise<Cliente | null> {
    try {
      const res = await authenticatedFetch(`/api/clientes/${id}`);
      const client: Cliente = await res.json();
      return client;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        throw err;
      }
      // Tenta recuperar do cache local do usuário ativo em caso de falha de rede
      const cached = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
      const found = cached.find((c) => c.id === id);
      if (found) return found;
      throw err;
    }
  },

  async createClient(payload: Partial<Cliente>): Promise<Cliente> {
    const res = await authenticatedFetch('/api/clientes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const created: Cliente = await res.json();

    const cached = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    saveStorage(STORAGE_KEYS.CLIENTES, [created, ...cached.filter((c) => c.id !== created.id)]);

    return created;
  },

  async updateClient(id: string, payload: Partial<Cliente>): Promise<Cliente> {
    const res = await authenticatedFetch(`/api/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const updated: Cliente = await res.json();

    const cached = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    saveStorage(
      STORAGE_KEYS.CLIENTES,
      cached.map((c) => (c.id === id ? { ...c, ...updated } : c))
    );

    return updated;
  },

  async deleteClient(id: string): Promise<void> {
    await authenticatedFetch(`/api/clientes/${id}`, {
      method: 'DELETE',
    });

    const cached = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    saveStorage(STORAGE_KEYS.CLIENTES, cached.filter((c) => c.id !== id));
  },

  // Diagnósticos
  async getDiagnosticsByClient(clientId: string): Promise<Diagnostico[]> {
    try {
      const res = await authenticatedFetch(`/api/diagnosticos?cliente_id=${encodeURIComponent(clientId)}`);
      const list: Diagnostico[] = await res.json();
      return list;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        throw err;
      }
      const cached = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
      return cached.filter((d) => d.cliente_id === clientId);
    }
  },

  async getDiagnosticById(id: string): Promise<Diagnostico | null> {
    try {
      const res = await authenticatedFetch(`/api/diagnosticos/${id}`);
      const data = await res.json();
      return data.diagnostico || null;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        throw err;
      }
      const cached = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
      return cached.find((d) => d.id === id) || null;
    }
  },

  async createDiagnostic(clientId: string, initialData?: Partial<Diagnostico>): Promise<Diagnostico> {
    const res = await authenticatedFetch('/api/diagnosticos', {
      method: 'POST',
      body: JSON.stringify({
        cliente_id: clientId,
        ...initialData,
      }),
    });
    const created: Diagnostico = await res.json();

    const cached = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    saveStorage(STORAGE_KEYS.DIAGNOSTICOS, [created, ...cached]);

    return created;
  },

  async updateDiagnostic(
    id: string,
    payload: Partial<Diagnostico>,
    baseVersion?: string
  ): Promise<Diagnostico> {
    const res = await authenticatedFetch(`/api/diagnosticos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...payload,
        base_version: baseVersion,
      }),
    });
    const updated: Diagnostico = await res.json();

    const cached = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    saveStorage(
      STORAGE_KEYS.DIAGNOSTICOS,
      cached.map((d) => (d.id === id ? { ...d, ...updated } : d))
    );

    return updated;
  },

  async deleteDiagnostic(id: string): Promise<void> {
    await authenticatedFetch(`/api/diagnosticos/${id}`, {
      method: 'DELETE',
    });

    const cached = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    saveStorage(STORAGE_KEYS.DIAGNOSTICOS, cached.filter((d) => d.id !== id));
  },

  // Avaliações
  async getAvaliacoes(diagnosticId: string): Promise<Avaliacao[]> {
    try {
      const res = await authenticatedFetch(`/api/diagnosticos/${diagnosticId}`);
      const data = await res.json();
      return data.avaliacoes || [];
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        throw err;
      }
      const cached = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
      return cached.filter((a) => a.diagnostico_id === diagnosticId);
    }
  },

  async saveAvaliacoes(
    diagnosticId: string,
    dirtyItems: Partial<Avaliacao>[],
    baseVersion?: string
  ): Promise<{ success: boolean; count: number; updated_at?: string; items?: Avaliacao[] }> {
    const res = await authenticatedFetch(`/api/diagnosticos/${diagnosticId}/avaliacoes`, {
      method: 'PUT',
      body: JSON.stringify({
        items: dirtyItems,
        base_version: baseVersion,
      }),
    });
    return res.json();
  },

  // Pontuações e Relatórios
  async getDiagnosticScores(diagnosticId: string): Promise<{
    diagScore: ScoreDiagnosticoView | null;
    pilaresScore: ScorePilarView[];
  }> {
    const diag = await this.getDiagnosticById(diagnosticId);
    if (!diag) {
      return { diagScore: null, pilaresScore: [] };
    }

    const client = await this.getClientById(diag.cliente_id);
    const avaliacoes = await this.getAvaliacoes(diagnosticId);

    return computeDiagnosticScores(diag, client?.nome || 'Cliente', avaliacoes);
  },

  async getDiagnosticScoresByClient(clientId: string): Promise<ScoreDiagnosticoView[]> {
    const client = await this.getClientById(clientId);
    const diagnostics = await this.getDiagnosticsByClient(clientId);

    const scoresList: ScoreDiagnosticoView[] = [];
    for (const diag of diagnostics) {
      const avaliacoes = await this.getAvaliacoes(diag.id);
      const { diagScore } = computeDiagnosticScores(diag, client?.nome || 'Cliente', avaliacoes);
      scoresList.push(diagScore);
    }

    return scoresList.sort(
      (a, b) => new Date(b.data_referencia).getTime() - new Date(a.data_referencia).getTime()
    );
  },

  async getClientsWithLatestScore(): Promise<
    Array<Cliente & { ultimoDiagnostico?: ScoreDiagnosticoView | null }>
  > {
    const clients = await this.getClients();

    let allDiags: Diagnostico[] = [];
    try {
      const res = await authenticatedFetch('/api/diagnosticos');
      allDiags = await res.json();
    } catch (_e) {
      allDiags = [];
    }

    const diagsByClient = new Map<string, Diagnostico[]>();
    allDiags.forEach((d) => {
      const list = diagsByClient.get(d.cliente_id) || [];
      list.push(d);
      diagsByClient.set(d.cliente_id, list);
    });

    const results: Array<Cliente & { ultimoDiagnostico?: ScoreDiagnosticoView | null }> = [];

    for (const client of clients) {
      const clientDiags = diagsByClient.get(client.id) || [];
      if (clientDiags.length === 0) {
        results.push({ ...client, ultimoDiagnostico: null });
        continue;
      }

      clientDiags.sort(
        (a, b) => new Date(b.data_referencia).getTime() - new Date(a.data_referencia).getTime()
      );
      const latestDiag = clientDiags[0];

      try {
        const avaliacoes = await this.getAvaliacoes(latestDiag.id);
        const { diagScore } = computeDiagnosticScores(latestDiag, client.nome, avaliacoes);
        results.push({ ...client, ultimoDiagnostico: diagScore });
      } catch (_e) {
        results.push({ ...client, ultimoDiagnostico: null });
      }
    }

    return results;
  },

  async getPublicReport(token: string): Promise<PublicReportData | null> {
    try {
      const res = await fetch(`/api/diagnosticos/public/${encodeURIComponent(token)}`);
      if (!res.ok) {
        return null;
      }
      const data: PublicReportData = await res.json();
      return data;
    } catch (err) {
      console.error('[dataRepository getPublicReport]:', err);
      return null;
    }
  },

  // Usuário Atual e Administração
  async getCurrentUser(): Promise<CurrentUser | null> {
    try {
      const res = await authenticatedFetch('/api/me');
      const data = await res.json();
      return data.user || null;
    } catch (err) {
      console.error('[dataRepository getCurrentUser]:', err);
      return null;
    }
  },

  async updateMyProfile(nome: string): Promise<CurrentUser> {
    const res = await authenticatedFetch('/api/me', {
      method: 'PATCH',
      body: JSON.stringify({ nome }),
    });
    const data = await res.json();
    return data.user;
  },

  async getAdminUsers(): Promise<AdminUser[]> {
    const res = await authenticatedFetch('/api/admin/usuarios');
    const data: AdminUser[] = await res.json();
    return data;
  },

  async updateUserRole(
    userId: string,
    papel: LumosRole
  ): Promise<{ success: boolean; message: string; usuario: AdminUser }> {
    const res = await authenticatedFetch(`/api/admin/usuarios/${encodeURIComponent(userId)}/papel`, {
      method: 'PATCH',
      body: JSON.stringify({ papel }),
    });
    return res.json();
  },

  async resetToDemo(): Promise<void> {
    // Mantém proteção de dados reais
  },

  async clearAll(): Promise<void> {
    // Mantém proteção de dados reais
  },
};
