import React, { useState, useEffect, useCallback } from 'react';
import { Cliente, ScoreDiagnosticoView } from '../types/database';
import { dataRepository } from '../lib/dataRepository';
import { ScoreBadge } from '../components/ScoreBadge';
import { EvolutionLineChart } from '../components/EvolutionLineChart';
import { formatDateBr, formatNumberBr } from '../utils/formatters';
import {
  ArrowLeft,
  Plus,
  Edit2,
  FileText,
  BarChart2,
  Instagram,
  MapPin,
  Phone,
  Globe,
  User,
  AlertTriangle,
  RefreshCw,
  X,
  Calendar,
  Layers,
  Trash2,
} from 'lucide-react';

interface ClientDetailPageProps {
  clientId: string;
}

export const ClientDetailPage: React.FC<ClientDetailPageProps> = ({ clientId }) => {
  const [client, setClient] = useState<Cliente | null>(null);
  const [diagnostics, setDiagnostics] = useState<ScoreDiagnosticoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit Client Modal State
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editCidade, setEditCidade] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editSite, setEditSite] = useState('');
  const [editResponsavel, setEditResponsavel] = useState('');
  const [savingClient, setSavingClient] = useState(false);

  // New Diagnostic State
  const [creatingDiag, setCreatingDiag] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);

  const fetchClientData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const clientData = await dataRepository.getClientById(clientId);
      if (!clientData) {
        setErrorMsg('Cliente não localizado.');
        return;
      }
      setClient(clientData);

      setEditNome(clientData.nome || '');
      setEditInstagram(clientData.instagram || '');
      setEditCidade(clientData.cidade || '');
      setEditWhatsapp(clientData.whatsapp || '');
      setEditSite(clientData.site || '');
      setEditResponsavel(clientData.responsavel || '');

      const diagScoresList = await dataRepository.getDiagnosticScoresByClient(clientId);
      setDiagnostics(diagScoresList);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Erro ao carregar dados do cliente.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNome.trim()) return;

    setSavingClient(true);
    try {
      let cleanInsta = editInstagram.trim();
      if (cleanInsta.startsWith('@')) cleanInsta = cleanInsta.substring(1);

      const updated = await dataRepository.updateClient(clientId, {
        nome: editNome.trim(),
        instagram: cleanInsta || null,
        segmento: 'Splash',
        cidade: editCidade.trim() || null,
        whatsapp: editWhatsapp.trim() || null,
        site: editSite.trim() || null,
        responsavel: editResponsavel.trim() || null,
      });

      setClient(updated);
      setIsEditingClient(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar dados do cliente.');
    } finally {
      setSavingClient(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    if (
      window.confirm(
        `Tem certeza que deseja excluir permanentemente o cliente "${client.nome}" e todo o histórico de diagnósticos? Esta ação não pode ser desfeita.`
      )
    ) {
      try {
        setDeletingClient(true);
        await dataRepository.deleteClient(client.id);
        window.location.hash = '#/clientes';
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir cliente.');
        setDeletingClient(false);
      }
    }
  };

  const handleCreateDiagnostic = async () => {
    setCreatingDiag(true);
    try {
      const newDiag = await dataRepository.createDiagnostic(clientId);
      window.location.hash = `#/editar/${newDiag.id}`;
    } catch (err) {
      console.error(err);
      alert('Erro ao criar novo diagnóstico.');
      setCreatingDiag(false);
    }
  };

  const handleDeleteDiagnostic = async (diagId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este diagnóstico? Esta ação não pode ser desfeita.')) {
      try {
        await dataRepository.deleteDiagnostic(diagId);
        fetchClientData();
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir diagnóstico.');
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="h-40 bg-white dark:bg-[#161d2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6"></div>
          <div className="h-60 bg-white dark:bg-[#161d2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6"></div>
        </div>
      </div>
    );
  }

  if (errorMsg || !client) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 bg-white dark:bg-[#161d2e] rounded-2xl border border-rose-200 dark:border-rose-900 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <h2 className="font-heading text-lg font-bold text-rose-800 dark:text-rose-200 mb-1">
          Não foi possível carregar a ficha
        </h2>
        <p className="text-xs text-rose-700 dark:text-rose-300 mb-4">{errorMsg}</p>
        <a
          href="#/clientes"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#2f55d4] text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para Clientes</span>
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Back button */}
      <div>
        <a
          href="#/clientes"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#5d6680] dark:text-slate-400 hover:text-[#2f55d4] dark:hover:text-[#6f8cff] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para a lista de clientes</span>
        </a>
      </div>

      {/* Client Header Card */}
      <div className="bg-white dark:bg-[#161d2e] rounded-2xl border border-[#dde2ec] dark:border-slate-800 p-6 shadow-xs relative">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#131a2b] dark:text-[#e8ecf5] tracking-tight">
                {client.nome}
              </h1>
              <button
                type="button"
                onClick={() => setIsEditingClient(true)}
                title="Editar informações do cliente"
                className="p-1.5 text-slate-400 hover:text-[#2f55d4] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            {client.segmento && (
              <span className="inline-block mt-1 text-xs font-medium text-[#2f55d4] dark:text-[#6f8cff] bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full">
                {client.segmento}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={deletingClient}
              onClick={handleDeleteClient}
              title="Excluir este cliente e todo o histórico"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-heading text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{deletingClient ? 'Excluindo...' : 'Excluir Cliente'}</span>
            </button>

            <button
              type="button"
              disabled={creatingDiag}
              onClick={handleCreateDiagnostic}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-heading text-xs sm:text-sm font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad] transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{creatingDiag ? 'Criando...' : 'Novo Diagnóstico'}</span>
            </button>
          </div>
        </div>

        {/* Client Meta Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
              Instagram
            </span>
            {client.instagram ? (
              <a
                href={`https://instagram.com/${client.instagram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#2f55d4] dark:text-[#6f8cff] hover:underline flex items-center gap-1.5"
              >
                <Instagram className="w-3.5 h-3.5" />
                <span>@{client.instagram.replace('@', '')}</span>
              </a>
            ) : (
              <span className="text-slate-400">Não informado</span>
            )}
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
              Cidade / Localização
            </span>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{client.cidade || 'Não informada'}</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
              WhatsApp
            </span>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{client.whatsapp || 'Não informado'}</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
              Responsável Lumos
            </span>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{client.responsavel || 'Equipe Geral'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Evolution Chart (Displayed when >= 2 diagnostics exist) */}
      {diagnostics.length >= 2 && (
        <div className="bg-white dark:bg-[#161d2e] rounded-2xl border border-[#dde2ec] dark:border-slate-800 p-6 shadow-xs">
          <div className="mb-4">
            <h2 className="font-heading text-base font-bold text-[#131a2b] dark:text-[#e8ecf5]">
              Evolução da Nota Geral
            </h2>
            <p className="text-xs text-[#5d6680] dark:text-slate-400">
              Acompanhamento histórico da maturidade do cliente nos diagnósticos realizados
            </p>
          </div>
          <div className="h-auto">
            <EvolutionLineChart
              points={diagnostics.map((d) => ({
                id: d.diagnostico_id,
                data_referencia: d.data_referencia,
                media_geral: d.media_geral,
                status: d.status,
              }))}
            />
          </div>
        </div>
      )}

      {/* Diagnostics List */}
      <div className="bg-white dark:bg-[#161d2e] rounded-2xl border border-[#dde2ec] dark:border-slate-800 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-base font-bold text-[#131a2b] dark:text-[#e8ecf5]">
              Diagnósticos Realizados ({diagnostics.length})
            </h2>
            <p className="text-xs text-[#5d6680] dark:text-slate-400">
              Histórico de auditorias por pilar e notas consolidadas
            </p>
          </div>
        </div>

        {diagnostics.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500 mb-3">Nenhum diagnóstico realizado ainda.</p>
            <button
              onClick={handleCreateDiagnostic}
              disabled={creatingDiag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Fazer Primeiro Diagnóstico</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {diagnostics.map((diag) => (
              <div
                key={diag.diagnostico_id}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Info & Date */}
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#2f55d4] shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-sm font-bold text-[#131a2b] dark:text-[#e8ecf5]">
                        {formatDateBr(diag.data_referencia)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          diag.status === 'finalizado'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {diag.status === 'finalizado' ? 'Finalizado' : 'Rascunho'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {diag.avaliados} de {diag.total_criterios} tópicos avaliados
                    </span>
                  </div>
                </div>

                {/* Scores breakdown: Instagram, Tráfego, Comercial, Geral */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">Insta:</span>
                    <span className="font-bold tabular-nums font-mono text-slate-800 dark:text-slate-200">
                      {formatNumberBr(diag.media_instagram)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">Tráfego:</span>
                    <span className="font-bold tabular-nums font-mono text-slate-800 dark:text-slate-200">
                      {formatNumberBr(diag.media_trafego)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">Comercial:</span>
                    <span className="font-bold tabular-nums font-mono text-slate-800 dark:text-slate-200">
                      {formatNumberBr(diag.media_comercial)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                    <ScoreBadge media={diag.media_geral} faixa={diag.faixa_geral} size="sm" />
                  </div>
                </div>

                {/* Actions: Notas, Dashboard, Excluir */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  <a
                    href={`#/editar/${diag.diagnostico_id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Notas</span>
                  </a>

                  <a
                    href={`#/dash/${diag.diagnostico_id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad] transition-colors"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDeleteDiagnostic(diag.diagnostico_id)}
                    title="Excluir diagnóstico"
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Client Modal */}
      {isEditingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#161d2e] rounded-2xl max-w-lg w-full shadow-2xl border border-[#dde2ec] dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-heading text-base font-bold text-[#131a2b] dark:text-[#e8ecf5]">
                Editar Dados do Cliente
              </h3>
              <button
                onClick={() => setIsEditingClient(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateClient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do cliente / empresa *
                </label>
                <input
                  type="text"
                  required
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    @ do Instagram
                  </label>
                  <input
                    type="text"
                    value={editInstagram}
                    onChange={(e) => setEditInstagram(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cidade / UF
                  </label>
                  <input
                    type="text"
                    value={editCidade}
                    onChange={(e) => setEditCidade(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
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
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Site ou Linktree
                  </label>
                  <input
                    type="text"
                    value={editSite}
                    onChange={(e) => setEditSite(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Responsável na Agência
                </label>
                <input
                  type="text"
                  value={editResponsavel}
                  onChange={(e) => setEditResponsavel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingClient(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingClient}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingClient ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
