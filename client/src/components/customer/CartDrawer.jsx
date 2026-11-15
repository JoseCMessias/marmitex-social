import { useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { FALLBACK_IMAGE, formatBRL, getEffectivePrice } from '../../utils/format';

export function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onSubmitOrder,
  submitting,
  confirmedOrder,
  onClearConfirmedOrder,
}) {
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [observacoes, setObservacoes] = useState('');
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const subtotal = cartItems.reduce(
    (sum, item) => sum + getEffectivePrice(item.marmita) * item.quantidade,
    0
  );

  const handleCheckout = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!clienteNome.trim() || !clienteTelefone.trim() || !endereco.trim()) {
      setFormError('Preencha nome, WhatsApp/telefone e endereço de entrega para continuar.');
      return;
    }

    try {
      await onSubmitOrder({
        clienteNome: clienteNome.trim(),
        clienteTelefone: clienteTelefone.trim(),
        endereco: endereco.trim(),
        formaPagamento,
        observacoes: observacoes.trim(),
        itens: cartItems.map((item) => ({
          id: item.marmita.id,
          quantidade: item.quantidade,
          observacao: item.observacao || '',
        })),
      });
      setObservacoes('');
    } catch (err) {
      setFormError(err.message || 'Erro ao finalizar pedido.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col bg-[#FFFBF5] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-orange-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold text-stone-900">
                {confirmedOrder ? 'Pedido Confirmado!' : 'Sua Sacola'}
              </h2>
              <p className="text-xs font-medium text-stone-500">
                {confirmedOrder
                  ? 'Preparando sua marmita quentinha'
                  : 'Entrega grátis • 25–35 min'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
            aria-label="Fechar sacola"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Order Confirmation State */}
        {confirmedOrder ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <span className="mt-4 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-200">
              Pedido {confirmedOrder.id}
            </span>
            <h3 className="mt-3 font-display text-2xl font-extrabold text-stone-900">
              Recebemos seu pedido!
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Obrigado, <strong>{confirmedOrder.clienteNome}</strong>! Sua marmita já foi registrada
              no sistema e entrou na fila de preparo.
            </p>

            <div className="mt-6 w-full rounded-2xl border border-orange-100 bg-white p-4 text-left shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-stone-400">
                Resumo da Entrega
              </div>
              <p className="mt-1.5 text-sm font-semibold text-stone-800">
                {confirmedOrder.itensResumo}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                Endereço: {confirmedOrder.endereco}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Pagamento: {confirmedOrder.formaPagamento}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                <span className="text-xs font-bold text-stone-500">Total Pago</span>
                <span className="font-display text-lg font-extrabold text-emerald-700">
                  {formatBRL(confirmedOrder.total)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClearConfirmedOrder();
                onClose();
              }}
              className="mt-6 w-full cursor-pointer rounded-2xl bg-orange-600 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700"
            >
              Continuar Comprando
            </button>
          </div>
        ) : cartItems.length === 0 ? (
          /* Empty Cart State */
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold text-stone-900">
              Sua sacola está vazia
            </h3>
            <p className="mt-1.5 text-sm text-stone-500">
              Escolha suas marmitas favoritas no cardápio e faça seu pedido com poucos cliques.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 cursor-pointer rounded-2xl bg-orange-600 px-6 py-3 text-sm font-extrabold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700"
            >
              Explorar Cardápio
            </button>
          </div>
        ) : (
          /* Cart Items + Express Checkout Form */
          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Items List */}
            <div className="space-y-3 p-4 sm:p-5">
              {cartItems.map((item) => {
                const unitPrice = getEffectivePrice(item.marmita);
                return (
                  <div
                    key={`${item.marmita.id}-${item.observacao || ''}`}
                    className="flex gap-3 rounded-2xl border border-orange-100 bg-white p-3 shadow-xs"
                  >
                    <img
                      src={item.marmita.imagem || FALLBACK_IMAGE}
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_IMAGE;
                      }}
                      alt={item.marmita.nome}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="truncate font-display text-sm font-bold text-stone-900">
                          {item.marmita.nome}
                        </h4>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.marmita.id, item.observacao)}
                          className="cursor-pointer rounded-lg p-1 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remover ${item.marmita.nome}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {item.observacao && (
                        <p className="mt-0.5 text-xs text-orange-700">Obs: {item.observacao}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-display text-sm font-extrabold text-stone-900">
                          {formatBRL(unitPrice * item.quantidade)}
                        </span>
                        <div className="flex items-center gap-1.5 rounded-xl bg-stone-100 p-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(
                                item.marmita.id,
                                item.quantidade - 1,
                                item.observacao
                              )
                            }
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white text-stone-700 shadow-2xs hover:bg-stone-50"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-5 text-center text-xs font-extrabold">
                            {item.quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(
                                item.marmita.id,
                                item.quantidade + 1,
                                item.observacao
                              )
                            }
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Express 1-Step Checkout Form */}
            <form
              onSubmit={handleCheckout}
              className="mt-auto space-y-3 border-t border-orange-100 bg-white p-4 sm:p-5"
            >
              <div className="text-xs font-extrabold uppercase tracking-wider text-orange-600">
                Dados para Entrega Rápida
              </div>

              {formError && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                  {formError}
                </div>
              )}

              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  required
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-3 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="tel"
                  required
                  value={clienteTelefone}
                  onChange={(e) => setClienteTelefone(e.target.value)}
                  placeholder="WhatsApp ou telefone (ex: 11 99999-9999)"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-3 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  required
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Endereço completo (Rua, nº, apto, bairro)"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-3 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="relative">
                  <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-3 text-sm font-medium focus:border-orange-500 focus:bg-white focus:outline-none"
                  >
                    <option value="Pix">Pix</option>
                    <option value="Cartão na Entrega">Cartão na Entrega</option>
                    <option value="Vale-Refeição">Vale-Refeição</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Obs. entrega (opcional)"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 rounded-2xl bg-[#FFFBF5] p-3 ring-1 ring-orange-100">
                <div className="flex justify-between text-xs text-stone-600">
                  <span>Taxa de entrega</span>
                  <span className="font-bold text-emerald-700">Grátis</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-stone-900">
                  <span>Total do pedido</span>
                  <span className="font-display text-xl text-emerald-700">
                    {formatBRL(subtotal)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full cursor-pointer rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? 'Enviando Pedido...'
                  : `Confirmar Compra • ${formatBRL(subtotal)}`}
              </button>
            </form>
          </div>
        )}
      </aside>
    </div>
  );
}
