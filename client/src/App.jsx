import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLogin } from './components/admin/AdminLogin';
import { CartDrawer } from './components/customer/CartDrawer';
import { FilterBar } from './components/customer/FilterBar';
import { HeroBanner } from './components/customer/HeroBanner';
import { MarmitaCard } from './components/customer/MarmitaCard';
import { MarmitaModal } from './components/customer/MarmitaModal';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { api } from './services/api';
import { formatBRL, getEffectivePrice } from './utils/format';

const CART_STORAGE_KEY = 'marmitexsocial_cart_v1';

function getInitialView() {
  return window.location.hash.includes('admin') ? 'admin' : 'customer';
}

export function App() {
  const [activeView, setActiveView] = useState(getInitialView);
  const [marmitas, setMarmitas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [persistence, setPersistence] = useState(null);
  const [ttlMinutes, setTtlMinutes] = useState(10);
  const [backupStatus, setBackupStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [adminUser, setAdminUser] = useState(null);
  const [adminChecking, setAdminChecking] = useState(() => api.hasAdminToken());

  // Customer filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedTaste, setSelectedTaste] = useState('');
  const [onlyDeals, setOnlyDeals] = useState(false);

  // Modals & drawers
  const [selectedMarmita, setSelectedMarmita] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Cart state persisted in localStorage
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Toast feedback
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const menuSectionRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // ignore storage quota errors
    }
  }, [cartItems]);

  useEffect(() => {
    const onHashChange = () => setActiveView(getInitialView());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleChangeView = (view) => {
    setActiveView(view);
    window.location.hash = view === 'admin' ? '#/admin' : '#/';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      setAdminUser(null);
      setPedidos([]);
      showToast('Sua sessão administrativa expirou. Faça login novamente.', 'error');
    });
    return () => api.setUnauthorizedHandler(null);
  }, [showToast]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const [marmitasList, healthInfo, sessionUser] = await Promise.all([
          api.listMarmitas(),
          api.getHealth().catch(() => null),
          api.verifyAdminSession(),
        ]);

        setMarmitas(marmitasList);
        setAdminUser(sessionUser);
        setAdminChecking(false);

        if (healthInfo?.persistence) {
          setPersistence(healthInfo.persistence);
        }
        if (Number.isFinite(Number(healthInfo?.insertedDishTtlMinutes))) {
          setTtlMinutes(Number(healthInfo.insertedDishTtlMinutes));
        }
        if (healthInfo?.backup) {
          setBackupStatus(healthInfo.backup);
        }

        if (sessionUser) {
          const pedidosList = await api.listPedidos();
          setPedidos(pedidosList);
        } else {
          setPedidos([]);
        }

        setLoading(false);
        return;
      } catch (err) {
        if (attempt === maxAttempts) {
          setAdminChecking(false);
          setLoadError(
            err.message ||
              'Não foi possível carregar o cardápio. Verifique se o servidor Node.js está rodando.'
          );
          setLoading(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Schedule a single refresh when a 10-minute backup restore or dish expiration timestamp arrives.
  useEffect(() => {
    const timestamps = [
      ...(backupStatus?.pendingRestores || []).map((entry) => Date.parse(entry.restaurarEm)),
      ...marmitas.filter((item) => item.temporario && item.expiraEm).map((item) => Date.parse(item.expiraEm)),
    ].filter((ts) => Number.isFinite(ts));

    if (timestamps.length === 0) return undefined;
    const nextTimestamp = Math.min(...timestamps);
    const delayMs = Math.min(24 * 60 * 60 * 1000, Math.max(1000, nextTimestamp - Date.now() + 500));
    const timer = setTimeout(() => {
      loadAllData();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [backupStatus, marmitas, loadAllData]);

  // Customer derived data
  const availableMarmitas = useMemo(
    () => marmitas.filter((item) => item.disponivel),
    [marmitas]
  );

  const featuredMarmita = useMemo(
    () =>
      availableMarmitas.find((item) => item.destaque) || availableMarmitas[0] || null,
    [availableMarmitas]
  );

  const filteredCustomerMarmitas = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const tasteTerm = selectedTaste.toLowerCase().trim();

    return availableMarmitas.filter((item) => {
      const matchCat =
        selectedCategory === 'Todas' || item.categoria === selectedCategory;

      const matchTaste =
        !tasteTerm || item.gosto.toLowerCase().includes(tasteTerm);

      const matchDeals =
        !onlyDeals ||
        (item.precoPromocional !== null &&
          item.precoPromocional !== undefined &&
          Number(item.precoPromocional) > 0 &&
          Number(item.precoPromocional) < Number(item.preco));

      const matchSearch =
        !term ||
        item.nome.toLowerCase().includes(term) ||
        item.descricao.toLowerCase().includes(term) ||
        item.categoria.toLowerCase().includes(term) ||
        item.gosto.toLowerCase().includes(term);

      return matchCat && matchTaste && matchDeals && matchSearch;
    });
  }, [availableMarmitas, searchTerm, selectedCategory, selectedTaste, onlyDeals]);

  // Cart calculations
  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantidade, 0),
    [cartItems]
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + getEffectivePrice(item.marmita) * item.quantidade,
        0
      ),
    [cartItems]
  );

  const getCartQuantityForDish = (dishId) =>
    cartItems
      .filter((item) => item.marmita.id === dishId)
      .reduce((sum, item) => sum + item.quantidade, 0);

  const handleAddToCart = (marmita, quantity = 1, observacao = '') => {
    setConfirmedOrder(null);
    setCartItems((prev) => {
      const idx = prev.findIndex(
        (entry) =>
          entry.marmita.id === marmita.id &&
          (entry.observacao || '') === (observacao || '')
      );
      if (idx > -1) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          marmita,
          quantidade: next[idx].quantidade + quantity,
        };
        return next;
      }
      return [...prev, { marmita, quantidade: quantity, observacao }];
    });
    showToast(`${quantity}x ${marmita.nome} adicionado à sacola!`);
  };

  const handleUpdateCartQuantity = (dishId, nextQty, observacao = '') => {
    setCartItems((prev) => {
      if (nextQty <= 0) {
        // When decreasing from card stepper (empty observacao), remove last/matching entry
        return prev.filter((entry) => {
          if (observacao) {
            return !(entry.marmita.id === dishId && (entry.observacao || '') === observacao);
          }
          return entry.marmita.id !== dishId;
        });
      }

      const idx = prev.findIndex((entry) =>
        observacao
          ? entry.marmita.id === dishId && (entry.observacao || '') === observacao
          : entry.marmita.id === dishId
      );

      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], quantidade: nextQty };
      return next;
    });
  };

  const handleRemoveCartItem = (dishId, observacao = '') => {
    setCartItems((prev) =>
      prev.filter(
        (entry) =>
          !(
            entry.marmita.id === dishId &&
            (entry.observacao || '') === (observacao || '')
          )
      )
    );
  };

  const handleSubmitOrder = async (orderPayload) => {
    setSubmittingOrder(true);
    try {
      const created = await api.createPedido(orderPayload);
      setPedidos((prev) => (adminUser ? [created, ...prev] : prev));
      setCartItems([]);
      setConfirmedOrder(created);
      showToast(`Pedido ${created.id} confirmado com sucesso!`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Admin auth handlers
  const handleAdminLogin = async ({ username, password, remember }) => {
    const user = await api.loginAdmin({ username, password, remember });
    setAdminUser(user);
    const [marmitasList, pedidosList, healthInfo] = await Promise.all([
      api.listMarmitas(),
      api.listPedidos(),
      api.getHealth().catch(() => null),
    ]);
    setMarmitas(marmitasList);
    setPedidos(pedidosList);
    if (healthInfo?.persistence) {
      setPersistence(healthInfo.persistence);
    }
    if (Number.isFinite(Number(healthInfo?.insertedDishTtlMinutes))) {
      setTtlMinutes(Number(healthInfo.insertedDishTtlMinutes));
    }
    showToast(`Bem-vindo ao painel, ${user.username}!`);
  };

  const handleAdminLogout = async () => {
    await api.logoutAdmin();
    setAdminUser(null);
    setPedidos([]);
    showToast('Sessão administrativa encerrada.');
  };

  const refreshBackupStatus = useCallback(async () => {
    const health = await api.getHealth().catch(() => null);
    if (health?.backup) setBackupStatus(health.backup);
  }, []);

  // Admin handlers
  const handleSaveMarmita = async (payload, id) => {
    if (id) {
      const updated = await api.updateMarmita(id, payload);
      setMarmitas((prev) => prev.map((m) => (m.id === id ? updated : m)));
      // Keep cart items synced with updated dish prices/info
      setCartItems((prev) =>
        prev.map((entry) =>
          entry.marmita.id === id ? { ...entry, marmita: updated } : entry
        )
      );
      showToast(`"${updated.nome}" atualizada na planilha Excel!`);
    } else {
      const created = await api.createMarmita(payload);
      setMarmitas((prev) => [created, ...prev]);
      showToast(`"${created.nome}" cadastrada na planilha Excel!`);
    }
  };

  const handleToggleMarmitaField = async (id, patch) => {
    try {
      const updated = await api.patchMarmita(id, patch);
      setMarmitas((prev) => prev.map((m) => (m.id === id ? updated : m)));
      showToast(`"${updated.nome}" atualizada!`);
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar marmita.', 'error');
    }
  };

  const handleDeleteMarmita = async (id) => {
    try {
      const result = await api.deleteMarmita(id);
      setMarmitas((prev) => prev.filter((m) => m.id !== id));
      setCartItems((prev) => prev.filter((entry) => entry.marmita.id !== id));
      if (result?.backupScheduled) {
        await refreshBackupStatus();
      }
      showToast(result?.message || 'Marmita removida da planilha Excel!');
    } catch (err) {
      showToast(err.message || 'Erro ao excluir marmita.', 'error');
      throw err;
    }
  };

  const handleRestoreBackup = async () => {
    try {
      const result = await api.restoreBackupMarmitas({ force: true });
      await loadAllData();
      showToast(result.message || 'Itens principais restaurados do backup!');
      return result;
    } catch (err) {
      showToast(err.message || 'Erro ao restaurar backup.', 'error');
      throw err;
    }
  };

  const handleCleanupInsertedMarmitas = async () => {
    try {
      const result = await api.cleanupInsertedMarmitas(true);
      await loadAllData();
      if (result.deletedIds?.length) {
        const deletedSet = new Set(result.deletedIds);
        setCartItems((prev) => prev.filter((entry) => !deletedSet.has(entry.marmita.id)));
      }
      showToast(result.message || 'Pratos inseridos removidos da planilha!');
      return result;
    } catch (err) {
      showToast(err.message || 'Erro ao limpar pratos inseridos.', 'error');
      throw err;
    }
  };

  const handleUpdateOrderStatus = async (id, status) => {
    try {
      const updated = await api.updatePedidoStatus(id, status);
      setPedidos((prev) => prev.map((p) => (p.id === id ? updated : p)));
      showToast(`Pedido ${id} atualizado para "${status}".`);
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar pedido.', 'error');
    }
  };

  const resetCustomerFilters = () => {
    setSearchTerm('');
    setSelectedCategory('Todas');
    setSelectedTaste('');
    setOnlyDeals(false);
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-[#FFFBF5] text-[#1C1917]">
      <Header
        activeView={activeView}
        onChangeView={handleChangeView}
        isAdminAuthenticated={Boolean(adminUser)}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setCartOpen(true)}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 py-5 pb-28 sm:px-6 sm:py-8">
        {loading && marmitas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-orange-100 bg-white px-5 py-16 text-center sm:py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-orange-600" />
            <p className="mt-3 font-display text-base font-bold text-stone-800 sm:text-lg">
              Carregando cardápio da planilha Excel...
            </p>
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center sm:p-8">
            <h2 className="font-display text-lg font-extrabold text-red-900 sm:text-xl">
              Falha ao conectar ao servidor
            </h2>
            <p className="mt-2 text-sm text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={loadAllData}
              className="mt-4 w-full cursor-pointer rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 sm:w-auto"
            >
              Tentar Novamente
            </button>
          </div>
        ) : activeView === 'admin' ? (
          adminChecking ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-orange-100 bg-white px-5 py-16 text-center sm:py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-orange-600" />
              <p className="mt-3 font-display text-base font-bold text-stone-800 sm:text-lg">
                Verificando sessão administrativa...
              </p>
            </div>
          ) : !adminUser ? (
            <AdminLogin
              onLogin={handleAdminLogin}
              onBackToCustomer={() => handleChangeView('customer')}
            />
          ) : (
            <AdminDashboard
              marmitas={marmitas}
              pedidos={pedidos}
              persistence={persistence}
              ttlMinutes={ttlMinutes}
              backupStatus={backupStatus}
              adminUser={adminUser}
              onSaveMarmita={handleSaveMarmita}
              onToggleField={handleToggleMarmitaField}
              onDeleteMarmita={handleDeleteMarmita}
              onCleanupInserted={handleCleanupInsertedMarmitas}
              onRestoreBackup={handleRestoreBackup}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onRefreshAll={loadAllData}
              onLogout={handleAdminLogout}
              onShowToast={showToast}
            />
          )
        ) : (
          <div className="space-y-6">
            <HeroBanner
              featuredMarmita={featuredMarmita}
              onQuickBuy={(dish) => handleAddToCart(dish, 1)}
              onScrollToMenu={() =>
                menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
            />

            <div ref={menuSectionRef} className="space-y-5 pt-1">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-stone-900 sm:text-3xl">
                    Cardápio do Dia
                  </h2>
                  <p className="text-sm text-stone-500">
                    Escolha seu prato favorito e clique em{' '}
                    <span className="font-bold text-emerald-700">Comprar</span> para adicionar ao
                    pedido.
                  </p>
                </div>
              </div>

              <FilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                selectedTaste={selectedTaste}
                onSelectTaste={setSelectedTaste}
                onlyDeals={onlyDeals}
                onToggleDeals={() => setOnlyDeals((v) => !v)}
                totalResults={filteredCustomerMarmitas.length}
              />

              {filteredCustomerMarmitas.length === 0 ? (
                <div className="rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-xs sm:p-12">
                  <UtensilsCrossed className="mx-auto h-10 w-10 text-orange-400" />
                  <h3 className="mt-3 font-display text-xl font-bold text-stone-900">
                    Nenhuma marmita encontrada
                  </h3>
                  <p className="mt-1 text-sm text-stone-500">
                    Tente limpar os filtros ou buscar por outro ingrediente ou gosto.
                  </p>
                  <button
                    type="button"
                    onClick={resetCustomerFilters}
                    className="mt-4 w-full cursor-pointer rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700 sm:w-auto"
                  >
                    Mostrar Todas as Marmitas
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredCustomerMarmitas.map((dish) => (
                    <MarmitaCard
                      key={dish.id}
                      marmita={dish}
                      cartQuantity={getCartQuantityForDish(dish.id)}
                      onAdd={handleAddToCart}
                      onUpdateQuantity={(id, qty) => handleUpdateCartQuantity(id, qty)}
                      onOpenDetails={(item) => setSelectedMarmita(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Conversion Bar when items are in Cart */}
      {activeView === 'customer' && cartCount > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-3 z-30 mx-auto max-w-lg px-3 sm:bottom-4 sm:px-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-white shadow-2xl shadow-emerald-900/30 ring-2 ring-white/40 transition hover:bg-emerald-700 active:scale-[0.99] sm:px-5 sm:py-3.5"
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-sm font-extrabold text-stone-950">
                {cartCount}
              </span>
              <div className="min-w-0 text-left">
                <div className="hidden text-xs font-semibold text-emerald-100 sm:block">
                  Pronto para pedir?
                </div>
                <div className="truncate font-display text-sm font-extrabold">
                  Finalizar Pedido Agora
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 font-display text-base font-extrabold sm:gap-2 sm:text-lg">
              <span>{formatBRL(cartTotal)}</span>
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-orange-100 bg-white py-6 text-center text-xs text-stone-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <span>
            <strong className="text-stone-800">MarmitexSocial</strong> • Entrega de marmitas frescas
            para todos os gostos
          </span>
          <button
            type="button"
            onClick={() => handleChangeView(activeView === 'admin' ? 'customer' : 'admin')}
            className="cursor-pointer font-bold text-orange-600 hover:underline"
          >
            {activeView === 'admin' ? 'Voltar para Loja do Cliente' : 'Acessar Painel Admin'}
          </button>
        </div>
      </footer>

      {/* Dish Details Modal */}
      <MarmitaModal
        marmita={selectedMarmita}
        onClose={() => setSelectedMarmita(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Cart & Express Checkout Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onSubmitOrder={handleSubmitOrder}
        submitting={submittingOrder}
        confirmedOrder={confirmedOrder}
        onClearConfirmedOrder={() => setConfirmedOrder(null)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default App;
