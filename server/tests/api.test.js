import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marmitex-api-'));
process.env.EXCEL_DB_PATH = path.join(tempDir, 'api_marmitex.xlsx');

const { createApp } = await import('../src/index.js');
const { ensureDatabase } = await import('../src/db/excelDb.js');

describe('MarmitexSocial HTTP API + Excel integration', () => {
  let server;
  let baseUrl;

  before(async () => {
    await ensureDatabase();
    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('lists seeded marmitas, creates, edits, toggles, deletes, and records orders', async () => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.database, 'Excel (.xlsx)');

    const listRes = await fetch(`${baseUrl}/api/marmitas`);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(listData.items.length >= 8);

    // Create new marmita
    const createRes = await fetch(`${baseUrl}/api/marmitas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Moqueca Baiana Tradicional',
        descricao: 'Peixe fresco no leite de coco, azeite de dendê, arroz e pirão.',
        categoria: 'Tradicional',
        gosto: 'Bem Temperado, Aromático',
        preco: 42.0,
        precoPromocional: 37.5,
        tamanho: '550g',
        calorias: 580,
        tempoPreparo: '30-40 min',
        imagem: '/images/marmitas/salmao-gourmet.jpg',
        disponivel: true,
        destaque: false,
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()).item;
    assert.equal(created.nome, 'Moqueca Baiana Tradicional');

    // Update marmita via PUT
    const updateRes = await fetch(`${baseUrl}/api/marmitas/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Moqueca Baiana Premium',
        preco: 45.0,
        precoPromocional: null,
      }),
    });
    assert.equal(updateRes.status, 200);
    const updated = (await updateRes.json()).item;
    assert.equal(updated.nome, 'Moqueca Baiana Premium');
    assert.equal(updated.preco, 45);

    // Place an order for the newly created dish
    const orderRes = await fetch(`${baseUrl}/api/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteNome: 'Ana Souza',
        clienteTelefone: '11988887777',
        endereco: 'Rua das Flores, 50',
        formaPagamento: 'Pix',
        itens: [{ id: created.id, quantidade: 2 }],
      }),
    });
    assert.equal(orderRes.status, 201);
    const order = (await orderRes.json()).order;
    assert.equal(order.total, 90);

    // Inspect Excel snapshot & binary download
    const snapRes = await fetch(`${baseUrl}/api/excel/snapshot`);
    assert.equal(snapRes.status, 200);
    const snap = await snapRes.json();
    assert.equal(snap.sheets.length, 2);

    const dlRes = await fetch(`${baseUrl}/api/excel/download`);
    assert.equal(dlRes.status, 200);
    const buf = await dlRes.arrayBuffer();
    assert.ok(buf.byteLength > 2000);

    // Delete marmita
    const delRes = await fetch(`${baseUrl}/api/marmitas/${created.id}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);
    const afterDel = await fetch(`${baseUrl}/api/marmitas/${created.id}`);
    assert.equal(afterDel.status, 404);
  });
});
