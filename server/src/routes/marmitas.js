import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import {
  createMarmita,
  deleteMarmita,
  getMarmitaById,
  listMarmitas,
  updateMarmita,
} from '../db/excelDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `marmita-${Date.now()}-${Math.round(Math.random() * 1e6)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Envie apenas arquivos de imagem (PNG, JPG ou WEBP).'));
    }
  },
});

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

    res.json({ items });
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
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

marmitasRouter.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

marmitasRouter.post('/', async (req, res, next) => {
  try {
    const errors = validateMarmitaPayload(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const payload = sanitizeMarmitaBody(req.body);
    const created = await createMarmita(payload);
    res.status(201).json({ item: created, message: 'Marmita cadastrada na planilha Excel!' });
  } catch (err) {
    next(err);
  }
});

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
    res.json({ item: updated, message: 'Marmita atualizada na planilha Excel!' });
  } catch (err) {
    next(err);
  }
}

marmitasRouter.put('/:id', handleUpdate);
marmitasRouter.patch('/:id', handleUpdate);

marmitasRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteMarmita(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Marmita não encontrada na planilha.' });
    }
    res.json({ deleted: true, id: req.params.id, message: 'Marmita removida da planilha Excel!' });
  } catch (err) {
    next(err);
  }
});
