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
import { supabase } from './supabase';

// Backups in localStorage remain untouched. Do not clear them before migrating.
// This repository now uses Supabase as its ONLY live data source.
async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sua sessão expirou. Entre novamente no Lumos PRO.');
  return data.user.id;
}

function fail(operation: string, error: unknown): never {
  console.error(`Supabase - ${operation}:`, error);
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(`Erro ao ${operation}: ${detail}`);
}

function assertOk(operation: string, error: unknown): void {
  if (error) fail(operation, error);
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
  // PILARES & CRITERIOS: IDs must come from the same database used by avaliacoes.
  async getPilares(): Promise<Pilar[]> {
    const { data, error } = await supabase.from('pilares').select('*').order('ordem');
    assertOk('consultar pilares', error);
    return (data ?? []) as Pilar[];
  },

  async getCriterios(): Promise<Criterio[]> {
    const { data, error } = await supabase.from('criterios').select('*').eq('ativo', true).order('ordem');
    assertOk('consultar critérios', error);
    return (data ?? []) as Criterio[];
  },

  // CLIENTES
  async getClients(): Promise<Cliente[]> {
    await currentUserId();
    const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
    assertOk('listar clientes', error);
    return (data ?? []) as Cliente[];
  },

  async getClientById(id: string): Promise<Cliente | null> {
    await currentUserId();
    const { data, error } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle();
    assertOk('consultar cliente', error);
    return (data as Cliente | null) ?? null;
  },

  async createClient(clientData: Partial<Cliente>): Promise<{ client: Cliente; isLocal: boolean }> {
    const userId = await currentUserId();
    const record = {
      nome: clientData.nome?.trim() || 'Cliente sem nome',
      segmento: clientData.segmento ?? null,
      instagram: clientData.instagram ?? null,
      site: clientData.site ?? null,
      whatsapp: clientData.whatsapp ?? null,
      cidade: clientData.cidade ?? null,
      responsavel: clientData.responsavel ?? null,
      observacoes: clientData.observacoes ?? null,
      ativo: clientData.ativo ?? true,
      criado_por: userId,
    };
    const { data, error } = await supabase.from('clientes').insert(record).select('*').single();
    assertOk('cadastrar cliente', error);
    return { client: data as Cliente, isLocal: false };
  },

  async updateClient(id: string, updates: Partial<Cliente>): Promise<Cliente> {
    await currentUserId();
    const { id: _id, criado_por: _author, created_at: _created, ...editable } = updates;
    const { data, error } = await supabase.from('clientes')
      .update({ ...editable, updated_at: new Date().toISOString() })
      .eq('id', id).select('*').single();
    assertOk('atualizar cliente', error);
    return data as Cliente;
  },

  async deleteClient(id: string): Promise<void> {
    await currentUserId();
    // Delete children first, without relying on FK ON DELETE CASCADE.
    const { data: diagnostics, error: dErr } = await supabase
      .from('diagnosticos').select('id').eq('cliente_id', id);
    assertOk('listar diagnósticos para exclusão', dErr);
    for (const d of diagnostics ?? []) {
      await this.deleteDiagnostic(d.id);
    }
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    assertOk('excluir cliente', error);
  },

  // DIAGNOSTICOS
  async getDiagnosticsByClient(clienteId: string): Promise<Diagnostico[]> {
    await currentUserId();
    const { data, error } = await supabase.from('diagnosticos')
      .select('*').eq('cliente_id', clienteId).order('data_referencia', { ascending: false });
    assertOk('listar diagnósticos', error);
    return (data ?? []) as Diagnostico[];
  },

  async getDiagnosticById(id: string): Promise<Diagnostico | null> {
    await currentUserId();
    const { data, error } = await supabase.from('diagnosticos').select('*').eq('id', id).maybeSingle();
    assertOk('consultar diagnóstico', error);
    return (data as Diagnostico | null) ?? null;
  },

  async createDiagnostic(clienteId: string, userId?: string | null): Promise<Diagnostico> {
    const actorId = await currentUserId();
    const { data, error } = await supabase.from('diagnosticos').insert({
      cliente_id: clienteId,
      data_referencia: new Date().toISOString().slice(0, 10),
      status: 'rascunho',
      resumo: '',
      compartilhado: false,
      share_token: crypto.randomUUID(),
      criado_por: actorId, // never trust an arbitrary ID passed from the browser
    }).select('*').single();
    assertOk('criar diagnóstico', error);
    return data as Diagnostico;
  },

  async updateDiagnostic(id: string, updates: Partial<Diagnostico>): Promise<Diagnostico> {
    await currentUserId();
    const { id: _id, cliente_id: _clientId, criado_por: _author, created_at: _created, ...editable } = updates;
    const { data, error } = await supabase.from('diagnosticos')
      .update({ ...editable, updated_at: new Date().toISOString() })
      .eq('id', id).select('*').single();
    assertOk('atualizar diagnóstico', error);
    return data as Diagnostico;
  },

  async deleteDiagnostic(id: string): Promise<void> {
    await currentUserId();
    const { error: aErr } = await supabase.from('avaliacoes').delete().eq('diagnostico_id', id);
    assertOk('excluir avaliações', aErr);
    const { error } = await supabase.from('diagnosticos').delete().eq('id', id);
    assertOk('excluir diagnóstico', error);
  },

  // AVALIACOES
  async getAvaliacoes(diagnosticId: string): Promise<Avaliacao[]> {
    await currentUserId();
    const { data, error } = await supabase.from('avaliacoes')
      .select('*').eq('diagnostico_id', diagnosticId);
    assertOk('consultar avaliações', error);
    return (data ?? []) as Avaliacao[];
  },

  async saveAvaliacoes(
    diagnosticId: string,
    items: Array<{ criterio_id: string; nota: number | null; solucao: string | null }>
  ): Promise<void> {
    await currentUserId();
    if (!items.length) return;
    const { data: existing, error: readError } = await supabase
      .from('avaliacoes').select('id, criterio_id').eq('diagnostico_id', diagnosticId);
    assertOk('localizar avaliações existentes', readError);
    const byCriterion = new Map((existing ?? []).map((row) => [row.criterio_id, row.id]));
    for (const item of items) {
      const record = { nota: item.nota, solucao: item.solucao };
      const existingId = byCriterion.get(item.criterio_id);
      if (existingId) {
        const { error } = await supabase.from('avaliacoes').update(record).eq('id', existingId);
        assertOk('atualizar avaliação', error);
      } else {
        const { error } = await supabase.from('avaliacoes').insert({
          diagnostico_id: diagnosticId, criterio_id: item.criterio_id, ...record,
        });
        assertOk('salvar avaliação', error);
      }
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

  // PUBLIC REPORT (Matches specification: only if compartilhado = true and status = finalizado)
  async getPublicReport(token: string): Promise<PublicReportData | null> {
    const { data: diagData, error } = await supabase.from('diagnosticos')
      .select('*').eq('share_token', token).eq('compartilhado', true)
      .eq('status', 'finalizado').maybeSingle();
    assertOk('consultar relatório compartilhado', error);
    const diag = diagData as Diagnostico | null;

    if (!diag || !diag.compartilhado || diag.status !== 'finalizado') {
      return null;
    }

    // Public reports require explicit, narrow SELECT policies for shared diagnostics.
    const { data: clientData, error: clientError } = await supabase
      .from('clientes').select('*').eq('id', diag.cliente_id).maybeSingle();
    assertOk('consultar cliente do relatório', clientError);
    const client = clientData as Cliente | null;
    if (!client) return null;

    const { data: avaliacoesData, error: avaliacoesError } = await supabase
      .from('avaliacoes').select('*').eq('diagnostico_id', diag.id);
    assertOk('consultar avaliações públicas', avaliacoesError);
    const avaliacoes = (avaliacoesData ?? []) as Avaliacao[];
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

  // Legacy reset buttons must not delete shared production data.
  resetToDemo(): void {
    console.warn('resetToDemo desativado: dados compartilhados preservados.');
  },

  clearAll(): void {
    console.warn('clearAll desativado: exclusão global bloqueada por segurança.');
  },
};
