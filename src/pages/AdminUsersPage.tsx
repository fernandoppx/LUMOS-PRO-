import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminUser, LumosRole, CurrentUser } from '../types/database';
import { dataRepository } from '../lib/dataRepository';
import { formatDateBr, normalizeSearch } from '../utils/formatters';
import {
  Users,
  ShieldCheck,
  UserCheck,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRightLeft,
  Building2,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';

interface AdminUsersPageProps {
  currentUser?: CurrentUser | null;
  onCurrentUserUpdated?: () => void;
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({
  currentUser,
  onCurrentUserUpdated,
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'todos' | LumosRole>('todos');

  // Modal de Confirmação de Alteração de Perfil
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState<LumosRole>('auditor');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await dataRepository.getAdminUsers();
      setUsers(data);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Não foi possível carregar a lista de usuários.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Contagem de administradores ativos
  const adminCount = useMemo(() => {
    return users.filter((u) => u.papel === 'administrador').length;
  }, [users]);

  // Filtro de busca e papel
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === 'todos' || u.papel === roleFilter;
      if (!matchesRole) return false;

      if (!searchQuery.trim()) return true;
      const q = normalizeSearch(searchQuery);
      const nameMatch = normalizeSearch(u.nome).includes(q);
      const emailMatch = normalizeSearch(u.email).includes(q);
      return nameMatch || emailMatch;
    });
  }, [users, searchQuery, roleFilter]);

  // Abertura do modal com preparação
  const handleOpenRoleModal = (user: AdminUser) => {
    const targetRole: LumosRole = user.papel === 'administrador' ? 'auditor' : 'administrador';

    // Verificação preventiva se é o único administrador
    if (user.papel === 'administrador' && adminCount <= 1) {
      setErrorMsg(
        `Não é possível alterar o perfil de ${user.email}: ele é o único Administrador do sistema.`
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSelectedUser(user);
    setNewRole(targetRole);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleConfirmRoleChange = async () => {
    if (!selectedUser) return;

    setIsUpdating(true);
    setModalError(null);

    try {
      const res = await dataRepository.updateUserRole(selectedUser.id, newRole);

      setSuccessMsg(
        `O perfil de ${selectedUser.email} foi alterado com sucesso para ${
          newRole === 'administrador' ? 'Administrador' : 'Auditor'
        }.`
      );

      // Fecha modal e recarrega lista
      setIsModalOpen(false);
      setSelectedUser(null);
      await fetchUsers();

      // Se o usuário alterou o próprio perfil, atualiza contexto global
      if (selectedUser.id === currentUser?.id && onCurrentUserUpdated) {
        onCurrentUserUpdated();
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar o perfil do usuário.';
      setModalError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Área Exclusiva · Administrador</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-[#131a2b] dark:text-[#e8ecf5] tracking-tight">
            Gerenciamento de Usuários
          </h1>
          <p className="text-xs text-[#5d6680] dark:text-slate-400 mt-1 max-w-2xl">
            Visualize os auditores e administradores da equipe, audite a volumetria de clientes e diagnósticos cadastrados e gerencie as permissões de acesso ao sistema.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSuccessMsg(null);
            fetchUsers();
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#161d2e] border border-[#dde2ec] dark:border-slate-800 text-[#131a2b] dark:text-[#e8ecf5] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* Alertas Globais */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start justify-between gap-3 text-xs text-rose-800 dark:text-rose-200 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 hover:text-rose-800 p-0.5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-start justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 p-0.5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#161d2e] border border-[#dde2ec] dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#5d6680] dark:text-slate-400">Total Usuários</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black font-heading text-[#131a2b] dark:text-[#e8ecf5] tabular-nums">
            {users.length}
          </div>
          <span className="text-[11px] text-[#5d6680] dark:text-slate-400 mt-1 block">
            Cadastrados no Supabase
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#161d2e] border border-[#dde2ec] dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#5d6680] dark:text-slate-400">Administradores</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black font-heading text-purple-600 dark:text-purple-400 tabular-nums">
            {adminCount}
          </div>
          <span className="text-[11px] text-[#5d6680] dark:text-slate-400 mt-1 block">
            Acesso irrestrito a todos clientes
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#161d2e] border border-[#dde2ec] dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#5d6680] dark:text-slate-400">Auditores</span>
            <UserCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black font-heading text-blue-600 dark:text-blue-400 tabular-nums">
            {users.length - adminCount}
          </div>
          <span className="text-[11px] text-[#5d6680] dark:text-slate-400 mt-1 block">
            Acesso aos próprios clientes
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#161d2e] border border-[#dde2ec] dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#5d6680] dark:text-slate-400">Clientes Vinculados</span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-heading text-emerald-600 dark:text-emerald-400 tabular-nums">
            {users.reduce((acc, u) => acc + (u.clientes_count || 0), 0)}
          </div>
          <span className="text-[11px] text-[#5d6680] dark:text-slate-400 mt-1 block">
            Distribuídos na equipe
          </span>
        </div>
      </div>

      {/* Tabela de Usuários e Filtros */}
      <div className="bg-white dark:bg-[#161d2e] rounded-2xl border border-[#dde2ec] dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Barra de Filtros */}
        <div className="p-4 sm:p-5 border-b border-[#dde2ec] dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#5d6680] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-[#131a2b] dark:text-[#e8ecf5] focus:outline-none focus:ring-2 focus:ring-[#2f55d4]/40"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setRoleFilter('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                roleFilter === 'todos'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-[#5d6680] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Todos ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('administrador')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                roleFilter === 'administrador'
                  ? 'bg-purple-600 text-white'
                  : 'text-[#5d6680] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Admins ({adminCount})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('auditor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                roleFilter === 'auditor'
                  ? 'bg-[#2f55d4] text-white'
                  : 'text-[#5d6680] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Auditores ({users.length - adminCount})
            </button>
          </div>
        </div>

        {/* Listagem */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#2f55d4] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-xs text-[#5d6680] dark:text-slate-400 font-medium">
              Carregando dados dos usuários...
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#5d6680] dark:text-slate-400">
            Nenhum usuário encontrado para os critérios selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-[#5d6680] dark:text-slate-400 font-semibold border-b border-[#dde2ec] dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5">Usuário</th>
                  <th className="py-3 px-4">Perfil Atual</th>
                  <th className="py-3 px-4">Cadastro</th>
                  <th className="py-3 px-4 text-center">Clientes</th>
                  <th className="py-3 px-4 text-center">Diagnósticos</th>
                  <th className="py-3 px-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-[#131a2b] dark:text-[#e8ecf5]">
                {filteredUsers.map((user) => {
                  const isCurrentLogged = user.id === currentUser?.id;
                  const isAdmin = user.papel === 'administrador';
                  const isLastAdmin = isAdmin && adminCount <= 1;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Nome e E-mail */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isAdmin
                                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-[#2f55d4] dark:text-[#6f8cff]'
                            }`}
                          >
                            {(user.nome || user.email).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-heading font-bold text-xs sm:text-sm text-[#131a2b] dark:text-[#e8ecf5] truncate">
                                {user.nome}
                              </span>
                              {isCurrentLogged && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  Você
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#5d6680] dark:text-slate-400 block truncate">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Perfil Atual */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                            <span>Administrador</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-[#2f55d4] dark:text-[#6f8cff] border border-blue-200 dark:border-blue-800/50">
                            <UserCheck className="w-3.5 h-3.5 text-[#2f55d4]" />
                            <span>Auditor</span>
                          </span>
                        )}
                      </td>

                      {/* Data de Cadastro */}
                      <td className="py-4 px-4 whitespace-nowrap text-[#5d6680] dark:text-slate-400">
                        {formatDateBr(user.created_at)}
                      </td>

                      {/* Clientes Cadastrados */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs">
                          {user.clientes_count}
                        </span>
                      </td>

                      {/* Diagnósticos */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs">
                          {user.diagnosticos_count}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenRoleModal(user)}
                          disabled={isLastAdmin}
                          title={
                            isLastAdmin
                              ? 'Não é permitido alterar o único Administrador ativo.'
                              : `Alterar papel para ${isAdmin ? 'Auditor' : 'Administrador'}`
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
                            isLastAdmin
                              ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                              : isAdmin
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                              : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                          }`}
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>
                            {isAdmin ? 'Rebaixar para Auditor' : 'Promover a Administrador'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Mudança de Perfil */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#161d2e] rounded-2xl max-w-md w-full border border-[#dde2ec] dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    newRole === 'administrador'
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-[#131a2b] dark:text-[#e8ecf5]">
                    Confirmar Alteração de Perfil
                  </h3>
                  <span className="text-xs text-[#5d6680] dark:text-slate-400">
                    Lumos Pro · Controle de Acesso
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isUpdating) {
                    setIsModalOpen(false);
                    setSelectedUser(null);
                  }
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#5d6680] dark:text-slate-400">Usuário:</span>
                  <strong className="text-[#131a2b] dark:text-[#e8ecf5] font-semibold">{selectedUser.nome}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5d6680] dark:text-slate-400">E-mail:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-[#5d6680] dark:text-slate-400">Perfil Atual:</span>
                  <span className="capitalize font-semibold">{selectedUser.papel}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-[#5d6680] dark:text-slate-400">Novo Perfil:</span>
                  <span
                    className={`font-bold uppercase text-[11px] px-2 py-0.5 rounded-full ${
                      newRole === 'administrador'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    }`}
                  >
                    {newRole}
                  </span>
                </div>
              </div>

              {/* Explicação de impacto de permissões */}
              <div className="text-xs text-[#5d6680] dark:text-slate-400 leading-relaxed bg-amber-50/60 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                {newRole === 'administrador' ? (
                  <p>
                    ⚠️ <strong>Atenção:</strong> Ao promover este usuário a <strong>Administrador</strong>, ele passará a ter acesso total a todos os clientes, diagnósticos, avaliações do sistema e poderá gerenciar outros usuários.
                  </p>
                ) : (
                  <p>
                    ⚠️ <strong>Atenção:</strong> Ao rebaixar este usuário para <strong>Auditor</strong>, ele perderá acesso à área administrativa e poderá visualizar exclusivamente os clientes e diagnósticos que ele mesmo cadastrou.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedUser(null);
                }}
                disabled={isUpdating}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmRoleChange}
                disabled={isUpdating}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer ${
                  newRole === 'administrador'
                    ? 'bg-purple-600 hover:bg-purple-700 disabled:opacity-50'
                    : 'bg-[#2f55d4] hover:bg-[#2544ad] disabled:opacity-50'
                }`}
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Confirmar Alteração</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
