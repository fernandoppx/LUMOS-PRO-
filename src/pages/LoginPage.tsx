import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  ShieldCheck,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  UserCheck,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Análise visual de força da senha
  const passwordRules = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];

  const passwordScore = passwordRules.filter(Boolean).length;

  const passwordStrength =
    passwordScore <= 1
      ? 'Fraca'
      : passwordScore <= 3
      ? 'Média'
      : 'Forte';

  const strengthColor =
    passwordScore <= 1
      ? '#ef4444'
      : passwordScore <= 3
      ? '#f59e0b'
      : '#10b981';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (isRegister) {
      if (!nome.trim()) {
        setErrorMessage('Por favor, informe seu nome completo.');
        return;
      }

      if (passwordScore < 4) {
        setErrorMessage(
          'Para criar sua conta, utilize pelo menos 8 caracteres, letras maiúsculas e minúsculas, números e símbolos.'
        );
        return;
      }
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (isRegister) {
        const cleanNome = nome.trim();

        // Cadastro enviando o nome nos metadados do Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              nome: cleanNome,
              full_name: cleanNome,
            },
          },
        });

        if (error) throw error;

        if (!data.session) {
          setInfoMessage(
            'Cadastro recebido com sucesso! Se necessário, verifique a confirmação em seu e-mail para acessar.'
          );
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error('Sessão não iniciada.');
        }
      }

      onSuccess();
    } catch (error: unknown) {
      console.error('[Auth Error]:', error);
      const message = error instanceof Error ? error.message : '';

      if (message.toLowerCase().includes('rate limit')) {
        setErrorMessage(
          'Limite temporário de tentativas atingido. Aguarde alguns instantes e tente novamente.'
        );
      } else if (
        message.toLowerCase().includes('invalid login credentials') ||
        message.toLowerCase().includes('invalid_grant')
      ) {
        setErrorMessage('E-mail ou senha incorretos. Verifique suas credenciais.');
      } else {
        setErrorMessage(
          message || 'Não foi possível continuar. Verifique os dados informados.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f3f5f9] dark:bg-[#0e1320] transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-[#161d2e] rounded-2xl shadow-xl border border-[#dde2ec] dark:border-slate-800 p-8 sm:p-10">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center mx-auto mb-3 border border-blue-100 dark:border-blue-900/40">
            <ShieldCheck className="w-6 h-6 text-[#2f55d4]" />
          </div>

          <h1 className="font-heading text-2xl font-black text-[#131a2b] dark:text-[#e8ecf5] tracking-tight">
            LUMOS PRO
          </h1>

          <p className="text-xs text-[#5d6680] dark:text-slate-400 mt-1">
            Sistema de Diagnóstico & Avaliação Estratégica
          </p>
        </div>

        {/* Alternância entre Login e Cadastro */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 mb-6 border border-slate-200/60 dark:border-slate-700/50">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setErrorMessage(null);
              setInfoMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              !isRegister
                ? 'bg-white dark:bg-slate-700 text-[#2f55d4] dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setErrorMessage(null);
              setInfoMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isRegister
                ? 'bg-white dark:bg-slate-700 text-[#2f55d4] dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Criar Conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome Completo (obrigatório no cadastro) */}
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                Nome completo <span className="text-rose-500">*</span>
              </label>

              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required={isRegister}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome e sobrenome"
                  autoComplete="name"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2f55d4]/40"
                />
              </div>
            </div>
          )}

          {/* E-mail */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
              E-mail <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                autoComplete="email"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2f55d4]/40"
              />
            </div>
          </div>

          {/* Senha com máscara e botão mostrar/ocultar */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
              Senha <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={isRegister ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'Crie uma senha forte' : 'Digite sua senha'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="w-full pl-9 pr-11 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2f55d4]/40"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#2f55d4] p-0.5 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Exibição informativa do Tipo de Usuário no Cadastro */}
          {isRegister && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#2f55d4]" />
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  Tipo de usuário:
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-blue-100 dark:bg-blue-950/60 text-[#2f55d4] dark:text-[#6f8cff] border border-blue-200 dark:border-blue-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2f55d4]"></span>
                <span>Auditor</span>
              </span>
            </div>
          )}

          {/* Indicador de força de senha no cadastro */}
          {isRegister && (
            <div className="space-y-1.5 pt-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className="h-1 flex-1 rounded-full transition-colors"
                    style={{
                      backgroundColor:
                        password && level <= passwordScore ? strengthColor : '#d5dbe5',
                    }}
                  />
                ))}
              </div>

              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Força da senha</span>
                <span
                  className="font-bold"
                  style={{ color: password ? strengthColor : '#94a3b8' }}
                >
                  {password ? passwordStrength : 'Mínimo 8 caracteres'}
                </span>
              </div>
            </div>
          )}

          {/* Indicação discreta na tela de login sobre identificação de perfil no servidor */}
          {!isRegister && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 flex items-start gap-2 text-[11px] text-[#5d6680] dark:text-slate-400 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-[#2f55d4] shrink-0 mt-0.5" />
              <span>
                O seu perfil de acesso (Administrador ou Auditor) será identificado automaticamente pelo servidor após a autenticação.
              </span>
            </div>
          )}

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mensagem Informativa */}
          {infoMessage && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-200"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{infoMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#2f55d4] hover:bg-[#2544ad] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer mt-2"
          >
            {loading ? (
              <span>Aguarde...</span>
            ) : isRegister ? (
              <>
                <span>Cadastrar como Auditor</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Entrar no Lumos Pro</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          Lumos Pro · Plataforma Segura com Supabase Auth
        </p>
      </div>
    </div>
  );
};
