import express from 'express';
import { requireAdminAuth } from '../auth/adminAuth.js';
import {
  createPedido,
  deletePedido,
  deletePedidos,
  listPedidos,
  updatePedidoStatus,
} from '../db/excelDb.js';

const VALID_STATUSES = [
  'Recebido',
  'Em Preparo',
  'Saiu para Entrega',
  'Entregue',
  'Cancelado',
];

const VALID_PAYMENT_METHODS = [
  'Pix',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Vale-Alimentação',
  'Vale-Benefício',
  'Cartão na Entrega',
  'Vale-Refeição',
  'Dinheiro',
];

function sanitizePaymentDetails(rawDetails, fallbackMethod) {
  if (!rawDetails || typeof rawDetails !== 'object') {
    return null;
  }

  const metodoRaw = String(rawDetails.metodo || fallbackMethod || 'Pix').trim().slice(0, 40);
  const modo = rawDetails.modo === 'Online' ? 'Online' : 'Entrega';
  const statusPagamento = String(
    rawDetails.statusPagamento || (modo === 'Online' ? 'Pago Online' : 'Pagar na Entrega')
  )
    .trim()
    .slice(0, 40);

  const sanitized = {
    metodo: metodoRaw,
    modo,
    statusPagamento,
  };

  if (rawDetails.bandeira) {
    sanitized.bandeira = String(rawDetails.bandeira).trim().slice(0, 30);
  }

  const parcelas = Number(rawDetails.parcelas);
  if (Number.isInteger(parcelas) && parcelas >= 1 && parcelas <= 12) {
    sanitized.parcelas = parcelas;
  }

  const last4Match = String(rawDetails.ultimosDigitos ?? '').match(/^\d{4}$/);
  if (last4Match) {
    sanitized.ultimosDigitos = last4Match[0];
  }

  if (rawDetails.txid) {
    sanitized.txid = String(rawDetails.txid)
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 25);
  }

  if (rawDetails.trocoPara) {
    sanitized.trocoPara = String(rawDetails.trocoPara).trim().slice(0, 25);
  }

  return sanitized;
}

export const pedidosRouter = express.Router();

pedidosRouter.get('/', requireAdminAuth, async (_req, res, next) => {
  try {
    const items = await listPedidos();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

pedidosRouter.post('/', async (req, res, next) => {
  try {
    const {
      clienteNome,
      clienteTelefone,
      endereco,
      formaPagamento,
      pagamentoDetalhes,
      observacoes,
      itens,
    } = req.body;

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

    const methodLabel = String(formaPagamento || 'Pix').trim().slice(0, 90);
    const sanitizedDetails = sanitizePaymentDetails(
      pagamentoDetalhes,
      VALID_PAYMENT_METHODS.find((m) => methodLabel.startsWith(m)) || methodLabel
    );

    const order = await createPedido({
      clienteNome: String(clienteNome).trim(),
      clienteTelefone: String(clienteTelefone).trim(),
      endereco: String(endereco).trim(),
      formaPagamento: methodLabel,
      pagamentoDetalhes: sanitizedDetails,
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

pedidosRouter.patch('/:id/status', requireAdminAuth, async (req, res, next) => {
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

pedidosRouter.delete('/', requireAdminAuth, async (req, res, next) => {
  try {
    const all = req.query?.all === 'true' || req.body?.all === true;
    const statusRaw = req.query?.status ?? req.body?.status;
    const status = typeof statusRaw === 'string' && statusRaw.trim() ? statusRaw.trim() : null;
    const ids = Array.isArray(req.body?.ids) && req.body.ids.length > 0 ? req.body.ids : null;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Status inválido. Use um de: ${VALID_STATUSES.join(', ')}`,
      });
    }

    if (!all && !status && !ids) {
      return res.status(400).json({
        error: 'Informe os pedidos, um status válido ou all=true para excluir.',
      });
    }

    const result = await deletePedidos({ all, status, ids });
    const message =
      result.deletedCount > 0
        ? `${result.deletedCount} pedido(s) removido(s) da planilha Excel!`
        : 'Nenhum pedido correspondente encontrado para exclusão.';

    res.json({ ...result, message });
  } catch (err) {
    next(err);
  }
});

pedidosRouter.delete('/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const deleted = await deletePedido(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    res.json({
      deleted: true,
      id: req.params.id,
      message: 'Pedido removido da planilha Excel!',
    });
  } catch (err) {
    next(err);
  }
});
