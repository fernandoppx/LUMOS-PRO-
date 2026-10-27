import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { app, issueTeamSessionCookie } from './src/server/app';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);

/**
 * Vite integration in development or static serving in production.
 * Preserves the exact WebSocket server binding on port 3000.
 */
async function startServer() {
  const httpServer = http.createServer(app);

  // Middleware to issue team session cookie for HTML navigation requests
  app.use((req, res, next) => {
    if (req.method === 'GET' && (!req.path.startsWith('/api') && !req.path.includes('.'))) {
      issueTeamSessionCookie(res);
    }
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      issueTeamSessionCookie(res);
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Lumos Pro] Servidor ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Lumos Pro] Falha ao iniciar servidor:', err);
  process.exit(1);
});
