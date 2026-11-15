import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { requireAdminAuth } from './auth/adminAuth.js';
import {
  cleanupInsertedMarmitas,
  ensureDatabase,
  getDbPath,
  getExcelFileBuffer,
  getExcelSnapshot,
  getInsertedDishTtlMs,
  getPersistenceInfo,
  isBlobStorageEnabled,
  readBlobBuffer,
  startInsertedDishCleanupScheduler,
} from './db/excelDb.js';
import { adminRouter } from './routes/admin.js';
import { getUploadsDir, marmitasRouter } from './routes/marmitas.js';
import { pedidosRouter } from './routes/pedidos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  app.use('/uploads', express.static(getUploadsDir()));
  app.get('/uploads/:filename', async (req, res, next) => {
    if (!isBlobStorageEnabled()) return next();
    try {
      const safeName = path.basename(req.params.filename);
      const result = await readBlobBuffer(`uploads/${safeName}`);
      if (!result) {
        return res.status(404).json({ error: 'Imagem não encontrada.' });
      }
      res.setHeader('Content-Type', result.blob?.contentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(result.buffer);
    } catch (err) {
      return next(err);
    }
  });

  app.get('/api/health', async (_req, res, next) => {
    try {
      await ensureDatabase();
      res.json({
        status: 'ok',
        service: 'MarmitexSocial API',
        database: 'Excel (.xlsx)',
        filePath: getDbPath(),
        persistence: getPersistenceInfo(),
        insertedDishTtlMinutes: Math.round(getInsertedDishTtlMs() / 60000),
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/cron/cleanup', async (req, res, next) => {
    try {
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const result = await cleanupInsertedMarmitas();
      res.json({
        ...result,
        message: 'Limpeza de pratos inseridos executada com sucesso.',
      });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/admin', adminRouter);
  app.use('/api/marmitas', marmitasRouter);
  app.use('/api/pedidos', pedidosRouter);

  app.get('/api/excel/snapshot', requireAdminAuth, async (_req, res, next) => {
    try {
      const snapshot = await getExcelSnapshot();
      res.json(snapshot);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/excel/download', requireAdminAuth, async (_req, res, next) => {
    try {
      const buffer = await getExcelFileBuffer();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="marmitex_social.xlsx"');
      res.send(buffer);
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
    database: 'Excel (.xlsx)',
    persistence: getPersistenceInfo(),
    insertedDishTtlMinutes: Math.round(getInsertedDishTtlMs() / 60000),
    endpoints: [
      '/api/health',
      '/api/admin/login',
      '/api/admin/session',
      '/api/marmitas',
      '/api/marmitas/cleanup',
      '/api/pedidos',
      '/api/excel/snapshot',
    ],
  });

  app.get('/', (_req, res) => {
    res.json(apiInfoPayload());
  });

  app.get('/api', (_req, res) => {
    res.json(apiInfoPayload());
  });

  app.use((err, _req, res, _next) => {
    console.error('[API Error]', err);
    const status = err.status || (err.name === 'MulterError' ? 400 : 500);
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
    console.log(`Planilha Excel conectada em: ${getDbPath()} (${getPersistenceInfo().label})`);
    console.log(
      `Limpeza automática de pratos inseridos configurada a cada ${Math.round(
        getInsertedDishTtlMs() / 60000
      )} minuto(s).`
    );
  });
  ensureDatabase()
    .then(() => {
      startInsertedDishCleanupScheduler(undefined, (result) => {
        console.log(
          `[Auto-Cleanup] ${result.deletedCount} prato(s) inserido(s) removido(s): ${result.deletedIds.join(', ')}`
        );
      });
    })
    .catch((err) => {
      console.error('Falha ao inicializar banco Excel:', err);
    });
}

export default app;
