import express from 'express';
import { generatePixBrCode } from '../utils/pix.js';

export const pagamentosRouter = express.Router();

pagamentosRouter.post('/pix', async (req, res, next) => {
  try {
    const rawValue = Number(req.body?.valor);
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      return res
        .status(400)
        .json({ error: 'Informe um valor válido maior que zero para gerar o Pix.' });
    }

    const clienteNome = String(req.body?.clienteNome || '').trim();
    const txid = String(req.body?.txid || `MS${Date.now()}`);
    const descricao = clienteNome
      ? `Pedido ${clienteNome.split(' ')[0]}`
      : 'Pedido MarmitexSocial';

    const pix = generatePixBrCode({
      valor: rawValue,
      txid,
      descricao,
    });

    return res.json({ pix });
  } catch (err) {
    return next(err);
  }
});
