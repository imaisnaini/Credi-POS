import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes.ts';
import { seedDatabase } from './server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Seed / init relational database
  try {
    seedDatabase(false);
    console.log('[CrediPOS] Database initialized and seeded successfully.');
  } catch (err) {
    console.error('[CrediPOS] Error initializing database:', err);
  }

  app.use(express.json());
  app.use('/api', apiRouter);

  if (!isProduction) {
    // Dev mode: Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built dist
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CrediPOS] Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[CrediPOS] Failed to start server:', err);
  process.exit(1);
});
