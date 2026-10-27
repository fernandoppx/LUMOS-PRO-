import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { DiagnosticEditorPage } from './pages/DiagnosticEditorPage';
import { DiagnosticDashboardPage } from './pages/DiagnosticDashboardPage';
import { PublicReportPage } from './pages/PublicReportPage';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [currentHash, setCurrentHash] = useState(
    window.location.hash || '#/clientes'
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setCheckingSession(false);
      }
    }).catch(() => {
      if (mounted) setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setCheckingSession(false);
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
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    window.location.hash = '#/clientes';
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e1320] text-white">
        Verificando acesso...
      </div>
    );
  }

  // Login obrigatório para acessar o sistema
  if (!session) {
    return (
      <LoginPage
        onSuccess={() => {
          supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
          });
        }}
      />
    );
  }

  const renderCurrentView = () => {
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
      <Header currentPath={currentHash} />
      <main className="flex-1">
        {renderCurrentView()}
      </main>
    </div>
  );
}
