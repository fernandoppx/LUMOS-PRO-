import express from 'express';

import {
  rateLimiter,
  requireTeamAccess
} from './middleware/security';

export const app = express();

app.disable('x-powered-by');

// Receber dados JSON do frontend
app.use(express.json({ limit: '1mb' }));

// Verificar se o backend está funcionando
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    application: 'Lumos Pro'
  });
});

// Exigir autenticação em todas as APIs
app.use('/api', rateLimiter);
app.use('/api', requireTeamAccess);

// Teste da sessão autenticada
app.get('/api/me', (req, res) => {
  res.status(200).json({
    id: req.lumosUser!.id,
    email: req.lumosUser!.email,
    papel: req.lumosUser!.papel
  });
});

// Bloqueio até implementar as regras de propriedade
app.use('/api', (_req, res) => {
  res.status(503).json({
    error:
      'Operações temporariamente indisponíveis até a configuração das permissões por usuário.'
  });
});
