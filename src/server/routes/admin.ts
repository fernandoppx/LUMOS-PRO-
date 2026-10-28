import { Router, Request, Response } from 'express';
import { supabaseServer } from '../supabase';
import { requireAdministrator } from '../middleware/security';

export const adminRouter = Router();

// Todas as rotas abaixo exigem perfil Administrador
adminRouter.use(requireAdministrator);

/**
 * GET /api/admin/usuarios
 * Retorna todos os usuários cadastrados na tabela perfis,
 * enriquecidos com a contagem de clientes e diagnósticos vinculados.
 */
adminRouter.get('/usuarios', async (req: Request, res: Response) => {
  try {
    // 1. Busca todos os perfis ordenados pela data de cadastro
    const { data: perfis, error: perfisError } = await supabaseServer
      .from('perfis')
      .select('id, nome, email, papel, created_at')
      .order('created_at', { ascending: true });

    if (perfisError) throw perfisError;

    // 2. Busca os clientes para agregar por criado_por_id
    const { data: clientes, error: clientesError } = await supabaseServer
      .from('clientes')
      .select('id, criado_por_id');

    if (clientesError) throw clientesError;

    // 3. Busca os diagnósticos para agregar por criado_por_id e por cliente
    const { data: diagnosticos, error: diagError } = await supabaseServer
      .from('diagnosticos')
      .select('id, cliente_id, criado_por_id');

    if (diagError) throw diagError;

    // Mapa de contagem de clientes por usuário
    const clientesCountMap = new Map<string, number>();
    const clientToOwnerMap = new Map<string, string>();

    (clientes || []).forEach((c) => {
      if (c.criado_por_id) {
        clientesCountMap.set(
          c.criado_por_id,
          (clientesCountMap.get(c.criado_por_id) || 0) + 1
        );
        clientToOwnerMap.set(c.id, c.criado_por_id);
      }
    });

    // Mapa de contagem de diagnósticos por usuário
    const diagCountMap = new Map<string, number>();
    (diagnosticos || []).forEach((d) => {
      // Prioriza criado_por_id do diagnóstico; se nulo, busca pelo dono do cliente
      const ownerId = d.criado_por_id || (d.cliente_id ? clientToOwnerMap.get(d.cliente_id) : null);
      if (ownerId) {
        diagCountMap.set(ownerId, (diagCountMap.get(ownerId) || 0) + 1);
      }
    });

    const usuariosEnriquecidos = (perfis || []).map((p) => ({
      id: p.id,
      nome: p.nome || p.email?.split('@')[0] || 'Usuário',
      email: p.email,
      papel: p.papel,
      created_at: p.created_at,
      clientes_count: clientesCountMap.get(p.id) || 0,
      diagnosticos_count: diagCountMap.get(p.id) || 0,
    }));

    res.json(usuariosEnriquecidos);
  } catch (error) {
    console.error('[Admin GET /usuarios]:', error);
    res.status(500).json({
      error: 'Erro ao listar usuários do sistema.',
    });
  }
});

/**
 * PATCH /api/admin/usuarios/:id/papel
 * Altera o papel de um usuário entre 'administrador' e 'auditor'.
 * Regra de segurança: Não permite rebaixar o único administrador do sistema.
 */
adminRouter.patch('/usuarios/:id/papel', async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const { papel } = req.body;

    if (!targetUserId) {
      res.status(400).json({ error: 'ID de usuário obrigatório.' });
      return;
    }

    if (!['administrador', 'auditor'].includes(papel)) {
      res.status(400).json({
        error: "Papel inválido. Os papéis permitidos são 'administrador' e 'auditor'.",
      });
      return;
    }

    // 1. Verifica se o usuário alvo existe
    const { data: targetPerfil, error: targetError } = await supabaseServer
      .from('perfis')
      .select('id, nome, email, papel')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetError) throw targetError;

    if (!targetPerfil) {
      res.status(404).json({ error: 'Usuário não encontrado na base de perfis.' });
      return;
    }

    // Se já está com o mesmo papel, retorna sucesso sem alteração
    if (targetPerfil.papel === papel) {
      res.json(targetPerfil);
      return;
    }

    // 2. Proteção do último Administrador:
    // Se o usuário atual é administrador e está sendo rebaixado para auditor,
    // verifica se existem outros administradores.
    if (targetPerfil.papel === 'administrador' && papel === 'auditor') {
      const { count, error: countError } = await supabaseServer
        .from('perfis')
        .select('id', { count: 'exact', head: true })
        .eq('papel', 'administrador');

      if (countError) throw countError;

      if (count !== null && count <= 1) {
        res.status(400).json({
          error:
            'Operação negada: não é possível rebaixar o único Administrador ativo no Lumos Pro. Promova outro usuário a Administrador antes de realizar esta alteração.',
        });
        return;
      }
    }

    // 3. Atualiza o papel na tabela perfis
    const { data: updatedPerfil, error: updateError } = await supabaseServer
      .from('perfis')
      .update({ papel })
      .eq('id', targetUserId)
      .select('id, nome, email, papel, created_at')
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: `Perfil do usuário ${updatedPerfil.email} alterado para ${papel}.`,
      usuario: updatedPerfil,
    });
  } catch (error) {
    console.error('[Admin PATCH /usuarios/:id/papel]:', error);
    res.status(500).json({
      error: 'Erro ao atualizar papel do usuário.',
    });
  }
});
