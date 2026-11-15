import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

export function ExcelPreviewTab({ refreshSignal, onSyncAll }) {
  const [snapshot, setSnapshot] = useState(null);
  const [activeSheet, setActiveSheet] = useState('Marmitas');
  const [loading, setLoading] = useState(true);

  const loadSnapshot = async () => {
    setLoading(true);
    try {
      const data = await api.getExcelSnapshot();
      setSnapshot(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshot();
  }, [refreshSignal]);

  const currentSheet = snapshot?.sheets?.find((s) => s.name === activeSheet);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-extrabold text-stone-900">
              Base de Dados Excel: {snapshot?.fileName || 'marmitex_social.xlsx'}
            </h3>
            <p className="mt-0.5 break-all font-mono text-xs text-emerald-900">
              {snapshot?.filePath || 'server/data/marmitex_social.xlsx'}
            </p>
            {snapshot && (
              <p className="mt-1 text-xs text-stone-600">
                Tamanho: {(snapshot.sizeBytes / 1024).toFixed(1)} KB • Última gravação:{' '}
                {new Date(snapshot.updatedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <button
            type="button"
            onClick={async () => {
              await loadSnapshot();
              if (onSyncAll) await onSyncAll();
            }}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-800 transition hover:bg-stone-50 sm:px-3.5"
          >
            <RefreshCw className={`h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
            <span>Ler Planilha</span>
          </button>

          <a
            href={api.getExcelDownloadUrl()}
            download="marmitex_social.xlsx"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 sm:px-4"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>Baixar .xlsx</span>
          </a>
        </div>
      </div>

      {/* Sheet Tabs */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {snapshot?.sheets?.map((sheet) => (
          <button
            key={sheet.name}
            type="button"
            onClick={() => setActiveSheet(sheet.name)}
            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              activeSheet === sheet.name
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50'
            }`}
          >
            Aba: {sheet.name} ({sheet.rowCount})
          </button>
        ))}
      </div>

      {/* Spreadsheet Grid Preview */}
      {currentSheet && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-stone-500 md:hidden">
            Deslize a tabela lateralmente para ver todas as colunas.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-xs">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-orange-600 text-white">
                <th className="border-r border-orange-500 px-3 py-2.5 font-mono text-[11px]">#</th>
                {currentSheet.columns.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap border-r border-orange-500 px-3 py-2.5 font-mono text-[11px] font-bold"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSheet.rows.map((row, idx) => (
                <tr key={row.id || idx} className="border-t border-stone-100 hover:bg-orange-50/40">
                  <td className="border-r border-stone-100 bg-stone-50 px-3 py-2 font-mono text-stone-500">
                    {idx + 2}
                  </td>
                  {currentSheet.columns.map((col) => {
                    const rawVal = row[col];
                    const displayVal =
                      rawVal === null || rawVal === undefined
                        ? ''
                        : typeof rawVal === 'boolean'
                          ? rawVal
                            ? 'VERDADEIRO'
                            : 'FALSO'
                          : String(rawVal);
                    return (
                      <td
                        key={col}
                        title={displayVal}
                        className="max-w-56 truncate whitespace-nowrap border-r border-stone-100 px-3 py-2 text-stone-700"
                      >
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
