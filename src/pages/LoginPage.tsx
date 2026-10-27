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
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const credentials = {
        email: email.trim().toLowerCase(),
        password
      };

      if (isRegister) {
        const { data, error } =
          await supabase.auth.signUp(credentials);

        if (error) throw error;

        if (!data.session) {
          setErrorMessage(
            'Conta criada. Verifique seu e-mail para confirmar o cadastro.'
          );
          return;
        }
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword(
            credentials
          );

        if (error) throw error;

        if (!data.session) {
          throw new Error('Sessão não iniciada.');
        }
      }

      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : '';

      if (message.includes('already registered')) {
        setErrorMessage(
          'Este e-mail já está cadastrado. Utilize Entrar.'
        );
      } else if (message.includes('rate limit')) {
        setErrorMessage(
          'Limite temporário de tentativas atingido. Tente novamente mais tarde.'
        );
      } else {
        setErrorMessage(
          'Não foi possível continuar. Verifique os dados informados.'
        );
      }
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

        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg ${
              !isRegister
                ? 'bg-white dark:bg-slate-700 text-[#2f55d4] shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg ${
              isRegister
                ? 'bg-white dark:bg-slate-700 text-[#2f55d4] shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Criar Conta
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold mb-1.5 dark:text-white">
              E-mail
            </label>

            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />

              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                autoComplete="email"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 dark:text-white">
              Senha
            </label>

            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />

              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                autoComplete={
                  isRegister
                    ? 'new-password'
                    : 'current-password'
                }
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 text-xs text-rose-600"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#2f55d4] hover:bg-[#2544ad] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading
              ? 'Aguarde...'
              : isRegister
                ? 'Criar Conta e Entrar'
                : 'Entrar no Sistema'
            }

            {!loading && (
              <ArrowRight className="w-4 h-4" />
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Lumos Pro — Sistema de Diagnóstico
        </p>
      </div>
    </div>
  );
};
