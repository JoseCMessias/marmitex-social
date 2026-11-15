import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  User,
} from 'lucide-react';

export function AdminLogin({ onLogin, onBackToCustomer }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Informe o login e a senha para acessar o painel.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onLogin({
        username: username.trim(),
        password,
        remember,
      });
    } catch (err) {
      setError(err.message || 'Login ou senha inválidos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md py-4 sm:py-10">
      <div className="overflow-hidden rounded-3xl border border-orange-100 bg-white p-5 shadow-xl shadow-stone-900/5 sm:p-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25">
            <Lock className="h-7 w-7" />
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-extrabold text-stone-700">
            <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
            <span>Área Administrativa Protegida</span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-stone-900 sm:text-3xl">
            Acesso ao Painel Admin
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-500 sm:text-sm">
            Faça login para cadastrar marmitas, acompanhar pedidos e gerenciar a planilha Excel.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-800 sm:text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="admin-username"
              className="block text-xs font-extrabold tracking-wide text-stone-700 uppercase"
            >
              Login
            </label>
            <div className="relative mt-1.5">
              <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="admin-username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Digite seu usuário"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-2.5 pr-4 pl-10 text-base font-medium text-stone-900 transition outline-none placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-extrabold tracking-wide text-stone-700 uppercase"
            >
              Senha
            </label>
            <div className="relative mt-1.5">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Digite sua senha"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-2.5 pr-11 pl-10 text-base font-medium text-stone-900 transition outline-none placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute top-1/2 right-2.5 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-200/70 hover:text-stone-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 pt-0.5 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-xs font-semibold text-stone-600 sm:text-sm">
              Manter conectado neste dispositivo
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-display text-sm font-extrabold text-white shadow-lg shadow-orange-600/25 transition hover:bg-orange-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
          >
            <Lock className="h-4 w-4" />
            <span>{submitting ? 'Validando acesso...' : 'Entrar no Painel'}</span>
          </button>
        </form>

        {/* Back to storefront */}
        {onBackToCustomer && (
          <div className="mt-6 border-t border-stone-100 pt-4 text-center">
            <button
              type="button"
              onClick={onBackToCustomer}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-stone-500 transition hover:text-orange-600 sm:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Voltar para o Cardápio</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
