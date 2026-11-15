const DEFAULT_VERCEL_API =
  typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')
    ? 'https://server-d27r.vercel.app'
    : '';
const API_ORIGIN = (import.meta.env.VITE_API_URL || DEFAULT_VERCEL_API).replace(/\/$/, '');
const API_BASE = `${API_ORIGIN}/api`;
const ADMIN_TOKEN_STORAGE_KEY = 'marmitexsocial_admin_token_v1';

let unauthorizedHandler = null;

function safeStorageGet(storage, key) {
  try {
    return typeof window !== 'undefined' ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeStorageSet(storage, key, value) {
  try {
    if (typeof window !== 'undefined') storage.setItem(key, value);
  } catch {
    // ignore storage quota/privacy restrictions
  }
}

function safeStorageRemove(storage, key) {
  try {
    if (typeof window !== 'undefined') storage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getAdminToken() {
  if (typeof window === 'undefined') return null;
  return (
    safeStorageGet(window.sessionStorage, ADMIN_TOKEN_STORAGE_KEY) ||
    safeStorageGet(window.localStorage, ADMIN_TOKEN_STORAGE_KEY)
  );
}

export function setAdminToken(token, remember = false) {
  if (typeof window === 'undefined') return;
  safeStorageRemove(window.sessionStorage, ADMIN_TOKEN_STORAGE_KEY);
  safeStorageRemove(window.localStorage, ADMIN_TOKEN_STORAGE_KEY);
  if (!token) return;
  safeStorageSet(
    remember ? window.localStorage : window.sessionStorage,
    ADMIN_TOKEN_STORAGE_KEY,
    token
  );
}

export function clearAdminToken() {
  if (typeof window === 'undefined') return;
  safeStorageRemove(window.sessionStorage, ADMIN_TOKEN_STORAGE_KEY);
  safeStorageRemove(window.localStorage, ADMIN_TOKEN_STORAGE_KEY);
}

async function request(path, options = {}) {
  const { suppressAuthCallback = false, headers: customHeaders = {}, ...fetchOptions } = options;
  const token = getAdminToken();

  const headers = {
    ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers,
    ...fetchOptions,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token && !suppressAuthCallback && path !== '/admin/login') {
      clearAdminToken();
      if (unauthorizedHandler) unauthorizedHandler();
    }
    throw new Error(data.error || 'Erro ao se comunicar com o servidor.');
  }
  return data;
}

export const api = {
  setUnauthorizedHandler(handler) {
    unauthorizedHandler = handler;
  },

  hasAdminToken() {
    return Boolean(getAdminToken());
  },

  async getHealth() {
    return request('/health');
  },

  // Admin Authentication
  async loginAdmin({ username, password, remember = false }) {
    const res = await request('/admin/login', {
      method: 'POST',
      suppressAuthCallback: true,
      body: JSON.stringify({ username, password }),
    });
    setAdminToken(res.token, remember);
    return res.user;
  },

  async verifyAdminSession() {
    const token = getAdminToken();
    if (!token) return null;
    try {
      const res = await request('/admin/session', { suppressAuthCallback: true });
      return res.authenticated ? res.user : null;
    } catch {
      clearAdminToken();
      return null;
    }
  },

  async logoutAdmin() {
    const token = getAdminToken();
    clearAdminToken();
    if (token) {
      await fetch(`${API_BASE}/admin/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  },

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

  async cleanupInsertedMarmitas(force = false) {
    return request('/marmitas/cleanup', {
      method: 'POST',
      body: JSON.stringify({ force }),
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

  // Pagamentos & Pedidos
  async generatePixQr(payload) {
    const res = await request('/pagamentos/pix', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.pix;
  },

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

  async downloadExcel() {
    const token = getAdminToken();
    const response = await fetch(`${API_BASE}/excel/download`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 && token) {
        clearAdminToken();
        if (unauthorizedHandler) unauthorizedHandler();
      }
      throw new Error(data.error || 'Não foi possível baixar a planilha Excel.');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'marmitex_social.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },
};
