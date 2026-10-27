import React from 'react';
import { Building2, User as UserIcon, LogOut } from 'lucide-react';
import { AuthUser, authService } from '../lib/auth';

interface HeaderProps {
  currentPath: string;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, user, onLogout }) => {
  const isClientes =
    currentPath.startsWith('#/clientes') ||
    currentPath.startsWith('#/cliente') ||
    currentPath.startsWith('#/editar') ||
    currentPath.startsWith('#/dash') ||
    currentPath === '' ||
    currentPath === '#/';

  const userName =
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Equipe Lumos';

  const handleLogout = async () => {
    if (window.confirm('Deseja realmente sair da sua conta?')) {
      if (onLogout) {
        onLogout();
      } else {
        await authService.logout();
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#161d2e]/95 backdrop-blur-md border-b border-[#dde2ec] dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-6">
          <a
            href="#/clientes"
            className="flex items-center gap-2.5 font-heading text-base sm:text-lg font-bold tracking-tight text-[#131a2b] dark:text-[#e8ecf5] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            <span className="w-3 h-3 rounded-full bg-[#2f55d4] inline-block shadow-xs"></span>
            <span>LUMOS PRO</span>
          </a>

          {/* Navigation Links */}
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
          </nav>
        </div>

        {/* Zone 3: Agency Tag & User Menu */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-medium">LUMOS Agency</span>
          </div>

          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-[#131a2b] dark:text-slate-200">
                <UserIcon className="w-3.5 h-3.5 text-[#2f55d4]" />
                <span className="font-semibold max-w-[120px] sm:max-w-[160px] truncate">{userName}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair da conta"
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
