import { useEffect, useState } from 'react';
import { ImagePlus, Sparkles, Upload, X } from 'lucide-react';
import { api } from '../../services/api';
import {
  CATEGORIAS,
  FALLBACK_IMAGE,
  GOSTOS_SUGERIDOS,
  IMAGENS_GALERIA,
  parseGostoTags,
} from '../../utils/format';

const EMPTY_FORM = {
  nome: '',
  descricao: '',
  categoria: 'Tradicional',
  gosto: 'Caseiro',
  preco: '',
  precoPromocional: '',
  tamanho: '500g',
  calorias: '',
  tempoPreparo: '25-35 min',
  imagem: '/images/marmitas/feijoada.jpg',
  disponivel: true,
  destaque: false,
};

export function MarmitaFormModal({ isOpen, initialData, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (initialData) {
      setForm({
        nome: initialData.nome || '',
        descricao: initialData.descricao || '',
        categoria: initialData.categoria || 'Tradicional',
        gosto: initialData.gosto || '',
        preco: initialData.preco !== undefined ? String(initialData.preco) : '',
        precoPromocional:
          initialData.precoPromocional !== null && initialData.precoPromocional !== undefined
            ? String(initialData.precoPromocional)
            : '',
        tamanho: initialData.tamanho || '500g',
        calorias:
          initialData.calorias !== null && initialData.calorias !== undefined
            ? String(initialData.calorias)
            : '',
        tempoPreparo: initialData.tempoPreparo || '25-35 min',
        imagem: initialData.imagem || '/images/marmitas/feijoada.jpg',
        disponivel: initialData.disponivel !== undefined ? Boolean(initialData.disponivel) : true,
        destaque: Boolean(initialData.destaque),
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialData?.id);
  const selectedTastes = parseGostoTags(form.gosto);

  const toggleTasteTag = (tag) => {
    const exists = selectedTastes.some((t) => t.toLowerCase() === tag.toLowerCase());
    const next = exists
      ? selectedTastes.filter((t) => t.toLowerCase() !== tag.toLowerCase())
      : [...selectedTastes, tag];
    setForm((prev) => ({ ...prev, gosto: next.join(', ') }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { url } = await api.uploadImage(file);
      setForm((prev) => ({ ...prev, imagem: url }));
    } catch (err) {
      setError(err.message || 'Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const precoNum = Number(String(form.preco).replace(',', '.'));
    const promoNum =
      form.precoPromocional !== ''
        ? Number(String(form.precoPromocional).replace(',', '.'))
        : null;

    if (!form.nome.trim() || !form.descricao.trim()) {
      setError('Nome e descrição são obrigatórios.');
      return;
    }
    if (!Number.isFinite(precoNum) || precoNum <= 0) {
      setError('Informe um preço válido maior que zero.');
      return;
    }
    if (promoNum !== null && (!Number.isFinite(promoNum) || promoNum <= 0 || promoNum >= precoNum)) {
      setError('O preço promocional deve ser maior que zero e menor que o preço normal.');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          nome: form.nome.trim(),
          descricao: form.descricao.trim(),
          categoria: form.categoria,
          gosto: form.gosto.trim(),
          preco: precoNum,
          precoPromocional: promoNum,
          tamanho: form.tamanho.trim() || '500g',
          calorias: form.calorias !== '' ? Number(form.calorias) : null,
          tempoPreparo: form.tempoPreparo.trim() || '25-35 min',
          imagem: form.imagem.trim(),
          disponivel: form.disponivel,
          destaque: form.destaque,
        },
        initialData?.id || null
      );
      onClose();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar na planilha Excel.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-stone-900">
              {isEditing ? `Editar Marmita (${initialData.id})` : 'Cadastrar Nova Marmita'}
            </h2>
            <p className="text-xs font-medium text-stone-500">
              As alterações são gravadas diretamente na planilha Excel (.xlsx)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
            aria-label="Fechar formulário"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          {/* Name & Category */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
                Nome da Marmita *
              </label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Parmegiana de Frango com Purê"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
                Categoria *
              </label>
              <select
                value={form.categoria}
                onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium focus:border-orange-500 focus:bg-white focus:outline-none"
              >
                {CATEGORIAS.filter((c) => c !== 'Todas').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
              Descrição do Prato e Acompanhamentos *
            </label>
            <textarea
              required
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Descreva os ingredientes, tempero e acompanhamentos para despertar o apetite..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Taste / Flavor Profile */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
              Gosto / Perfil de Sabor
            </label>
            <input
              type="text"
              value={form.gosto}
              onChange={(e) => setForm((p) => ({ ...p, gosto: e.target.value }))}
              placeholder="Ex: Caseiro, Bem Temperado, Leve"
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GOSTOS_SUGERIDOS.map((tag) => {
                const active = selectedTastes.some((t) => t.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTasteTag(tag)}
                    className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      active
                        ? 'bg-orange-600 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-orange-50 hover:text-orange-700'
                    }`}
                  >
                    {active ? `✓ ${tag}` : `+ ${tag}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pricing & Portion */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
                Preço (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.preco}
                onChange={(e) => setForm((p) => ({ ...p, preco: e.target.value }))}
                placeholder="29.90"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-bold focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
                Preço Promo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.precoPromocional}
                onChange={(e) => setForm((p) => ({ ...p, precoPromocional: e.target.value }))}
                placeholder="Opcional"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-bold text-emerald-700 focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
                Porção / Peso
              </label>
              <input
                type="text"
                value={form.tamanho}
                onChange={(e) => setForm((p) => ({ ...p, tamanho: e.target.value }))}
                placeholder="500g"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
                Calorias (kcal)
              </label>
              <input
                type="number"
                min="0"
                value={form.calorias}
                onChange={(e) => setForm((p) => ({ ...p, calorias: e.target.value }))}
                placeholder="520"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Prep Time & Image */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
                Tempo de Preparo
              </label>
              <input
                type="text"
                value={form.tempoPreparo}
                onChange={(e) => setForm((p) => ({ ...p, tempoPreparo: e.target.value }))}
                placeholder="25-35 min"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
                URL da Imagem ou Upload
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  value={form.imagem}
                  onChange={(e) => setForm((p) => ({ ...p, imagem: e.target.value }))}
                  placeholder="/images/marmitas/feijoada.jpg ou https://..."
                  className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800">
                  <Upload className="h-4 w-4" />
                  <span>{uploading ? 'Enviando...' : 'Upload'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Quick Gallery Picker & Preview */}
          <div className="rounded-2xl border border-orange-100 bg-[#FFFBF5] p-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <img
                src={form.imagem || FALLBACK_IMAGE}
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
                alt="Pré-visualização"
                className="h-20 w-28 shrink-0 rounded-xl object-cover shadow-xs ring-1 ring-orange-200"
              />
              <div className="flex-1">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-stone-600">
                  <ImagePlus className="h-3.5 w-3.5 text-orange-600" />
                  Ou escolha uma foto pronta do catálogo:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {IMAGENS_GALERIA.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, imagem: img.url }))}
                      className={`cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                        form.imagem === img.url
                          ? 'bg-orange-600 text-white'
                          : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-orange-50'
                      }`}
                    >
                      {img.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-stone-900">Disponível para venda</div>
                <div className="text-xs text-stone-500">Exibir na loja para os clientes</div>
              </div>
              <input
                type="checkbox"
                checked={form.disponivel}
                onChange={(e) => setForm((p) => ({ ...p, disponivel: e.target.checked }))}
                className="h-5 w-5 accent-emerald-600"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
              <div>
                <div className="flex items-center gap-1 text-sm font-bold text-stone-900">
                  <Sparkles className="h-4 w-4 text-amber-600" /> Destaque / Mais Pedida
                </div>
                <div className="text-xs text-stone-600">Promover no banner e selo especial</div>
              </div>
              <input
                type="checkbox"
                checked={form.destaque}
                onChange={(e) => setForm((p) => ({ ...p, destaque: e.target.checked }))}
                className="h-5 w-5 accent-orange-600"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold text-stone-600 transition hover:bg-stone-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-extrabold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving
                ? 'Salvando no Excel...'
                : isEditing
                  ? 'Salvar Alterações'
                  : 'Cadastrar Marmita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
