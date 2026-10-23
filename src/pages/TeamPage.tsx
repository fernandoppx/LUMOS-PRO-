import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, PapelUsuario } from '../types/database';
import { useAuth } from '../context/AuthContext';
import { formatDateBr } from '../utils/formatters';
import {
  Users,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
} from 'lucide-react';

export const TeamPage: React.FC = () => {
  const { user, profile: currentAdminProfile, isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles((data as Profile[]) || []);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Não foi possível carregar a lista de membros da equipe.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
    }
  }, [isAdmin, fetchProfiles]);

  const handleToggleApproval = async (targetProfile: Profile) => {
    if (targetProfile.id === user?.id) {
      alert('Você não pode alterar o status da sua própria conta.');
      return;
    }

    const nextApproved = !targetProfile.aprovado;
    setActionLoadingId(targetProfile.id);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ aprovado: nextApproved })
        .eq('id', targetProfile.id);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => (p.id === targetProfile.id ? { ...p, aprovado: nextApproved } : p))
      );
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar permissão do usuário.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleChangePapel = async (targetProfile: Profile, newPapel: PapelUsuario) => {
    if (targetProfile.id === user?.id) {
      alert('Você não pode alterar seu próprio papel.');
      return;
    }

    setActionLoadingId(targetProfile.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ papel: newPapel })
        .eq('id', targetProfile.id);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => (p.id === targetProfile.id ? { ...p, papel: newPapel } : p))
      );
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar papel do usuário.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-[#161d2e] rounded-2xl border border-rose-200 dark:border-rose-900 text-center shadow-lg">
        <Shield className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
          Acesso Restrito
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Apenas administradores podem gerenciar e aprovar os membros da equipe.
        </p>
        <a
          href="#/clientes"
          className="inline-block px-4 py-2 rounded-xl text-xs font-semibold bg-[#2f55d4] text-white"
        >
          Voltar para Clientes
        </a>
      </div>
    );
  }

  const filtered = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.nome?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.papel?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#131a2b] dark:text-[#e8ecf5] tracking-tight">
            Gestão da Equipe
          </h1>
          <p className="text-xs sm:text-sm text-[#5d6680] dark:text-slate-400 mt-1">
            Aprove analistas e gerencie níveis de acesso no LUMOS PRO
          </p>
        </div>

        <button
          type="button"
          onClick={fetchProfiles}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-[#161d2e] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar lista</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-[#dde2ec] dark:border-slate-800 bg-white dark:bg-[#161d2e] text-[#131a2b] dark:text-[#e8ecf5] focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
        />
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="bg-white dark:bg-[#161d2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && errorMsg && (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-center max-w-md mx-auto">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <p className="text-xs text-rose-700 dark:text-rose-300 mb-4">{errorMsg}</p>
          <button
            onClick={fetchProfiles}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Table of Team Members */}
      {!loading && !errorMsg && (
        <div className="bg-white dark:bg-[#161d2e] rounded-2xl border border-[#dde2ec] dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[#5d6680] dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Membro</th>
                  <th className="py-3.5 px-4">Papel</th>
                  <th className="py-3.5 px-4">Status de Acesso</th>
                  <th className="py-3.5 px-4">Cadastrado em</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((item) => {
                  const isSelf = item.id === user?.id;
                  const isProcessing = actionLoadingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                        isSelf ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                      }`}
                    >
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                            {item.nome ? item.nome.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <div className="font-bold text-[#131a2b] dark:text-[#e8ecf5] flex items-center gap-2">
                              <span>{item.nome || 'Sem nome informado'}</span>
                              {isSelf && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#2f55d4] dark:text-[#6f8cff] font-semibold">
                                  Você
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[#5d6680] dark:text-slate-400 block font-mono">
                              {item.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Selector */}
                      <td className="py-4 px-4">
                        {isSelf ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                            <span>Administrador</span>
                          </span>
                        ) : (
                          <select
                            value={item.papel}
                            disabled={isProcessing}
                            onChange={(e) =>
                              handleChangePapel(item, e.target.value as PapelUsuario)
                            }
                            className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4] cursor-pointer"
                          >
                            <option value="analista">Analista</option>
                            <option value="admin">Administrador</option>
                          </select>
                        )}
                      </td>

                      {/* Approval Status */}
                      <td className="py-4 px-4">
                        {item.aprovado ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Liberado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Aguardando</span>
                          </span>
                        )}
                      </td>

                      {/* Created date */}
                      <td className="py-4 px-4 text-xs text-[#5d6680] dark:text-slate-400 font-mono">
                        {formatDateBr(item.created_at)}
                      </td>

                      {/* Action Button */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        {isSelf ? (
                          <span className="text-[11px] text-slate-400 italic">Conta atual</span>
                        ) : (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleToggleApproval(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                              item.aprovado
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {isProcessing
                              ? 'Salvando...'
                              : item.aprovado
                              ? 'Bloquear'
                              : 'Liberar acesso'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
