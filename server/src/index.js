import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { ensureDatabase, getDbPath, getExcelSnapshot } from './db/excelDb.js';
import { getUploadsDir, marmitasRouter } from './routes/marmitas.js';
import { pedidosRouter } from './routes/pedidos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.use('/uploads', express.static(getUploadsDir()));

  app.get('/api/health', async (_req, res, next) => {
    try {
      await ensureDatabase();
      res.json({
        status: 'ok',
        service: 'MarmitexSocial API',
        database: 'Excel (.xlsx)',
        filePath: getDbPath(),
      });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/marmitas', marmitasRouter);
  app.use('/api/pedidos', pedidosRouter);

  app.get('/api/excel/snapshot', async (_req, res, next) => {
    try {
      const snapshot = await getExcelSnapshot();
      res.json(snapshot);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/excel/download', async (_req, res, next) => {
    try {
      await ensureDatabase();
      const dbPath = getDbPath();
      res.download(dbPath, 'marmitex_social.xlsx');
    } catch (err) {
      next(err);
    }
  });

  // Serve built client when running locally in production mode if dist exists.
  const clientDistDir = path.resolve(__dirname, '../../client/dist');
  app.use(async (req, res, next) => {
    if (process.env.VERCEL || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    try {
      await fs.access(clientDistDir);
      return express.static(clientDistDir)(req, res, next);
    } catch {
      return next();
    }
  });

  const apiInfoPayload = () => ({
    status: 'ok',
    service: 'MarmitexSocial API',
    database: process.env.VERCEL ? 'Excel (.xlsx em /tmp temporário)' : 'Excel (.xlsx)',
    endpoints: ['/api/health', '/api/marmitas', '/api/pedidos', '/api/excel/snapshot'],
  });

  app.get('/', (_req, res) => {
    res.json(apiInfoPayload());
  });

  app.get('/api', (_req, res) => {
    res.json(apiInfoPayload());
  });

  app.use((err, _req, res, _next) => {
    console.error('[API Error]', err);
    const status = err.name === 'MulterError' ? 400 : 500;
    res.status(status).json({
      error: err.message || 'Erro interno ao processar requisição na planilha Excel.',
    });
  });

  return app;
}

const app = createApp();

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  const PORT = Number(process.env.PORT) || 3001;
  app.listen(PORT, () => {
    console.log(`MarmitexSocial API rodando em http://localhost:${PORT}`);
    console.log(`Planilha Excel conectada em: ${getDbPath()}`);
  });
  ensureDatabase().catch((err) => {
    console.error('Falha ao inicializar banco Excel:', err);
  });
}

export default app;
