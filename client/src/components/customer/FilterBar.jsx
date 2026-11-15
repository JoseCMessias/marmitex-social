import { Search, Sparkles, Tag, X } from 'lucide-react';
import { CATEGORIAS, GOSTOS_SUGERIDOS } from '../../utils/format';

export function FilterBar({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  selectedTaste,
  onSelectTaste,
  onlyDeals,
  onToggleDeals,
  totalResults,
}) {
  return (
    <div className="space-y-4 rounded-3xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5">
      {/* Top Row: Search + Offers Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar prato, ingrediente ou gosto (ex: frango, picante, vegano)..."
            className="w-full rounded-2xl border border-stone-200 bg-[#FFFBF5] py-2.5 pl-10 pr-9 text-sm text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onToggleDeals}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
              onlyDeals
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Ofertas do Dia</span>
          </button>

          <span className="text-xs font-semibold text-stone-500">
            {totalResults} {totalResults === 1 ? 'prato' : 'pratos'}
          </span>
        </div>
      </div>

      {/* Category Pills: horizontal swipe on mobile, tidy wrap on desktop */}
      <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {CATEGORIAS.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className={`shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition sm:px-4 sm:text-sm ${
                active
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                  : 'bg-stone-100 text-stone-700 hover:bg-orange-50 hover:text-orange-700'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Taste / Flavor Profile Row: horizontal swipe on mobile, wrap on desktop */}
      <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto border-t border-stone-100 px-1 pt-3 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <span className="mr-1 inline-flex shrink-0 items-center gap-1 text-xs font-bold text-stone-500">
          <Sparkles className="h-3.5 w-3.5 text-orange-500" />
          Gosto:
        </span>
        <button
          type="button"
          onClick={() => onSelectTaste('')}
          className={`shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition ${
            selectedTaste === ''
              ? 'bg-stone-900 text-white'
              : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
          }`}
        >
          Todos
        </button>
        {GOSTOS_SUGERIDOS.map((taste) => {
          const active = selectedTaste === taste;
          return (
            <button
              key={taste}
              type="button"
              onClick={() => onSelectTaste(active ? '' : taste)}
              className={`shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition ${
                active
                  ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300'
                  : 'bg-stone-50 text-stone-600 hover:bg-orange-50/70 hover:text-orange-700'
              }`}
            >
              {taste}
            </button>
          );
        })}
      </div>
    </div>
  );
}
