
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
const isVercel = process.env.VERCEL === '1';

// Mantém a emissão de cookie existente.
// A autorização real deve ser verificada no backend.
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/api') &&
    !req.path.includes('.')
  ) {
    issueTeamSessionCookie(res);
  }

  next();
});

// Entrada Express reconhecida pela Vercel
export default app;

// Inicialização utilizada fora da Vercel
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } =
      await import('vite');

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

    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }

      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[Lumos Pro] Servidor ativo na porta ${PORT}`
    );
  });
}

// Vercel gerencia as requisições HTTP.
// Fora dela, o servidor inicia normalmente.
if (!isVercel) {
  startServer().catch((err) => {
    console.error(
      '[Lumos Pro] Falha ao iniciar servidor:',
      err
    );

    process.exit(1);
  });
}
