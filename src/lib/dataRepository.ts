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

// Storage keys for local persistence (sem banco externo, sem necessidade de login)
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

// Compute scores for a specific diagnostic
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

  // Overall average is the mean of the 3 pillar averages (or available ones)
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

export const dataRepository = {
  // PILARES & CRITERIOS
  async getPilares(): Promise<Pilar[]> {
    const saved = loadStorage<Pilar[]>(STORAGE_KEYS.PILARES, []);
    if (saved && saved.length > 0) return saved;
    return DEFAULT_PILARES;
  },

  async getCriterios(): Promise<Criterio[]> {
    const saved = loadStorage<Criterio[]>(STORAGE_KEYS.CRITERIOS, []);
    if (saved && saved.length > 0) return saved.filter((c) => c.ativo);
    return DEFAULT_CRITERIOS.filter((c) => c.ativo);
  },

  // CLIENTES
  async getClients(): Promise<Cliente[]> {
    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    return clients.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getClientById(id: string): Promise<Cliente | null> {
    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    return clients.find((c) => c.id === id) || null;
  },

  async createClient(clientData: Partial<Cliente>): Promise<{ client: Cliente; isLocal: boolean }> {
    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    const newClient: Cliente = {
      id: generateId('cli'),
      nome: clientData.nome?.trim() || 'Cliente sem nome',
      segmento: 'Splash',
      instagram: clientData.instagram ?? null,
      site: clientData.site ?? null,
      whatsapp: clientData.whatsapp ?? null,
      cidade: clientData.cidade ?? null,
      responsavel: clientData.responsavel ?? null,
      observacoes: clientData.observacoes ?? null,
      ativo: clientData.ativo ?? true,
      criado_por: 'local_user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    clients.unshift(newClient);
    saveStorage(STORAGE_KEYS.CLIENTES, clients);
    return { client: newClient, isLocal: true };
  },

  async updateClient(id: string, updates: Partial<Cliente>): Promise<Cliente> {
    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    const index = clients.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error('Cliente não encontrado para atualização.');
    }

    const current = clients[index];
    const updatedClient: Cliente = {
      ...current,
      ...updates,
      id: current.id,
      segmento: 'Splash',
      created_at: current.created_at,
      updated_at: new Date().toISOString(),
    };

    clients[index] = updatedClient;
    saveStorage(STORAGE_KEYS.CLIENTES, clients);
    return updatedClient;
  },

  async deleteClient(id: string): Promise<void> {
    // 1. Remove all client's diagnostics and their evaluations
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const clientDiagIds = diags.filter((d) => d.cliente_id === id).map((d) => d.id);
    const diagIdSet = new Set(clientDiagIds);

    const remainingDiags = diags.filter((d) => d.cliente_id !== id);
    saveStorage(STORAGE_KEYS.DIAGNOSTICOS, remainingDiags);

    const avaliacoes = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
    const remainingAvals = avaliacoes.filter((a) => !diagIdSet.has(a.diagnostico_id));
    saveStorage(STORAGE_KEYS.AVALIACOES, remainingAvals);

    // 2. Remove client
    const clients = loadStorage<Cliente[]>(STORAGE_KEYS.CLIENTES, []);
    const remainingClients = clients.filter((c) => c.id !== id);
    saveStorage(STORAGE_KEYS.CLIENTES, remainingClients);
  },

  // DIAGNOSTICOS
  async getDiagnosticsByClient(clienteId: string): Promise<Diagnostico[]> {
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    return diags
      .filter((d) => d.cliente_id === clienteId)
      .sort((a, b) => (b.data_referencia || '').localeCompare(a.data_referencia || ''));
  },

  async getDiagnosticById(id: string): Promise<Diagnostico | null> {
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    return diags.find((d) => d.id === id) || null;
  },

  async createDiagnostic(clienteId: string, userId?: string | null): Promise<Diagnostico> {
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const newDiag: Diagnostico = {
      id: generateId('diag'),
      cliente_id: clienteId,
      data_referencia: new Date().toISOString().slice(0, 10),
      status: 'rascunho',
      resumo: '',
      compartilhado: false,
      share_token: generateId('token'),
      criado_por: userId || 'local_user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    diags.unshift(newDiag);
    saveStorage(STORAGE_KEYS.DIAGNOSTICOS, diags);
    return newDiag;
  },

  async updateDiagnostic(id: string, updates: Partial<Diagnostico>): Promise<Diagnostico> {
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const index = diags.findIndex((d) => d.id === id);
    if (index === -1) {
      throw new Error('Diagnóstico não encontrado para atualização.');
    }

    const current = diags[index];
    const updatedDiag: Diagnostico = {
      ...current,
      ...updates,
      id: current.id,
      cliente_id: current.cliente_id,
      created_at: current.created_at,
      updated_at: new Date().toISOString(),
    };

    diags[index] = updatedDiag;
    saveStorage(STORAGE_KEYS.DIAGNOSTICOS, diags);
    return updatedDiag;
  },

  async deleteDiagnostic(id: string): Promise<void> {
    // 1. Remove evaluations
    const avals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
    const remainingAvals = avals.filter((a) => a.diagnostico_id !== id);
    saveStorage(STORAGE_KEYS.AVALIACOES, remainingAvals);

    // 2. Remove diagnostic
    const diags = loadStorage<Diagnostico[]>(STORAGE_KEYS.DIAGNOSTICOS, []);
    const remainingDiags = diags.filter((d) => d.id !== id);
    saveStorage(STORAGE_KEYS.DIAGNOSTICOS, remainingDiags);
  },

  // AVALIACOES
  async getAvaliacoes(diagnosticId: string): Promise<Avaliacao[]> {
    const avals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);
    return avals.filter((a) => a.diagnostico_id === diagnosticId);
  },

  async saveAvaliacoes(
    diagnosticId: string,
    items: Array<{ criterio_id: string; nota: number | null; solucao: string | null }>
  ): Promise<void> {
    if (!items.length) return;
    const avals = loadStorage<Avaliacao[]>(STORAGE_KEYS.AVALIACOES, []);

    for (const item of items) {
      const existingIndex = avals.findIndex(
        (a) => a.diagnostico_id === diagnosticId && a.criterio_id === item.criterio_id
      );

      if (existingIndex !== -1) {
        avals[existingIndex] = {
          ...avals[existingIndex],
          nota: item.nota,
          solucao: item.solucao,
        };
      } else {
        avals.push({
          id: generateId('aval'),
          diagnostico_id: diagnosticId,
          criterio_id: item.criterio_id,
          nota: item.nota,
          solucao: item.solucao,
        });
      }
    }

    saveStorage(STORAGE_KEYS.AVALIACOES, avals);
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
