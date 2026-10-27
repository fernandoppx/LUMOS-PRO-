import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseServer } from '../supabase';

export const clientesRouter = Router();

function sanitizeString(val: unknown, maxLen = 255): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str.length === 0) return null;
  return str.slice(0, maxLen);
}

/**
 * GET /api/clientes
 * Lista todos os clientes ordenados pela data de criação decrescente.
 */
clientesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseServer
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase GET /clientes error]:', error.message);
      res.status(500).json({ error: 'Erro ao consultar clientes no banco de dados.' });
      return;
    }

    res.json(data || []);
  } catch (err: unknown) {
    console.error('[GET /clientes exception]:', err);
    res.status(500).json({ error: 'Falha interna ao carregar clientes.' });
  }
});

/**
 * GET /api/clientes/:id
 * Busca um cliente específico pelo ID.
 */
clientesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID do cliente é obrigatório.' });
      return;
    }

    const { data, error } = await supabaseServer
      .from('clientes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[Supabase GET /clientes/:id error]:', error.message);
      res.status(500).json({ error: 'Erro ao buscar cliente.' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Cliente não encontrado.' });
      return;
    }

    res.json(data);
  } catch (err: unknown) {
    console.error('[GET /clientes/:id exception]:', err);
    res.status(500).json({ error: 'Falha interna ao buscar cliente.' });
  }
});

/**
 * POST /api/clientes
 * Cadastra um novo cliente na tabela clientes.
 */
clientesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { nome, instagram, site, whatsapp, cidade, responsavel, observacoes, ativo, id } = req.body;

    const trimmedNome = sanitizeString(nome, 120);
    if (!trimmedNome) {
      res.status(400).json({ error: 'O nome do cliente é obrigatório e deve ser preenchido.' });
      return;
    }

    // Se id fornecido for válido UUID, usa ele; senão gera novo UUID padrão v4
    const clientId = id && typeof id === 'string' && id.length >= 8 ? id : crypto.randomUUID();

    const novoCliente = {
      id: clientId,
      nome: trimmedNome,
      segmento: 'Splash', // Conforme regra de negócio da Lumos
      instagram: sanitizeString(instagram, 80),
      site: sanitizeString(site, 200),
      whatsapp: sanitizeString(whatsapp, 50),
      cidade: sanitizeString(cidade, 100),
      responsavel: sanitizeString(responsavel, 100),
      observacoes: sanitizeString(observacoes, 1000),
      ativo: typeof ativo === 'boolean' ? ativo : true,
      criado_por: sanitizeString(req.body.criado_por, 100) || 'lumos_app',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('clientes')
      .insert([novoCliente])
      .select()
      .single();

    if (error) {
      console.error('[Supabase POST /clientes error]:', error.message);
      res.status(500).json({ error: 'Erro ao persistir novo cliente no banco de dados.' });
      return;
    }

    res.status(201).json(data);
  } catch (err: unknown) {
    console.error('[POST /clientes exception]:', err);
    res.status(500).json({ error: 'Falha interna ao cadastrar cliente.' });
  }
});

/**
 * PUT /api/clientes/:id
 * Atualiza os dados de um cliente existente.
 */
clientesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID do cliente é obrigatório.' });
      return;
    }

    const { nome, instagram, site, whatsapp, cidade, responsavel, observacoes, ativo } = req.body;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      segmento: 'Splash',
    };

    if (nome !== undefined) {
      const cleanNome = sanitizeString(nome, 120);
      if (!cleanNome) {
        res.status(400).json({ error: 'O nome do cliente não pode ficar em branco.' });
        return;
      }
      updatePayload.nome = cleanNome;
    }

    if (instagram !== undefined) updatePayload.instagram = sanitizeString(instagram, 80);
    if (site !== undefined) updatePayload.site = sanitizeString(site, 200);
    if (whatsapp !== undefined) updatePayload.whatsapp = sanitizeString(whatsapp, 50);
    if (cidade !== undefined) updatePayload.cidade = sanitizeString(cidade, 100);
    if (responsavel !== undefined) updatePayload.responsavel = sanitizeString(responsavel, 100);
    if (observacoes !== undefined) updatePayload.observacoes = sanitizeString(observacoes, 1000);
    if (ativo !== undefined) updatePayload.ativo = Boolean(ativo);

    const { data, error } = await supabaseServer
      .from('clientes')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Supabase PUT /clientes/:id error]:', error.message);
      res.status(500).json({ error: 'Erro ao atualizar cliente no banco de dados.' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Cliente não encontrado para atualização.' });
      return;
    }

    res.json(data);
  } catch (err: unknown) {
    console.error('[PUT /clientes/:id exception]:', err);
    res.status(500).json({ error: 'Falha interna ao atualizar cliente.' });
  }
});

/**
 * DELETE /api/clientes/:id
 * Exclui o cliente e limpa diagnósticos e avaliações associadas no Supabase.
 */
clientesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID do cliente é obrigatório.' });
      return;
    }

    // 1. Exclui avaliações de diagnósticos desse cliente (se houverem)
    const { data: diags } = await supabaseServer
      .from('diagnosticos')
      .select('id')
      .eq('cliente_id', id);

    if (diags && diags.length > 0) {
      const diagIds = diags.map((d: { id: string }) => d.id);
      await supabaseServer.from('avaliacoes').delete().in('diagnostico_id', diagIds);
      await supabaseServer.from('diagnosticos').delete().eq('cliente_id', id);
    }

    // 2. Exclui o cliente
    const { error } = await supabaseServer
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Supabase DELETE /clientes/:id error]:', error.message);
      res.status(500).json({ error: 'Erro ao excluir cliente no banco de dados.' });
      return;
    }

    res.json({ success: true, id });
  } catch (err: unknown) {
    console.error('[DELETE /clientes/:id exception]:', err);
    res.status(500).json({ error: 'Falha interna ao excluir cliente.' });
  }
});
