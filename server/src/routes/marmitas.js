import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { requireAdminAuth } from '../auth/adminAuth.js';
import {
  captureBackupBaseline,
  cleanupInsertedMarmitas,
  createMarmita,
  deleteMarmita,
  getBackupEntryById,
  getBackupSummary,
  getMainDishBackupDelayMs,
  getMarmitaById,
  isBlobStorageEnabled,
  isMainMarmita,
  listMarmitas,
  restoreDeletedMainMarmitas,
  serializeMarmita,
  updateMarmita,
  writeBlobBuffer,
} from '../db/excelDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getUploadsDir() {
  if (process.env.UPLOADS_DIR) {
    return path.resolve(process.env.UPLOADS_DIR);
  }
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'marmitex-uploads');
  }
  return path.resolve(__dirname, '../../uploads');
}

function buildSafeImageFilename(originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg';
  return `marmita-${Date.now()}-${Math.round(Math.random() * 1e6)}${safeExt}`;
}

const diskStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      const uploadsDir = getUploadsDir();
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    cb(null, buildSafeImageFilename(file.originalname));
  },
});

const uploadOptions = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    const err = new Error('Envie apenas arquivos de imagem (PNG, JPG ou WEBP).');
    err.status = 400;
    return cb(err, false);
  },
};

const diskUpload = multer({ storage: diskStorage, ...uploadOptions });
const memoryUpload = multer({ storage: multer.memoryStorage(), ...uploadOptions });

function uploadSingleImage(req, res, next) {
  const middleware = (isBlobStorageEnabled() ? memoryUpload : diskUpload).single('image');
  return middleware(req, res, next);
}

function validateMarmitaPayload(body, isUpdate = false) {
  const errors = [];

  if (!isUpdate || body.nome !== undefined) {
    if (!String(body.nome ?? '').trim()) {
      errors.push('O nome da marmita é obrigatório.');
    }
  }

  if (!isUpdate || body.descricao !== undefined) {
    if (!String(body.descricao ?? '').trim()) {
      errors.push('A descrição da marmita é obrigatória.');
    }
  }

  if (!isUpdate || body.categoria !== undefined) {
    if (!String(body.categoria ?? '').trim()) {
      errors.push('A categoria é obrigatória.');
    }
  }

  if (!isUpdate || body.preco !== undefined) {
    const preco = Number(body.preco);
    if (!Number.isFinite(preco) || preco <= 0) {
      errors.push('Informe um preço válido maior que zero.');
    }
  }

  if (
    body.precoPromocional !== undefined &&
    body.precoPromocional !== null &&
    body.precoPromocional !== ''
  ) {
    const promo = Number(body.precoPromocional);
    if (!Number.isFinite(promo) || promo <= 0) {
      errors.push('O preço promocional deve ser maior que zero.');
    }
    const basePrice = body.preco !== undefined ? Number(body.preco) : null;
    if (basePrice !== null && Number.isFinite(basePrice) && promo >= basePrice) {
      errors.push('O preço promocional deve ser menor que o preço original.');
    }
  }

  return errors;
}

function sanitizeMarmitaBody(body) {
  const sanitized = {};
  if (body.nome !== undefined) sanitized.nome = String(body.nome).trim();
  if (body.descricao !== undefined) sanitized.descricao = String(body.descricao).trim();
  if (body.categoria !== undefined) sanitized.categoria = String(body.categoria).trim();
  if (body.gosto !== undefined) sanitized.gosto = String(body.gosto).trim();
  if (body.preco !== undefined) sanitized.preco = Number(Number(body.preco).toFixed(2));
  if (body.precoPromocional !== undefined) {
    sanitized.precoPromocional =
      body.precoPromocional === null || body.precoPromocional === ''
        ? null
        : Number(Number(body.precoPromocional).toFixed(2));
  }
  if (body.tamanho !== undefined) sanitized.tamanho = String(body.tamanho).trim() || '500g';
  if (body.calorias !== undefined) {
    sanitized.calorias =
      body.calorias === null || body.calorias === '' ? null : Math.round(Number(body.calorias));
  }
  if (body.tempoPreparo !== undefined) {
    sanitized.tempoPreparo = String(body.tempoPreparo).trim() || '25-35 min';
  }
  if (body.imagem !== undefined) sanitized.imagem = String(body.imagem).trim();
  if (body.disponivel !== undefined) sanitized.disponivel = Boolean(body.disponivel);
  if (body.destaque !== undefined) sanitized.destaque = Boolean(body.destaque);
  return sanitized;
}

export const marmitasRouter = express.Router();

marmitasRouter.get('/', async (req, res, next) => {
  try {
    let items = await listMarmitas();
    const { disponivel, categoria, q } = req.query;

    if (disponivel === 'true') {
      items = items.filter((item) => item.disponivel);
    }
    if (categoria && categoria !== 'Todas') {
      items = items.filter(
        (item) => item.categoria.toLowerCase() === String(categoria).toLowerCase()
      );
    }
    if (q) {
      const term = String(q).toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.nome.toLowerCase().includes(term) ||
          item.descricao.toLowerCase().includes(term) ||
          item.categoria.toLowerCase().includes(term) ||
          item.gosto.toLowerCase().includes(term)
      );
    }

    res.json({ items: items.map(serializeMarmita) });
  } catch (err) {
    next(err);
  }
});

async function handleCleanup(req, res, next) {
  try {
    const force = req.body?.force === true || req.query?.force === 'true';
    const result = await cleanupInsertedMarmitas({ force });
    const message =
      result.deletedCount > 0
        ? `${result.deletedCount} prato(s) inserido(s) removido(s) da planilha Excel.`
        : 'Nenhum prato inserido elegível para exclusão no momento.';
    res.json({ ...result, message });
  } catch (err) {
    next(err);
  }
}

marmitasRouter.get('/cleanup', requireAdminAuth, handleCleanup);
marmitasRouter.post('/cleanup', requireAdminAuth, handleCleanup);

marmitasRouter.get('/backup', requireAdminAuth, async (_req, res, next) => {
  try {
    const backup = await getBackupSummary();
    res.json({ backup });
  } catch (err) {
    next(err);
  }
});

marmitasRouter.post('/backup/restore', requireAdminAuth, async (req, res, next) => {
  try {
    const force = req.body?.force === true || req.query?.force === 'true';
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    const result = await restoreDeletedMainMarmitas({ force, ids });
    const message =
      result.restoredCount > 0
        ? `${result.restoredCount} item(ns) principal(is) restaurado(s) do backup para a planilha.`
        : 'Nenhum item principal elegível para restauração no momento.';
    res.json({
      ...result,
      restoredItems: result.restoredItems.map(serializeMarmita),
      message,
    });
  } catch (err) {
    next(err);
  }
});

marmitasRouter.post('/backup/baseline', requireAdminAuth, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    const result = await captureBackupBaseline({ ids });
    const message =
      result.updatedCount > 0
        ? `Backup base atualizado para ${result.updatedCount} item(ns) principal(is).`
        : 'Nenhum item principal ativo elegível para atualizar o backup base.';
    res.json({
      ...result,
      message,
    });
  } catch (err) {
    next(err);
  }
});

marmitasRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await getMarmitaById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Marmita não encontrada.' });
    }
    res.json({ item: serializeMarmita(item) });
  } catch (err) {
    next(err);
  }
});

marmitasRouter.post('/upload', requireAdminAuth, uploadSingleImage, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
    }
    if (isBlobStorageEnabled() && req.file.buffer) {
      const filename = buildSafeImageFilename(req.file.originalname);
      const { blob, access } = await writeBlobBuffer(
        `uploads/${filename}`,
        req.file.buffer,
        req.file.mimetype || 'image/jpeg',
        31536000
      );
      const url = access === 'public' ? blob.url : `/uploads/${filename}`;
      return res.status(201).json({ url });
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  } catch (err) {
    next(err);
  }
});

marmitasRouter.post('/', requireAdminAuth, async (req, res, next) => {
  try {
    const errors = validateMarmitaPayload(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const payload = sanitizeMarmitaBody(req.body);
    const created = await createMarmita(payload);
    res.status(201).json({
      item: serializeMarmita(created),
      message: 'Marmita cadastrada na planilha Excel!',
    });
  } catch (err) {
    next(err);
  }
});

async function getBackupScheduleMetadata(id) {
  const backupRestoreMinutes = Math.round(getMainDishBackupDelayMs() / 60000);
  if (!isMainMarmita({ id })) {
    return {
      backupScheduled: false,
      restaurarEm: null,
      backupRestoreMinutes,
    };
  }
  const backupEntry = await getBackupEntryById(id);
  return {
    backupScheduled: Boolean(backupEntry?.restaurarEm),
    restaurarEm: backupEntry?.restaurarEm || null,
    backupRestoreMinutes,
  };
}

async function handleUpdate(req, res, next) {
  try {
    const existing = await getMarmitaById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Marmita não encontrada na planilha.' });
    }

    const mergedValidationInput = {
      ...existing,
      ...req.body,
    };
    const errors = validateMarmitaPayload(mergedValidationInput, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const payload = sanitizeMarmitaBody(req.body);
    const updated = await updateMarmita(req.params.id, payload);
    const backupMeta = await getBackupScheduleMetadata(req.params.id);
    const message = backupMeta.backupScheduled
      ? `Marmita atualizada! O histórico original do backup será restaurado em ${backupMeta.backupRestoreMinutes} min.`
      : 'Marmita atualizada na planilha Excel!';
    res.json({
      item: serializeMarmita(updated),
      ...backupMeta,
      message,
    });
  } catch (err) {
    next(err);
  }
}

marmitasRouter.put('/:id', requireAdminAuth, handleUpdate);
marmitasRouter.patch('/:id', requireAdminAuth, handleUpdate);

marmitasRouter.delete('/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const deleted = await deleteMarmita(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Marmita não encontrada na planilha.' });
    }
    const backupMeta = await getBackupScheduleMetadata(req.params.id);
    const message = backupMeta.backupScheduled
      ? `Item principal removido. O backup restaurará a versão original em ${backupMeta.backupRestoreMinutes} min.`
      : 'Marmita removida da planilha Excel!';
    res.json({
      deleted: true,
      id: req.params.id,
      ...backupMeta,
      message,
    });
  } catch (err) {
    next(err);
  }
});
