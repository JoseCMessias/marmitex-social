import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  LogOut,
  Package,
  PauseCircle,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  CATEGORIAS,
  FALLBACK_IMAGE,
  formatBRL,
  getEffectivePrice,
} from '../../utils/format';
import { ExcelPreviewTab } from './ExcelPreviewTab';
import { MarmitaFormModal } from './MarmitaFormModal';
import { OrdersTab } from './OrdersTab';

export function AdminDashboard({
  marmitas,
  pedidos,
  persistence,
  ttlMinutes = 10,
  backupStatus = null,
  adminUser,
  onSaveMarmita,
  onToggleField,
  onDeleteMarmita,
  onCleanupInserted,
  onRestoreBackup,
  onUpdateOrderStatus,
  onDeleteOrder,
  onClearOrders,
  onRefreshAll,
  onLogout,
  onShowToast,
}) {
  const [activeTab, setActiveTab] = useState('marmitas');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [excelRefreshKey, setExcelRefreshKey] = useState(0);

  const filteredMarmitas = marmitas.filter((item) => {
    const matchCategory = categoryFilter === 'Todas' || item.categoria === categoryFilter;
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      item.nome.toLowerCase().includes(term) ||
      item.id.toLowerCase().includes(term) ||
      item.gosto.toLowerCase().includes(term) ||
      item.categoria.toLowerCase().includes(term);
    return matchCategory && matchSearch;
  });

  const availableCount = marmitas.filter((m) => m.disponivel).length;
  const totalRevenue = pedidos
    .filter((o) => o.status !== 'Cancelado')
    .reduce((acc, o) => acc + Number(o.total || 0), 0);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDuplicate = (item) => {
    setEditingItem({
      ...item,
      id: null,
      nome: `${item.nome} (Cópia)`,
    });
    setModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteMarmita(deleteTarget.id);
      setDeleteTarget(null);
      setExcelRefreshKey((k) => k + 1);
    } finally {
      setDeleting(false);
    }
  };

  const handleModalSave = async (payload, id) => {
    await onSaveMarmita(payload, id);
    setExcelRefreshKey((k) => k + 1);
  };

  const handleToggleDishFlag = async (item, field) => {
    await onToggleField(item.id, { [field]: !item[field] });
    setExcelRefreshKey((k) => k + 1);
  };

  const handleCleanupClick = async () => {
    if (!onCleanupInserted) return;
    setCleaningUp(true);
    try {
      await onCleanupInserted();
      setExcelRefreshKey((k) => k + 1);
    } finally {
      setCleaningUp(false);
    }
  };

  const handleRestoreBackupClick = async () => {
    if (!onRestoreBackup) return;
    setRestoringBackup(true);
    try {
      await onRestoreBackup();
      setExcelRefreshKey((k) => k + 1);
    } finally {
      setRestoringBackup(false);
    }
  };

  const pendingRestores = backupStatus?.pendingRestores || [];
  const backupIntervalMinutes = backupStatus?.intervalMinutes || 10;

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      await api.downloadExcel();
    } catch (err) {
      if (onShowToast) {
        onShowToast(err.message || 'Erro ao baixar planilha Excel.', 'error');
      }
    } finally {
      setDownloadingExcel(false);
    }
  };

  const insertedCount = marmitas.filter((m) => m.temporario).length;

  const getExpiryLabel = (item) => {
    if (!item.temporario) return null;
    if (item.expiraEm) {
      const remainingMin = Math.max(
        1,
        Math.ceil((Date.parse(item.expiraEm) - Date.now()) / 60000)
      );
      if (Number.isFinite(remainingMin)) {
        return `Remove em ${remainingMin} min`;
      }
    }
    return `Auto-remove ${ttlMinutes} min`;
  };

  const enrichedMarmitas = filteredMarmitas.map((item) => ({
    item,
    effective: getEffectivePrice(item),
    hasPromo: Boolean(item.precoPromocional && Number(item.precoPromocional) < Number(item.preco)),
    expiryLabel: getExpiryLabel(item),
  }));

  const renderStatusButtons = (item, layout = 'stack') => (
    <div
      className={
        layout === 'row'
          ? 'flex flex-wrap items-center gap-2'
          : 'flex flex-col items-start gap-1.5'
      }
    >
      <button
        type="button"
        onClick={() => handleToggleDishFlag(item, 'disponivel')}
        className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${
          item.disponivel
            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
            : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
        }`}
      >
        {item.disponivel ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" /> Disponível
          </>
        ) : (
          <>
            <PauseCircle className="h-3.5 w-3.5" /> Pausada
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => handleToggleDishFlag(item, 'destaque')}
        className={`cursor-pointer text-[11px] font-semibold transition ${
          item.destaque
            ? 'text-amber-700 hover:text-amber-900'
            : 'text-stone-400 hover:text-stone-700'
        }`}
      >
        {item.destaque ? '★ Remover destaque' : '☆ Marcar destaque'}
      </button>
    </div>
  );

  const renderActionButtons = (item, fullWidthEdit = false) => (
    <div className={fullWidthEdit ? 'flex items-center gap-1.5' : 'inline-flex items-center gap-1.5'}>
      <button
        type="button"
        onClick={() => handleOpenEdit(item)}
        title="Editar informações da marmita"
        className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 transition hover:bg-orange-100 ${
          fullWidthEdit ? 'flex-1 py-2' : ''
        }`}
      >
        <Edit3 className="h-3.5 w-3.5" />
        <span>Editar</span>
      </button>

      <button
        type="button"
        onClick={() => handleDuplicate(item)}
        title="Duplicar marmita"
        className="cursor-pointer rounded-xl p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
        aria-label={`Duplicar ${item.nome}`}
      >
        <Copy className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => setDeleteTarget(item)}
        title="Excluir marmita da planilha"
        className="cursor-pointer rounded-xl p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700"
        aria-label={`Excluir ${item.nome}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <section className="space-y-5 sm:space-y-6">
      {/* Top Admin Header */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0">
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700 ring-1 ring-emerald-200 sm:text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {persistence?.label || 'Planilha Excel Conectada (CRUD em Tempo Real)'}
            </span>
          </div>
          <h1 className="mt-2 font-display text-xl font-extrabold text-stone-900 sm:text-3xl">
            Painel do Administrador
          </h1>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            Cadastre novas marmitas, edite pratos e preços, gerencie pedidos e exporte a planilha.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <button
            type="button"
            disabled={downloadingExcel}
            onClick={handleDownloadExcel}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs font-bold text-stone-800 transition hover:bg-stone-100 disabled:opacity-60 sm:px-4 sm:text-sm"
          >
            <Download className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{downloadingExcel ? 'Baixando...' : 'Baixar Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-600 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 active:scale-95 sm:px-5 sm:text-sm"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Nova Marmita</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title={adminUser?.username ? `Sair (${adminUser.username})` : 'Sair do painel admin'}
              className="col-span-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-bold text-stone-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:col-span-1 sm:px-4 sm:text-sm"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sair{adminUser?.username ? ` (${adminUser.username})` : ''}</span>
            </button>
          )}
        </div>
      </div>

      {/* Persistence / Auto-Cleanup Alerts */}
      {persistence && !persistence.persistent && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 sm:p-4 sm:text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="leading-relaxed">
            <strong>Modo temporário (/tmp) na Vercel:</strong> conecte um{' '}
            <strong>Vercel Blob Store</strong> (<code className="font-mono">BLOB_READ_WRITE_TOKEN</code>) ao
            projeto da API para manter os pratos inseridos na planilha entre refreshes e múltiplas
            instâncias.
          </p>
        </div>
      )}

      {pendingRestores.length > 0 && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 sm:flex-row sm:items-center sm:p-4">
          <div className="flex items-start gap-2.5 text-xs text-emerald-950 sm:text-sm">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span>
              <strong>
                Backup automático ({backupIntervalMinutes} min): {pendingRestores.length} item(ns)
                principal(is) excluído(s)
              </strong>{' '}
              ({pendingRestores.map((item) => item.nome).join(', ')}) será(ão) reinserido(s) com o
              histórico original do backup em até {backupIntervalMinutes} minutos.
            </span>
          </div>
          {onRestoreBackup && (
            <button
              type="button"
              disabled={restoringBackup}
              onClick={handleRestoreBackupClick}
              className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 sm:w-auto"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{restoringBackup ? 'Restaurando...' : 'Restaurar Backup Agora'}</span>
            </button>
          )}
        </div>
      )}

      {insertedCount > 0 && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50/70 p-3.5 sm:flex-row sm:items-center sm:p-4">
          <div className="flex items-start gap-2.5 text-xs text-orange-950 sm:text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <span>
              <strong>{insertedCount} prato(s) inserido(s)</strong> na planilha. A limpeza automática
              remove pratos inseridos após <strong>{ttlMinutes} minutos</strong>.
            </span>
          </div>
          {onCleanupInserted && (
            <button
              type="button"
              disabled={cleaningUp}
              onClick={handleCleanupClick}
              className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-orange-300 bg-white px-3.5 py-2 text-xs font-extrabold text-orange-800 transition hover:bg-orange-100 disabled:opacity-60 sm:w-auto"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{cleaningUp ? 'Limpando...' : 'Limpar Inseridos Agora'}</span>
            </button>
          )}
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-500">
            <span className="truncate">Total de Marmitas</span>
            <Package className="h-4 w-4 shrink-0 text-orange-600" />
          </div>
          <div className="mt-2 truncate font-display text-xl font-extrabold text-stone-900 sm:text-2xl">
            {marmitas.length}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-500">
            <span className="truncate">Ativas no Cardápio</span>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          </div>
          <div className="mt-2 truncate font-display text-xl font-extrabold text-emerald-700 sm:text-2xl">
            {availableCount}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-500">
            <span className="truncate">Pedidos Salvos</span>
            <ClipboardList className="h-4 w-4 shrink-0 text-amber-500" />
          </div>
          <div className="mt-2 truncate font-display text-xl font-extrabold text-stone-900 sm:text-2xl">
            {pedidos.length}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-500">
            <span className="truncate">Vendas na Planilha</span>
            <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
          </div>
          <div className="mt-2 truncate font-display text-xl font-extrabold text-emerald-700 sm:text-2xl">
            {formatBRL(totalRevenue)}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto border-b border-stone-200 px-1 pb-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <button
          type="button"
          onClick={() => setActiveTab('marmitas')}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
            activeTab === 'marmitas'
              ? 'bg-stone-900 text-white shadow-sm'
              : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Gerenciar Marmitas ({marmitas.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pedidos')}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
            activeTab === 'pedidos'
              ? 'bg-stone-900 text-white shadow-sm'
              : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Pedidos Recebidos ({pedidos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
            activeTab === 'excel'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-emerald-50 hover:text-emerald-800'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Planilha Excel (.xlsx)</span>
        </button>
      </div>

      {/* Tab 1: Marmitas CRUD */}
      {activeTab === 'marmitas' && (
        <div className="space-y-4">
          {/* Admin Filter Strip */}
          <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar marmitas por código, nome, categoria ou gosto..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700 focus:border-orange-500 focus:bg-white focus:outline-none sm:w-auto"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  Categoria: {c}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile Cards (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {enrichedMarmitas.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
                Nenhuma marmita encontrada com esse filtro.
              </div>
            ) : (
              enrichedMarmitas.map(({ item, effective, hasPromo, expiryLabel }) => (
                <article
                  key={item.id}
                  className="space-y-3 rounded-2xl border border-stone-200 bg-white p-3.5 shadow-2xs"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={item.imagem || FALLBACK_IMAGE}
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_IMAGE;
                      }}
                      alt={item.nome}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-stone-200"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-stone-400">
                          {item.id}
                        </span>
                        <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                          {item.categoria}
                        </span>
                        {item.destaque && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                            <Sparkles className="h-2.5 w-2.5" /> Destaque
                          </span>
                        )}
                        {expiryLabel && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-extrabold text-orange-800">
                            <Clock className="h-2.5 w-2.5" /> {expiryLabel}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 font-display text-sm font-bold text-stone-900">
                        {item.nome}
                      </h3>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {item.tamanho || '500g'} • {item.tempoPreparo || '25-35 min'}
                        {item.gosto ? ` • ${item.gosto}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-base font-extrabold text-stone-900">
                        {formatBRL(effective)}
                      </span>
                      {hasPromo && (
                        <span className="text-xs text-stone-400 line-through">
                          {formatBRL(item.preco)}
                        </span>
                      )}
                    </div>
                    {renderStatusButtons(item, 'row')}
                  </div>

                  <div className="border-t border-stone-100 pt-2.5">
                    {renderActionButtons(item, true)}
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-xs md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-xs font-extrabold uppercase tracking-wider text-stone-500">
                  <th className="px-4 py-3">Prato</th>
                  <th className="px-4 py-3">Categoria & Gosto</th>
                  <th className="px-4 py-3">Preço</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {enrichedMarmitas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500">
                      Nenhuma marmita encontrada com esse filtro.
                    </td>
                  </tr>
                ) : (
                  enrichedMarmitas.map(({ item, effective, hasPromo, expiryLabel }) => (
                    <tr key={item.id} className="transition hover:bg-orange-50/30">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.imagem || FALLBACK_IMAGE}
                            onError={(e) => {
                              e.currentTarget.src = FALLBACK_IMAGE;
                            }}
                            alt={item.nome}
                            className="h-14 w-16 shrink-0 rounded-xl object-cover ring-1 ring-stone-200"
                          />
                          <div className="min-w-0 max-w-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-stone-400">
                                {item.id}
                              </span>
                              {item.destaque && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                                  <Sparkles className="h-2.5 w-2.5" /> Destaque
                                </span>
                              )}
                              {expiryLabel && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-extrabold text-orange-800">
                                  <Clock className="h-2.5 w-2.5" /> {expiryLabel}
                                </span>
                              )}
                            </div>
                            <div className="truncate font-display font-bold text-stone-900">
                              {item.nome}
                            </div>
                            <div className="truncate text-xs text-stone-500">
                              {item.tamanho || '500g'} • {item.tempoPreparo || '25-35 min'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="inline-block rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
                          {item.categoria}
                        </div>
                        {item.gosto && (
                          <div className="mt-1 text-xs text-stone-500">{item.gosto}</div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {hasPromo && (
                          <div className="text-xs text-stone-400 line-through">
                            {formatBRL(item.preco)}
                          </div>
                        )}
                        <div className="font-display text-base font-extrabold text-stone-900">
                          {formatBRL(effective)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">{renderStatusButtons(item, 'stack')}</td>

                      <td className="px-4 py-3.5 text-right">{renderActionButtons(item, false)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Orders */}
      {activeTab === 'pedidos' && (
        <OrdersTab
          pedidos={pedidos}
          onUpdateStatus={async (id, status) => {
            await onUpdateOrderStatus(id, status);
            setExcelRefreshKey((k) => k + 1);
          }}
          onDeleteOrder={async (id) => {
            await onDeleteOrder(id);
            setExcelRefreshKey((k) => k + 1);
          }}
          onClearOrders={async (options) => {
            await onClearOrders(options);
            setExcelRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Tab 3: Excel Sheet Inspector */}
      {activeTab === 'excel' && (
        <ExcelPreviewTab refreshSignal={excelRefreshKey} onSyncAll={onRefreshAll} />
      )}

      {/* Create / Edit Modal */}
      <MarmitaFormModal
        isOpen={modalOpen}
        initialData={editingItem}
        onClose={() => setModalOpen(false)}
        onSave={handleModalSave}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold text-stone-900 sm:text-xl">
              Excluir marmita da planilha?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Você está prestes a remover <strong>{deleteTarget.nome}</strong> ({deleteTarget.id}) da
              planilha Excel.{' '}
              {deleteTarget.temporario
                ? 'Essa ação não pode ser desfeita.'
                : `Como é um item principal do cardápio, o backup de ${backupIntervalMinutes} minutos irá reinseri-lo automaticamente em ${backupIntervalMinutes} min.`}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="w-full cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold text-stone-600 hover:bg-stone-100 sm:w-auto sm:py-2"
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
    </section>
  );
}
