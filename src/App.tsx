import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { DiagnosticEditorPage } from './pages/DiagnosticEditorPage';
import { DiagnosticDashboardPage } from './pages/DiagnosticDashboardPage';
import { PublicReportPage } from './pages/PublicReportPage';
import { AuthPage } from './pages/AuthPage';
import { AuthUser, authService } from './lib/auth';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() =>
    authService.getCurrentUser()
  );

  const [currentHash, setCurrentHash] = useState<string>(
    window.location.hash || '#/clientes'
  );

  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
      window.location.hash = '#/clientes';
    }

    const handleHashChange = () => {
      const h = window.location.hash || '#/clientes';
      setCurrentHash(h);
    };

    const handleAuthChange = () => {
      setCurrentUser(authService.getCurrentUser());
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('lumos_auth_change', handleAuthChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('lumos_auth_change', handleAuthChange);
    };
  }, []);

  // 1. PUBLIC ROUTE: #/r/:token (Public client diagnostic report, no login required)
  if (currentHash.startsWith('#/r/')) {
    const token = currentHash.replace('#/r/', '').split('?')[0].split('/')[0];
    return <PublicReportPage token={token} />;
  }

  // 2. AUTHENTICATION GATE: Require login for all internal dashboard and client pages
  if (!currentUser) {
    return <AuthPage onSuccess={() => setCurrentUser(authService.getCurrentUser())} />;
  }

  // 3. INTERNAL PROTECTED ROUTES
  const renderCurrentView = () => {
    // #/cliente/:id
    if (currentHash.startsWith('#/cliente/')) {
      const clientId = currentHash.replace('#/cliente/', '').split('/')[0];
      return <ClientDetailPage clientId={clientId} />;
    }

    // #/editar/:id
    if (currentHash.startsWith('#/editar/')) {
      const diagId = currentHash.replace('#/editar/', '').split('/')[0];
      return <DiagnosticEditorPage diagnosticId={diagId} />;
    }

    // #/dash/:id/:pilar or #/dash/:id
    if (currentHash.startsWith('#/dash/')) {
      const parts = currentHash.replace('#/dash/', '').split('/');
      const diagId = parts[0];
      const pilarSlug = parts[1];
      return <DiagnosticDashboardPage diagnosticId={diagId} initialPilarSlug={pilarSlug} />;
    }

    // Default to #/clientes
    return <ClientsPage />;
  };

  return (
    <div className="min-h-screen bg-[#f3f5f9] dark:bg-[#0e1320] text-[#131a2b] dark:text-[#e8ecf5] flex flex-col font-sans transition-colors">
      <Header
        currentPath={currentHash}
        user={currentUser}
        onLogout={() => authService.logout()}
      />
      <main className="flex-1">{renderCurrentView()}</main>
    </div>
  );
}
