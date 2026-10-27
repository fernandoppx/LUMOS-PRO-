
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        });

      if (error) throw error;

      if (!data.session) {
        throw new Error('Sessão não iniciada.');
      }

      onSuccess();
    } catch (error) {
      console.error('Falha ao entrar no sistema:', error);
      setErrorMessage(
        'Não foi possível entrar. Verifique seu e-mail e senha.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f3f5f9] dark:bg-[#0e1320]">

      <div className="max-w-md w-full bg-white dark:bg-[#161d2e] rounded-2xl shadow-xl border border-[#dde2ec] dark:border-slate-800 p-8 sm:p-10">

        <div className="text-center mb-8">
          <ShieldCheck className="w-10 h-10 mx-auto mb-4 text-[#2f55d4]" />

          <h1 className="font-heading text-2xl font-black text-[#131a2b] dark:text-[#e8ecf5]">
            LUMOS PRO
          </h1>

          <p className="text-xs text-[#5d6680] dark:text-slate-400 mt-1">
            Sistema de Diagnóstico de Clientes
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              E-mail
            </label>

            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                autoComplete="email"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Senha
            </label>

            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />

              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {errorMessage && (
            <div role="alert" className="flex items-center gap-2 text-xs text-rose-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#2f55d4] hover:bg-[#2544ad] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar no Sistema'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Acesso exclusivo para a equipe autorizada.
        </p>
      </div>
    </div>
  );
};
