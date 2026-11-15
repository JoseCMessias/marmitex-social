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
  cleanupInsertedMarmitas,
  createMarmita,
  createPedido,
  deleteMarmita,
  ensureDatabase,
  getMarmitaById,
  isInsertedMarmita,
  listMarmitas,
  listPedidos,
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
});
