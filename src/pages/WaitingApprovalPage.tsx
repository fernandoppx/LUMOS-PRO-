import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';

export const WaitingApprovalPage: React.FC = () => {
  const { profile, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleCheck = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const updated = await refreshProfile();
      if (updated?.aprovado) {
        window.location.hash = '#/clientes';
      } else {
        setMessage('Seu acesso ainda não foi liberado. Fale com um administrador.');
      }
    } catch {
      setMessage('Erro ao verificar status. Tente novamente.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f3f5f9] dark:bg-[#0e1320]">
      <div className="max-w-md w-full bg-white dark:bg-[#161d2e] rounded-2xl shadow-xl border border-[#dde2ec] dark:border-slate-800 p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-[#e3a008] flex items-center justify-center border border-amber-200 dark:border-amber-900">
          <Clock className="w-7 h-7" />
        </div>

        <h2 className="font-heading text-xl font-bold text-[#131a2b] dark:text-[#e8ecf5] mb-2">
          Aguardando liberação
        </h2>

        <p className="text-sm text-[#5d6680] dark:text-slate-400 mb-6 leading-relaxed">
          Peça para um administrador liberar seu acesso no sistema LUMOS PRO.
        </p>

        {profile && (
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs mb-6 text-left">
            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
              <span className="text-slate-500">Nome:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.nome}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">E-mail:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.email}</span>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-6 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            {message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#2f55d4] hover:bg-[#2544ad] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {checking ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Já fui liberado</span>
          </button>

          <button
            type="button"
            onClick={signOut}
            className="py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
};
