import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { supabaseServer } from '../supabase.js';

export const diagnosticosRouter = Router();

type Usuario = { id: string; email: string; papel: 'administrador' | 'auditor' };

function usuarioDaRequisicao(req: Request, res: Response): Usuario | null {
  const usuario = req.lumosUser;
  if (!usuario) {
    res.status(401).json({ error: 'É necessário entrar no Lumos Pro.' });
    return null;
  }
  return usuario;
}

function texto(valor: unknown, max = 2000): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim();
  return limpo ? limpo.slice(0, max) : null;
}

function validateNota(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (num === 1 || num === 2 || num === 3) return num;
  return null;
}

// Verifica se o usuário tem permissão para acessar o cliente especificado
async function podeAcessarCliente(clienteId: string, usuario: Usuario): Promise<boolean> {
  let consulta = supabaseServer.from('clientes').select('id').eq('id', clienteId);
  if (usuario.papel !== 'administrador') {
    consulta = consulta.eq('criado_por_id', usuario.id);
  }
  const { data, error } = await consulta.maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// Checa o diagnóstico E o cliente vinculado antes de permitir leitura/modificação
async function diagnosticoPermitido(id: string, usuario: Usuario) {
  const { data, error } = await supabaseServer
    .from('diagnosticos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!(await podeAcessarCliente(data.cliente_id, usuario))) return null;
  return data;
}

function falha(res: Response, erro: unknown, mensagem: string) {
  console.error(`[Lumos Pro] ${mensagem}:`, erro);
  res.status(500).json({ error: mensagem });
}

/**
 * GET /api/diagnosticos?cliente_id=...
 * Lista diagnósticos respeitando a regra de propriedade (Administrador vê todos; Auditor vê apenas os seus)
 */
diagnosticosRouter.get('/', async (req: Request, res: Response) => {
  const usuario = usuarioDaRequisicao(req, res);
  if (!usuario) return;

  try {
    const clienteId = req.query.cliente_id;
    if (clienteId !== undefined && typeof clienteId !== 'string') {
      res.status(400).json({ error: 'cliente_id inválido.' });
      return;
    }

    // Se um clienteId foi passado, verifica primeiro se o usuário pode acessar esse cliente
    if (clienteId && !(await podeAcessarCliente(clienteId, usuario))) {
      res.status(403).json({ error: 'Acesso negado aos diagnósticos deste cliente.' });
      return;
    }

    if (usuario.papel === 'auditor') {
      let consulta = supabaseServer
        .from('diagnosticos')
        .select('*, clientes!inner(criado_por_id)')
        .eq('clientes.criado_por_id', usuario.id);

      if (clienteId) {
        consulta = consulta.eq('cliente_id', clienteId);
      }

      const { data, error } = await consulta.order('data_referencia', { ascending: false });
      if (error) throw error;

      // Desembrulha a propriedade clientes retornada pelo inner join
      res.json((data ?? []).map(({ clientes: _c, ...diag }: any) => diag));
      return;
    }

    // Administrador: lista todos
    let consulta = supabaseServer.from('diagnosticos').select('*');
    if (clienteId) {
      consulta = consulta.eq('cliente_id', clienteId);
    }
    const { data, error } = await consulta.order('data_referencia', { ascending: false });
    if (error) throw error;

    res.json(data ?? []);
  } catch (erro) {
    falha(res, erro, 'Erro ao listar diagnósticos.');
  }
});

/**
 * GET /api/diagnosticos/:id
 * Busca metadados do diagnóstico e suas avaliações
 */
diagnosticosRouter.get('/:id', async (req: Request, res: Response) => {
  const usuario = usuarioDaRequisicao(req, res);
  if (!usuario) return;

  try {
    const diag = await diagnosticoPermitido(req.params.id, usuario);
    if (!diag) {
      res.status(404).json({ error: 'Diagnóstico não encontrado ou sem permissão.' });
      return;
    }

    const { data: avaliacoes, error: avalsError } = await supabaseServer
      .from('avaliacoes')
      .select('*')
      .eq('diagnostico_id', req.params.id);

    if (avalsError) throw avalsError;

    res.json({
      diagnostico: diag,
      avaliacoes: avaliacoes || [],
    });
  } catch (erro) {
    falha(res, erro, 'Erro ao carregar detalhes do diagnóstico.');
  }
});

/**
 * POST /api/diagnosticos
 * Cria um novo diagnóstico
 */
diagnosticosRouter.post('/', async (req: Request, res: Response) => {
  const usuario = usuarioDaRequisicao(req, res);
  if (!usuario) return;

  try {
    const { cliente_id, data_referencia, resumo, id } = req.body;

    if (!cliente_id || typeof cliente_id !== 'string') {
      res.status(400).json({ error: 'cliente_id é obrigatório.' });
      return;
    }

    if (!(await podeAcessarCliente(cliente_id, usuario))) {
      res.status(403).json({ error: 'Você não tem permissão para criar diagnósticos para este cliente.' });
      return;
    }

    const diagId = id && typeof id === 'string' && id.length >= 8 ? id : crypto.randomUUID();
    const shareToken = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const novoDiagnostico = {
      id: diagId,
      cliente_id,
      data_referencia: data_referencia || nowIso.slice(0, 10),
      status: 'rascunho',
      resumo: texto(resumo, 4000) || '',
      compartilhado: false,
      share_token: shareToken,
      criado_por: usuario.email || 'lumos_app',
      criado_por_id: usuario.id,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data, error } = await supabaseServer
      .from('diagnosticos')
      .insert(novoDiagnostico)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (erro) {
    falha(res, erro, 'Erro ao criar diagnóstico.');
  }
});

/**
 * PUT /api/diagnosticos/:id
 * Atualiza metadados do diagnóstico com controle otimista de versão (concurrency check)
 */
diagnosticosRouter.put('/:id', async (req: Request, res: Response) => {
  const usuario = usuarioDaRequisicao(req, res);
  if (!usuario) return;

  try {
    const diag = await diagnosticoPermitido(req.params.id, usuario);
    if (!diag) {
      res.status(404).json({ error: 'Diagnóstico não encontrado ou sem permissão.' });
      return;
    }

    const { data_referencia, resumo, status, compartilhado, base_version } = req.body;

    // Concurrency Check otimista
    if (base_version && diag.updated_at) {
      const serverDate = new Date(diag.updated_at).getTime();
      const clientDate = new Date(base_version).getTime();
      if (serverDate - clientDate > 2500) {
        res.status(409).json({
          error: 'Conflito de versão: este diagnóstico foi modificado recentemente em outro navegador ou dispositivo.',
          serverUpdatedAt: diag.updated_at,
        });
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      updated_at: nowIso,
    };

    if (data_referencia !== undefined) updatePayload.data_referencia = data_referencia;
    if (resumo !== undefined) updatePayload.resumo = texto(resumo, 4000) || '';
    if (status !== undefined && ['rascunho', 'finalizado'].includes(status)) {
      updatePayload.status = status;
    }
    if (compartilhado !== undefined) updatePayload.compartilhado = Boolean(compartilhado);

    const { data, error } = await supabaseServer
      .from('diagnosticos')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (erro) {
    falha(res, erro, 'Erro ao atualizar diagnóstico.');
  }
});

/**
 * PUT /api/diagnosticos/:id/avaliacoes
 * Upsert atômico das avaliações do diagnóstico
 */
diagnosticosRouter.put('/:id/avaliacoes', async (req: Request, res: Response) => {
  const usuario = usuarioDaRequisicao(req, res);
  if (!usuario) return;

  try {
    const diag = await diagnosticoPermitido(req.params.id, usuario);
    if (!diag) {
      res.status(404).json({ error: 'Diagnóstico não encontrado ou sem permissão.' });
      return;
    }

    const { items, base_version } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Lista de avaliações inválida ou vazia.' });
      return;
    }

    // Concurrency Check opcional
    if (base_version && diag.updated_at) {
      const serverDate = new Date(diag.updated_at).getTime();
      const clientDate = new Date(base_version).getTime();
      if (serverDate - clientDate > 3000) {
        res.status(409).json({
          error: 'Conflito de versão: dados atualizados em outro navegador.',
          serverUpdatedAt: diag.updated_at,
        });
        return;
      }
    }

    const recordsToUpsert = items.map((item: any) => ({
      id: item.id && typeof item.id === 'string' && item.id.length >= 8 ? item.id : crypto.randomUUID(),
      diagnostico_id: req.params.id,
      criterio_id: String(item.criterio_id || '').trim(),
      nota: validateNota(item.nota),
      solucao: texto(item.solucao, 2000),
      observacao: texto(item.observacao, 2000),
      recomendacao: texto(item.recomendacao, 2000),
      evidencia_url: texto(item.evidencia_url, 1000),
    }));

    const { data: upsertedData, error: upsertError } = await supabaseServer
      .from('avaliacoes')
      .upsert(recordsToUpsert, {
        onConflict: 'diagnostico_id, criterio_id',
      })
      .select();

    if (upsertError) throw upsertError;

    const nowIso = new Date().toISOString();
    await supabaseServer
      .from('diagnosticos')
      .update({ updated_at: nowIso })
      .eq('id', req.params.id);

    res.json({
      success: true,
      count: upsertedData?.length || recordsToUpsert.length,
      updated_at: nowIso,
      items: upsertedData || [],
    });
  } catch (erro) {
    falha(res, erro, 'Erro ao salvar avaliações.');
  }
});

/**
 * DELETE /api/diagnosticos/:id
 * Exclui diagnóstico e suas avaliações
 */
diagnosticosRouter.delete('/:id', async (req: Request, res: Response) => {
  const usuario = usuarioDaRequisicao(req, res);
  if (!usuario) return;

  try {
    const diag = await diagnosticoPermitido(req.params.id, usuario);
    if (!diag) {
      res.status(404).json({ error: 'Diagnóstico não encontrado ou sem permissão.' });
      return;
    }

    await supabaseServer.from('avaliacoes').delete().eq('diagnostico_id', req.params.id);
    const { error: diagError } = await supabaseServer.from('diagnosticos').delete().eq('id', req.params.id);

    if (diagError) throw diagError;

    res.json({ success: true, id: req.params.id });
  } catch (erro) {
    falha(res, erro, 'Erro ao excluir diagnóstico.');
  }
});
