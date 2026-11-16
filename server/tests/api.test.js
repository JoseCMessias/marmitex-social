import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marmitex-api-'));
process.env.EXCEL_DB_PATH = path.join(tempDir, 'api_marmitex.xlsx');
process.env.UPLOADS_DIR = path.join(tempDir, 'uploads');

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
    assert.equal(health.mainDishBackupMinutes, 10);
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
    assert.equal(snap.sheets.length, 3);
    assert.equal(snap.sheets[2].name, 'BackupCardapio');

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

    // Editing a main item preserves the edit without scheduling rollback; deleting recovers pre-edit history
    const origMainRes = await fetch(`${baseUrl}/api/marmitas/MARM-101`);
    assert.equal(origMainRes.status, 200);
    const origMain = (await origMainRes.json()).item;

    const editMainRes = await fetch(`${baseUrl}/api/marmitas/MARM-101`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ nome: 'Prato Alterado Sem Deletar', precoPromocional: 19.9 }),
    });
    assert.equal(editMainRes.status, 200);
    const editMainData = await editMainRes.json();
    assert.equal(editMainData.backupScheduled, false);
    assert.equal(editMainData.restaurarEm, null);

    // Without deletion, forced backup restore keeps the edited item intact
    const forcedWhileNotDeleted = await (
      await fetch(`${baseUrl}/api/marmitas/backup/restore`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ force: true, ids: ['MARM-101'] }),
      })
    ).json();
    assert.equal(forcedWhileNotDeleted.restoredCount, 0);
    const persistedEditRes = await (await fetch(`${baseUrl}/api/marmitas/MARM-101`)).json();
    assert.equal(persistedEditRes.item.nome, 'Prato Alterado Sem Deletar');

    const delMainRes = await fetch(`${baseUrl}/api/marmitas/MARM-101`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(delMainRes.status, 200);
    const delMainData = await delMainRes.json();
    assert.equal(delMainData.backupScheduled, true);
    assert.ok(delMainData.restaurarEm);
    assert.equal((await fetch(`${baseUrl}/api/marmitas/MARM-101`)).status, 404);

    const backupStatusRes = await fetch(`${baseUrl}/api/marmitas/backup`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(backupStatusRes.status, 200);
    const backupStatusData = await backupStatusRes.json();
    assert.equal(backupStatusData.backup.pendingRestoreCount, 1);
    assert.equal(backupStatusData.backup.pendingRestores[0].tipo, 'exclusao');

    const softRestoreRes = await fetch(`${baseUrl}/api/marmitas/backup/restore`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ force: false }),
    });
    assert.equal((await softRestoreRes.json()).restoredCount, 0);

    const forceRestoreRes = await fetch(`${baseUrl}/api/marmitas/backup/restore`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ force: true }),
    });
    assert.equal(forceRestoreRes.status, 200);
    const forceRestoreData = await forceRestoreRes.json();
    assert.equal(forceRestoreData.restoredCount, 1);
    assert.deepEqual(forceRestoreData.restoredIds, ['MARM-101']);

    const restoredMainRes = await fetch(`${baseUrl}/api/marmitas/MARM-101`);
    assert.equal(restoredMainRes.status, 200);
    const restoredMain = (await restoredMainRes.json()).item;
    assert.equal(restoredMain.nome, origMain.nome);
    assert.equal(restoredMain.precoPromocional, origMain.precoPromocional);

    // Explicit admin baseline capture commits a new baseline; edits stay until deleted, then restore new baseline
    const baselineEditRes = await fetch(`${baseUrl}/api/marmitas/MARM-101`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ nome: `${origMain.nome} Revisada` }),
    });
    assert.equal(baselineEditRes.status, 200);
    const baselineCommitRes = await fetch(`${baseUrl}/api/marmitas/backup/baseline`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ids: ['MARM-101'] }),
    });
    assert.equal(baselineCommitRes.status, 200);
    const baselineCommitData = await baselineCommitRes.json();
    assert.equal(baselineCommitData.updatedCount, 1);
    assert.deepEqual(baselineCommitData.updatedIds, ['MARM-101']);
    assert.equal(baselineCommitData.backup.pendingRestoreCount, 0);

    await fetch(`${baseUrl}/api/marmitas/MARM-101`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ nome: 'Teste Mantido Enquanto Ativo' }),
    });
    await fetch(`${baseUrl}/api/marmitas/MARM-101`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    await fetch(`${baseUrl}/api/marmitas/backup/restore`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ force: true, ids: ['MARM-101'] }),
    });
    const afterBaselineRestore = await (await fetch(`${baseUrl}/api/marmitas/MARM-101`)).json();
    assert.equal(afterBaselineRestore.item.nome, `${origMain.nome} Revisada`);

    // Upload image via Multer 2.x (valid image + invalid mime rejection)
    const validForm = new FormData();
    validForm.append('image', new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' }), 'prato.png');
    const uploadRes = await fetch(`${baseUrl}/api/marmitas/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginData.token}` },
      body: validForm,
    });
    assert.equal(uploadRes.status, 201);
    const uploadData = await uploadRes.json();
    assert.match(uploadData.url, /^\/uploads\/marmita-.*\.png$/);

    const invalidForm = new FormData();
    invalidForm.append('image', new Blob(['texto'], { type: 'text/plain' }), 'nota.txt');
    const invalidUploadRes = await fetch(`${baseUrl}/api/marmitas/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginData.token}` },
      body: invalidForm,
    });
    assert.equal(invalidUploadRes.status, 400);
  });

  it('generates Pix BR Code and stores sanitized payment metadata without raw card secrets', async () => {
    const badPixRes = await fetch(`${baseUrl}/api/pagamentos/pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: 0 }),
    });
    assert.equal(badPixRes.status, 400);

    const pixRes = await fetch(`${baseUrl}/api/pagamentos/pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valor: 64.5,
        clienteNome: 'Maria José',
        txid: 'PED-999!',
      }),
    });
    assert.equal(pixRes.status, 200);
    const { pix } = await pixRes.json();
    assert.equal(pix.txid, 'PED999');
    assert.equal(pix.valor, 64.5);
    assert.equal(pix.expiraEmMinutos, 15);
    assert.ok(pix.brCode.startsWith('000201010211'));
    assert.ok(pix.brCode.includes('540564.50'));
    assert.match(pix.crc16, /^[0-9A-F]{4}$/);

    const listRes = await fetch(`${baseUrl}/api/marmitas`);
    const listData = await listRes.json();
    const dishId = listData.items[0].id;

    // Simulate online credit card checkout ensuring raw card fields are stripped server-side
    const cardOrderRes = await fetch(`${baseUrl}/api/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteNome: 'Carlos Andrade',
        clienteTelefone: '(11) 98888-7777',
        endereco: 'Rua das Flores, 120 - Centro',
        formaPagamento: 'Cartão de Crédito (Mastercard 3x • Final 4321)',
        pagamentoDetalhes: {
          metodo: 'Cartão de Crédito',
          modo: 'Online',
          statusPagamento: 'Pago Online',
          bandeira: 'Mastercard',
          parcelas: 3,
          ultimosDigitos: '4321',
          numeroCartao: '5555444433334321',
          cvv: '999',
          validade: '12/30',
        },
        itens: [{ id: dishId, quantidade: 2 }],
      }),
    });
    assert.equal(cardOrderRes.status, 201);
    const { order: cardOrder } = await cardOrderRes.json();
    assert.equal(cardOrder.pagamentoDetalhes?.metodo, 'Cartão de Crédito');
    assert.equal(cardOrder.pagamentoDetalhes?.modo, 'Online');
    assert.equal(cardOrder.pagamentoDetalhes?.statusPagamento, 'Pago Online');
    assert.equal(cardOrder.pagamentoDetalhes?.bandeira, 'Mastercard');
    assert.equal(cardOrder.pagamentoDetalhes?.parcelas, 3);
    assert.equal(cardOrder.pagamentoDetalhes?.ultimosDigitos, '4321');
    assert.equal('numeroCartao' in cardOrder.pagamentoDetalhes, false);
    assert.equal('cvv' in cardOrder.pagamentoDetalhes, false);
    assert.equal('validade' in cardOrder.pagamentoDetalhes, false);
    assert.ok(!cardOrder.pagamentoJson.includes('55554444'));
    assert.ok(!cardOrder.pagamentoJson.includes('999'));

    // Voucher / delivery order
    const voucherOrderRes = await fetch(`${baseUrl}/api/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteNome: 'Ana Beatriz',
        clienteTelefone: '(11) 97777-6666',
        endereco: 'Av. Paulista, 900',
        formaPagamento: 'Vale-Alimentação (Alelo • Maquininha na Entrega)',
        pagamentoDetalhes: {
          metodo: 'Vale-Alimentação',
          modo: 'Entrega',
          statusPagamento: 'Pagar na Entrega',
          bandeira: 'Alelo',
        },
        itens: [{ id: dishId, quantidade: 1 }],
      }),
    });
    assert.equal(voucherOrderRes.status, 201);

    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const { token } = await loginRes.json();

    const pedidosRes = await fetch(`${baseUrl}/api/pedidos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(pedidosRes.status, 200);
    const { items: pedidos } = await pedidosRes.json();
    const persistedCard = pedidos.find((p) => p.id === cardOrder.id);
    assert.ok(persistedCard);
    assert.equal(persistedCard.pagamentoDetalhes?.ultimosDigitos, '4321');
    assert.equal(persistedCard.pagamentoDetalhes?.parcelas, 3);

    // Delete single order (requires admin auth)
    const unauthDelOrder = await fetch(`${baseUrl}/api/pedidos/${cardOrder.id}`, {
      method: 'DELETE',
    });
    assert.equal(unauthDelOrder.status, 401);

    const delSingleOrder = await fetch(`${baseUrl}/api/pedidos/${cardOrder.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(delSingleOrder.status, 200);
    const delSingleData = await delSingleOrder.json();
    assert.equal(delSingleData.deleted, true);
    assert.equal(delSingleData.id, cardOrder.id);

    const { order: voucherOrder } = await (
      await fetch(`${baseUrl}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteNome: 'Lucas Recebido',
          clienteTelefone: '(11) 96666-5555',
          endereco: 'Rua Teste, 50',
          formaPagamento: 'Pix',
          itens: [{ id: dishId, quantidade: 1 }],
        }),
      })
    ).json();
    assert.equal(voucherOrder.status, 'Recebido');

    // Clear orders filtered by status "Recebido"
    const clearReceivedRes = await fetch(`${baseUrl}/api/pedidos?status=Recebido`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(clearReceivedRes.status, 200);
    const clearReceivedData = await clearReceivedRes.json();
    assert.ok(clearReceivedData.deletedCount >= 1);
    assert.equal(clearReceivedData.deletedIds.includes(voucherOrder.id), true);

    const afterDeleteList = await (
      await fetch(`${baseUrl}/api/pedidos`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    assert.equal(afterDeleteList.items.some((p) => p.id === cardOrder.id), false);
    assert.equal(afterDeleteList.items.some((p) => p.status === 'Recebido'), false);
  });
});
