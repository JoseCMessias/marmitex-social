import { Clock, Flame, Minus, Plus, Scale, ShoppingCart, Sparkles } from 'lucide-react';
import {
  FALLBACK_IMAGE,
  formatBRL,
  getDiscountPercent,
  getEffectivePrice,
  parseGostoTags,
} from '../../utils/format';

export function MarmitaCard({
  marmita,
  cartQuantity,
  onAdd,
  onUpdateQuantity,
  onOpenDetails,
}) {
  const effectivePrice = getEffectivePrice(marmita);
  const discount = getDiscountPercent(marmita);
  const tasteTags = parseGostoTags(marmita.gosto);

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-orange-100/90 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-900/10">
      {/* Clickable Photo Header */}
      <div
        onClick={() => onOpenDetails(marmita)}
        className="relative aspect-[16/10] cursor-pointer overflow-hidden bg-orange-50"
      >
        <img
          src={marmita.imagem || FALLBACK_IMAGE}
          onError={(e) => {
            e.currentTarget.src = FALLBACK_IMAGE;
          }}
          alt={marmita.nome}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Top Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {discount > 0 && (
            <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white shadow-md">
              -{discount}% OFF
            </span>
          )}
          {marmita.destaque && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-stone-950 shadow-md">
              <Sparkles className="h-3 w-3" /> Mais Pedida
            </span>
          )}
        </div>

        {/* Portion Badge */}
        {marmita.tamanho && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-stone-900/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            <Scale className="h-3 w-3 text-orange-300" />
            {marmita.tamanho}
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Category & Taste Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 ring-1 ring-orange-200/70">
            {marmita.categoria}
          </span>
          {tasteTags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Dish Title */}
        <button
          type="button"
          onClick={() => onOpenDetails(marmita)}
          className="mt-2.5 cursor-pointer text-left font-display text-lg font-bold leading-snug text-stone-900 transition group-hover:text-orange-600"
        >
          {marmita.nome}
        </button>

        {/* Description */}
        <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-stone-600 sm:text-sm">
          {marmita.descricao}
        </p>

        {/* Quick Info Strip */}
        <div className="mt-3 flex items-center gap-3 text-xs font-medium text-stone-500">
          {marmita.tempoPreparo && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-orange-500" />
              {marmita.tempoPreparo}
            </span>
          )}
          {marmita.calorias && (
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              {marmita.calorias} kcal
            </span>
          )}
        </div>

        {/* Price + High-Conversion Buy Action */}
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-stone-100 pt-3.5">
          <div>
            {discount > 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-stone-400 line-through">
                  {formatBRL(marmita.preco)}
                </span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  Economize {formatBRL(Number(marmita.preco) - effectivePrice)}
                </span>
              </div>
            ) : (
              <span className="block text-[11px] font-semibold text-stone-400">
                Por apenas
              </span>
            )}
            <div className="font-display text-2xl font-extrabold tracking-tight text-stone-900">
              {formatBRL(effectivePrice)}
            </div>
          </div>

          {cartQuantity > 0 ? (
            <div className="flex items-center gap-1.5 rounded-2xl bg-emerald-50 p-1 ring-1 ring-emerald-300">
              <button
                type="button"
                onClick={() => onUpdateQuantity(marmita.id, cartQuantity - 1)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                aria-label={`Remover uma unidade de ${marmita.nome}`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-6 text-center text-sm font-extrabold text-emerald-900">
                {cartQuantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(marmita.id, cartQuantity + 1)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700"
                aria-label={`Adicionar mais uma unidade de ${marmita.nome}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAdd(marmita, 1)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-95"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Comprar</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
