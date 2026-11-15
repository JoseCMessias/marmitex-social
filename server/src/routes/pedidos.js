import express from 'express';
import { createPedido, listPedidos, updatePedidoStatus } from '../db/excelDb.js';

const VALID_STATUSES = [
  'Recebido',
  'Em Preparo',
  'Saiu para Entrega',
  'Entregue',
  'Cancelado',
];

export const pedidosRouter = express.Router();

pedidosRouter.get('/', async (_req, res, next) => {
  try {
    const items = await listPedidos();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

pedidosRouter.post('/', async (req, res, next) => {
  try {
    const { clienteNome, clienteTelefone, endereco, formaPagamento, observacoes, itens } = req.body;

    if (!String(clienteNome ?? '').trim()) {
      return res.status(400).json({ error: 'Informe o seu nome para o pedido.' });
    }
    if (!String(clienteTelefone ?? '').trim()) {
      return res.status(400).json({ error: 'Informe um telefone ou WhatsApp para contato.' });
    }
    if (!String(endereco ?? '').trim()) {
      return res.status(400).json({ error: 'Informe o endereço completo de entrega.' });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'Adicione pelo menos uma marmita ao carrinho.' });
    }

    const order = await createPedido({
      clienteNome: String(clienteNome).trim(),
      clienteTelefone: String(clienteTelefone).trim(),
      endereco: String(endereco).trim(),
      formaPagamento: String(formaPagamento || 'Pix').trim(),
      observacoes: String(observacoes || '').trim(),
      itens,
    });

    res.status(201).json({
      order,
      message: 'Pedido realizado e salvo na planilha Excel!',
    });
  } catch (err) {
    if (err.message && (err.message.includes('não encontrada') || err.message.includes('indisponível'))) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

pedidosRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Status inválido. Use um de: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const updated = await updatePedidoStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    res.json({ order: updated, message: 'Status do pedido atualizado na planilha Excel!' });
  } catch (err) {
    next(err);
  }
});
