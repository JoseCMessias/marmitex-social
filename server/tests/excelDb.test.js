import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marmitex-test-'));
const testExcelPath = path.join(tempDir, 'test_marmitex.xlsx');
process.env.EXCEL_DB_PATH = testExcelPath;

const {
  BACKUP_SHEET_NAME,
  cleanupInsertedMarmitas,
  createMarmita,
  createPedido,
  deleteMarmita,
  ensureDatabase,
  getBackupEntryById,
  getBackupSummary,
  getMarmitaById,
  isBlobStorageEnabled,
  isInsertedMarmita,
  listMarmitas,
  listPedidos,
  restoreDeletedMainMarmitas,
  startInsertedDishCleanupScheduler,
  updateMarmita,
  updatePedidoStatus,
} = await import('../src/db/excelDb.js');

describe('MarmitexSocial Excel Database CRUD', () => {
  before(async () => {
    await ensureDatabase();
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates and seeds the .xlsx file with initial marmitas and pedidos', async () => {
    const marmitas = await listMarmitas();
    const pedidos = await listPedidos();

    assert.ok(marmitas.length >= 8, 'Should seed at least 8 marmitas');
    assert.ok(pedidos.length >= 2, 'Should seed initial orders');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(testExcelPath);
    assert.ok(workbook.getWorksheet('Marmitas'), 'Marmitas worksheet should exist');
    assert.ok(workbook.getWorksheet('Pedidos'), 'Pedidos worksheet should exist');
    assert.ok(workbook.getWorksheet(BACKUP_SHEET_NAME), 'BackupCardapio worksheet should exist');
  });

  it('creates, reads, updates, and deletes a marmita directly in Excel', async () => {
    const created = await createMarmita({
      nome: 'Baião de Dois Nordestino',
      descricao: 'Arroz, feijão de corda, queijo coalho e carne seca desfiada.',
      categoria: 'Tradicional',
      gosto: 'Caseiro, Bem Temperado',
      preco: 34.5,
      precoPromocional: 29.9,
      tamanho: '550g',
      calorias: 630,
      tempoPreparo: '25-35 min',
      imagem: '/images/marmitas/feijoada.jpg',
      disponivel: true,
      destaque: true,
    });

    assert.match(created.id, /^MARM-\d+$/);
    assert.equal(created.nome, 'Baião de Dois Nordestino');

    const fetched = await getMarmitaById(created.id);
    assert.ok(fetched);
    assert.equal(fetched.precoPromocional, 29.9);

    const updated = await updateMarmita(created.id, {
      nome: 'Baião de Dois Especial',
      preco: 36.0,
      disponivel: false,
    });
    assert.equal(updated.nome, 'Baião de Dois Especial');
    assert.equal(updated.preco, 36);
    assert.equal(updated.disponivel, false);

    const removed = await deleteMarmita(created.id);
    assert.equal(removed, true);

    const afterDelete = await getMarmitaById(created.id);
    assert.equal(afterDelete, null);
  });

  it('creates an order and updates its status in Excel', async () => {
    const marmitas = await listMarmitas();
    const dish = marmitas.find((m) => m.disponivel);

    const order = await createPedido({
      clienteNome: 'Carlos Teste',
      clienteTelefone: '11999990000',
      endereco: 'Rua Teste, 123',
      formaPagamento: 'Pix',
      observacoes: 'Sem cebola',
      itens: [{ id: dish.id, quantidade: 2 }],
    });

    assert.match(order.id, /^PED-\d+$/);
    assert.equal(order.status, 'Recebido');

    const updatedOrder = await updatePedidoStatus(order.id, 'Em Preparo');
    assert.equal(updatedOrder.status, 'Em Preparo');
  });

  it('keeps inserted dishes in Excel within 10 minutes and auto-deletes them after 10 minutes', async () => {
    const created = await createMarmita({
      nome: 'Prato Temporário de Teste',
      descricao: 'Prato inserido manualmente para testar persistência e limpeza.',
      categoria: 'Tradicional',
      gosto: 'Caseiro',
      preco: 30.0,
      precoPromocional: null,
      tamanho: '500g',
      calorias: 500,
      tempoPreparo: '25-35 min',
      imagem: '/images/marmitas/feijoada.jpg',
      disponivel: true,
      destaque: false,
    });

    assert.equal(isInsertedMarmita(created), true);

    // Survives subsequent Excel reads before 10 minutes
    const afterRefresh = await listMarmitas();
    assert.ok(afterRefresh.some((item) => item.id === created.id));

    // At 5 minutes it is NOT deleted yet
    const at5Min = await cleanupInsertedMarmitas({
      now: Date.parse(created.criadoEm) + 5 * 60 * 1000,
    });
    assert.equal(at5Min.deletedCount, 0);
    assert.ok(await getMarmitaById(created.id));

    // At 10 minutes it IS deleted while seeded dishes stay intact
    const at10Min = await cleanupInsertedMarmitas({
      now: Date.parse(created.criadoEm) + 10 * 60 * 1000,
    });
    assert.equal(at10Min.deletedCount, 1);
    assert.deepEqual(at10Min.deletedIds, [created.id]);
    assert.equal(await getMarmitaById(created.id), null);

    const remaining = await listMarmitas();
    assert.ok(remaining.some((item) => item.id === 'MARM-101'));

    // Also test automatic lazy cleanup on read when TTL is configured to 0ms
    const prevTtl = process.env.INSERTED_MARMITA_TTL_MS;
    process.env.INSERTED_MARMITA_TTL_MS = '0';
    try {
      const ephemeral = await createMarmita({
        nome: 'Prato Expirado Imediato',
        descricao: 'Deve expirar na leitura seguinte.',
        categoria: 'Tradicional',
        preco: 25.0,
      });
      const listAfterExpiry = await listMarmitas();
      assert.equal(
        listAfterExpiry.some((item) => item.id === ephemeral.id),
        false
      );
    } finally {
      if (prevTtl === undefined) {
        delete process.env.INSERTED_MARMITA_TTL_MS;
      } else {
        process.env.INSERTED_MARMITA_TTL_MS = prevTtl;
      }
    }

    const stopScheduler = startInsertedDishCleanupScheduler(60000);
    assert.equal(typeof stopScheduler, 'function');
    stopScheduler();
  });

  it('backs up existing main menu items and auto-restores deleted main items after 10 minutes', async () => {
    const editedMain = await updateMarmita('MARM-102', {
      nome: 'Frango Grelhado Customizado na Planilha',
      preco: 29.5,
    });
    assert.equal(editedMain.nome, 'Frango Grelhado Customizado na Planilha');

    // Delete main menu item -> stays deleted for 10 minutes, snapshot kept in BackupCardapio
    const deleted = await deleteMarmita('MARM-102');
    assert.equal(deleted, true);
    assert.equal(await getMarmitaById('MARM-102'), null);

    const backupEntry = await getBackupEntryById('MARM-102');
    assert.ok(backupEntry);
    assert.ok(backupEntry.deletadoEm);
    assert.ok(backupEntry.restaurarEm);
    assert.equal(backupEntry.nome, 'Frango Grelhado Customizado na Planilha');

    const summary = await getBackupSummary();
    assert.equal(summary.pendingRestoreCount, 1);
    assert.equal(summary.pendingRestores[0].id, 'MARM-102');

    // At 5 minutes it is NOT restored yet
    const deletedMs = Date.parse(backupEntry.deletadoEm);
    const at5Min = await restoreDeletedMainMarmitas({
      now: deletedMs + 5 * 60 * 1000,
    });
    assert.equal(at5Min.restoredCount, 0);
    assert.equal(await getMarmitaById('MARM-102'), null);

    // At 10 minutes it IS automatically re-inserted with the exact same edited values
    const at10Min = await cleanupInsertedMarmitas({
      now: deletedMs + 10 * 60 * 1000,
    });
    assert.equal(at10Min.restoredCount, 1);
    assert.deepEqual(at10Min.restoredIds, ['MARM-102']);

    const restored = await getMarmitaById('MARM-102');
    assert.ok(restored);
    assert.equal(restored.nome, 'Frango Grelhado Customizado na Planilha');
    assert.equal(restored.preco, 29.5);

    const summaryAfter = await getBackupSummary();
    assert.equal(summaryAfter.pendingRestoreCount, 0);

    // Migrating a legacy 2-sheet workbook (without BackupCardapio) creates BackupCardapio and preserves values
    const legacyWb = new ExcelJS.Workbook();
    await legacyWb.xlsx.readFile(testExcelPath);
    legacyWb.removeWorksheet(BACKUP_SHEET_NAME);
    await legacyWb.xlsx.writeFile(testExcelPath);

    const migratedList = await listMarmitas();
    assert.ok(migratedList.some((m) => m.id === 'MARM-102' && m.preco === 29.5));

    const migratedWb = new ExcelJS.Workbook();
    await migratedWb.xlsx.readFile(testExcelPath);
    assert.ok(migratedWb.getWorksheet(BACKUP_SHEET_NAME));

    // Lazy automatic restore on next read when delay is 0ms
    const prevDelay = process.env.MAIN_MARMITA_RESTORE_DELAY_MS;
    process.env.MAIN_MARMITA_RESTORE_DELAY_MS = '0';
    try {
      await deleteMarmita('MARM-101');
      const lazyRestored = await listMarmitas();
      assert.ok(lazyRestored.some((m) => m.id === 'MARM-101'));
    } finally {
      if (prevDelay === undefined) {
        delete process.env.MAIN_MARMITA_RESTORE_DELAY_MS;
      } else {
        process.env.MAIN_MARMITA_RESTORE_DELAY_MS = prevDelay;
      }
    }
  });

  it('detects Vercel Blob via BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID with OIDC on Vercel', () => {
    const saved = {
      EXCEL_DB_PATH: process.env.EXCEL_DB_PATH,
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
      BLOB_STORE_ID: process.env.BLOB_STORE_ID,
      VERCEL: process.env.VERCEL,
    };

    try {
      delete process.env.EXCEL_DB_PATH;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.BLOB_STORE_ID;
      delete process.env.VERCEL;
      assert.equal(isBlobStorageEnabled(), false);

      process.env.BLOB_STORE_ID = 'store_test123';
      process.env.VERCEL = '1';
      assert.equal(isBlobStorageEnabled(), true);

      delete process.env.BLOB_STORE_ID;
      delete process.env.VERCEL;
      process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_123';
      assert.equal(isBlobStorageEnabled(), true);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
