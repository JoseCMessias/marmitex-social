import { Clock, MapPin, Phone, User } from 'lucide-react';
import { formatBRL } from '../../utils/format';

const ORDER_STATUSES = [
  'Recebido',
  'Em Preparo',
  'Saiu para Entrega',
  'Entregue',
  'Cancelado',
];

const STATUS_BADGE_STYLES = {
  Recebido: 'bg-amber-100 text-amber-900 ring-amber-200',
  'Em Preparo': 'bg-orange-100 text-orange-900 ring-orange-200',
  'Saiu para Entrega': 'bg-sky-100 text-sky-900 ring-sky-200',
  Entregue: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  Cancelado: 'bg-red-100 text-red-900 ring-red-200',
};

export function OrdersTab({ pedidos, onUpdateStatus }) {
  if (pedidos.length === 0) {
    return (
      <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center">
        <p className="font-display text-lg font-bold text-stone-800">
          Nenhum pedido registrado na planilha ainda.
        </p>
        <p className="mt-1 text-sm text-stone-500">
          Quando os clientes comprarem pelo cardápio, os pedidos aparecerão aqui e na aba Pedidos
          do Excel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pedidos.map((order) => (
        <div
          key={order.id}
          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-stone-900 px-2.5 py-0.5 text-xs font-extrabold text-white">
                  {order.id}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${
                    STATUS_BADGE_STYLES[order.status] || 'bg-stone-100 text-stone-700'
                  }`}
                >
                  {order.status}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(order.criadoEm).toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-stone-900">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4 text-orange-600" />
                  {order.clienteNome}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600">
                  <Phone className="h-3.5 w-3.5 text-stone-400" />
                  {order.clienteTelefone}
                </span>
              </div>

              <p className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                {order.endereco}
              </p>

              <div className="rounded-xl bg-[#FFFBF5] px-3 py-2 text-xs font-semibold text-stone-800 ring-1 ring-orange-100">
                {order.itensResumo}
              </div>

              {order.observacoes && (
                <p className="text-xs italic text-stone-500">Obs: {order.observacoes}</p>
              )}
            </div>

            <div className="flex shrink-0 flex-row items-center justify-between gap-4 border-t border-stone-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
              <div className="text-left sm:text-right">
                <div className="text-xs font-medium text-stone-500">{order.formaPagamento}</div>
                <div className="font-display text-xl font-extrabold text-emerald-700">
                  {formatBRL(order.total)}
                </div>
              </div>

              <select
                value={order.status}
                onChange={(e) => onUpdateStatus(order.id, e.target.value)}
                aria-label={`Alterar status do pedido ${order.id}`}
                className="cursor-pointer rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-800 focus:border-orange-500 focus:bg-white focus:outline-none"
              >
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
