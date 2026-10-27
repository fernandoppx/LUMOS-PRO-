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
  PRE_MIGRATION_BACKUP: 'lumos_pro_pre_migration_backup',
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

  // CLIENTES (Não-destrutivo: preserva clientes locais mesmo se o servidor estiver vazio ou inacessível)
  async getClients(): Promise<Cliente[]> {
    const localClients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);

    try {
      const res = await fetch('/api/clientes', { credentials: 'same-origin' });
      if (res.ok) {
        const backendClients: Cliente[] = await res.json();
        if (Array.isArray(backendClients)) {
          // Merge seguro: preserva todos do servidor e mantém qualquer cliente local que ainda não subiu
          const serverIds = new Set(backendClients.map((c) => c.id));
          const pendingLocals = localClients.filter((c) => !serverIds.has(c.id)).map((c) => ({
            ...c,
            _pendingSync: true,
          }));

          const merged = [...backendClients, ...pendingLocals];
          saveStorage(STORAGE_KEYS.CLIENTES, merged);
          return merged;
        }
      }
    } catch (err) {
      console.warn('[dataRepository.getClients] API indisponível, usando cache local seguro:', err);
    }

    return localClients;
  },

  async getClientById(id: string): Promise<Cliente | null> {
    const localClients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    const cached = localClients.find((c) => c.id === id);

    try {
      const res = await fetch(`/api/clientes/${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
      });

      if (res.ok) {
        const backendClient: Cliente = await res.json();
        if (backendClient?.id) {
          const index = localClients.findIndex((c) => c.id === id);
          if (index !== -1) {
            localClients[index] = backendClient;
          } else {
            localClients.unshift(backendClient);
          }
          saveStorage(STORAGE_KEYS.CLIENTES, localClients);
          return backendClient;
        }
      }

      // Tratamento estrito de erros HTTP para diferenciar causas reais
      if (res.status === 404) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await res.json().catch(() => null);
          if (body?.error === 'Cliente não encontrado.') {
            // Cliente realmente não existe no Supabase
            if (cached) return { ...cached, _pendingSync: true };
            return null;
          }
        }
        // Se a Vercel retornou 404 de rota não encontrada (infraestrutura)
        if (cached) return { ...cached, _pendingSync: true };
        throw new Error('Falha no serviço da Vercel: rota de API não encontrada (HTTP 404). O backend pode estar em processo de publicação.');
      }

      if (res.status === 401 || res.status === 403) {
        if (cached) return { ...cached, _pendingSync: true };
        throw new Error('Acesso restrito: este dispositivo não possui permissão para consultar os dados deste cliente (HTTP 403).');
      }

      if (res.status >= 500) {
        if (cached) return { ...cached, _pendingSync: true };
        throw new Error(`Erro interno do servidor ao carregar dados do cliente (HTTP ${res.status}).`);
      }
    } catch (err: unknown) {
      if (cached) {
        console.info(`[dataRepository.getClientById] Utilizando cache local para o cliente ${id}`);
        return { ...cached, _pendingSync: true };
      }
      if (err instanceof Error) throw err;
      throw new Error('Falha de conexão com o servidor. Verifique sua conexão com a internet ou se a API está ativa.');
    }

    return cached || null;
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
      _pendingSync: true,
    };

    // Sempre garante o cliente gravado no cache local preventivo primeiro
    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    clients.unshift(localClient);
    saveStorage(STORAGE_KEYS.CLIENTES, clients);

    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...data, id: newId }),
      });

      if (res.ok) {
        const saved: Cliente = await res.json();
        const currentList = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
        const idx = currentList.findIndex((c) => c.id === newId);
        if (idx !== -1) {
          currentList[idx] = { ...saved, _pendingSync: false };
        } else {
          currentList.unshift(saved);
        }
        saveStorage(STORAGE_KEYS.CLIENTES, currentList);
        return saved;
      }
    } catch (err) {
      console.warn('[dataRepository.createClient] API indisponível, mantido no cache local como pendente:', err);
    }

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
      created_at: index !== -1 ? clients[index].created_at : new Date().toISOString(),
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

  // DIAGNOSTICOS (Não-destrutivo)
  async getDiagnosticsByClient(clienteId: string): Promise<Diagnostico[]> {
    const localDiags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const localMatching = localDiags.filter((d) => d.cliente_id === clienteId);

    try {
      const res = await fetch(`/api/diagnosticos?cliente_id=${encodeURIComponent(clienteId)}`, {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const backendDiags: Diagnostico[] = await res.json();
        if (Array.isArray(backendDiags)) {
          const serverDiagIds = new Set(backendDiags.map((d) => d.id));
          const pendingLocals = localMatching.filter((d) => !serverDiagIds.has(d.id)).map((d) => ({
            ...d,
            _pendingSync: true,
          }));

          const mergedThisClient = [...backendDiags, ...pendingLocals];
          const otherDiags = localDiags.filter((d) => d.cliente_id !== clienteId);
          saveStorage(STORAGE_KEYS.DIAGNOSTICOS, [...mergedThisClient, ...otherDiags]);

          return mergedThisClient.sort((a, b) =>
            (b.data_referencia || '').localeCompare(a.data_referencia || '')
          );
        }
      }
    } catch (err) {
      console.warn('[dataRepository.getDiagnosticsByClient] Contingência offline:', err);
    }

    return localMatching.sort((a, b) =>
      (b.data_referencia || '').localeCompare(a.data_referencia || '')
    );
  },

  async getDiagnosticById(id: string): Promise<Diagnostico | null> {
    const localDiags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const cached = localDiags.find((d) => d.id === id);

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

      if (res.status === 404) {
        if (cached) return { ...cached, _pendingSync: true };
        return null;
      }
    } catch (err) {
      console.warn('[dataRepository.getDiagnosticById] Contingência offline:', err);
    }

    return cached || null;
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
      _pendingSync: true,
    };

    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    diags.unshift(localDiag);
    saveStorage(STORAGE_KEYS.DIAGNOSTICOS, diags);

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
        const curDiags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
        const idx = curDiags.findIndex((d) => d.id === newId);
        if (idx !== -1) {
          curDiags[idx] = { ...created, _pendingSync: false };
        } else {
          curDiags.unshift(created);
        }
        saveStorage(STORAGE_KEYS.DIAGNOSTICOS, curDiags);
        return created;
      }
    } catch (err) {
      console.warn('[dataRepository.createDiagnostic] Falha na rede ao criar no backend:', err);
    }

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
      console.warn('[dataRepository.updateDiagnostic] Erro ou contingência ao atualizar:', err);
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

    const avals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
    saveStorage(
      STORAGE_KEYS.AVALIACOES,
      avals.filter((a) => a.diagnostico_id !== id)
    );

    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    saveStorage(
      STORAGE_KEYS.DIAGNOSTICOS,
      diags.filter((d) => d.id !== id)
    );
  },

  // AVALIACOES
  async getAvaliacoes(diagnosticId: string): Promise<Avaliacao[]> {
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

    // Atualiza imediatamente o buffer local preventivo
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

      // Descarte de resposta fora de ordem
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

  // BACKUP E MIGRAÇÃO SEGURA DOS DADOS LOCAIS
  exportLocalBackup(): string {
    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const avals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);

    const backupData = {
      app: 'Lumos Pro',
      exportedAt: new Date().toISOString(),
      counts: {
        clientes: clients.length,
        diagnosticos: diags.length,
        avaliacoes: avals.length,
      },
      data: {
        clientes: clients,
        diagnosticos: diags,
        avaliacoes: avals,
      },
    };

    return JSON.stringify(backupData, null, 2);
  },

  downloadLocalBackup(): void {
    if (typeof window === 'undefined') return;
    const json = this.exportLocalBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lumos-pro-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  getUnsyncedSummary(): { pendingClients: number; pendingDiags: number } {
    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);

    return {
      pendingClients: clients.filter((c) => c._pendingSync).length,
      pendingDiags: diags.filter((d) => d._pendingSync).length,
    };
  },

  async migrateLocalDataToSupabase(): Promise<{
    success: boolean;
    migratedClients: number;
    migratedDiags: number;
    errors: string[];
  }> {
    // 1. Cria snapshot de segurança obrigatório no localStorage antes de qualquer migração
    const preBackup = this.exportLocalBackup();
    saveStorage(STORAGE_KEYS.PRE_MIGRATION_BACKUP, preBackup);

    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const avals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);

    const errors: string[] = [];
    let migratedClients = 0;
    let migratedDiags = 0;

    // 2. Consulta IDs existentes no servidor para nunca duplicar
    let existingClientIds = new Set<string>();
    try {
      const res = await fetch('/api/clientes', { credentials: 'same-origin' });
      if (res.ok) {
        const list: Cliente[] = await res.json();
        existingClientIds = new Set(list.map((c) => c.id));
      }
    } catch {
      // continua
    }

    // 3. Migra Clientes preservando IDs originais
    for (const client of clients) {
      if (!existingClientIds.has(client.id)) {
        try {
          const res = await fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(client),
          });

          if (res.ok) {
            client._pendingSync = false;
            migratedClients++;
          } else {
            errors.push(`Cliente "${client.nome}": erro HTTP ${res.status}`);
          }
        } catch (err) {
          errors.push(`Cliente "${client.nome}": falha de rede`);
        }
      } else {
        client._pendingSync = false;
      }
    }
    saveStorage(STORAGE_KEYS.CLIENTES, clients);

    // 4. Migra Diagnósticos e Avaliações preservando IDs originais
    for (const diag of diags) {
      try {
        const res = await fetch('/api/diagnosticos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(diag),
        });

        if (res.ok) {
          diag._pendingSync = false;
          migratedDiags++;

          // Migra avaliações vinculadas a este diagnóstico
          const diagAvals = avals.filter((a) => a.diagnostico_id === diag.id);
          if (diagAvals.length > 0) {
            await fetch(`/api/diagnosticos/${encodeURIComponent(diag.id)}/avaliacoes`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ items: diagAvals }),
            });
          }
        }
      } catch (err) {
        errors.push(`Diagnóstico ID ${diag.id}: erro ao migrar`);
      }
    }
    saveStorage(STORAGE_KEYS.DIAGNOSTICOS, diags);

    return {
      success: errors.length === 0,
      migratedClients,
      migratedDiags,
      errors,
    };
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
