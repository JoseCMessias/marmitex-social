import { useState } from 'react';
import { Clock, MapPin, Phone, Trash2, User } from 'lucide-react';
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

function getDeleteCopy(target) {
  if (!target) return { title: '', description: '' };
  if (target.mode === 'single') {
    return {
      title: `Excluir pedido ${target.order.id}?`,
      description: `Remover o pedido de ${target.order.clienteNome} (${formatBRL(target.order.total)}) da planilha Excel? Essa ação não pode ser desfeita.`,
    };
  }
  if (target.mode === 'status') {
    return {
      title: `Excluir pedidos com status "${target.status}"?`,
      description: `Você está prestes a remover ${target.count} pedido(s) marcado(s) como "${target.status}" da planilha Excel. Essa ação não pode ser desfeita.`,
    };
  }
  return {
    title: 'Excluir todos os pedidos?',
    description: `Você está prestes a remover todos os ${target.count} pedidos salvos na planilha Excel. Essa ação não pode ser desfeita.`,
  };
}

export function OrdersTab({ pedidos, onUpdateStatus, onDeleteOrder, onClearOrders }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const canceledCount = pedidos.filter((order) => order.status === 'Cancelado').length;
  const deleteCopy = getDeleteCopy(deleteTarget);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.mode === 'single' && onDeleteOrder) {
        await onDeleteOrder(deleteTarget.order.id);
      } else if (deleteTarget.mode === 'status' && onClearOrders) {
        await onClearOrders({ status: deleteTarget.status });
      } else if (deleteTarget.mode === 'all' && onClearOrders) {
        await onClearOrders({ all: true });
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {(onClearOrders || onDeleteOrder) && (
        <div className="flex flex-col justify-between gap-2.5 rounded-2xl border border-stone-200 bg-white p-3.5 sm:flex-row sm:items-center sm:p-4">
          <div className="text-xs font-semibold text-stone-600 sm:text-sm">
            Exibindo <strong className="text-stone-900">{pedidos.length}</strong> pedido(s) na
            planilha
            {canceledCount > 0 ? (
              <>
                {' '}
                • <strong className="text-red-700">{canceledCount}</strong> com status{' '}
                <strong>Cancelado</strong>
              </>
            ) : null}
          </div>

          {onClearOrders && (
            <div className="flex flex-wrap items-center gap-2">
              {canceledCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({ mode: 'status', status: 'Cancelado', count: canceledCount })
                  }
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-100 px-3 py-2 text-xs font-bold text-stone-800 transition hover:bg-stone-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Limpar Cancelados ({canceledCount})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setDeleteTarget({ mode: 'all', count: pedidos.length })}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Excluir Todos ({pedidos.length})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {pedidos.map((order) => (
        <div
          key={order.id}
          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1.5">
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
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {new Date(order.criadoEm).toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-stone-900">
                <span className="inline-flex items-center gap-1.5 break-words">
                  <User className="h-4 w-4 shrink-0 text-orange-600" />
                  {order.clienteNome}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  {order.clienteTelefone}
                </span>
              </div>

              <p className="flex items-start gap-1.5 break-words text-xs text-stone-600">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                <span>{order.endereco}</span>
              </p>

              <div className="rounded-xl bg-[#FFFBF5] px-3 py-2 text-xs font-semibold text-stone-800 ring-1 ring-orange-100">
                {order.itensResumo}
              </div>

              {order.observacoes && (
                <p className="break-words text-xs italic text-stone-500">
                  Obs: {order.observacoes}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
              <div className="text-left sm:text-right">
                {order.pagamentoDetalhes?.statusPagamento && (
                  <span
                    className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      order.pagamentoDetalhes.modo === 'Online' ||
                      String(order.pagamentoDetalhes.statusPagamento).toLowerCase().includes('pago')
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {order.pagamentoDetalhes.statusPagamento}
                  </span>
                )}
                <div className="text-xs font-medium text-stone-600">{order.formaPagamento}</div>
                {order.pagamentoDetalhes?.txid && (
                  <div className="font-mono text-[10px] text-stone-400">
                    TXID: {order.pagamentoDetalhes.txid}
                  </div>
                )}
                {order.pagamentoDetalhes?.trocoPara && (
                  <div className="text-[11px] font-semibold text-amber-700">
                    Troco p/: {order.pagamentoDetalhes.trocoPara}
                  </div>
                )}
                <div className="font-display text-xl font-extrabold text-emerald-700">
                  {formatBRL(order.total)}
                </div>
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <select
                  value={order.status}
                  onChange={(e) => onUpdateStatus(order.id, e.target.value)}
                  aria-label={`Alterar status do pedido ${order.id}`}
                  className="flex-1 cursor-pointer rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-800 focus:border-orange-500 focus:bg-white focus:outline-none sm:w-auto sm:flex-none"
                >
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                {onDeleteOrder && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ mode: 'single', order })}
                    title={`Excluir pedido ${order.id}`}
                    aria-label={`Excluir pedido ${order.id}`}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sm:hidden lg:inline">Excluir</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold text-stone-900 sm:text-xl">
              {deleteCopy.title}
            </h3>
            <p className="mt-2 text-sm text-stone-600">{deleteCopy.description}</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="w-full cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-60 sm:w-auto sm:py-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="w-full cursor-pointer rounded-xl bg-red-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60 sm:w-auto sm:py-2"
              >
                {deleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
