import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseServer } from '../supabase.js';

export const clientesRouter = Router();

function sanitizeString(
  value: unknown,
  maxLength = 255
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;

  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function getUser(req: Request) {
  return req.lumosUser;
}

function applyOwnership<T extends {
  eq: (column: string, value: string) => T
}>(
  query: T,
  user: { id: string; papel: string }
): T {
  return user.papel === 'administrador'
    ? query
    : query.eq('criado_por_id', user.id);
}

function requireUser(req: Request, res: Response) {
  const user = getUser(req);

  if (!user) {
    res.status(401).json({
      error: 'Usuário não autenticado.'
    });
    return null;
  }

  return user;
}

// GET /api/clientes
clientesRouter.get('/', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    let query = supabaseServer
      .from('clientes')
      .select('*');

    query = applyOwnership(query, user);

    const { data, error } = await query.order(
      'created_at',
      { ascending: false }
    );

    if (error) throw error;

    res.json(data ?? []);
  } catch (error) {
    console.error('[Clientes GET]:', error);
    res.status(500).json({
      error: 'Erro ao consultar clientes.'
    });
  }
});

// GET /api/clientes/:id
clientesRouter.get('/:id', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    let query = supabaseServer
      .from('clientes')
      .select('*')
      .eq('id', req.params.id);

    query = applyOwnership(query, user);

    const { data, error } = await query.maybeSingle();

    if (error) throw error;

    if (!data) {
      res.status(404).json({
        error: 'Cliente não encontrado.'
      });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('[Cliente GET ID]:', error);
    res.status(500).json({
      error: 'Erro ao consultar cliente.'
    });
  }
});

// POST /api/clientes
clientesRouter.post('/', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Dados inválidos.' });
      return;
    }

    const nome = sanitizeString(body.nome, 120);

    if (!nome) {
      res.status(400).json({
        error: 'Nome do cliente obrigatório.'
      });
      return;
    }

    if (
      body.ativo !== undefined &&
      typeof body.ativo !== 'boolean'
    ) {
      res.status(400).json({
        error: 'Valor inválido para ativo.'
      });
      return;
    }

    const requestedId =
      typeof body.id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)
        ? body.id
        : crypto.randomUUID();

    const now = new Date().toISOString();

    const novoCliente = {
      id: requestedId,
      nome,
      segmento: 'Splash',
      instagram: sanitizeString(body.instagram, 80),
      site: sanitizeString(body.site, 200),
      whatsapp: sanitizeString(body.whatsapp, 50),
      cidade: sanitizeString(body.cidade, 100),
      responsavel: sanitizeString(body.responsavel, 100),
      observacoes: sanitizeString(body.observacoes, 1000),
      ativo: body.ativo ?? true,
      criado_por_id: user.id,
      criado_por: user.email || 'lumos_app',
      created_at: now,
      updated_at: now
    };

    const { data, error } = await supabaseServer
      .from('clientes')
      .insert(novoCliente)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('[Cliente POST]:', error);
    res.status(500).json({
      error: 'Erro ao cadastrar cliente.'
    });
  }
});

// PUT /api/clientes/:id
clientesRouter.put('/:id', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Dados inválidos.' });
      return;
    }

    const payload: Record<string, unknown> = {};

    if (body.nome !== undefined) {
      const nome = sanitizeString(body.nome, 120);

      if (!nome) {
        res.status(400).json({
          error: 'Nome inválido.'
        });
        return;
      }

      payload.nome = nome;
    }

    const fields: Record<string, number> = {
      instagram: 80,
      site: 200,
      whatsapp: 50,
      cidade: 100,
      responsavel: 100,
      observacoes: 1000
    };

    for (const [field, maxLength] of Object.entries(fields)) {
      if (body[field] !== undefined) {
        payload[field] = sanitizeString(
          body[field],
          maxLength
        );
      }
    }

    if (body.ativo !== undefined) {
      if (typeof body.ativo !== 'boolean') {
        res.status(400).json({
          error: 'Valor inválido para ativo.'
        });
        return;
      }

      payload.ativo = body.ativo;
    }

    if (Object.keys(payload).length === 0) {
      res.status(400).json({
        error: 'Nenhum campo válido para atualizar.'
      });
      return;
    }

    payload.updated_at = new Date().toISOString();

    let query = supabaseServer
      .from('clientes')
      .update(payload)
      .eq('id', req.params.id);

    query = applyOwnership(query, user);

    const { data, error } = await query
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      res.status(404).json({
        error: 'Cliente não encontrado ou sem acesso.'
      });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('[Cliente PUT]:', error);
    res.status(500).json({
      error: 'Erro ao atualizar cliente.'
    });
  }
});

// DELETE /api/clientes/:id
clientesRouter.delete('/:id', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    // Exclusão restrita ao proprietário ou administrador
    let acesso = supabaseServer
      .from('clientes')
      .select('id')
      .eq('id', req.params.id);
    acesso = applyOwnership(acesso, user);
    const { data: permitido, error: acessoError } = await acesso.maybeSingle();
    if (acessoError) throw acessoError;
    if (!permitido) {
      res.status(404).json({
        error: 'Cliente não encontrado ou sem acesso.'
      });
      return;
    }

    // Remove avaliações e diagnósticos do cliente antes (não depende de CASCADE no banco)
    const { data: diags, error: diagsError } = await supabaseServer
      .from('diagnosticos')
      .select('id')
      .eq('cliente_id', req.params.id);
    if (diagsError) throw diagsError;
    const diagIds = (diags || []).map((d) => d.id);
    if (diagIds.length > 0) {
      const { error: avError } = await supabaseServer
        .from('avaliacoes')
        .delete()
        .in('diagnostico_id', diagIds);
      if (avError) throw avError;
      const { error: dError } = await supabaseServer
        .from('diagnosticos')
        .delete()
        .eq('cliente_id', req.params.id);
      if (dError) throw dError;
    }

    let query = supabaseServer
      .from('clientes')
      .delete()
      .eq('id', req.params.id);

    query = applyOwnership(query, user);

    const { data, error } = await query
      .select('id')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      res.status(404).json({
        error: 'Cliente não encontrado ou sem acesso.'
      });
      return;
    }

    // ON DELETE CASCADE remove diagnósticos
    // e avaliações associados conforme o schema.
    res.json({
      success: true,
      id: data.id
    });
  } catch (error) {
    console.error('[Cliente DELETE]:', error);
    res.status(500).json({
      error: 'Erro ao excluir cliente.'
    });
  }
});
