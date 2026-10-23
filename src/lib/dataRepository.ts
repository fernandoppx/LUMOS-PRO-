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
  INITIAL_DEMO_CLIENTS,
  INITIAL_DEMO_DIAGNOSTICS,
  INITIAL_DEMO_AVALIACOES,
} from '../data/diagnosticData';
import { getFaixaFromMedia, getRotuloPadrao } from '../utils/formatters';

const LOCAL_CLIENTES_KEY = 'lumos_local_clientes_v2';
const LOCAL_DIAGNOSTICOS_KEY = 'lumos_local_diagnosticos_v2';
const LOCAL_AVALIACOES_KEY = 'lumos_local_avaliacoes_v2';

// Purge any legacy demo data from localStorage on load
function purgeDemoData(): void {
  try {
    const rawClients = localStorage.getItem(LOCAL_CLIENTES_KEY);
    if (rawClients) {
      const parsed: Cliente[] = JSON.parse(rawClients);
      const filtered = parsed.filter((c) => !c.id.startsWith('demo-'));
      if (filtered.length !== parsed.length) {
        localStorage.setItem(LOCAL_CLIENTES_KEY, JSON.stringify(filtered));
      }
    }
    const rawDiags = localStorage.getItem(LOCAL_DIAGNOSTICOS_KEY);
    if (rawDiags) {
      const parsed: Diagnostico[] = JSON.parse(rawDiags);
      const filtered = parsed.filter(
        (d) => !d.id.startsWith('demo-') && !d.cliente_id.startsWith('demo-')
      );
      if (filtered.length !== parsed.length) {
        localStorage.setItem(LOCAL_DIAGNOSTICOS_KEY, JSON.stringify(filtered));
      }
    }
    const rawAvals = localStorage.getItem(LOCAL_AVALIACOES_KEY);
    if (rawAvals) {
      const parsed: Avaliacao[] = JSON.parse(rawAvals);
      const filtered = parsed.filter((a) => !a.diagnostico_id.startsWith('demo-'));
      if (filtered.length !== parsed.length) {
        localStorage.setItem(LOCAL_AVALIACOES_KEY, JSON.stringify(filtered));
      }
    }
  } catch (e) {
    // ignore
  }
}

purgeDemoData();

function getLocalItems<T>(key: string, defaultItems: T[] = []): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      if (defaultItems.length > 0) {
        localStorage.setItem(key, JSON.stringify(defaultItems));
      }
      return defaultItems;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Erro ao ler ${key} do localStorage:`, e);
    return defaultItems;
  }
}

function setLocalItems<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error(`Erro ao salvar ${key} no localStorage:`, e);
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
    return DEFAULT_PILARES;
  },

  async getCriterios(): Promise<Criterio[]> {
    return DEFAULT_CRITERIOS;
  },

  // CLIENTES
  async getClients(): Promise<Cliente[]> {
    return getLocalItems<Cliente>(LOCAL_CLIENTES_KEY, INITIAL_DEMO_CLIENTS);
  },

  async getClientById(id: string): Promise<Cliente | null> {
    const clients = await this.getClients();
    return clients.find((c) => c.id === id) || null;
  },

  async createClient(clientData: Partial<Cliente>): Promise<{ client: Cliente; isLocal: boolean }> {
    const clients = await this.getClients();
    const newRecord: Cliente = {
      id: clientData.id || crypto.randomUUID(),
      nome: clientData.nome || 'Cliente sem nome',
      instagram: clientData.instagram || null,
      segmento: clientData.segmento || null,
      cidade: clientData.cidade || null,
      whatsapp: clientData.whatsapp || null,
      site: clientData.site || null,
      responsavel: clientData.responsavel || null,
      observacoes: clientData.observacoes || null,
      ativo: true,
      criado_por: clientData.criado_por || 'lumos-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    clients.unshift(newRecord);
    setLocalItems(LOCAL_CLIENTES_KEY, clients);
    return { client: newRecord, isLocal: true };
  },

  async updateClient(id: string, updates: Partial<Cliente>): Promise<Cliente> {
    const clients = await this.getClients();
    const index = clients.findIndex((c) => c.id === id);
    if (index >= 0) {
      clients[index] = {
        ...clients[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      setLocalItems(LOCAL_CLIENTES_KEY, clients);
      return clients[index];
    }
    throw new Error('Cliente não encontrado');
  },

  async deleteClient(id: string): Promise<void> {
    const clients = await this.getClients();
    setLocalItems(
      LOCAL_CLIENTES_KEY,
      clients.filter((c) => c.id !== id)
    );

    // Also delete client's diagnostics and evaluations
    const diags = await this.getDiagnosticsByClient(id);
    const diagIds = new Set(diags.map((d) => d.id));
    const allDiags = getLocalItems<Diagnostico>(LOCAL_DIAGNOSTICOS_KEY);
    setLocalItems(
      LOCAL_DIAGNOSTICOS_KEY,
      allDiags.filter((d) => d.cliente_id !== id)
    );

    const allAvals = getLocalItems<Avaliacao>(LOCAL_AVALIACOES_KEY);
    setLocalItems(
      LOCAL_AVALIACOES_KEY,
      allAvals.filter((a) => !diagIds.has(a.diagnostico_id))
    );
  },

  // DIAGNOSTICOS
  async getDiagnosticsByClient(clienteId: string): Promise<Diagnostico[]> {
    const all = getLocalItems<Diagnostico>(LOCAL_DIAGNOSTICOS_KEY, INITIAL_DEMO_DIAGNOSTICS);
    return all
      .filter((d) => d.cliente_id === clienteId)
      .sort((a, b) => new Date(b.data_referencia).getTime() - new Date(a.data_referencia).getTime());
  },

  async getDiagnosticById(id: string): Promise<Diagnostico | null> {
    const all = getLocalItems<Diagnostico>(LOCAL_DIAGNOSTICOS_KEY, INITIAL_DEMO_DIAGNOSTICS);
    return all.find((d) => d.id === id) || null;
  },

  async createDiagnostic(clienteId: string, userId?: string | null): Promise<Diagnostico> {
    const all = getLocalItems<Diagnostico>(LOCAL_DIAGNOSTICOS_KEY, INITIAL_DEMO_DIAGNOSTICS);
    const today = new Date().toISOString().split('T')[0];
    const newRecord: Diagnostico = {
      id: crypto.randomUUID(),
      cliente_id: clienteId,
      data_referencia: today,
      status: 'rascunho',
      resumo: '',
      compartilhado: false,
      share_token: crypto.randomUUID(),
      criado_por: userId || 'lumos-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    all.unshift(newRecord);
    setLocalItems(LOCAL_DIAGNOSTICOS_KEY, all);
    return newRecord;
  },

  async updateDiagnostic(id: string, updates: Partial<Diagnostico>): Promise<Diagnostico> {
    const all = getLocalItems<Diagnostico>(LOCAL_DIAGNOSTICOS_KEY, INITIAL_DEMO_DIAGNOSTICS);
    const idx = all.findIndex((d) => d.id === id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      setLocalItems(LOCAL_DIAGNOSTICOS_KEY, all);
      return all[idx];
    }
    throw new Error('Diagnóstico não encontrado');
  },

  async deleteDiagnostic(id: string): Promise<void> {
    const all = getLocalItems<Diagnostico>(LOCAL_DIAGNOSTICOS_KEY, INITIAL_DEMO_DIAGNOSTICS);
    setLocalItems(
      LOCAL_DIAGNOSTICOS_KEY,
      all.filter((d) => d.id !== id)
    );

    const avals = getLocalItems<Avaliacao>(LOCAL_AVALIACOES_KEY, INITIAL_DEMO_AVALIACOES);
    setLocalItems(
      LOCAL_AVALIACOES_KEY,
      avals.filter((a) => a.diagnostico_id !== id)
    );
  },

  // AVALIACOES
  async getAvaliacoes(diagnosticId: string): Promise<Avaliacao[]> {
    const all = getLocalItems<Avaliacao>(LOCAL_AVALIACOES_KEY, INITIAL_DEMO_AVALIACOES);
    return all.filter((a) => a.diagnostico_id === diagnosticId);
  },

  async saveAvaliacoes(
    diagnosticId: string,
    items: Array<{ criterio_id: string; nota: number | null; solucao: string | null }>
  ): Promise<void> {
    const allLocal = getLocalItems<Avaliacao>(LOCAL_AVALIACOES_KEY, INITIAL_DEMO_AVALIACOES);

    items.forEach((item) => {
      const existingIdx = allLocal.findIndex(
        (a) => a.diagnostico_id === diagnosticId && a.criterio_id === item.criterio_id
      );
      const newAv: Avaliacao = {
        diagnostico_id: diagnosticId,
        criterio_id: item.criterio_id,
        nota: item.nota,
        solucao: item.solucao,
      };

      if (existingIdx >= 0) {
        allLocal[existingIdx] = newAv;
      } else {
        allLocal.push(newAv);
      }
    });

    setLocalItems(LOCAL_AVALIACOES_KEY, allLocal);
  },

  // SCORES & VIEWS
  async getDiagnosticScores(
    diagnosticId: string
  ): Promise<{ diagScore: ScoreDiagnosticoView | null; pilaresScore: ScorePilarView[] }> {
    const diag = await this.getDiagnosticById(diagnosticId);
    if (!diag) return { diagScore: null, pilaresScore: [] };

    const client = await this.getClientById(diag.cliente_id);
    const avaliacoes = await this.getAvaliacoes(diagnosticId);
    return computeDiagnosticScores(diag, client, avaliacoes);
  },

  async getDiagnosticScoresByClient(clienteId: string): Promise<ScoreDiagnosticoView[]> {
    const diags = await this.getDiagnosticsByClient(clienteId);
    const client = await this.getClientById(clienteId);

    const result: ScoreDiagnosticoView[] = [];
    for (const d of diags) {
      const avals = await this.getAvaliacoes(d.id);
      const { diagScore } = computeDiagnosticScores(d, client, avals);
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
        const { diagScore } = computeDiagnosticScores(latestDiag, client, avals);
        latestScore = diagScore;
      }
      result.push({
        ...client,
        ultimoDiagnostico: latestScore,
      });
    }

    return result;
  },

  // PUBLIC REPORT (Matches specification: only if compartilhado = true and status = finalizado)
  async getPublicReport(token: string): Promise<PublicReportData | null> {
    const allDiags = getLocalItems<Diagnostico>(LOCAL_DIAGNOSTICOS_KEY, INITIAL_DEMO_DIAGNOSTICS);
    const diag = allDiags.find((d) => d.share_token === token);

    if (!diag || !diag.compartilhado || diag.status !== 'finalizado') {
      return null;
    }

    const client = await this.getClientById(diag.cliente_id);
    if (!client) return null;

    const avaliacoes = await this.getAvaliacoes(diag.id);
    const criterios = DEFAULT_CRITERIOS;
    const pilares = DEFAULT_PILARES;

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

  // Clear data
  resetToDemo(): void {
    setLocalItems(LOCAL_CLIENTES_KEY, []);
    setLocalItems(LOCAL_DIAGNOSTICOS_KEY, []);
    setLocalItems(LOCAL_AVALIACOES_KEY, []);
  },

  clearAll(): void {
    setLocalItems(LOCAL_CLIENTES_KEY, []);
    setLocalItems(LOCAL_DIAGNOSTICOS_KEY, []);
    setLocalItems(LOCAL_AVALIACOES_KEY, []);
  },
};
