import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export function Toast({ toast, onClose }) {
  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div className="fixed inset-x-3 top-24 z-50 sm:inset-x-auto sm:top-auto sm:bottom-5 sm:right-5 sm:w-full sm:max-w-sm animate-[fadeIn_0.2s_ease-out]">
      <div
        className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-xl ${
          isError
            ? 'border-red-200 bg-red-50 text-red-900'
            : 'border-emerald-200 bg-emerald-50 text-emerald-950'
        }`}
      >
        {isError ? (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        )}
        <div className="flex-1 text-sm font-medium leading-snug">{toast.message}</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-stone-500 transition hover:bg-black/5 hover:text-stone-800"
          aria-label="Fechar notificação"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
