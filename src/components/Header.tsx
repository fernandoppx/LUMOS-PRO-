import React from 'react';
import { Building2, ShieldCheck, LogOut, UserCheck } from 'lucide-react';
import { CurrentUser } from '../types/database';

interface HeaderProps {
  currentPath: string;
  currentUser?: CurrentUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPath,
  currentUser,
  onLogout,
}) => {
  const isClientes =
    currentPath.startsWith('#/clientes') ||
    currentPath.startsWith('#/cliente') ||
    currentPath.startsWith('#/editar') ||
    currentPath.startsWith('#/dash') ||
    currentPath === '' ||
    currentPath === '#/';

  const isAdminPath = currentPath.startsWith('#/admin');
  const isAdministrator = currentUser?.papel === 'administrador';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#161d2e]/95 backdrop-blur-md border-b border-[#dde2ec] dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Marca e navegação */}
        <div className="flex items-center gap-6">
          <a
            href="#/clientes"
            className="flex items-center gap-2.5 font-heading text-base sm:text-lg font-bold tracking-tight text-[#131a2b] dark:text-[#e8ecf5] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            <span className="w-3 h-3 rounded-full bg-[#2f55d4] inline-block shadow-xs"></span>
            <span>LUMOS PRO</span>
          </a>

          <nav className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
            <a
              href="#/clientes"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                isClientes
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-[#2f55d4] dark:text-[#6f8cff] font-semibold'
                  : 'text-[#5d6680] dark:text-slate-400 hover:text-[#131a2b] dark:hover:text-[#e8ecf5] hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Clientes & Diagnósticos</span>
            </a>

            {/* Item Administração exibido EXCLUSIVAMENTE para o Administrador */}
            {isAdministrator && (
              <a
                href="#/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  isAdminPath
                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold'
                    : 'text-[#5d6680] dark:text-slate-400 hover:text-[#131a2b] dark:hover:text-[#e8ecf5] hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Administração</span>
              </a>
            )}
          </nav>
        </div>

        {/* Identificação do Usuário e Logout */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {currentUser && (
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex flex-col items-end text-right">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-heading font-bold text-[#131a2b] dark:text-[#e8ecf5] truncate max-w-[220px]">
                    {currentUser.nome || currentUser.email}
                  </span>
                  <span className="text-[#5d6680] dark:text-slate-500">—</span>
                  <span
                    className={`font-semibold ${
                      currentUser.papel === 'administrador'
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-[#2f55d4] dark:text-[#6f8cff]'
                    }`}
                  >
                    {currentUser.papel === 'administrador' ? 'Administrador' : 'Auditor'}
                  </span>
                </div>
                <div className="text-[11px] text-[#5d6680] dark:text-slate-400 flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      currentUser.papel === 'administrador' ? 'bg-purple-500' : 'bg-[#2f55d4]'
                    }`}
                  ></span>
                  <span>
                    {currentUser.papel === 'administrador'
                      ? 'administração completa'
                      : 'acesso aos próprios clientes'}
                  </span>
                </div>
              </div>

              {/* Tag compacta para telas mobile */}
              <div className="sm:hidden flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#131a2b] dark:text-[#e8ecf5] truncate max-w-[120px]">
                  {currentUser.nome || currentUser.email}
                </span>
                <span className="text-[11px] text-slate-400">—</span>
                {currentUser.papel === 'administrador' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Admin</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2f55d4] dark:text-[#6f8cff] text-[10px] font-bold">
                    <UserCheck className="w-3 h-3" />
                    <span>Auditor</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Botão de Logout */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Sair da conta"
              className="inline-flex items-center justify-center p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="sr-only">Sair</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
