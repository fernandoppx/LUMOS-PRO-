import React, { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import { dataRepository } from './lib/dataRepository';
import { CurrentUser } from './types/database';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { DiagnosticEditorPage } from './pages/DiagnosticEditorPage';
import { DiagnosticDashboardPage } from './pages/DiagnosticDashboardPage';
import { PublicReportPage } from './pages/PublicReportPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [currentHash, setCurrentHash] = useState(
    window.location.hash || '#/clientes'
  );

  const fetchCurrentUser = useCallback(async () => {
    try {
      const user = await dataRepository.getCurrentUser();
      setCurrentUser(user);
    } catch (_err) {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setCheckingSession(false);
        if (data.session) {
          fetchCurrentUser();
        }
      }
    }).catch(() => {
      if (mounted) setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setCheckingSession(false);
        if (newSession) {
          fetchCurrentUser();
        } else {
          setCurrentUser(null);
        }
      }
    );

    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#/clientes');
    };

    window.addEventListener('hashchange', handleHashChange);

    if (
      !window.location.hash ||
      window.location.hash === '#/' ||
      window.location.hash === '#'
    ) {
      window.location.hash = '#/clientes';
    }

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [fetchCurrentUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCurrentUser(null);
    window.location.hash = '#/clientes';
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e1320] text-white">
        Verificando acesso...
      </div>
    );
  }

  // Relatório público pode ser visualizado sem login
  if (currentHash.startsWith('#/r/')) {
    const token = currentHash.replace('#/r/', '').split('/')[0];
    return <PublicReportPage token={token} />;
  }

  // Login obrigatório para acessar o painel privado
  if (!session) {
    return (
      <LoginPage
        onSuccess={() => {
          supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            if (data.session) {
              fetchCurrentUser();
            }
          });
        }}
      />
    );
  }

  const renderCurrentView = () => {
    if (currentHash.startsWith('#/r/')) {
      const token = currentHash.replace('#/r/', '').split('/')[0];
      return <PublicReportPage token={token} />;
    }

    // Painel de Administração: Restrito exclusivamente a Administradores
    if (currentHash.startsWith('#/admin')) {
      if (currentUser?.papel === 'administrador') {
        return (
          <AdminUsersPage
            currentUser={currentUser}
            onCurrentUserUpdated={fetchCurrentUser}
          />
        );
      }

      // Se for Auditor tentando acessar via URL direta
      return (
        <div className="max-w-lg mx-auto my-16 p-8 bg-white dark:bg-[#161d2e] rounded-2xl border border-rose-200 dark:border-rose-900 shadow-md text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="font-heading text-lg font-bold text-rose-800 dark:text-rose-200 mb-2">
            Acesso Restrito
          </h2>
          <p className="text-xs text-[#5d6680] dark:text-slate-400 leading-relaxed mb-6">
            O seu perfil atual (<strong>{currentUser?.papel || 'Auditor'}</strong>) não possui permissão para acessar o painel de administração de usuários do Lumos Pro.
          </p>
          <a
            href="#/clientes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#2f55d4] text-white hover:bg-[#2544ad] transition-all shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Clientes</span>
          </a>
        </div>
      );
    }

    if (currentHash.startsWith('#/cliente/')) {
      const clientId = currentHash.replace('#/cliente/', '').split('/')[0];
      return <ClientDetailPage clientId={clientId} />;
    }

    if (currentHash.startsWith('#/editar/')) {
      const diagId = currentHash.replace('#/editar/', '').split('/')[0];
      return <DiagnosticEditorPage diagnosticId={diagId} />;
    }

    if (currentHash.startsWith('#/dash/')) {
      const parts = currentHash.replace('#/dash/', '').split('/');
      return (
        <DiagnosticDashboardPage
          diagnosticId={parts[0]}
          initialPilarSlug={parts[1]}
        />
      );
    }

    return <ClientsPage />;
  };

  return (
    <div className="min-h-screen bg-[#f3f5f9] dark:bg-[#0e1320] text-[#131a2b] dark:text-[#e8ecf5] flex flex-col font-sans transition-colors">
      <Header
        currentPath={currentHash}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main className="flex-1">
        {renderCurrentView()}
      </main>
    </div>
  );
}
