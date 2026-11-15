import { Flame, Sparkles, Clock, Truck, ArrowDown } from 'lucide-react';
import { FALLBACK_IMAGE, formatBRL, getEffectivePrice } from '../../utils/format';

export function HeroBanner({ featuredMarmita, onQuickBuy, onScrollToMenu }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 p-5 text-white shadow-xl shadow-orange-600/15 sm:p-8 lg:p-10">
      {/* Subtle decorative glows */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-10 h-52 w-52 rounded-full bg-red-600/20 blur-3xl" />

      <div className="relative grid items-center gap-6 lg:grid-cols-12">
        {/* Left Value Proposition */}
        <div className="min-w-0 lg:col-span-7">
          <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-50 backdrop-blur-sm sm:px-3.5 sm:text-xs">
            <Flame className="h-3.5 w-3.5 shrink-0 text-amber-200" />
            <span className="truncate">Pratos frescos • Entrega rápida</span>
          </div>

          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[42px]">
            Marmitas irresistíveis para{' '}
            <span className="text-amber-200 underline decoration-amber-300/60 decoration-4 underline-offset-4">
              todos os gostos
            </span>
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-orange-50 sm:text-base">
            Do sabor caseiro tradicional às opções fitness, veganas e gourmet. Escolha seu prato
            favorito e finalize seu pedido em segundos.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={onScrollToMenu}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/25 transition hover:bg-emerald-400 active:scale-[0.98] sm:w-auto"
            >
              <span>Ver Cardápio e Pedir</span>
              <ArrowDown className="h-4 w-4" />
            </button>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-orange-50">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-200" /> 25–35 min
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-amber-200" /> Frete Grátis hoje
              </span>
            </div>
          </div>
        </div>

        {/* Right Featured Conversion Card */}
        {featuredMarmita && (
          <div className="min-w-0 lg:col-span-5">
            <div className="flex flex-col gap-3.5 rounded-2xl bg-white p-3.5 text-stone-900 shadow-2xl ring-1 ring-white/40 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
              <img
                src={featuredMarmita.imagem || FALLBACK_IMAGE}
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
                alt={featuredMarmita.nome}
                className="h-40 w-full shrink-0 rounded-xl object-cover shadow-sm sm:h-28 sm:w-28"
              />
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800">
                  <Sparkles className="h-3 w-3" /> Destaque do Chef
                </div>
                <h2 className="mt-1 truncate font-display text-base font-bold text-stone-900 sm:text-lg">
                  {featuredMarmita.nome}
                </h2>
                <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">
                  {featuredMarmita.descricao}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {featuredMarmita.precoPromocional && (
                      <span className="block text-[11px] font-medium text-stone-400 line-through">
                        {formatBRL(featuredMarmita.preco)}
                      </span>
                    )}
                    <span className="font-display text-lg font-extrabold text-orange-600">
                      {formatBRL(getEffectivePrice(featuredMarmita))}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onQuickBuy(featuredMarmita)}
                    className="shrink-0 cursor-pointer rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-95"
                  >
                    + Comprar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
