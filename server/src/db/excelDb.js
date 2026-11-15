import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { INITIAL_MARMITAS, INITIAL_PEDIDOS } from '../seed/initialMarmitas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_DB_PATH = path.resolve(__dirname, '../../data/marmitex_social.xlsx');

export function getDbPath() {
  if (process.env.EXCEL_DB_PATH) {
    return path.resolve(process.env.EXCEL_DB_PATH);
  }
  // Vercel serverless filesystem (/var/task) is read-only; /tmp is writable while warm.
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'marmitex_social.xlsx');
  }
  return DEFAULT_DB_PATH;
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

async function writeDatabase(marmitas, pedidos) {
  const dbPath = getDbPath();
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

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

  const tempPath = `${dbPath}.${Date.now()}.tmp.xlsx`;
  await workbook.xlsx.writeFile(tempPath);
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

export async function ensureDatabase() {
  const dbPath = getDbPath();
  try {
    await fs.access(dbPath);
    return;
  } catch {
    // Database does not exist yet; create and seed atomically.
  }

  await withWriteLock(async () => {
    try {
      await fs.access(dbPath);
      return;
    } catch {
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
    }
  });
}

async function loadWorkbookData() {
  await ensureDatabase();
  const dbPath = getDbPath();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(dbPath);

  const marmitasSheet = workbook.getWorksheet('Marmitas');
  const pedidosSheet = workbook.getWorksheet('Pedidos');

  const marmitas = readSheetObjects(marmitasSheet, MARMITAS_COLUMNS).map(hydrateMarmita);
  const pedidos = readSheetObjects(pedidosSheet, PEDIDOS_COLUMNS).map(hydratePedido);

  return { marmitas, pedidos };
}

function generateNextId(prefix, existingItems) {
  let maxNumber = prefix === 'MARM' ? 100 : 1000;
  for (const item of existingItems) {
    const match = String(item.id).match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
    if (match) {
      const num = Number(match[1]);
      if (num > maxNumber) maxNumber = num;
    }
  }
  return `${prefix}-${maxNumber + 1}`;
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
    const { marmitas, pedidos } = await loadWorkbookData();
    const now = new Date().toISOString();
    const newItem = hydrateMarmita({
      ...payload,
      id: generateNextId('MARM', marmitas),
      criadoEm: now,
      atualizadoEm: now,
    });
    const updated = [newItem, ...marmitas];
    await writeDatabase(updated, pedidos);
    return newItem;
  });
}

export async function updateMarmita(id, payload) {
  return withWriteLock(async () => {
    const { marmitas, pedidos } = await loadWorkbookData();
    const index = marmitas.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const existing = marmitas[index];
    const updatedItem = hydrateMarmita({
      ...existing,
      ...payload,
      id: existing.id,
      criadoEm: existing.criadoEm,
      atualizadoEm: new Date().toISOString(),
    });

    const nextMarmitas = [...marmitas];
    nextMarmitas[index] = updatedItem;
    await writeDatabase(nextMarmitas, pedidos);
    return updatedItem;
  });
}

export async function deleteMarmita(id) {
  return withWriteLock(async () => {
    const { marmitas, pedidos } = await loadWorkbookData();
    const exists = marmitas.some((item) => item.id === id);
    if (!exists) return false;

    const nextMarmitas = marmitas.filter((item) => item.id !== id);
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
    const { marmitas, pedidos } = await loadWorkbookData();
    const now = new Date().toISOString();

    const itemsWithDetails = [];
    let total = 0;

    for (const cartItem of payload.itens) {
      const dish = marmitas.find((m) => m.id === cartItem.id);
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
    await writeDatabase(marmitas, nextPedidos);
    return newOrder;
  });
}

export async function updatePedidoStatus(id, status) {
  return withWriteLock(async () => {
    const { marmitas, pedidos } = await loadWorkbookData();
    const index = pedidos.findIndex((order) => order.id === id);
    if (index === -1) return null;

    const nextPedidos = [...pedidos];
    nextPedidos[index] = {
      ...nextPedidos[index],
      status,
    };
    await writeDatabase(marmitas, nextPedidos);
    return nextPedidos[index];
  });
}

export async function getExcelSnapshot() {
  const { marmitas, pedidos } = await loadWorkbookData();
  const dbPath = getDbPath();
  const stats = await fs.stat(dbPath);
  return {
    filePath: dbPath,
    fileName: path.basename(dbPath),
    sizeBytes: stats.size,
    updatedAt: stats.mtime.toISOString(),
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
