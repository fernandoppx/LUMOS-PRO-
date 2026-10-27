import express from 'express';
import {
  issueTeamSessionCookie
} from './middleware/security';

export const app = express();

export { issueTeamSessionCookie };

app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));

// Verificação de funcionamento do servidor
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    application: 'Lumos Pro'
  });
});

// Bloqueio temporário das APIs de dados.
// Será substituído após corrigirmos a autorização.
app.use('/api', (_req, res) => {
  res.status(503).json({
    error: 'API temporariamente indisponível durante a configuração de segurança.'
  });
});
