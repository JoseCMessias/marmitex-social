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
    const rootRes = await fetch(`${baseUrl}/`);
    assert.equal(rootRes.status, 200);
    const rootCt = rootRes.headers.get('content-type') || '';
    if (rootCt.includes('application/json')) {
      const rootData = await rootRes.json();
      assert.equal(rootData.status, 'ok');
    } else {
      assert.ok(rootCt.includes('text/html'), 'Expected HTML when client/dist is built');
    }

    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.database, 'Excel (.xlsx)');
    assert.equal(health.insertedDishTtlMinutes, 10);
    assert.equal(health.persistence.persistent, true);

    const listRes = await fetch(`${baseUrl}/api/marmitas`);
    assert.equal(listRes.status, 200);
    assert.match(listRes.headers.get('cache-control') || '', /no-store/);
    const listData = await listRes.json();
    assert.ok(listData.items.length >= 8);

    // Protected admin endpoints reject unauthenticated access
    const unauthPedidosRes = await fetch(`${baseUrl}/api/pedidos`);
    assert.equal(unauthPedidosRes.status, 401);
    const unauthSnapRes = await fetch(`${baseUrl}/api/excel/snapshot`);
    assert.equal(unauthSnapRes.status, 401);
    const unauthDownloadRes = await fetch(`${baseUrl}/api/excel/download`);
    assert.equal(unauthDownloadRes.status, 401);
    const unauthCreateRes = await fetch(`${baseUrl}/api/marmitas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Bloqueado', descricao: 'Sem token', categoria: 'Tradicional', preco: 30 }),
    });
    assert.equal(unauthCreateRes.status, 401);

    // Invalid login attempts
    const badLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    assert.equal(badLoginRes.status, 401);

    // Valid admin login (admin / admin123)
    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);
    assert.equal(loginData.user.username, 'admin');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginData.token}`,
    };

    const sessionRes = await fetch(`${baseUrl}/api/admin/session`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.authenticated, true);
    assert.equal(sessionData.user.username, 'admin');

    // Create new marmita (authenticated admin)
    const createRes = await fetch(`${baseUrl}/api/marmitas`, {
      method: 'POST',
      headers: authHeaders,
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

    // Update marmita via PUT (authenticated admin)
    const updateRes = await fetch(`${baseUrl}/api/marmitas/${created.id}`, {
      method: 'PUT',
      headers: authHeaders,
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

    // Customer places an order without needing admin authentication
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

    // Admin lists orders and updates status
    const pedidosRes = await fetch(`${baseUrl}/api/pedidos`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(pedidosRes.status, 200);
    const pedidosList = await pedidosRes.json();
    assert.ok(pedidosList.items.some((p) => p.id === order.id));

    const patchOrderRes = await fetch(`${baseUrl}/api/pedidos/${order.id}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'Em Preparo' }),
    });
    assert.equal(patchOrderRes.status, 200);
    assert.equal((await patchOrderRes.json()).order.status, 'Em Preparo');

    // Inspect Excel snapshot & binary download (authenticated admin)
    const snapRes = await fetch(`${baseUrl}/api/excel/snapshot`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(snapRes.status, 200);
    const snap = await snapRes.json();
    assert.equal(snap.sheets.length, 2);

    const dlRes = await fetch(`${baseUrl}/api/excel/download`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(dlRes.status, 200);
    const buf = await dlRes.arrayBuffer();
    assert.ok(buf.byteLength > 2000);

    // Delete marmita (authenticated admin)
    const delRes = await fetch(`${baseUrl}/api/marmitas/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(delRes.status, 200);
    const afterDel = await fetch(`${baseUrl}/api/marmitas/${created.id}`);
    assert.equal(afterDel.status, 404);

    // Create another dish, confirm it stays on normal refresh and cleanup respects 10-min TTL until forced
    const tempDishRes = await fetch(`${baseUrl}/api/marmitas`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        nome: 'Escondidinho Temporário',
        descricao: 'Prato de teste para endpoint de limpeza.',
        categoria: 'Tradicional',
        preco: 29.0,
      }),
    });
    assert.equal(tempDishRes.status, 201);
    const tempDish = (await tempDishRes.json()).item;
    assert.equal(tempDish.temporario, true);
    assert.ok(tempDish.expiraEm);

    const softCleanupRes = await fetch(`${baseUrl}/api/marmitas/cleanup`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ force: false }),
    });
    assert.equal(softCleanupRes.status, 200);
    const softCleanup = await softCleanupRes.json();
    assert.equal(softCleanup.deletedCount, 0);

    const forceCleanupRes = await fetch(`${baseUrl}/api/marmitas/cleanup`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ force: true }),
    });
    assert.equal(forceCleanupRes.status, 200);
    const forceCleanup = await forceCleanupRes.json();
    assert.equal(forceCleanup.deletedCount, 1);
    assert.deepEqual(forceCleanup.deletedIds, [tempDish.id]);
  });
});
