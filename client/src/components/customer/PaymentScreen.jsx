import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Truck,
  Wallet,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatBRL } from '../../utils/format';

const PAYMENT_METHODS = [
  {
    id: 'pix',
    label: 'Pix',
    methodName: 'Pix',
    badge: 'Instantâneo',
    subtitle: 'QR Code & Copia e Cola',
    icon: QrCode,
  },
  {
    id: 'credito',
    label: 'Crédito',
    methodName: 'Cartão de Crédito',
    badge: 'Até 6x',
    subtitle: 'Online ou maquininha',
    icon: CreditCard,
  },
  {
    id: 'debito',
    label: 'Débito',
    methodName: 'Cartão de Débito',
    badge: 'À vista',
    subtitle: 'Online ou maquininha',
    icon: Wallet,
  },
  {
    id: 'alimentacao',
    label: 'Alimentação',
    methodName: 'Vale-Alimentação',
    badge: 'VA',
    subtitle: 'Alelo, Pluxee, Ticket, VR',
    icon: Ticket,
  },
  {
    id: 'beneficio',
    label: 'Benefício',
    methodName: 'Vale-Benefício',
    badge: 'Multi',
    subtitle: 'Caju, Flash, Swile, iFood',
    icon: Sparkles,
  },
  {
    id: 'dinheiro',
    label: 'Dinheiro',
    methodName: 'Dinheiro',
    badge: 'Entrega',
    subtitle: 'Informe se precisa troco',
    icon: Banknote,
  },
];

const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'Amex'];

const VOUCHER_BRANDS = {
  alimentacao: ['Alelo', 'Pluxee (Sodexo)', 'Ticket', 'VR', 'Ben Visa Vale'],
  beneficio: ['Caju', 'Flash', 'Swile', 'iFood Benefícios', 'Alelo Tudo', 'VR Multi'],
};

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function formatCardNumberInput(value) {
  return onlyDigits(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiryInput(value) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function detectCardBrand(digits) {
  if (!digits) return '';
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|651|652|655)/.test(digits)) {
    return 'Elo';
  }
  if (/^(606282|3841)/.test(digits)) return 'Hipercard';
  if (/^(34|37)/.test(digits)) return 'Amex';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^4/.test(digits)) return 'Visa';
  return '';
}

function isExpiryValid(expiry) {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const cardMonthIndex = year * 12 + (month - 1);
  return cardMonthIndex >= currentMonthIndex;
}

function formatCountdown(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function PaymentScreen({
  amount,
  customerName,
  submitting,
  onBack,
  onConfirmPayment,
}) {
  const [activeMethod, setActiveMethod] = useState('pix');
  const [error, setError] = useState('');

  // Pix state
  const [pixData, setPixData] = useState(null);
  const [pixQrDataUrl, setPixQrDataUrl] = useState('');
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const [copiedPix, setCopiedPix] = useState(false);
  const pixRequestIdRef = useRef(0);

  // Card / Voucher mode: 'Online' or 'Entrega'
  const [paymentMode, setPaymentMode] = useState('Online');
  const [cardBrand, setCardBrand] = useState('Visa');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [installments, setInstallments] = useState(1);

  const [voucherBrand, setVoucherBrand] = useState({
    alimentacao: VOUCHER_BRANDS.alimentacao[0],
    beneficio: VOUCHER_BRANDS.beneficio[0],
  });

  // Cash state
  const [trocoPara, setTrocoPara] = useState('');

  const cardDigits = useMemo(() => onlyDigits(cardNumber), [cardNumber]);
  const detectedBrand = useMemo(() => detectCardBrand(cardDigits), [cardDigits]);
  const isCardMethod = activeMethod === 'credito' || activeMethod === 'debito';
  const isVoucherMethod = activeMethod === 'alimentacao' || activeMethod === 'beneficio';

  const loadPixQr = useCallback(async () => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const requestId = ++pixRequestIdRef.current;
    setPixLoading(true);
    setPixError('');
    setCopiedPix(false);

    try {
      const pix = await api.generatePixQr({
        valor: Number(amount.toFixed(2)),
        clienteNome: customerName,
      });
      const qrDataUrl = await QRCode.toDataURL(pix.brCode, {
        width: 260,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#1C1917',
          light: '#FFFFFF',
        },
      });
      if (requestId !== pixRequestIdRef.current) return;
      setPixData(pix);
      setPixQrDataUrl(qrDataUrl);
      setSecondsLeft((pix.expiraEmMinutos || 15) * 60);
    } catch (err) {
      if (requestId !== pixRequestIdRef.current) return;
      setPixError(err.message || 'Não foi possível gerar o QR Code Pix.');
    } finally {
      if (requestId === pixRequestIdRef.current) {
        setPixLoading(false);
      }
    }
  }, [amount, customerName]);

  useEffect(() => {
    if (activeMethod === 'pix') {
      loadPixQr();
    }
  }, [activeMethod, loadPixQr]);

  useEffect(() => {
    if (activeMethod !== 'pix' || !pixData || secondsLeft <= 0) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeMethod, pixData, secondsLeft]);

  const handleSelectMethod = (methodId) => {
    setActiveMethod(methodId);
    setError('');
  };

  const handleCopyPix = async () => {
    if (!pixData?.brCode) return;
    try {
      await navigator.clipboard.writeText(pixData.brCode);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = pixData.brCode;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const validateOnlineCardFields = () => {
    if (cardDigits.length < 13 || cardDigits.length > 19) {
      return 'Informe um número de cartão válido (13 a 19 dígitos).';
    }
    if (cardHolder.trim().length < 3) {
      return 'Informe o nome impresso no cartão.';
    }
    if (!isExpiryValid(cardExpiry)) {
      return 'Informe uma validade válida e não expirada (MM/AA).';
    }
    const cvvDigits = onlyDigits(cardCvv);
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      return 'Informe o código de segurança (CVV) com 3 ou 4 dígitos.';
    }
    return '';
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');

    if (activeMethod === 'pix') {
      if (!pixData || secondsLeft <= 0) {
        setError('Gere um QR Code Pix válido antes de finalizar o pedido.');
        return;
      }
      await onConfirmPayment({
        formaPagamento: 'Pix',
        pagamentoDetalhes: {
          metodo: 'Pix',
          modo: 'Online',
          statusPagamento: 'Pago Online (Pix)',
          txid: pixData.txid,
        },
      });
      return;
    }

    if (isCardMethod) {
      const methodLabel =
        activeMethod === 'credito' ? 'Cartão de Crédito' : 'Cartão de Débito';
      const resolvedBrand =
        paymentMode === 'Online' ? detectedBrand || cardBrand : cardBrand;

      if (paymentMode === 'Online') {
        const validationError = validateOnlineCardFields();
        if (validationError) {
          setError(validationError);
          return;
        }

        const last4 = cardDigits.slice(-4);
        const parcelasValue = activeMethod === 'credito' ? installments : 1;
        const summary =
          activeMethod === 'credito'
            ? `${methodLabel} (${resolvedBrand} ${parcelasValue}x • Final ${last4})`
            : `${methodLabel} (${resolvedBrand} • Final ${last4})`;

        // Security: persist only safe metadata (never raw PAN or CVV)
        await onConfirmPayment({
          formaPagamento: summary,
          pagamentoDetalhes: {
            metodo: methodLabel,
            modo: 'Online',
            statusPagamento: 'Pago Online',
            bandeira: resolvedBrand,
            parcelas: parcelasValue,
            ultimosDigitos: last4,
          },
        });
        return;
      }

      await onConfirmPayment({
        formaPagamento: `${methodLabel} (${resolvedBrand} • Maquininha na Entrega)`,
        pagamentoDetalhes: {
          metodo: methodLabel,
          modo: 'Entrega',
          statusPagamento: 'Pagar na Entrega',
          bandeira: resolvedBrand,
        },
      });
      return;
    }

    if (isVoucherMethod) {
      const methodLabel =
        activeMethod === 'alimentacao' ? 'Vale-Alimentação' : 'Vale-Benefício';
      const selectedVoucherBrand = voucherBrand[activeMethod];

      if (paymentMode === 'Online') {
        const validationError = validateOnlineCardFields();
        if (validationError) {
          setError(validationError);
          return;
        }
        const last4 = cardDigits.slice(-4);
        await onConfirmPayment({
          formaPagamento: `${methodLabel} (${selectedVoucherBrand} • Final ${last4})`,
          pagamentoDetalhes: {
            metodo: methodLabel,
            modo: 'Online',
            statusPagamento: 'Pago Online',
            bandeira: selectedVoucherBrand,
            ultimosDigitos: last4,
          },
        });
        return;
      }

      await onConfirmPayment({
        formaPagamento: `${methodLabel} (${selectedVoucherBrand} • Maquininha na Entrega)`,
        pagamentoDetalhes: {
          metodo: methodLabel,
          modo: 'Entrega',
          statusPagamento: 'Pagar na Entrega',
          bandeira: selectedVoucherBrand,
        },
      });
      return;
    }

    // Dinheiro
    const trocoClean = trocoPara.trim();
    await onConfirmPayment({
      formaPagamento: trocoClean
        ? `Dinheiro (Troco para ${trocoClean})`
        : 'Dinheiro (Sem troco)',
      pagamentoDetalhes: {
        metodo: 'Dinheiro',
        modo: 'Entrega',
        statusPagamento: 'Pagar na Entrega',
        ...(trocoClean ? { trocoPara: trocoClean } : {}),
      },
    });
  };

  const quickCashOptions = useMemo(() => {
    const bills = [50, 100, 200].filter((v) => v >= amount);
    return ['Sem troco', ...bills.map((v) => `R$ ${v},00`)];
  }, [amount]);

  const activeBrandDisplay =
    (isVoucherMethod
      ? voucherBrand[activeMethod]
      : detectedBrand || cardBrand) || 'Cartão';

  return (
    <form onSubmit={handleConfirm} className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-orange-100 bg-orange-50/70 px-3.5 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-orange-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos dados
        </button>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Total a pagar
          </p>
          <p className="font-display text-lg font-extrabold text-orange-600">
            {formatBRL(amount)}
          </p>
        </div>
      </div>

      {/* Method Grid */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">
          Escolha a forma de pagamento
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PAYMENT_METHODS.map((method) => {
            const Icon = method.icon;
            const selected = activeMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => handleSelectMethod(method.id)}
                className={`flex cursor-pointer flex-col items-start rounded-2xl border p-2.5 text-left transition ${
                  selected
                    ? 'border-orange-500 bg-orange-50/90 ring-2 ring-orange-200'
                    : 'border-stone-200 bg-white hover:border-orange-200 hover:bg-stone-50'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-xl ${
                      selected
                        ? 'bg-orange-600 text-white'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      selected
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {method.badge}
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold text-stone-900">{method.label}</p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-stone-500">
                  {method.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* PIX VIEW */}
      {activeMethod === 'pix' && (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-emerald-700" />
              <h4 className="font-display text-sm font-bold text-stone-900">
                Pague com Pix QR Code
              </h4>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                secondsLeft > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              <Clock className="h-3 w-3" />
              {secondsLeft > 0
                ? `Expira em ${formatCountdown(secondsLeft)}`
                : 'QR Code expirado'}
            </span>
          </div>

          {pixLoading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-white py-10">
              <RefreshCw className="h-7 w-7 animate-spin text-emerald-600" />
              <p className="mt-2 text-xs font-semibold text-stone-600">
                Gerando código Pix EMV...
              </p>
            </div>
          ) : pixError ? (
            <div className="rounded-2xl border border-red-200 bg-white p-4 text-center">
              <p className="text-xs font-semibold text-red-700">{pixError}</p>
              <button
                type="button"
                onClick={loadPixQr}
                className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </button>
            </div>
          ) : pixData && pixQrDataUrl ? (
            <>
              <div className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-white p-4 shadow-xs">
                <img
                  src={pixQrDataUrl}
                  alt="QR Code Pix para pagamento"
                  className="h-44 w-44 rounded-xl border border-stone-100 object-contain sm:h-48 sm:w-48"
                />
                {secondsLeft === 0 && (
                  <button
                    type="button"
                    onClick={loadPixQr}
                    className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Gerar novo QR Code
                  </button>
                )}
                <div className="mt-3 grid w-full grid-cols-2 gap-2 rounded-xl bg-stone-50 p-2.5 text-[11px] text-stone-600">
                  <div className="min-w-0">
                    <span className="block text-[10px] font-semibold text-stone-400">
                      Recebedor
                    </span>
                    <span className="block truncate font-bold text-stone-800">
                      {pixData.beneficiario}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-semibold text-stone-400">
                      Identificador (txid)
                    </span>
                    <span className="block truncate font-mono font-bold text-stone-800">
                      {pixData.txid}
                    </span>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <span className="block text-[10px] font-semibold text-stone-400">
                      Chave Pix
                    </span>
                    <span className="block truncate font-semibold text-stone-800">
                      {pixData.chavePix}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-stone-700">
                  Pix Copia e Cola
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixData.brCode}
                    onClick={(e) => e.target.select()}
                    aria-label="Código Pix Copia e Cola"
                    className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 font-mono text-[11px] text-stone-700 outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition ${
                      copiedPix
                        ? 'bg-emerald-600'
                        : 'bg-stone-900 hover:bg-stone-800'
                    }`}
                  >
                    {copiedPix ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* CARD OR VOUCHER VIEW */}
      {(isCardMethod || isVoucherMethod) && (
        <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          {/* Online vs Entrega Toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-stone-200/80 p-1">
            <button
              type="button"
              onClick={() => {
                setPaymentMode('Online');
                setError('');
              }}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                paymentMode === 'Online'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              Pagar Online Agora
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentMode('Entrega');
                setError('');
              }}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                paymentMode === 'Entrega'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Truck className="h-3.5 w-3.5 text-orange-600" />
              Na Entrega (Maquininha)
            </button>
          </div>

          {/* Brand Selection for Vouchers or Entrega Cards */}
          {isVoucherMethod && (
            <div>
              <label className="mb-1.5 block text-xs font-bold text-stone-700">
                Selecione a bandeira do seu{' '}
                {activeMethod === 'alimentacao' ? 'Vale-Alimentação' : 'Vale-Benefício'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {VOUCHER_BRANDS[activeMethod].map((brand) => {
                  const active = voucherBrand[activeMethod] === brand;
                  return (
                    <button
                      key={brand}
                      type="button"
                      onClick={() =>
                        setVoucherBrand((prev) => ({ ...prev, [activeMethod]: brand }))
                      }
                      className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                        active
                          ? 'border-orange-500 bg-orange-600 text-white shadow-xs'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-orange-300'
                      }`}
                    >
                      {brand}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isCardMethod && paymentMode === 'Entrega' && (
            <div>
              <label className="mb-1.5 block text-xs font-bold text-stone-700">
                Bandeira do cartão para a maquininha
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CARD_BRANDS.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => setCardBrand(brand)}
                    className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      cardBrand === brand
                        ? 'border-orange-500 bg-orange-600 text-white shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-orange-300'
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}

          {paymentMode === 'Online' ? (
            <div className="space-y-3">
              {/* Interactive Card Preview */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-stone-800 to-orange-950 p-4 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-300">
                    {activeMethod === 'credito'
                      ? 'Crédito'
                      : activeMethod === 'debito'
                        ? 'Débito'
                        : activeMethod === 'alimentacao'
                          ? 'Vale-Alimentação'
                          : 'Vale-Benefício'}
                  </span>
                  <span className="rounded-lg bg-white/15 px-2 py-0.5 text-xs font-extrabold">
                    {activeBrandDisplay}
                  </span>
                </div>
                <p className="mt-4 font-mono text-base font-bold tracking-widest sm:text-lg">
                  {cardNumber || '•••• •••• •••• ••••'}
                </p>
                <div className="mt-4 flex items-end justify-between text-xs">
                  <div className="min-w-0 pr-3">
                    <span className="block text-[9px] uppercase text-stone-400">
                      Titular
                    </span>
                    <span className="block truncate font-semibold uppercase">
                      {cardHolder.trim() || customerName.trim() || 'SEU NOME AQUI'}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block text-[9px] uppercase text-stone-400">
                      Validade
                    </span>
                    <span className="font-mono font-semibold">
                      {cardExpiry || 'MM/AA'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700">
                    Número do cartão *
                  </label>
                  {isCardMethod && detectedBrand && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                      {detectedBrand}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-stone-700">
                  Nome impresso no cartão *
                </label>
                <input
                  type="text"
                  autoComplete="cc-name"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="Como está no cartão"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm uppercase outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-700">
                    Validade *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiryInput(e.target.value))}
                    placeholder="MM/AA"
                    maxLength={5}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-700">
                    CVV *
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(onlyDigits(e.target.value).slice(0, 4))}
                    placeholder="000"
                    maxLength={4}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {activeMethod === 'credito' && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-700">
                    Parcelamento
                  </label>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-800 outline-none focus:border-orange-500"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}x de {formatBRL(amount / n)} sem juros
                        {n === 1 ? ' (à vista)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p className="flex items-start gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                <span>
                  Ambiente seguro: apenas a bandeira e os 4 últimos dígitos ficam registrados no comprovante do pedido.
                </span>
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-orange-200 bg-white p-3.5 text-xs text-stone-700">
              <div className="flex items-start gap-2.5">
                <Truck className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                <div>
                  <p className="font-bold text-stone-900">
                    Pagamento na maquininha com o entregador
                  </p>
                  <p className="mt-1 text-stone-600">
                    Levaremos a maquininha sem fio compatível com{' '}
                    <strong>{activeBrandDisplay}</strong>. Você só paga quando receber suas marmitas!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DINHEIRO VIEW */}
      {activeMethod === 'dinheiro' && (
        <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-stone-700">
              Precisa de troco para quanto?
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quickCashOptions.map((option) => {
                const value = option === 'Sem troco' ? '' : option;
                const selected = trocoPara === value;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTrocoPara(value)}
                    className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? 'border-orange-500 bg-orange-600 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-orange-300'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={trocoPara}
              onChange={(e) => setTrocoPara(e.target.value)}
              placeholder="Ex: R$ 100,00 (deixe vazio se não precisar)"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-orange-500"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={
          submitting ||
          (activeMethod === 'pix' && (pixLoading || Boolean(pixError) || secondsLeft <= 0))
        }
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-display text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
      >
        <CheckCircle2 className="h-5 w-5" />
        {submitting
          ? 'Confirmando pedido...'
          : activeMethod === 'pix'
            ? `Já fiz o Pix • Confirmar (${formatBRL(amount)})`
            : paymentMode === 'Online' && (isCardMethod || isVoucherMethod)
              ? `Pagar ${formatBRL(amount)} e Confirmar`
              : `Confirmar Pedido (${formatBRL(amount)})`}
      </button>
    </form>
  );
}
