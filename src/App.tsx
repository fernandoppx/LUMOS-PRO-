import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { DiagnosticEditorPage } from './pages/DiagnosticEditorPage';
import { DiagnosticDashboardPage } from './pages/DiagnosticDashboardPage';
import { PublicReportPage } from './pages/PublicReportPage';

export default function App() {
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

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 1. PUBLIC ROUTE: #/r/:token (No header, public client view)
  if (currentHash.startsWith('#/r/')) {
    const token = currentHash.replace('#/r/', '').split('?')[0].split('/')[0];
    return <PublicReportPage token={token} />;
  }

  // 2. INTERNAL ROUTES
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
      <Header currentPath={currentHash} />
      <main className="flex-1">{renderCurrentView()}</main>
    </div>
  );
}
