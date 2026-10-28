
import express from 'express';

import {
  rateLimiter,
  requireTeamAccess
} from './middleware/security';

import { clientesRouter } from './routes/clientes';
import { diagnosticosRouter } from './routes/diagnosticos';

export const app = express();

app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));

// Verificação pública do servidor
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    application: 'Lumos Pro'
  });
});

// Proteção das APIs privadas
app.use('/api', rateLimiter);
app.use('/api', requireTeamAccess);

// Dados do usuário autenticado
app.get('/api/me', (req, res) => {
  res.json({
    id: req.lumosUser!.id,
    email: req.lumosUser!.email,
    papel: req.lumosUser!.papel
  });
});

// Clientes e diagnósticos
app.use('/api/clientes', clientesRouter);
app.use('/api/diagnosticos', diagnosticosRouter);

// Rotas de API inexistentes
app.use('/api', (_req, res) => {
  res.status(404).json({
    error: 'Rota de API não encontrada.'
  });
});
