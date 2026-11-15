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
  createMarmita,
  createPedido,
  deleteMarmita,
  ensureDatabase,
  getMarmitaById,
  listMarmitas,
  listPedidos,
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
});
