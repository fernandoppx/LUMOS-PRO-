import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  rateLimiter,
  requireTeamAccess,
  issueTeamSessionCookie,
} from './src/server/middleware/security';
import { clientesRouter } from './src/server/routes/clientes';
import { diagnosticosRouter } from './src/server/routes/diagnosticos';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Basic security response headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// JSON body parser with payload limits
app.use(express.json({ limit: '2mb' }));

// Apply IP rate limiting to API routes
app.use('/api', rateLimiter);

/**
 * Health check endpoint (public ping)
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Lumos Pro Backend',
    timestamp: new Date().toISOString(),
  });
});

/**
 * API Routes protected by Team & Gateway Access Middleware
 * Protects GET, POST, PUT, DELETE
 */
app.use('/api/clientes', requireTeamAccess, clientesRouter);
app.use('/api/diagnosticos', requireTeamAccess, diagnosticosRouter);

/**
 * Vite integration in development or static serving in production.
 * Issues HttpOnly session cookie on initial page load for legitimate app visitors.
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
