import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get as blobGet, put as blobPut } from '@vercel/blob';
import ExcelJS from 'exceljs';
import { INITIAL_MARMITAS, INITIAL_PEDIDOS } from '../seed/initialMarmitas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_DB_PATH = path.resolve(__dirname, '../../data/marmitex_social.xlsx');
export const DEFAULT_INSERTED_DISH_TTL_MS = 10 * 60 * 1000;
const BLOB_WORKBOOK_PATHNAME = process.env.EXCEL_BLOB_PATHNAME || 'db/marmitex_social.xlsx';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const INITIAL_MARMITA_IDS = new Set(INITIAL_MARMITAS.map((item) => item.id));
const SEEDED_MAX_MARMITA_NUM = Math.max(
  100,
  ...INITIAL_MARMITAS.map((item) => {
    const match = String(item.id).match(/^MARM-(\d+)$/i);
    return match ? Number(match[1]) : 100;
  })
);

let cachedBlobAccess =
  process.env.BLOB_ACCESS === 'public' || process.env.BLOB_ACCESS === 'private'
    ? process.env.BLOB_ACCESS
    : null;

export function getInsertedDishTtlMs() {
  const configured = Number(process.env.INSERTED_MARMITA_TTL_MS);
  if (Number.isFinite(configured) && configured >= 0) {
    return configured;
  }
  return DEFAULT_INSERTED_DISH_TTL_MS;
}

function hasVercelOidcContext() {
  try {
    const ctx = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
    if (ctx?.headers?.['x-vercel-oidc-token']) return true;
  } catch {
    // ignore request-context lookup errors
  }
  return Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);
}

export function isBlobStorageEnabled() {
  if (process.env.EXCEL_DB_PATH) return false;
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && hasVercelOidcContext())
  );
}

export function getPersistenceInfo() {
  if (isBlobStorageEnabled()) {
    return {
      mode: 'vercel-blob',
      persistent: true,
      label: 'Vercel Blob (.xlsx persistente)',
    };
  }
  if (process.env.VERCEL) {
    return {
      mode: 'vercel-tmp-ephemeral',
      persistent: false,
      label: 'Vercel /tmp temporário (conecte Vercel Blob / BLOB_STORE_ID)',
    };
  }
  return {
    mode: 'local-file',
    persistent: true,
    label: 'Arquivo Excel local (.xlsx)',
  };
}

export function getDbPath() {
  if (process.env.EXCEL_DB_PATH) {
    return path.resolve(process.env.EXCEL_DB_PATH);
  }
  if (isBlobStorageEnabled()) {
    return `vercel-blob://${BLOB_WORKBOOK_PATHNAME}`;
  }
  // Vercel serverless filesystem (/var/task) is read-only; /tmp is writable only per instance.
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'marmitex_social.xlsx');
  }
  return DEFAULT_DB_PATH;
}

function isAccessMismatchError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (
    err?.name === 'BlobAccessError' ||
    msg.includes('public store') ||
    msg.includes('private store') ||
    msg.includes('access must be') ||
    (msg.includes('access') && (msg.includes('public') || msg.includes('private')))
  );
}

async function withDetectedBlobAccess(operation) {
  const candidates = cachedBlobAccess ? [cachedBlobAccess] : ['private', 'public'];
  let lastError;

  for (const access of candidates) {
    try {
      const result = await operation(access);
      cachedBlobAccess = access;
      return { result, access };
    } catch (err) {
      lastError = err;
      if (!cachedBlobAccess && isAccessMismatchError(err)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

export async function readBlobBuffer(pathname) {
  const { result } = await withDetectedBlobAccess((access) =>
    blobGet(pathname, { access, useCache: false })
  );
  if (!result || !result.stream) return null;

  const arrayBuf = await new Response(result.stream).arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuf),
    blob: result.blob,
  };
}

export async function writeBlobBuffer(pathname, buffer, contentType, cacheControlMaxAge = 60) {
  const { result, access } = await withDetectedBlobAccess((resolvedAccess) =>
    blobPut(pathname, buffer, {
      access: resolvedAccess,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge,
      contentType,
    })
  );
  return { blob: result, access };
}

const MARMITAS_COLUMNS = [
  { header: 'id', key: 'id', width: 14 },
  { header: 'nome', key: 'nome', width: 34 },
  { header: 'descricao', key: 'descricao', width: 55 },
  { header: 'categoria', key: 'categoria', width: 22 },
  { header: 'gosto', key: 'gosto', width: 26 },
  { header: 'preco', key: 'preco', width: 14 },
  { header: 'precoPromocional', key: 'precoPromocional', width: 18 },
  { header: 'tamanho', key: 'tamanho', width: 12 },
  { header: 'calorias', key: 'calorias', width: 12 },
  { header: 'tempoPreparo', key: 'tempoPreparo', width: 16 },
  { header: 'imagem', key: 'imagem', width: 42 },
  { header: 'disponivel', key: 'disponivel', width: 13 },
  { header: 'destaque', key: 'destaque', width: 13 },
  { header: 'criadoEm', key: 'criadoEm', width: 26 },
  { header: 'atualizadoEm', key: 'atualizadoEm', width: 26 },
];

const PEDIDOS_COLUMNS = [
  { header: 'id', key: 'id', width: 14 },
  { header: 'clienteNome', key: 'clienteNome', width: 26 },
  { header: 'clienteTelefone', key: 'clienteTelefone', width: 18 },
  { header: 'endereco', key: 'endereco', width: 42 },
  { header: 'formaPagamento', key: 'formaPagamento', width: 20 },
  { header: 'observacoes', key: 'observacoes', width: 32 },
  { header: 'itensResumo', key: 'itensResumo', width: 48 },
  { header: 'itensJson', key: 'itensJson', width: 52 },
  { header: 'total', key: 'total', width: 14 },
  { header: 'status', key: 'status', width: 20 },
  { header: 'criadoEm', key: 'criadoEm', width: 26 },
];

// Serializes all Excel file mutations to avoid concurrent write races.
let writeMutex = Promise.resolve();

function withWriteLock(task) {
  const next = writeMutex.then(task, task);
  writeMutex = next.catch(() => {});
  return next;
}

function parseBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'sim', 's', '1', 'yes', 'y', 'verdadeiro'].includes(normalized)) return true;
    if (['false', 'nao', 'não', 'n', '0', 'no', 'falso'].includes(normalized)) return false;
  }
  return fallback;
}

function parseNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const cleaned = String(value)
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeCellValue(cellValue) {
  if (cellValue && typeof cellValue === 'object' && 'result' in cellValue) {
    return cellValue.result;
  }
  if (cellValue && typeof cellValue === 'object' && 'text' in cellValue) {
    return cellValue.text;
  }
  return cellValue;
}

function readSheetObjects(worksheet, columns) {
  if (!worksheet || worksheet.rowCount < 2) return [];

  const headerMap = new Map();
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const key = String(normalizeCellValue(cell.value) ?? '').trim();
    if (key) headerMap.set(colNumber, key);
  });

  const rows = [];
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const obj = {};
    let hasAnyValue = false;

    for (const col of columns) {
      obj[col.key] = null;
    }

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = headerMap.get(colNumber);
      if (!key) return;
      const val = normalizeCellValue(cell.value);
      if (val !== null && val !== undefined && val !== '') {
        hasAnyValue = true;
      }
      obj[key] = val;
    });

    if (hasAnyValue && obj.id) {
      rows.push(obj);
    }
  }
  return rows;
}

function styleWorksheet(worksheet, columns, currencyKeys = []) {
  worksheet.columns = columns;
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEA580C' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFC2410C' } },
    };
  });

  if (columns.length > 0) {
    const lastColLetter = worksheet.getColumn(columns.length).letter;
    worksheet.autoFilter = `A1:${lastColLetter}1`;
  }

  for (let r = 2; r <= worksheet.rowCount; r += 1) {
    const row = worksheet.getRow(r);
    row.height = 22;
    row.alignment = { vertical: 'middle', wrapText: false };
    if (r % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFBF5' },
        };
      });
    }
  }

  for (const key of currencyKeys) {
    const col = worksheet.getColumn(key);
    if (col) {
      col.numFmt = '"R$ "#,##0.00';
    }
  }
}

async function buildWorkbookBuffer(marmitas, pedidos) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MarmitexSocial';
  workbook.created = new Date();
  workbook.modified = new Date();

  const marmitasSheet = workbook.addWorksheet('Marmitas');
  marmitasSheet.columns = MARMITAS_COLUMNS;
  for (const item of marmitas) {
    marmitasSheet.addRow({
      ...item,
      preco: Number(item.preco),
      precoPromocional:
        item.precoPromocional !== null && item.precoPromocional !== undefined
          ? Number(item.precoPromocional)
          : null,
      calorias:
        item.calorias !== null && item.calorias !== undefined ? Number(item.calorias) : null,
      disponivel: Boolean(item.disponivel),
      destaque: Boolean(item.destaque),
    });
  }
  styleWorksheet(marmitasSheet, MARMITAS_COLUMNS, ['preco', 'precoPromocional']);

  const pedidosSheet = workbook.addWorksheet('Pedidos');
  pedidosSheet.columns = PEDIDOS_COLUMNS;
  for (const order of pedidos) {
    pedidosSheet.addRow({
      ...order,
      total: Number(order.total),
    });
  }
  styleWorksheet(pedidosSheet, PEDIDOS_COLUMNS, ['total']);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

async function readStoredWorkbook() {
  if (isBlobStorageEnabled()) {
    const res = await readBlobBuffer(BLOB_WORKBOOK_PATHNAME);
    if (!res) return null;
    return {
      buffer: res.buffer,
      sizeBytes: res.buffer.byteLength,
      updatedAt:
        res.blob?.uploadedAt instanceof Date
          ? res.blob.uploadedAt.toISOString()
          : new Date().toISOString(),
    };
  }

  const dbPath = getDbPath();
  try {
    const [buffer, stats] = await Promise.all([fs.readFile(dbPath), fs.stat(dbPath)]);
    return {
      buffer,
      sizeBytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeDatabase(marmitas, pedidos) {
  const buffer = await buildWorkbookBuffer(marmitas, pedidos);

  if (isBlobStorageEnabled()) {
    await writeBlobBuffer(BLOB_WORKBOOK_PATHNAME, buffer, XLSX_MIME, 60);
    return;
  }

  const dbPath = getDbPath();
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const tempPath = `${dbPath}.${Date.now()}.tmp.xlsx`;
  await fs.writeFile(tempPath, buffer);
  try {
    await fs.rename(tempPath, dbPath);
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {});
    if (err.code === 'EPERM' || err.code === 'EBUSY') {
      throw new Error(
        'Não foi possível gravar a planilha Excel porque o arquivo está aberto em outro programa. Feche o Excel e tente novamente.'
      );
    }
    throw err;
  }
}

function hydrateMarmita(raw) {
  return {
    id: String(raw.id ?? '').trim(),
    nome: String(raw.nome ?? '').trim(),
    descricao: String(raw.descricao ?? '').trim(),
    categoria: String(raw.categoria ?? 'Tradicional').trim(),
    gosto: String(raw.gosto ?? '').trim(),
    preco: parseNumber(raw.preco, 0),
    precoPromocional: parseNumber(raw.precoPromocional, null),
    tamanho: String(raw.tamanho ?? '500g').trim(),
    calorias: parseNumber(raw.calorias, null),
    tempoPreparo: String(raw.tempoPreparo ?? '25-35 min').trim(),
    imagem: String(raw.imagem ?? '').trim(),
    disponivel: parseBool(raw.disponivel, true),
    destaque: parseBool(raw.destaque, false),
    criadoEm: raw.criadoEm ? String(raw.criadoEm) : new Date().toISOString(),
    atualizadoEm: raw.atualizadoEm ? String(raw.atualizadoEm) : new Date().toISOString(),
  };
}

function hydratePedido(raw) {
  let itens = [];
  if (raw.itensJson) {
    try {
      itens = JSON.parse(String(raw.itensJson));
    } catch {
      itens = [];
    }
  }
  return {
    id: String(raw.id ?? '').trim(),
    clienteNome: String(raw.clienteNome ?? '').trim(),
    clienteTelefone: String(raw.clienteTelefone ?? '').trim(),
    endereco: String(raw.endereco ?? '').trim(),
    formaPagamento: String(raw.formaPagamento ?? 'Pix').trim(),
    observacoes: String(raw.observacoes ?? '').trim(),
    itensResumo: String(raw.itensResumo ?? '').trim(),
    itensJson: String(raw.itensJson ?? '[]'),
    itens,
    total: parseNumber(raw.total, 0),
    status: String(raw.status ?? 'Recebido').trim(),
    criadoEm: raw.criadoEm ? String(raw.criadoEm) : new Date().toISOString(),
  };
}

export function isInsertedMarmita(item) {
  return Boolean(item && item.id && !INITIAL_MARMITA_IDS.has(item.id));
}

export function serializeMarmita(item) {
  const temporario = isInsertedMarmita(item);
  const createdMs = Date.parse(item.criadoEm);
  const expiraEm =
    temporario && Number.isFinite(createdMs)
      ? new Date(createdMs + getInsertedDishTtlMs()).toISOString()
      : null;
  return {
    ...item,
    temporario,
    expiraEm,
  };
}

export function getExpiredInsertedMarmitas(
  marmitas,
  { maxAgeMs = getInsertedDishTtlMs(), now = Date.now(), force = false } = {}
) {
  const activeMarmitas = [];
  const removedMarmitas = [];

  for (const item of marmitas) {
    if (!isInsertedMarmita(item)) {
      activeMarmitas.push(item);
      continue;
    }
    if (force) {
      removedMarmitas.push(item);
      continue;
    }
    const createdAtMs = Date.parse(item.criadoEm);
    const elapsedMs = Number.isFinite(createdAtMs) ? now - createdAtMs : Infinity;
    if (elapsedMs >= maxAgeMs) {
      removedMarmitas.push(item);
    } else {
      activeMarmitas.push(item);
    }
  }

  return { activeMarmitas, removedMarmitas };
}

async function ensureDatabaseUnsafe() {
  const existing = await readStoredWorkbook();
  if (existing) return existing;

  const now = new Date().toISOString();
  const seededMarmitas = INITIAL_MARMITAS.map((item) => ({
    ...item,
    criadoEm: now,
    atualizadoEm: now,
  }));
  const seededPedidos = INITIAL_PEDIDOS.map((order) => ({
    ...order,
    criadoEm: now,
  }));
  await writeDatabase(seededMarmitas, seededPedidos);
  return readStoredWorkbook();
}

export async function ensureDatabase() {
  const existing = await readStoredWorkbook();
  if (existing) return;

  await withWriteLock(async () => {
    await ensureDatabaseUnsafe();
  });
}

async function readWorkbookUnsafe() {
  const stored = await ensureDatabaseUnsafe();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(stored.buffer);

  const marmitasSheet = workbook.getWorksheet('Marmitas');
  const pedidosSheet = workbook.getWorksheet('Pedidos');

  const marmitas = readSheetObjects(marmitasSheet, MARMITAS_COLUMNS).map(hydrateMarmita);
  const pedidos = readSheetObjects(pedidosSheet, PEDIDOS_COLUMNS).map(hydratePedido);

  return { marmitas, pedidos, stored };
}

async function loadWorkbookData() {
  await ensureDatabase();
  const data = await readWorkbookUnsafe();
  const { removedMarmitas } = getExpiredInsertedMarmitas(data.marmitas);

  if (removedMarmitas.length > 0) {
    await cleanupInsertedMarmitas();
    return readWorkbookUnsafe();
  }

  return data;
}

function generateNextId(prefix, existingItems) {
  let maxNumber = prefix === 'MARM' ? SEEDED_MAX_MARMITA_NUM : 1000;
  for (const item of existingItems) {
    const match = String(item.id).match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
    if (match) {
      const num = Number(match[1]);
      if (num > maxNumber) maxNumber = num;
    }
  }
  return `${prefix}-${maxNumber + 1}`;
}

export async function cleanupInsertedMarmitas({
  maxAgeMs = getInsertedDishTtlMs(),
  now = Date.now(),
  force = false,
} = {}) {
  return withWriteLock(async () => {
    const { marmitas, pedidos } = await readWorkbookUnsafe();
    const { activeMarmitas, removedMarmitas } = getExpiredInsertedMarmitas(marmitas, {
      maxAgeMs,
      now,
      force,
    });

    if (removedMarmitas.length === 0) {
      return {
        deletedCount: 0,
        deletedIds: [],
        remainingCount: marmitas.length,
        ttlMinutes: Math.round(maxAgeMs / 60000),
      };
    }

    await writeDatabase(activeMarmitas, pedidos);
    return {
      deletedCount: removedMarmitas.length,
      deletedIds: removedMarmitas.map((item) => item.id),
      remainingCount: activeMarmitas.length,
      ttlMinutes: Math.round(maxAgeMs / 60000),
    };
  });
}

export function startInsertedDishCleanupScheduler(
  intervalMs = getInsertedDishTtlMs(),
  onCleaned = null
) {
  const safeInterval = Math.max(1000, Number(intervalMs) || DEFAULT_INSERTED_DISH_TTL_MS);
  const timer = setInterval(async () => {
    try {
      const result = await cleanupInsertedMarmitas();
      if (result.deletedCount > 0 && typeof onCleaned === 'function') {
        onCleaned(result);
      }
    } catch (err) {
      console.error('[Cleanup Scheduler Error]', err);
    }
  }, safeInterval);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return () => clearInterval(timer);
}

export async function listMarmitas() {
  const { marmitas } = await loadWorkbookData();
  return marmitas;
}

export async function getMarmitaById(id) {
  const { marmitas } = await loadWorkbookData();
  return marmitas.find((item) => item.id === id) || null;
}

export async function createMarmita(payload) {
  return withWriteLock(async () => {
    const { marmitas, pedidos } = await readWorkbookUnsafe();
    const { activeMarmitas } = getExpiredInsertedMarmitas(marmitas);
    const now = new Date().toISOString();
    const newItem = hydrateMarmita({
      ...payload,
      id: generateNextId('MARM', activeMarmitas),
      criadoEm: now,
      atualizadoEm: now,
    });
    const updated = [newItem, ...activeMarmitas];
    await writeDatabase(updated, pedidos);
    return newItem;
  });
}

export async function updateMarmita(id, payload) {
  return withWriteLock(async () => {
    const { marmitas, pedidos } = await readWorkbookUnsafe();
    const { activeMarmitas } = getExpiredInsertedMarmitas(marmitas);
    const index = activeMarmitas.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const existing = activeMarmitas[index];
    const updatedItem = hydrateMarmita({
      ...existing,
      ...payload,
      id: existing.id,
      criadoEm: existing.criadoEm,
      atualizadoEm: new Date().toISOString(),
    });

    const nextMarmitas = [...activeMarmitas];
    nextMarmitas[index] = updatedItem;
    await writeDatabase(nextMarmitas, pedidos);
    return updatedItem;
  });
}

export async function deleteMarmita(id) {
  return withWriteLock(async () => {
    const { marmitas, pedidos } = await readWorkbookUnsafe();
    const { activeMarmitas, removedMarmitas } = getExpiredInsertedMarmitas(marmitas);
    const exists = activeMarmitas.some((item) => item.id === id);
    if (!exists) {
      if (removedMarmitas.length > 0) {
        await writeDatabase(activeMarmitas, pedidos);
      }
      return false;
    }

    const nextMarmitas = activeMarmitas.filter((item) => item.id !== id);
    await writeDatabase(nextMarmitas, pedidos);
    return true;
  });
}

export async function listPedidos() {
  const { pedidos } = await loadWorkbookData();
  return pedidos;
}

export async function createPedido(payload) {
  return withWriteLock(async () => {
    const { marmitas, pedidos } = await readWorkbookUnsafe();
    const { activeMarmitas } = getExpiredInsertedMarmitas(marmitas);
    const now = new Date().toISOString();

    const itemsWithDetails = [];
    let total = 0;

    for (const cartItem of payload.itens) {
      const dish = activeMarmitas.find((m) => m.id === cartItem.id);
      if (!dish) {
        throw new Error(`Marmita "${cartItem.id}" não encontrada no cardápio.`);
      }
      if (!dish.disponivel) {
        throw new Error(`A marmita "${dish.nome}" está temporariamente indisponível.`);
      }
      const qty = Math.max(1, Math.floor(Number(cartItem.quantidade) || 1));
      const unitPrice =
        dish.precoPromocional !== null &&
        dish.precoPromocional > 0 &&
        dish.precoPromocional < dish.preco
          ? dish.precoPromocional
          : dish.preco;
      total += unitPrice * qty;
      itemsWithDetails.push({
        id: dish.id,
        nome: dish.nome,
        quantidade: qty,
        precoUnitario: unitPrice,
        observacao: cartItem.observacao ? String(cartItem.observacao).trim() : '',
      });
    }

    const itensResumo = itemsWithDetails
      .map((item) => `${item.quantidade}x ${item.nome}`)
      .join(', ');

    const newOrder = hydratePedido({
      id: generateNextId('PED', pedidos),
      clienteNome: payload.clienteNome,
      clienteTelefone: payload.clienteTelefone,
      endereco: payload.endereco,
      formaPagamento: payload.formaPagamento || 'Pix',
      observacoes: payload.observacoes || '',
      itensResumo,
      itensJson: JSON.stringify(itemsWithDetails),
      total: Number(total.toFixed(2)),
      status: 'Recebido',
      criadoEm: now,
    });

    const nextPedidos = [newOrder, ...pedidos];
    await writeDatabase(activeMarmitas, nextPedidos);
    return newOrder;
  });
}

export async function updatePedidoStatus(id, status) {
  return withWriteLock(async () => {
    const { marmitas, pedidos } = await readWorkbookUnsafe();
    const { activeMarmitas } = getExpiredInsertedMarmitas(marmitas);
    const index = pedidos.findIndex((order) => order.id === id);
    if (index === -1) return null;

    const nextPedidos = [...pedidos];
    nextPedidos[index] = {
      ...nextPedidos[index],
      status,
    };
    await writeDatabase(activeMarmitas, nextPedidos);
    return nextPedidos[index];
  });
}

export async function getExcelFileBuffer() {
  const { stored } = await loadWorkbookData();
  return stored.buffer;
}

export async function getExcelSnapshot() {
  const { marmitas, pedidos, stored } = await loadWorkbookData();
  const dbPath = getDbPath();
  return {
    filePath: dbPath,
    fileName: path.basename(dbPath),
    sizeBytes: stored.sizeBytes,
    updatedAt: stored.updatedAt,
    persistence: getPersistenceInfo(),
    insertedDishTtlMinutes: Math.round(getInsertedDishTtlMs() / 60000),
    sheets: [
      {
        name: 'Marmitas',
        columns: MARMITAS_COLUMNS.map((c) => c.key),
        rowCount: marmitas.length,
        rows: marmitas,
      },
      {
        name: 'Pedidos',
        columns: PEDIDOS_COLUMNS.map((c) => c.key),
        rowCount: pedidos.length,
        rows: pedidos,
      },
    ],
  };
}
