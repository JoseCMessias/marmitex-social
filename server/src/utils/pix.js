function stripAccents(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function sanitizePixText(value, maxLength, uppercase = true) {
  const cleaned = stripAccents(value)
    .replace(/[^A-Za-z0-9 .\-@/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const formatted = uppercase ? cleaned.toUpperCase() : cleaned;
  return formatted.slice(0, maxLength);
}

export function formatEmvField(id, value) {
  const str = String(value ?? '');
  const len = String(str.length).padStart(2, '0');
  return `${id}${len}${str}`;
}

export function computeCrc16Ccitt(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function getPixConfig() {
  return {
    chavePix: (process.env.PIX_KEY || 'contato@marmitexsocial.com.br').trim(),
    beneficiario:
      sanitizePixText(process.env.PIX_MERCHANT_NAME || 'MARMITEXSOCIAL', 25) || 'MARMITEXSOCIAL',
    cidade: sanitizePixText(process.env.PIX_MERCHANT_CITY || 'SAO PAULO', 15) || 'SAO PAULO',
  };
}

export function generatePixBrCode({
  valor,
  txid,
  descricao,
  chavePix,
  beneficiario,
  cidade,
} = {}) {
  const defaults = getPixConfig();
  const resolvedKey = String(chavePix || defaults.chavePix).trim();
  const resolvedName = sanitizePixText(beneficiario || defaults.beneficiario, 25) || 'MARMITEXSOCIAL';
  const resolvedCity = sanitizePixText(cidade || defaults.cidade, 15) || 'SAO PAULO';
  const resolvedTxid =
    stripAccents(txid || `MS${Date.now()}`)
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 25) || 'MARMITEXSOCIAL';
  const resolvedDescription = sanitizePixText(descricao || 'Pedido MarmitexSocial', 25, false);

  const merchantAccountValue = [
    formatEmvField('00', 'br.gov.bcb.pix'),
    formatEmvField('01', resolvedKey),
    resolvedDescription ? formatEmvField('02', resolvedDescription) : '',
  ].join('');

  const amountNum = Number(valor);
  const hasAmount = Number.isFinite(amountNum) && amountNum > 0;

  const additionalDataValue = formatEmvField('05', resolvedTxid);

  const payloadWithoutCrc = [
    formatEmvField('00', '01'),
    formatEmvField('01', '11'),
    formatEmvField('26', merchantAccountValue),
    formatEmvField('52', '5812'),
    formatEmvField('53', '986'),
    hasAmount ? formatEmvField('54', amountNum.toFixed(2)) : '',
    formatEmvField('58', 'BR'),
    formatEmvField('59', resolvedName),
    formatEmvField('60', resolvedCity),
    formatEmvField('62', additionalDataValue),
    '6304',
  ].join('');

  const crc16 = computeCrc16Ccitt(payloadWithoutCrc);
  return {
    brCode: `${payloadWithoutCrc}${crc16}`,
    crc16,
    chavePix: resolvedKey,
    beneficiario: resolvedName,
    cidade: resolvedCity,
    txid: resolvedTxid,
    valor: hasAmount ? Number(amountNum.toFixed(2)) : 0,
    expiraEmMinutos: 15,
  };
}
