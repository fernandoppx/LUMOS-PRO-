import express from 'express';

import {
  issueTeamSessionCookie,
  requireTeamAccess,
  rateLimiter
} from './middleware/security.js';

import {
  clientesRouter
} from './routes/clientes.js';

import {
  diagnosticosRouter
} from './routes/diagnosticos.js';

import {
  adminRouter
} from './routes/admin.js';

import { supabaseServer } from './supabase.js';
import { DEFAULT_PILARES, DEFAULT_CRITERIOS } from '../data/diagnosticData.js';
import { getFaixaFromMedia, getRotuloPadrao } from '../utils/formatters.js';

export const app = express();

export { issueTeamSessionCookie };

app.disable('x-powered-by');

app.use(express.json({ limit: '2mb' }));
app.use(rateLimiter);

// 1. Verificação de saúde do servidor (aberto para monitoramento e testes)
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    application: 'Lumos Pro',
    environment: process.env.NODE_ENV || 'development',
    time: new Date().toISOString()
  });
});

// 2. Relatório público desprotegido (acessível via token único compartilhado)
app.get('/api/diagnosticos/public/:token', async (req, res) => {
  try {
    const token = req.params.token;
    if (!token) {
      res.status(400).json({ error: 'Token obrigatório.' });
      return;
    }

    const { data: diag, error: diagErr } = await supabaseServer
      .from('diagnosticos')
      .select('*')
      .eq('share_token', token)
      .maybeSingle();

    if (diagErr) throw diagErr;

    if (!diag || !diag.compartilhado) {
      res.status(404).json({ error: 'Relatório indisponível ou link de compartilhamento desativado.' });
      return;
    }

    const { data: cliente, error: cliErr } = await supabaseServer
      .from('clientes')
      .select('id, nome, segmento, instagram, cidade')
      .eq('id', diag.cliente_id)
      .maybeSingle();

    if (cliErr) throw cliErr;

    const { data: avaliacoes, error: avErr } = await supabaseServer
      .from('avaliacoes')
      .select('*')
      .eq('diagnostico_id', diag.id);

    if (avErr) throw avErr;

    const avalsMap = new Map((avaliacoes || []).map(a => [a.criterio_id, a]));

    const pilares = DEFAULT_PILARES.map(pilar => {
      const pCrit = DEFAULT_CRITERIOS.filter(c => c.pilar_id === pilar.id);
      const criterios = pCrit.map(c => {
        const av = avalsMap.get(c.id);
        const nota = av?.nota ?? null;
        return {
          nome: c.nome,
          nota,
          rotulo: nota ? getRotuloPadrao(pilar.slug, nota) : 'Sem nota',
          solucao: av?.solucao || null
        };
      });

      const rated = criterios.filter(c => c.nota !== null);
      const media = rated.length > 0
        ? rated.reduce((acc, curr) => acc + (curr.nota || 0), 0) / rated.length
        : null;

      return {
        slug: pilar.slug,
        nome: pilar.nome,
        avaliador: pilar.avaliador,
        media,
        faixa: getFaixaFromMedia(media),
        criterios
      };
    });

    res.json({
      cliente: {
        nome: cliente?.nome || 'Cliente',
        segmento: cliente?.segmento || null,
        instagram: cliente?.instagram || null
      },
      diagnostico: {
        data: diag.data_referencia,
        resumo: diag.resumo || null
      },
      pilares
    });
  } catch (error) {
    console.error('[Public Report GET]:', error);
    res.status(500).json({ error: 'Erro ao carregar relatório público.' });
  }
});

// 3. Identificação do usuário logado e perfil
app.get('/api/me', requireTeamAccess, (req, res) => {
  res.json({ user: req.lumosUser });
});

// Atualização do próprio nome (sem permitir alterar o papel)
app.patch('/api/me', requireTeamAccess, async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      res.status(400).json({ error: 'Nome completo é obrigatório.' });
      return;
    }

    const cleanNome = nome.trim().slice(0, 120);

    const { data, error } = await supabaseServer
      .from('perfis')
      .update({ nome: cleanNome })
      .eq('id', req.lumosUser!.id)
      .select('id, nome, email, papel')
      .single();

    if (error) throw error;

    await supabaseServer.auth.admin
      .updateUserById(req.lumosUser!.id, {
        user_metadata: { nome: cleanNome, full_name: cleanNome },
      })
      .catch(() => {});

    res.json({ user: data });
  } catch (error) {
    console.error('[PATCH /api/me]:', error);
    res.status(500).json({ error: 'Erro ao atualizar nome do perfil.' });
  }
});

// 4. Rotas protegidas com controle de permissão por papel (Administrador x Auditor)
app.use('/api/clientes', requireTeamAccess, clientesRouter);
app.use('/api/diagnosticos', requireTeamAccess, diagnosticosRouter);
app.use('/api/admin', requireTeamAccess, adminRouter);

// Fallback JSON para rotas de API não encontradas
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado na API do Lumos Pro.' });
});
