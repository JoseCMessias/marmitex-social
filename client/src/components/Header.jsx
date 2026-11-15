import { UtensilsCrossed, ShoppingBag, ShieldCheck, Store, Clock, Lock } from 'lucide-react';
import { formatBRL } from '../utils/format';

export function Header({
  activeView,
  onChangeView,
  isAdminAuthenticated = false,
  cartCount,
  cartTotal,
  onOpenCart,
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-orange-100/90 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-3">
        {/* Brand Identity + Mobile Delivery Pill */}
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <button
            type="button"
            onClick={() => onChangeView('customer')}
            className="group flex min-w-0 cursor-pointer items-center gap-2.5 text-left sm:gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/25 transition group-hover:scale-105 sm:h-11 sm:w-11 sm:rounded-2xl">
              <UtensilsCrossed className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-lg font-extrabold tracking-tight text-stone-900 sm:text-xl">
                  Marmitex<span className="text-orange-600">Social</span>
                </span>
                <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex">
                  <Clock className="h-3 w-3" /> 25-35 min
                </span>
              </div>
              <p className="hidden truncate text-xs font-medium text-stone-500 sm:block">
                Comida caseira, fitness e gourmet direto na sua porta
              </p>
            </div>
          </button>

          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 sm:hidden">
            <Clock className="h-3 w-3" /> 25-35 min
          </span>
        </div>

        {/* Right Controls: View Switch + Cart CTA */}
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
          {/* Segmented View Toggle */}
          <nav
            aria-label="Alternar visão"
            className="flex items-center rounded-xl bg-stone-100 p-1 ring-1 ring-stone-200/80"
          >
            <button
              type="button"
              onClick={() => onChangeView('customer')}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition sm:px-3 sm:text-sm ${
                activeView === 'customer'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Cardápio</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeView('admin')}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition sm:px-3 sm:text-sm ${
                activeView === 'admin'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {isAdminAuthenticated ? (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" />
              ) : (
                <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
              <span>Admin</span>
            </button>
          </nav>

          {/* High-Conversion Cart CTA */}
          {activeView === 'customer' && (
            <button
              type="button"
              onClick={onOpenCart}
              className={`relative flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold whitespace-nowrap transition sm:gap-2.5 sm:px-4 sm:py-2.5 sm:text-sm ${
                cartCount > 0
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.98]'
                  : 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100'
              }`}
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Sacola</span>
              <span className="hidden sm:inline">
                {cartCount > 0 ? 'Fechar Pedido' : 'Sacola'}
              </span>
              {cartCount > 0 && (
                <>
                  <span className="rounded-lg bg-white/20 px-1.5 py-0.5 text-[11px] font-extrabold sm:px-2 sm:text-xs">
                    {formatBRL(cartTotal)}
                  </span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 text-[11px] font-extrabold text-stone-950 sm:text-xs">
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
