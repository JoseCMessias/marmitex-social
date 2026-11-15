import { UtensilsCrossed, ShoppingBag, ShieldCheck, Store, Clock } from 'lucide-react';
import { formatBRL } from '../utils/format';

export function Header({
  activeView,
  onChangeView,
  cartCount,
  cartTotal,
  onOpenCart,
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-orange-100/90 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand Identity */}
        <button
          type="button"
          onClick={() => onChangeView('customer')}
          className="group flex items-center gap-3 text-left"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/25 transition group-hover:scale-105">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-extrabold tracking-tight text-stone-900">
                Marmitex<span className="text-orange-600">Social</span>
              </span>
              <span className="hidden rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> 25-35 min
              </span>
            </div>
            <p className="text-xs font-medium text-stone-500">
              Comida caseira, fitness e gourmet direto na sua porta
            </p>
          </div>
        </button>

        {/* Right Controls: View Switch + Cart CTA */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Segmented View Toggle */}
          <nav
            aria-label="Alternar visão"
            className="flex items-center rounded-xl bg-stone-100 p-1 ring-1 ring-stone-200/80"
          >
            <button
              type="button"
              onClick={() => onChangeView('customer')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition sm:text-sm ${
                activeView === 'customer'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Store className="h-4 w-4" />
              <span>Cardápio</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeView('admin')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition sm:text-sm ${
                activeView === 'admin'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin</span>
            </button>
          </nav>

          {/* High-Conversion Cart CTA */}
          {activeView === 'customer' && (
            <button
              type="button"
              onClick={onOpenCart}
              className={`relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-bold transition cursor-pointer ${
                cartCount > 0
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.98]'
                  : 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">
                {cartCount > 0 ? 'Fechar Pedido' : 'Sacola'}
              </span>
              {cartCount > 0 && (
                <>
                  <span className="rounded-lg bg-white/20 px-2 py-0.5 text-xs font-extrabold">
                    {formatBRL(cartTotal)}
                  </span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 text-xs font-extrabold text-stone-950">
                    {cartCount}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
