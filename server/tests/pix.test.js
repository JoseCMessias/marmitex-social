import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeCrc16Ccitt,
  formatEmvField,
  generatePixBrCode,
  sanitizePixText,
} from '../src/utils/pix.js';

describe('Pix EMV BR Code utility', () => {
  it('computes standard CRC-16/CCITT-FALSE checksums', () => {
    assert.equal(computeCrc16Ccitt('123456789'), '29B1');
  });

  it('sanitizes text and formats EMV TLV fields', () => {
    assert.equal(sanitizePixText('João & Café São Paulo!', 25), 'JOAO CAFE SAO PAULO');
    assert.equal(formatEmvField('53', '986'), '5303986');
  });

  it('generates a valid static EMV Pix payload with matching CRC16', () => {
    const pix = generatePixBrCode({
      valor: 49.9,
      txid: 'MS-2026_01!',
      descricao: 'Pedido João Silva',
      chavePix: 'contato@marmitexsocial.com.br',
      beneficiario: 'Marmitex Social Ltda',
      cidade: 'São Paulo',
    });

    assert.equal(pix.valor, 49.9);
    assert.equal(pix.txid, 'MS202601');
    assert.equal(pix.beneficiario, 'MARMITEX SOCIAL LTDA');
    assert.equal(pix.cidade, 'SAO PAULO');
    assert.equal(pix.expiraEmMinutos, 15);
    assert.ok(pix.brCode.startsWith('000201010211'));
    assert.ok(pix.brCode.includes('br.gov.bcb.pix'));
    assert.ok(pix.brCode.includes('52045812'));
    assert.ok(pix.brCode.includes('5303986'));
    assert.ok(pix.brCode.includes('540549.90'));
    assert.ok(pix.brCode.includes('5802BR'));

    const payloadPrefix = pix.brCode.slice(0, -4);
    const embeddedCrc = pix.brCode.slice(-4);
    assert.equal(embeddedCrc, pix.crc16);
    assert.equal(computeCrc16Ccitt(payloadPrefix), embeddedCrc);
  });
});
