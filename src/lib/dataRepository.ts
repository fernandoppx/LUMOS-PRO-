import {
  Cliente,
  Diagnostico,
  Avaliacao,
  ScoreDiagnosticoView,
  ScorePilarView,
  PublicReportData,
  Pilar,
  Criterio,
  PilarSlug,
} from '../types/database';
import {
  DEFAULT_PILARES,
  DEFAULT_CRITERIOS,
} from '../data/diagnosticData';
import { getFaixaFromMedia, getRotuloPadrao } from '../utils/formatters';

// Storage keys for local persistence / offline contingency
const STORAGE_KEYS = {
  CLIENTES: 'lumos_pro_clientes',
  DIAGNOSTICOS: 'lumos_pro_diagnosticos',
  AVALIACOES: 'lumos_pro_avaliacoes',
  PILARES: 'lumos_pro_pilares',
  CRITERIOS: 'lumos_pro_criterios',
  PENDING_CHANGES: 'lumos_pro_pending_changes',
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
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[Lumos Storage] Falha ao ler ${key}:`, err);
    return fallback;
  }
}

function saveStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`[Lumos Storage] Falha ao gravar ${key}:`, err);
  }
}

// Compute scores for a specific diagnostic - preserves exact business formula
export function computeDiagnosticScores(
  diag: Diagnostico,
  client: Cliente | null,
  avaliacoes: Avaliacao[],
  criterios: Criterio[] = DEFAULT_CRITERIOS,
  pilares: Pilar[] = DEFAULT_PILARES
): { diagScore: ScoreDiagnosticoView; pilaresScore: ScorePilarView[] } {
  const pilaresScore: ScorePilarView[] = pilares.map((pilar) => {
    const pCrit = criterios.filter((c) => c.pilar_id === pilar.id && c.ativo);
    const critIds = new Set(pCrit.map((c) => c.id));
    const pAvaliacoes = avaliacoes.filter(
      (a) => critIds.has(a.criterio_id) && a.nota !== null && a.nota !== undefined
    );

    const avaliados = pAvaliacoes.length;
    const soma = pAvaliacoes.reduce((acc, curr) => acc + (curr.nota || 0), 0);
    const media = avaliados > 0 ? soma / avaliados : null;
    const percentual = media !== null ? ((media - 1) / 2) * 100 : null;
    const faixa = getFaixaFromMedia(media);

    return {
      diagnostico_id: diag.id,
      cliente_id: diag.cliente_id,
      pilar_id: pilar.id,
      slug: pilar.slug,
      nome: pilar.nome,
      ordem: pilar.ordem,
      total_criterios: pCrit.length,
      avaliados,
      media,
      percentual,
      faixa,
    };
  });

  const instaPilar = pilaresScore.find((p) => p.slug === 'instagram');
  const trafegoPilar = pilaresScore.find((p) => p.slug === 'trafego');
  const comPilar = pilaresScore.find((p) => p.slug === 'comercial');

  const validMedias = pilaresScore
    .map((p) => p.media)
    .filter((m): m is number => m !== null && m !== undefined && !isNaN(m));

  // Overall average is the mean of the 3 pillar averages
  const mediaGeral =
    validMedias.length > 0
      ? validMedias.reduce((a, b) => a + b, 0) / validMedias.length
      : null;

  const percentualGeral = mediaGeral !== null ? ((mediaGeral - 1) / 2) * 100 : null;
  const faixaGeral = getFaixaFromMedia(mediaGeral);

  const totalAvaliados = pilaresScore.reduce((acc, curr) => acc + curr.avaliados, 0);
  const totalCriterios = criterios.filter((c) => c.ativo).length;

  const diagScore: ScoreDiagnosticoView = {
    diagnostico_id: diag.id,
    cliente_id: diag.cliente_id,
    cliente_nome: client?.nome || 'Cliente',
    data_referencia: diag.data_referencia,
    status: diag.status,
    media_instagram: instaPilar?.media ?? null,
    media_trafego: trafegoPilar?.media ?? null,
    media_comercial: comPilar?.media ?? null,
    media_geral: mediaGeral,
    percentual_geral: percentualGeral,
    faixa_geral: faixaGeral,
    avaliados: totalAvaliados,
    total_criterios: totalCriterios,
  };

  return { diagScore, pilaresScore };
}

// Request sequence numbers to prevent out-of-order race conditions
let currentSaveSeq = 0;
let lastAckSaveSeq = 0;

export const dataRepository = {
  // PILARES & CRITERIOS
  async getPilares(): Promise<Pilar[]> {
    const local = loadStorage<Pilar[]>(STORAGE_KEYS.PILARES, []);
    if (local.length > 0) return local;
    saveStorage(STORAGE_KEYS.PILARES, DEFAULT_PILARES);
    return DEFAULT_PILARES;
  },

  async getCriterios(): Promise<Criterio[]> {
    const local = loadStorage<Criterio[]>(STORAGE_KEYS.CRITERIOS, []);
    if (local.length > 0) return local;
    saveStorage(STORAGE_KEYS.CRITERIOS, DEFAULT_CRITERIOS);
    return DEFAULT_CRITERIOS;
  },

  // CLIENTES
  async getClients(): Promise<Cliente[]> {
    try {
      const res = await fetch('/api/clientes', { credentials: 'same-origin' });
      if (res.ok) {
        const backendClients: Cliente[] = await res.json();
        if (Array.isArray(backendClients)) {
          saveStorage(STORAGE_KEYS.CLIENTES, backendClients);
          return backendClients;
        }
      }
    } catch (err) {
      console.warn('[dataRepository.getClients] Modo contingência offline:', err);
    }
    return loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
  },

  async getClientById(id: string): Promise<Cliente | null> {
    try {
      const res = await fetch(`/api/clientes/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      if (res.ok) {
        const backendClient: Cliente = await res.json();
        if (backendClient?.id) {
          const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
          const index = clients.findIndex((c) => c.id === id);
          if (index !== -1) {
            clients[index] = backendClient;
          } else {
            clients.unshift(backendClient);
          }
          saveStorage(STORAGE_KEYS.CLIENTES, clients);
          return backendClient;
        }
      }
    } catch (err) {
      console.warn('[dataRepository.getClientById] Modo contingência offline:', err);
    }
    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    return clients.find((c) => c.id === id) || null;
  },

  async createClient(data: Omit<Cliente, 'id' | 'created_at' | 'updated_at'>): Promise<Cliente> {
    const newId = generateId('client');
    const localClient: Cliente = {
      ...data,
      id: newId,
      segmento: 'Splash',
      ativo: data.ativo ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...data, id: newId }),
      });

      if (res.ok) {
        const saved: Cliente = await res.json();
        const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
        clients.unshift(saved);
        saveStorage(STORAGE_KEYS.CLIENTES, clients);
        return saved;
      }
    } catch (err) {
      console.warn('[dataRepository.createClient] Erro ao sincronizar com backend:', err);
    }

    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    clients.unshift(localClient);
    saveStorage(STORAGE_KEYS.CLIENTES, clients);
    return localClient;
  },

  async updateClient(id: string, updates: Partial<Cliente>): Promise<Cliente> {
    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    const index = clients.findIndex((c) => c.id === id);

    let finalClient: Cliente = {
      id,
      nome: updates.nome || 'Cliente',
      segmento: 'Splash',
      ativo: updates.ativo ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...updates,
    };

    try {
      const res = await fetch(`/api/clientes/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        finalClient = await res.json();
      }
    } catch (err) {
      console.warn('[dataRepository.updateClient] Erro ao sincronizar com backend:', err);
    }

    if (index !== -1) {
      clients[index] = finalClient;
    } else {
      clients.unshift(finalClient);
    }
    saveStorage(STORAGE_KEYS.CLIENTES, clients);
    return finalClient;
  },

  async deleteClient(id: string): Promise<void> {
    try {
      await fetch(`/api/clientes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
    } catch (err) {
      console.warn('[dataRepository.deleteClient] Falha na rede ao excluir no backend:', err);
    }

    // Remove local diagnostics and evaluations for this client
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const clientDiagIds = diags.filter((d) => d.cliente_id === id).map((d) => d.id);
    const diagIdSet = new Set(clientDiagIds);

    saveStorage(
      STORAGE_KEYS.DIAGNOSTICOS,
      diags.filter((d) => d.cliente_id !== id)
    );

    const avaliacoes = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
    saveStorage(
      STORAGE_KEYS.AVALIACOES,
      avaliacoes.filter((a) => !diagIdSet.has(a.diagnostico_id))
    );

    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    saveStorage(
      STORAGE_KEYS.CLIENTES,
      clients.filter((c) => c.id !== id)
    );
  },

  // DIAGNOSTICOS
  async getDiagnosticsByClient(clienteId: string): Promise<Diagnostico[]> {
    try {
      const res = await fetch(`/api/diagnosticos?cliente_id=${encodeURIComponent(clienteId)}`, {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const backendDiags: Diagnostico[] = await res.json();
        if (Array.isArray(backendDiags)) {
          // Reconcilia com o cache local
          const allDiags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
          const otherDiags = allDiags.filter((d) => d.cliente_id !== clienteId);
          saveStorage(STORAGE_KEYS.DIAGNOSTICOS, [...backendDiags, ...otherDiags]);
          return backendDiags;
        }
      }
    } catch (err) {
      console.warn('[dataRepository.getDiagnosticsByClient] Contingência offline:', err);
    }

    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    return diags
      .filter((d) => d.cliente_id === clienteId)
      .sort((a, b) => (b.data_referencia || '').localeCompare(a.data_referencia || ''));
  },

  async getDiagnosticById(id: string): Promise<Diagnostico | null> {
    try {
      const res = await fetch(`/api/diagnosticos/${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.diagnostico) {
          const diag: Diagnostico = data.diagnostico;
          const avals: Avaliacao[] = data.avaliacoes || [];

          // Atualiza cache de diagnósticos
          const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
          const index = diags.findIndex((d) => d.id === id);
          if (index !== -1) {
            diags[index] = diag;
          } else {
            diags.unshift(diag);
          }
          saveStorage(STORAGE_KEYS.DIAGNOSTICOS, diags);

          // Atualiza cache de avaliações
          const existingAvals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
          const otherAvals = existingAvals.filter((a) => a.diagnostico_id !== id);
          saveStorage(STORAGE_KEYS.AVALIACOES, [...otherAvals, ...avals]);

          return diag;
        }
      }
    } catch (err) {
      console.warn('[dataRepository.getDiagnosticById] Contingência offline:', err);
    }

    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    return diags.find((d) => d.id === id) || null;
  },

  async createDiagnostic(clienteId: string, userId?: string | null): Promise<Diagnostico> {
    const newId = generateId('diag');
    const localDiag: Diagnostico = {
      id: newId,
      cliente_id: clienteId,
      data_referencia: new Date().toISOString().slice(0, 10),
      status: 'rascunho',
      resumo: '',
      compartilhado: false,
      share_token: generateId('token'),
      criado_por: userId || 'lumos_app',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/diagnosticos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          id: newId,
          cliente_id: clienteId,
          criado_por: userId,
          data_referencia: localDiag.data_referencia,
        }),
      });

      if (res.ok) {
        const created: Diagnostico = await res.json();
        const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
        diags.unshift(created);
        saveStorage(STORAGE_KEYS.DIAGNOSTICOS, diags);
        return created;
      }
    } catch (err) {
      console.warn('[dataRepository.createDiagnostic] Falha na rede ao criar no backend:', err);
    }

    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    diags.unshift(localDiag);
    saveStorage(STORAGE_KEYS.DIAGNOSTICOS, diags);
    return localDiag;
  },

  async updateDiagnostic(
    id: string,
    updates: Partial<Diagnostico>,
    baseVersion?: string
  ): Promise<Diagnostico> {
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const index = diags.findIndex((d) => d.id === id);

    let updatedDiag: Diagnostico = {
      ...(index !== -1 ? diags[index] : {}),
      ...updates,
      id,
      cliente_id: index !== -1 ? diags[index].cliente_id : '',
      created_at: index !== -1 ? diags[index].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Diagnostico;

    try {
      const res = await fetch(`/api/diagnosticos/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...updates, base_version: baseVersion }),
      });

      if (res.status === 409) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Conflito de versão detectado no diagnóstico.');
      }

      if (res.ok) {
        updatedDiag = await res.json();
      }
    } catch (err) {
      console.warn('[dataRepository.updateDiagnostic] Erro ou conflito ao atualizar:', err);
      throw err;
    }

    if (index !== -1) {
      diags[index] = updatedDiag;
    } else {
      diags.unshift(updatedDiag);
    }
    saveStorage(STORAGE_KEYS.DIAGNOSTICOS, diags);
    return updatedDiag;
  },

  async deleteDiagnostic(id: string): Promise<void> {
    try {
      await fetch(`/api/diagnosticos/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
    } catch (err) {
      console.warn('[dataRepository.deleteDiagnostic] Falha de rede ao excluir:', err);
    }

    // 1. Remove evaluations
    const avals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
    saveStorage(
      STORAGE_KEYS.AVALIACOES,
      avals.filter((a) => a.diagnostico_id !== id)
    );

    // 2. Remove diagnostic
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    saveStorage(
      STORAGE_KEYS.DIAGNOSTICOS,
      diags.filter((d) => d.id !== id)
    );
  },

  // AVALIACOES
  async getAvaliacoes(diagnosticId: string): Promise<Avaliacao[]> {
    // 1. Tenta carregar do backend
    try {
      const res = await fetch(`/api/diagnosticos/${encodeURIComponent(diagnosticId)}`, {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.avaliacoes && Array.isArray(data.avaliacoes)) {
          const avals: Avaliacao[] = data.avaliacoes;
          const allAvals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
          const otherAvals = allAvals.filter((a) => a.diagnostico_id !== diagnosticId);
          saveStorage(STORAGE_KEYS.AVALIACOES, [...otherAvals, ...avals]);
          return avals;
        }
      }
    } catch (err) {
      console.warn('[dataRepository.getAvaliacoes] Contingência offline:', err);
    }

    const avals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
    return avals.filter((a) => a.diagnostico_id === diagnosticId);
  },

  async saveAvaliacoes(
    diagnosticId: string,
    items: Array<{
      criterio_id: string;
      nota: number | null;
      solucao?: string | null;
      observacao?: string | null;
      recomendacao?: string | null;
      evidencia_url?: string | null;
      id?: string;
    }>,
    baseVersion?: string
  ): Promise<{ success: boolean; updated_at?: string }> {
    if (!items.length) return { success: true };

    const thisSeq = ++currentSaveSeq;

    // Atualiza imediatamente o buffer local
    const avals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
    for (const item of items) {
      const existingIndex = avals.findIndex(
        (a) => a.diagnostico_id === diagnosticId && a.criterio_id === item.criterio_id
      );

      if (existingIndex !== -1) {
        avals[existingIndex] = {
          ...avals[existingIndex],
          nota: item.nota,
          solucao: item.solucao !== undefined ? item.solucao : avals[existingIndex].solucao,
          observacao: item.observacao !== undefined ? item.observacao : avals[existingIndex].observacao,
          recomendacao: item.recomendacao !== undefined ? item.recomendacao : avals[existingIndex].recomendacao,
          evidencia_url: item.evidencia_url !== undefined ? item.evidencia_url : avals[existingIndex].evidencia_url,
        };
      } else {
        avals.push({
          id: item.id || generateId('aval'),
          diagnostico_id: diagnosticId,
          criterio_id: item.criterio_id,
          nota: item.nota,
          solucao: item.solucao || null,
          observacao: item.observacao || null,
          recomendacao: item.recomendacao || null,
          evidencia_url: item.evidencia_url || null,
        });
      }
    }
    saveStorage(STORAGE_KEYS.AVALIACOES, avals);

    // Sincroniza com o Supabase via Backend API
    try {
      const res = await fetch(`/api/diagnosticos/${encodeURIComponent(diagnosticId)}/avaliacoes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          items,
          base_version: baseVersion,
        }),
      });

      if (res.status === 409) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Conflito de concorrência detectado.');
      }

      if (!res.ok) {
        throw new Error(`Erro do servidor (${res.status}) ao gravar avaliações.`);
      }

      // Descarte de resposta fora de ordem (race condition prevention)
      if (thisSeq < lastAckSaveSeq) {
        console.warn(`[dataRepository.saveAvaliacoes] Resposta fora de ordem descartada (seq: ${thisSeq} < ${lastAckSaveSeq})`);
        return { success: true };
      }
      lastAckSaveSeq = thisSeq;

      const data = await res.json();
      return { success: true, updated_at: data.updated_at };
    } catch (err) {
      console.warn('[dataRepository.saveAvaliacoes] Falha ao persistir no Supabase:', err);
      throw err;
    }
  },

  // SCORES & VIEWS
  async getDiagnosticScores(
    diagnosticId: string
  ): Promise<{ diagScore: ScoreDiagnosticoView | null; pilaresScore: ScorePilarView[] }> {
    const diag = await this.getDiagnosticById(diagnosticId);
    if (!diag) return { diagScore: null, pilaresScore: [] };

    const client = await this.getClientById(diag.cliente_id);
    const avaliacoes = await this.getAvaliacoes(diagnosticId);
    return computeDiagnosticScores(diag, client, avaliacoes, await this.getCriterios(), await this.getPilares());
  },

  async getDiagnosticScoresByClient(clienteId: string): Promise<ScoreDiagnosticoView[]> {
    const diags = await this.getDiagnosticsByClient(clienteId);
    const client = await this.getClientById(clienteId);

    const result: ScoreDiagnosticoView[] = [];
    for (const d of diags) {
      const avals = await this.getAvaliacoes(d.id);
      const { diagScore } = computeDiagnosticScores(d, client, avals, await this.getCriterios(), await this.getPilares());
      result.push(diagScore);
    }
    return result;
  },

  async getClientsWithLatestScore(): Promise<
    Array<Cliente & { ultimoDiagnostico?: ScoreDiagnosticoView | null }>
  > {
    const clients = await this.getClients();
    const result: Array<Cliente & { ultimoDiagnostico?: ScoreDiagnosticoView | null }> = [];

    for (const client of clients) {
      const diags = await this.getDiagnosticsByClient(client.id);
      let latestScore: ScoreDiagnosticoView | null = null;
      if (diags.length > 0) {
        const latestDiag = diags[0];
        const avals = await this.getAvaliacoes(latestDiag.id);
        const { diagScore } = computeDiagnosticScores(latestDiag, client, avals, await this.getCriterios(), await this.getPilares());
        latestScore = diagScore;
      }
      result.push({
        ...client,
        ultimoDiagnostico: latestScore,
      });
    }

    return result;
  },

  // PUBLIC REPORT
  async getPublicReport(token: string): Promise<PublicReportData | null> {
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const diag = diags.find(
      (d) => d.share_token === token && d.compartilhado && d.status === 'finalizado'
    );

    if (!diag) {
      return null;
    }

    const client = await this.getClientById(diag.cliente_id);
    if (!client) return null;

    const avaliacoes = await this.getAvaliacoes(diag.id);
    const criterios = await this.getCriterios();
    const pilares = await this.getPilares();

    const reportPilares = pilares.map((pilar) => {
      const pCrit = criterios.filter((c) => c.pilar_id === pilar.id && c.ativo);
      const critItems = pCrit.map((crit) => {
        const av = avaliacoes.find((a) => a.criterio_id === crit.id);
        const nota = av?.nota ?? null;
        const rotulo = nota ? getRotuloPadrao(pilar.slug, nota) : 'Sem avaliação';
        return {
          nome: crit.nome,
          nota,
          rotulo,
          solucao: av?.solucao || null,
        };
      });

      const validNotas = critItems
        .map((c) => c.nota)
        .filter((n): n is number => n !== null && n !== undefined);

      const media =
        validNotas.length > 0
          ? validNotas.reduce((a, b) => a + b, 0) / validNotas.length
          : null;

      return {
        slug: pilar.slug as PilarSlug,
        nome: pilar.nome,
        avaliador: pilar.avaliador,
        media,
        faixa: getFaixaFromMedia(media),
        criterios: critItems,
      };
    });

    return {
      cliente: {
        nome: client.nome,
        segmento: client.segmento,
        instagram: client.instagram,
      },
      diagnostico: {
        data: diag.data_referencia,
        resumo: diag.resumo,
      },
      pilares: reportPilares,
    };
  },

  resetToDemo(): void {
    console.info('resetToDemo executado');
  },

  clearAll(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEYS.CLIENTES);
      window.localStorage.removeItem(STORAGE_KEYS.DIAGNOSTICOS);
      window.localStorage.removeItem(STORAGE_KEYS.AVALIACOES);
    }
  },
};
