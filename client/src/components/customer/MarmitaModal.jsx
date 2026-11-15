import { useState } from 'react';
import { Clock, Flame, Minus, Plus, Scale, ShoppingBag, Sparkles, X } from 'lucide-react';
import {
  FALLBACK_IMAGE,
  formatBRL,
  getDiscountPercent,
  getEffectivePrice,
  parseGostoTags,
} from '../../utils/format';

export function MarmitaModal({ marmita, onClose, onAddToCart }) {
  const [quantity, setQuantity] = useState(1);
  const [observacao, setObservacao] = useState('');

  if (!marmita) return null;

  const effectivePrice = getEffectivePrice(marmita);
  const discount = getDiscountPercent(marmita);
  const tasteTags = parseGostoTags(marmita.gosto);

  const handleConfirm = () => {
    onAddToCart(marmita, quantity, observacao.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-md backdrop-blur-sm transition hover:bg-white hover:text-stone-950"
          aria-label="Fechar detalhes"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Image */}
        <div className="relative h-64 w-full bg-orange-50 sm:h-72">
          <img
            src={marmita.imagem || FALLBACK_IMAGE}
            onError={(e) => {
              e.currentTarget.src = FALLBACK_IMAGE;
            }}
            alt={marmita.nome}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-3 left-4 flex flex-wrap gap-2">
            {discount > 0 && (
              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold text-white shadow">
                -{discount}% OFF
              </span>
            )}
            {marmita.destaque && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-stone-950 shadow">
                <Sparkles className="h-3.5 w-3.5" /> Mais Pedida
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800">
              {marmita.categoria}
            </span>
            {tasteTags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700"
              >
                {tag}
              </span>
            ))}
          </div>

          <h2 className="mt-3 font-display text-2xl font-extrabold text-stone-900">
            {marmita.nome}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            {marmita.descricao}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2.5 rounded-2xl bg-[#FFFBF5] p-3 ring-1 ring-orange-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
              <Scale className="h-4 w-4 text-orange-600" />
              <span>{marmita.tamanho || '500g'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
              <Clock className="h-4 w-4 text-orange-600" />
              <span>{marmita.tempoPreparo || '25-35 min'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
              <Flame className="h-4 w-4 text-amber-500" />
              <span>{marmita.calorias ? `${marmita.calorias} kcal` : 'Fresh'}</span>
            </div>
          </div>

          {/* Optional Note */}
          <div className="mt-5">
            <label
              htmlFor="dish-note"
              className="block text-xs font-bold uppercase tracking-wide text-stone-600"
            >
              Alguma observação no prato? (Opcional)
            </label>
            <input
              id="dish-note"
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Sem cebola, pouco sal, talheres descartáveis..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          {/* Bottom Action Row */}
          <div className="mt-6 flex flex-col gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:items-center">
            <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-2 py-1.5 sm:w-36">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-stone-700 transition hover:bg-white hover:shadow-sm"
                aria-label="Diminuir quantidade"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-base font-extrabold text-stone-900">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-stone-700 transition hover:bg-white hover:shadow-sm"
                aria-label="Aumentar quantidade"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Adicionar • {formatBRL(effectivePrice * quantity)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
