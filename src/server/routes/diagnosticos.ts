import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseServer } from '../supabase';

export const diagnosticosRouter = Router();

function sanitizeString(val: unknown, maxLen = 2000): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str.length === 0) return null;
  return str.slice(0, maxLen);
}

function validateNota(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (num === 1 || num === 2 || num === 3) return num;
  return null;
}

/**
 * GET /api/diagnosticos?cliente_id=xxx
 * Lista diagnósticos de um cliente ordenados por data_referencia decrescente.
 */
diagnosticosRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { cliente_id } = req.query;

    let query = supabaseServer
      .from('diagnosticos')
      .select('*')
      .order('data_referencia', { ascending: false });

    if (cliente_id && typeof cliente_id === 'string') {
      query = query.eq('cliente_id', cliente_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase GET /diagnosticos error]:', error.message);
      res.status(500).json({ error: 'Erro ao consultar diagnósticos no banco de dados.' });
      return;
    }

    res.json(data || []);
  } catch (err: unknown) {
    console.error('[GET /diagnosticos exception]:', err);
    res.status(500).json({ error: 'Falha interna ao carregar diagnósticos.' });
  }
});

/**
 * GET /api/diagnosticos/:id
 * Busca um diagnóstico específico com todas as suas avaliações correspondentes.
 */
diagnosticosRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID do diagnóstico é obrigatório.' });
      return;
    }

    // 1. Busca os metadados do diagnóstico
    const { data: diag, error: diagError } = await supabaseServer
      .from('diagnosticos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (diagError) {
      console.error('[Supabase GET /diagnosticos/:id error]:', diagError.message);
      res.status(500).json({ error: 'Erro ao consultar diagnóstico no banco de dados.' });
      return;
    }

    if (!diag) {
      res.status(404).json({ error: 'Diagnóstico não encontrado.' });
      return;
    }

    // 2. Busca todas as avaliações vinculadas ao diagnóstico
    const { data: avaliacoes, error: avalsError } = await supabaseServer
      .from('avaliacoes')
      .select('*')
      .eq('diagnostico_id', id);

    if (avalsError) {
      console.error('[Supabase GET avaliacoes error]:', avalsError.message);
      res.status(500).json({ error: 'Erro ao carregar avaliações do diagnóstico.' });
      return;
    }

    res.json({
      diagnostico: diag,
      avaliacoes: avaliacoes || [],
    });
  } catch (err: unknown) {
    console.error('[GET /diagnosticos/:id exception]:', err);
    res.status(500).json({ error: 'Falha interna ao carregar diagnóstico.' });
  }
});

/**
 * POST /api/diagnosticos
 * Cria um novo diagnóstico na tabela diagnosticos.
 */
diagnosticosRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { cliente_id, data_referencia, resumo, id, criado_por } = req.body;

    if (!cliente_id || typeof cliente_id !== 'string') {
      res.status(400).json({ error: 'cliente_id é obrigatório.' });
      return;
    }

    const diagId = id && typeof id === 'string' && id.length >= 8 ? id : crypto.randomUUID();
    const shareToken = crypto.randomBytes(12).toString('hex');
    const nowIso = new Date().toISOString();

    const novoDiagnostico = {
      id: diagId,
      cliente_id,
      data_referencia: data_referencia || nowIso.slice(0, 10),
      status: 'rascunho',
      resumo: sanitizeString(resumo, 4000) || '',
      compartilhado: false,
      share_token: shareToken,
      criado_por: sanitizeString(criado_por, 100) || 'lumos_app',
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data, error } = await supabaseServer
      .from('diagnosticos')
      .insert([novoDiagnostico])
      .select()
      .single();

    if (error) {
      console.error('[Supabase POST /diagnosticos error]:', error.message);
      res.status(500).json({ error: 'Erro ao criar diagnóstico no banco de dados.' });
      return;
    }

    res.status(201).json(data);
  } catch (err: unknown) {
    console.error('[POST /diagnosticos exception]:', err);
    res.status(500).json({ error: 'Falha interna ao cadastrar diagnóstico.' });
  }
});

/**
 * PUT /api/diagnosticos/:id
 * Atualiza metadados do diagnóstico com controle otimista de versão (updated_at).
 */
diagnosticosRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data_referencia, resumo, status, compartilhado, base_version } = req.body;

    if (!id) {
      res.status(400).json({ error: 'ID do diagnóstico é obrigatório.' });
      return;
    }

    // 1. Concurrency Check: verifica se houve alteração posterior por outro dispositivo
    if (base_version) {
      const { data: current } = await supabaseServer
        .from('diagnosticos')
        .select('updated_at')
        .eq('id', id)
        .maybeSingle();

      if (current && current.updated_at && base_version) {
        const currentDate = new Date(current.updated_at).getTime();
        const clientDate = new Date(base_version).getTime();
        // Se a data do servidor for superior em mais de 2 segundos, alerta conflito
        if (currentDate - clientDate > 2000) {
          res.status(409).json({
            error: 'Conflito de versão: este diagnóstico foi modificado recentemente em outro dispositivo.',
            serverUpdatedAt: current.updated_at,
          });
          return;
        }
      }
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      updated_at: nowIso,
    };

    if (data_referencia !== undefined) updatePayload.data_referencia = data_referencia;
    if (resumo !== undefined) updatePayload.resumo = sanitizeString(resumo, 4000) || '';
    if (status !== undefined) {
      if (['rascunho', 'finalizado'].includes(status)) {
        updatePayload.status = status;
      }
    }
    if (compartilhado !== undefined) updatePayload.compartilhado = Boolean(compartilhado);

    const { data, error } = await supabaseServer
      .from('diagnosticos')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Supabase PUT /diagnosticos/:id error]:', error.message);
      res.status(500).json({ error: 'Erro ao atualizar diagnóstico no banco de dados.' });
      return;
    }

    res.json(data);
  } catch (err: unknown) {
    console.error('[PUT /diagnosticos/:id exception]:', err);
    res.status(500).json({ error: 'Falha interna ao atualizar diagnóstico.' });
  }
});

/**
 * PUT /api/diagnosticos/:id/avaliacoes
 * Executa upsert atômico em lote na tabela avaliacoes com restrição UNIQUE (diagnostico_id, criterio_id).
 */
diagnosticosRouter.put('/:id/avaliacoes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { items, base_version } = req.body;

    if (!id) {
      res.status(400).json({ error: 'ID do diagnóstico é obrigatório.' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Lista de avaliações inválida ou vazia.' });
      return;
    }

    // 1. Concurrency Check opcional
    if (base_version) {
      const { data: currentDiag } = await supabaseServer
        .from('diagnosticos')
        .select('updated_at')
        .eq('id', id)
        .maybeSingle();

      if (currentDiag?.updated_at && base_version) {
        const currentDate = new Date(currentDiag.updated_at).getTime();
        const clientDate = new Date(base_version).getTime();
        if (currentDate - clientDate > 3000) {
          res.status(409).json({
            error: 'Conflito de sincronização: dados atualizados em outro navegador.',
            serverUpdatedAt: currentDiag.updated_at,
          });
          return;
        }
      }
    }

    // 2. Prepara e valida itens para upsert
    const recordsToUpsert = items.map((item) => {
      const criterioId = String(item.criterio_id || '').trim();
      const validNota = validateNota(item.nota);

      return {
        // Se id for fornecido e válido, usa; senão gera novo UUID
        id: item.id && typeof item.id === 'string' && item.id.length >= 8 ? item.id : crypto.randomUUID(),
        diagnostico_id: id,
        criterio_id: criterioId,
        nota: validNota,
        solucao: sanitizeString(item.solucao, 2000),
        observacao: sanitizeString(item.observacao, 2000),
        recomendacao: sanitizeString(item.recomendacao, 2000),
        evidencia_url: sanitizeString(item.evidencia_url, 1000),
      };
    });

    // 3. Executa upsert com resolução em (diagnostico_id, criterio_id)
    const { data: upsertedData, error: upsertError } = await supabaseServer
      .from('avaliacoes')
      .upsert(recordsToUpsert, {
        onConflict: 'diagnostico_id, criterio_id',
      })
      .select();

    if (upsertError) {
      console.error('[Supabase PUT avaliacoes upsert error]:', upsertError.message);
      res.status(500).json({ error: 'Erro ao gravar avaliações no banco de dados.' });
      return;
    }

    // 4. Atualiza o timestamp updated_at do diagnóstico
    const nowIso = new Date().toISOString();
    await supabaseServer
      .from('diagnosticos')
      .update({ updated_at: nowIso })
      .eq('id', id);

    res.json({
      success: true,
      count: upsertedData?.length || recordsToUpsert.length,
      updated_at: nowIso,
      items: upsertedData || [],
    });
  } catch (err: unknown) {
    console.error('[PUT /diagnosticos/:id/avaliacoes exception]:', err);
    res.status(500).json({ error: 'Falha interna ao salvar avaliações.' });
  }
});

/**
 * DELETE /api/diagnosticos/:id
 * Remove diagnóstico e suas avaliações do Supabase de forma controlada.
 */
diagnosticosRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID do diagnóstico é obrigatório.' });
      return;
    }

    // 1. Remove avaliações do diagnóstico
    await supabaseServer
      .from('avaliacoes')
      .delete()
      .eq('diagnostico_id', id);

    // 2. Remove o diagnóstico
    const { error: diagError } = await supabaseServer
      .from('diagnosticos')
      .delete()
      .eq('id', id);

    if (diagError) {
      console.error('[Supabase DELETE /diagnosticos/:id error]:', diagError.message);
      res.status(500).json({ error: 'Erro ao excluir diagnóstico no banco de dados.' });
      return;
    }

    res.json({ success: true, id });
  } catch (err: unknown) {
    console.error('[DELETE /diagnosticos/:id exception]:', err);
    res.status(500).json({ error: 'Falha interna ao excluir diagnóstico.' });
  }
});
