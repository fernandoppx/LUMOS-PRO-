import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Cliente, ScoreDiagnosticoView } from '../types/database';
import { dataRepository } from '../lib/dataRepository';
import { ScoreBadge } from '../components/ScoreBadge';
import { formatDateBr, normalizeSearch } from '../utils/formatters';
import {
  Search,
  Plus,
  Building2,
  Instagram,
  MapPin,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  X,
  Trash2,
} from 'lucide-react';

interface ClientWithLatestScore extends Cliente {
  ultimoDiagnostico?: ScoreDiagnosticoView | null;
}

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<ClientWithLatestScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Client Form State
  const [formNome, setFormNome] = useState('');
  const [formInstagram, setFormInstagram] = useState('');
  const [formCidade, setFormCidade] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formSite, setFormSite] = useState('');
  const [formResponsavel, setFormResponsavel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchClientsAndScores = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await dataRepository.getClientsWithLatestScore();
      setClients(data);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Não foi possível carregar a lista de clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientsAndScores();
  }, [fetchClientsAndScores]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = normalizeSearch(searchQuery);

    return clients.filter((c) => {
      const nomeMatch = normalizeSearch(c.nome).includes(query);
      const instaMatch = normalizeSearch(c.instagram).includes(query);
      const segMatch = normalizeSearch(c.segmento).includes(query);
      const cidadeMatch = normalizeSearch(c.cidade).includes(query);
      return nomeMatch || instaMatch || segMatch || cidadeMatch;
    });
  }, [clients, searchQuery]);

  const handleDeleteClient = async (id: string, name: string) => {
    if (
      window.confirm(
        `Tem certeza que deseja excluir o cliente "${name}" e todos os seus diagnósticos? Esta ação é irreversível.`
      )
    ) {
      try {
        await dataRepository.deleteClient(id);
        await fetchClientsAndScores();
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir cliente.');
      }
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formNome.trim()) {
      setFormError('O nome do cliente é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    try {
      let cleanInsta = formInstagram.trim();
      if (cleanInsta.startsWith('@')) {
        cleanInsta = cleanInsta.substring(1);
      }

      const createdClient = await dataRepository.createClient({
        nome: formNome.trim(),
        instagram: cleanInsta || null,
        segmento: 'Splash',
        cidade: formCidade.trim() || null,
        whatsapp: formWhatsapp.trim() || null,
        site: formSite.trim() || null,
        responsavel: formResponsavel.trim() || null,
        ativo: true,
      });

      setIsModalOpen(false);
      setFormNome('');
      setFormInstagram('');
      setFormCidade('');
      setFormWhatsapp('');
      setFormSite('');
      setFormResponsavel('');

      if (createdClient?.id) {
        window.location.hash = `#/cliente/${createdClient.id}`;
      } else {
        fetchClientsAndScores();
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar cliente.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#131a2b] dark:text-[#e8ecf5] tracking-tight">
            Clientes & Diagnósticos
          </h1>
          <p className="text-xs sm:text-sm text-[#5d6680] dark:text-slate-400 mt-1">
            Gerencie diagnósticos de Instagram, Tráfego e Comercial, dashboards e exporte relatórios em PDF
          </p>
        </div>

        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-heading text-xs sm:text-sm font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad] transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar cliente por nome, @instagram, segmento ou cidade..."
          className="w-full pl-10 pr-10 py-3 text-xs sm:text-sm rounded-xl border border-[#dde2ec] dark:border-slate-800 bg-white dark:bg-[#161d2e] text-[#131a2b] dark:text-[#e8ecf5] placeholder-[#5d6680] dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4] shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#161d2e] p-5 rounded-xl border border-[#dde2ec] dark:border-slate-800 animate-pulse space-y-3"
            >
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-md w-2/3"></div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-md w-1/2"></div>
              <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-md w-full"></div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && errorMsg && (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-center max-w-lg mx-auto">
          <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto mb-2" />
          <h3 className="font-heading text-sm font-bold text-rose-800 dark:text-rose-200 mb-1">
            Erro ao carregar clientes
          </h3>
          <p className="text-xs text-rose-700 dark:text-rose-300 mb-4">{errorMsg}</p>
          <button
            onClick={fetchClientsAndScores}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar de novo</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && filteredClients.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-[#161d2e] rounded-2xl border border-[#dde2ec] dark:border-slate-800 p-8 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#2f55d4] flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-heading text-base font-bold text-[#131a2b] dark:text-[#e8ecf5] mb-1">
            {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </h3>
          <p className="text-xs text-[#5d6680] dark:text-slate-400 mb-5">
            {searchQuery
              ? `Não encontramos clientes correspondentes a "${searchQuery}".`
              : 'Cadastre o primeiro cliente para iniciar a avaliação dos 3 pilares.'}
          </p>
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Cliente</span>
            </button>
          </div>
        </div>
      )}

      {/* Populated Client Grid */}
      {!loading && !errorMsg && filteredClients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const diag = client.ultimoDiagnostico;
            return (
              <a
                key={client.id}
                href={`#/cliente/${client.id}`}
                className="group block bg-white dark:bg-[#161d2e] p-5 rounded-xl border border-[#dde2ec] dark:border-slate-800 hover:border-[#2f55d4] dark:hover:border-[#6f8cff] transition-all shadow-xs hover:shadow-md relative"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 pr-2 flex-1">
                    <h3 className="font-heading text-base font-bold text-[#131a2b] dark:text-[#e8ecf5] group-hover:text-[#2f55d4] transition-colors truncate">
                      {client.nome}
                    </h3>
                    <span className="text-xs text-[#5d6680] dark:text-slate-400 block mt-0.5 truncate">
                      {client.segmento || 'Splash'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {diag && diag.media_geral !== null ? (
                      <ScoreBadge media={diag.media_geral} faixa={diag.faixa_geral} size="sm" />
                    ) : (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        Sem diagnóstico
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteClient(client.id, client.nome);
                      }}
                      title="Excluir cliente"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Info row */}
                <div className="space-y-1.5 text-xs text-[#5d6680] dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  {client.instagram && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Instagram className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>@{client.instagram.replace('@', '')}</span>
                    </div>
                  )}

                  {client.cidade && (
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>{client.cidade}</span>
                    </div>
                  )}
                </div>

                {/* Diagnostic Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[#5d6680] dark:text-slate-500 text-[11px]">
                    {diag ? `Último: ${formatDateBr(diag.data_referencia)}` : 'Novo cliente'}
                  </span>
                  <div className="flex items-center text-[#2f55d4] dark:text-[#6f8cff] font-semibold text-xs group-hover:translate-x-1 transition-transform">
                    <span>Ver ficha</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* New Client Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#161d2e] rounded-2xl max-w-lg w-full shadow-2xl border border-[#dde2ec] dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-heading text-base font-bold text-[#131a2b] dark:text-[#e8ecf5]">
                Novo Cliente
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do cliente / unidade <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Splash Cidade"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    @ do Instagram
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs">
                      @
                    </span>
                    <input
                      type="text"
                      value={formInstagram}
                      onChange={(e) => setFormInstagram(e.target.value)}
                      placeholder="perfilcliente"
                      className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cidade / UF
                  </label>
                  <input
                    type="text"
                    value={formCidade}
                    onChange={(e) => setFormCidade(e.target.value)}
                    placeholder="Ex: São Paulo / SP"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    WhatsApp Comercial
                  </label>
                  <input
                    type="text"
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    placeholder="Ex: (11) 98765-4321"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Site ou Linktree
                  </label>
                  <input
                    type="text"
                    value={formSite}
                    onChange={(e) => setFormSite(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Responsável na Agência
                </label>
                <input
                  type="text"
                  value={formResponsavel}
                  onChange={(e) => setFormResponsavel(e.target.value)}
                  placeholder="Nome do analista"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Cadastrar e Abrir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
