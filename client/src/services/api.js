const DEFAULT_VERCEL_API =
  typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')
    ? 'https://server-d27r.vercel.app'
    : '';
const API_ORIGIN = (import.meta.env.VITE_API_URL || DEFAULT_VERCEL_API).replace(/\/$/, '');
const API_BASE = `${API_ORIGIN}/api`;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao se comunicar com o servidor.');
  }
  return data;
}

export const api = {
  // Marmitas CRUD
  async listMarmitas(params = {}) {
    const query = new URLSearchParams();
    if (params.disponivel !== undefined) query.set('disponivel', String(params.disponivel));
    if (params.categoria && params.categoria !== 'Todas') query.set('categoria', params.categoria);
    if (params.q) query.set('q', params.q);
    const qs = query.toString();
    const res = await request(`/marmitas${qs ? `?${qs}` : ''}`);
    return res.items;
  },

  async createMarmita(payload) {
    const res = await request('/marmitas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.item;
  },

  async updateMarmita(id, payload) {
    const res = await request(`/marmitas/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.item;
  },

  async patchMarmita(id, payload) {
    const res = await request(`/marmitas/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.item;
  },

  async deleteMarmita(id) {
    return request(`/marmitas/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await request('/marmitas/upload', {
      method: 'POST',
      body: formData,
    });
    return {
      ...res,
      url: res.url && res.url.startsWith('/') && API_ORIGIN ? `${API_ORIGIN}${res.url}` : res.url,
    };
  },

  // Pedidos
  async listPedidos() {
    const res = await request('/pedidos');
    return res.items;
  },

  async createPedido(payload) {
    const res = await request('/pedidos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.order;
  },

  async updatePedidoStatus(id, status) {
    const res = await request(`/pedidos/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return res.order;
  },

  // Planilha Excel
  async getExcelSnapshot() {
    return request('/excel/snapshot');
  },

  getExcelDownloadUrl() {
    return `${API_BASE}/excel/download`;
  },
};
