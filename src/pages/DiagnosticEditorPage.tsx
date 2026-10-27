import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cliente,
  Criterio,
  Diagnostico,
  Pilar,
  PilarSlug,
  StatusDiagnostico,
} from '../types/database';
import { dataRepository } from '../lib/dataRepository';
import { PasteSkillModal } from '../components/PasteSkillModal';
import { getRotuloPadrao } from '../utils/formatters';
import {
  ArrowLeft,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  BarChart2,
  Trash2,
  Calendar,
  Lock,
  Unlock,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface DiagnosticEditorPageProps {
  diagnosticId: string;
}

interface LocalAvaliacao {
  criterio_id: string;
  nota: number | null;
  solucao: string;
  isDirty?: boolean;
}

export const DiagnosticEditorPage: React.FC<DiagnosticEditorPageProps> = ({ diagnosticId }) => {
  const [diagnostic, setDiagnostic] = useState<Diagnostico | null>(null);
  const [client, setClient] = useState<Cliente | null>(null);
  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [activePilarId, setActivePilarId] = useState<number>(1);

  // Form State
  const [dataReferencia, setDataReferencia] = useState<string>('');
  const [resumo, setResumo] = useState<string>('');
  const [avaliacoesMap, setAvaliacoesMap] = useState<Map<string, LocalAvaliacao>>(new Map());

  // Save state
  const [saveStatus, setSaveStatus] = useState<'salvo' | 'salvando' | 'erro'>('salvo');
  const [loading, setLoading] = useState(true);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);

  // Modals & Confirmations
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Debounce ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Diagnostic via dataRepository
      const diagData = await dataRepository.getDiagnosticById(diagnosticId);

      if (!diagData) {
        console.warn('Diagnóstico não localizado');
        setLoading(false);
        return;
      }
      setDiagnostic(diagData);
      setDataReferencia(diagData.data_referencia || '');
      setResumo(diagData.resumo || '');

      // 2. Fetch Client via dataRepository
      const clientData = await dataRepository.getClientById(diagData.cliente_id);
      if (clientData) {
        setClient(clientData);
      }

      // 3. Fetch Pilares via dataRepository
      const pilaresData = await dataRepository.getPilares();
      setPilares(pilaresData);
      if (pilaresData && pilaresData.length > 0) {
        setActivePilarId(pilaresData[0].id);
      }

      // 4. Fetch Criterios via dataRepository
      const criteriosData = await dataRepository.getCriterios();
      setCriterios(criteriosData);

      // 5. Fetch Existing Avaliacoes via dataRepository
      const avaliacoesData = await dataRepository.getAvaliacoes(diagnosticId);

      const map = new Map<string, LocalAvaliacao>();
      if (avaliacoesData) {
        avaliacoesData.forEach((av) => {
          map.set(av.criterio_id, {
            criterio_id: av.criterio_id,
            nota: av.nota,
            solucao: av.solucao || '',
          });
        });
      }
      setAvaliacoesMap(map);
    } catch (err) {
      console.error('Erro ao carregar dados do diagnóstico:', err);
    } finally {
      setLoading(false);
    }
  }, [diagnosticId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Autosave function
  const triggerAutoSave = useCallback(
    async (
      updatedMap: Map<string, LocalAvaliacao>,
      updatedResumo: string,
      updatedDataRef: string
    ) => {
      setSaveStatus('salvando');
      try {
        const baseVersion = diagnostic?.updated_at || undefined;

        // Update diagnostic metadata
        const updated = await dataRepository.updateDiagnostic(
          diagnosticId,
          {
            resumo: updatedResumo,
            data_referencia: updatedDataRef,
          },
          baseVersion
        );

        if (updated) {
          setDiagnostic((prev) => (prev ? { ...prev, updated_at: updated.updated_at } : prev));
        }

        // Upsert modified evaluations
        const dirtyItems: Array<{
          criterio_id: string;
          nota: number | null;
          solucao: string | null;
        }> = [];

        updatedMap.forEach((val) => {
          if (val.isDirty) {
            dirtyItems.push({
              criterio_id: val.criterio_id,
              nota: val.nota,
              solucao: val.solucao || null,
            });
          }
        });

        if (dirtyItems.length > 0) {
          const res = await dataRepository.saveAvaliacoes(
            diagnosticId,
            dirtyItems,
            updated?.updated_at || baseVersion
          );

          if (res?.updated_at) {
            setDiagnostic((prev) => (prev ? { ...prev, updated_at: res.updated_at } : prev));
          }

          // Clear isDirty flags
          setAvaliacoesMap((prev) => {
            const next = new Map(prev);
            dirtyItems.forEach((item) => {
              const cur = next.get(item.criterio_id);
              if (cur) {
                next.set(item.criterio_id, { ...cur, isDirty: false });
              }
            });
            return next;
          });
        }

        // Confirmado pelo banco
        setSaveStatus('salvo');
      } catch (err) {
        console.error('Falha no salvamento automático:', err);
        setSaveStatus('erro');
      }
    },
    [diagnosticId, diagnostic?.updated_at]
  );

  const scheduleSave = (
    nextMap: Map<string, LocalAvaliacao>,
    nextResumo = resumo,
    nextDataRef = dataReferencia
  ) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSaveStatus('salvando');
    saveTimeoutRef.current = setTimeout(() => {
      triggerAutoSave(nextMap, nextResumo, nextDataRef);
    }, 1000);
  };

  const handleSetNota = (criterioId: string, nota: number) => {
    const nextMap = new Map(avaliacoesMap);
    const existing = nextMap.get(criterioId) || {
      criterio_id: criterioId,
      nota: null,
      solucao: '',
    };

    // Toggle off if clicking the already active note
    const nextNota = existing.nota === nota ? null : nota;

    nextMap.set(criterioId, {
      ...existing,
      nota: nextNota,
      isDirty: true,
    });

    setAvaliacoesMap(nextMap);
    scheduleSave(nextMap);
  };

  const handleSetSolucao = (criterioId: string, solucao: string) => {
    const nextMap = new Map(avaliacoesMap);
    const existing = nextMap.get(criterioId) || {
      criterio_id: criterioId,
      nota: null,
      solucao: '',
    };

    nextMap.set(criterioId, {
      ...existing,
      solucao,
      isDirty: true,
    });

    setAvaliacoesMap(nextMap);
    scheduleSave(nextMap);
  };

  const handleResumoChange = (val: string) => {
    setResumo(val);
    scheduleSave(avaliacoesMap, val, dataReferencia);
  };

  const handleDataRefChange = (val: string) => {
    setDataReferencia(val);
    scheduleSave(avaliacoesMap, resumo, val);
  };

  // Skill import applier
  const handleApplySkill = (data: {
    resumo?: string;
    avaliacoes: Array<{ criterioId: string; nota: number; solucao: string }>;
  }) => {
    const nextMap = new Map(avaliacoesMap);
    let nextResumo = resumo;

    if (!resumo && data.resumo) {
      nextResumo = data.resumo;
      setResumo(nextResumo);
    }

    data.avaliacoes.forEach((av) => {
      nextMap.set(av.criterioId, {
        criterio_id: av.criterioId,
        nota: av.nota,
        solucao: av.solucao,
        isDirty: true,
      });
    });

    setAvaliacoesMap(nextMap);
    scheduleSave(nextMap, nextResumo, dataReferencia);
  };

  // Status transitions
  const totalEvaluated = Array.from(avaliacoesMap.values()).filter(
    (a) => a.nota !== null && a.nota !== undefined
  ).length;
  const missingCount = 19 - totalEvaluated;

  const handleFinalizeClick = () => {
    if (missingCount > 0) {
      setConfirmFinalizeOpen(true);
    } else {
      executeFinalize();
    }
  };

  const executeFinalize = async () => {
    setConfirmFinalizeOpen(false);
    setSaveStatus('salvando');
    try {
      await dataRepository.updateDiagnostic(diagnosticId, {
        status: 'finalizado' as StatusDiagnostico,
      });

      setDiagnostic((prev) => (prev ? { ...prev, status: 'finalizado' } : null));
      setSaveStatus('salvo');
    } catch (err) {
      console.error(err);
      alert('Erro ao finalizar diagnóstico.');
      setSaveStatus('erro');
    }
  };

  const handleReopen = async () => {
    setSaveStatus('salvando');
    try {
      await dataRepository.updateDiagnostic(diagnosticId, {
        status: 'rascunho' as StatusDiagnostico,
      });

      setDiagnostic((prev) => (prev ? { ...prev, status: 'rascunho' } : null));
      setSaveStatus('salvo');
    } catch (err) {
      console.error(err);
      alert('Erro ao reabrir diagnóstico.');
      setSaveStatus('erro');
    }
  };

  const handleDeleteDiagnostic = async () => {
    try {
      await dataRepository.deleteDiagnostic(diagnosticId);

      if (client?.id) {
        window.location.hash = `#/cliente/${client.id}`;
      } else {
        window.location.hash = '#/clientes';
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir diagnóstico.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
        <div className="h-28 bg-white dark:bg-[#161d2e] rounded-xl border border-slate-200"></div>
        <div className="h-96 bg-white dark:bg-[#161d2e] rounded-xl border border-slate-200"></div>
      </div>
    );
  }

  if (!diagnostic || !client) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-white dark:bg-[#161d2e] text-center shadow-md">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="font-heading font-bold text-base mb-1">Diagnóstico não localizado</h3>
        <a
          href="#/clientes"
          className="inline-block mt-3 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          Voltar para Clientes
        </a>
      </div>
    );
  }

  const activePilar = pilares.find((p) => p.id === activePilarId) || pilares[0];
  const activeCriterios = criterios.filter((c) => c.pilar_id === activePilarId);

  // Pillar progress counts
  const getPilarProgress = (pilarId: number) => {
    const critIds = criterios.filter((c) => c.pilar_id === pilarId).map((c) => c.id);
    const evaluated = critIds.filter((cid) => {
      const av = avaliacoesMap.get(cid);
      return av && av.nota !== null && av.nota !== undefined;
    }).length;
    return { evaluated, total: critIds.length };
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <a
            href={`#/cliente/${client.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5d6680] dark:text-slate-400 hover:text-[#2f55d4] dark:hover:text-[#6f8cff] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ficha de {client.nome}</span>
          </a>

          <span className="text-slate-300 dark:text-slate-700">·</span>

          {/* Autosave Indicator */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {saveStatus === 'salvando' && (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                Salvando…
              </span>
            )}
            {saveStatus === 'salvo' && (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Salvo
              </span>
            )}
            {saveStatus === 'erro' && (
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Erro ao salvar
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsSkillModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[#2f55d4] dark:text-[#6f8cff] border border-blue-200 dark:border-blue-900 transition-colors cursor-pointer"
            title="Importe os dados do Claude de uma só vez"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Colar resultado da skill</span>
          </button>

          <a
            href={`#/dash/${diagnosticId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#2f55d4] hover:bg-[#2544ad] text-white transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Ver Dashboard</span>
          </a>

          {diagnostic.status === 'rascunho' ? (
            <button
              type="button"
              onClick={handleFinalizeClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Finalizar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReopen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Reabrir</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            title="Excluir diagnóstico"
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Diagnostic Metadata Header Card */}
      <div className="bg-white dark:bg-[#161d2e] p-5 sm:p-6 rounded-2xl border border-[#dde2ec] dark:border-slate-800 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="font-heading text-lg sm:text-xl font-black text-[#131a2b] dark:text-[#e8ecf5]">
              Avaliação de {client.nome}
            </h1>
            <p className="text-xs text-[#5d6680] dark:text-slate-400 mt-0.5">
              Preencha nota (1 a 3) e a recomendação/solução de cada tópico
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <Calendar className="w-4 h-4 text-slate-400" />
              <label className="text-xs text-slate-500">Data:</label>
              <input
                type="date"
                value={dataReferencia}
                onChange={(e) => handleDataRefChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="pt-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Progresso Geral
            </span>
            <span className="font-mono font-bold text-[#2f55d4] dark:text-[#6f8cff]">
              {totalEvaluated} de 19 tópicos avaliados
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2f55d4] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(totalEvaluated / 19) * 100}%` }}
            />
          </div>
        </div>

        {/* General Summary Textarea */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Resumo Geral do Diagnóstico
          </label>
          <textarea
            value={resumo}
            onChange={(e) => handleResumoChange(e.target.value)}
            rows={2}
            placeholder="Visão geral executiva da situação atual da empresa nos 3 pilares..."
            className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
          />
        </div>
      </div>

      {/* Pillar Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
        {pilares.map((p) => {
          const prog = getPilarProgress(p.id);
          const isActive = p.id === activePilarId;
          const isComplete = prog.evaluated === prog.total;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePilarId(p.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-heading text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#2f55d4] text-white shadow-md'
                  : 'bg-white dark:bg-[#161d2e] text-slate-700 dark:text-slate-300 border border-[#dde2ec] dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <span>{p.nome}</span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : isComplete
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {prog.evaluated}/{prog.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Evaluator notice for active pillar */}
      {activePilar && (
        <div className="mb-4 flex items-center justify-between text-xs text-[#5d6680] dark:text-slate-400 px-1">
          <div>
            <span>Avaliador responsável: </span>
            <strong className="text-slate-800 dark:text-slate-200">{activePilar.avaliador}</strong>
          </div>
          <span>
            {activeCriterios.length} tópicos neste pilar
          </span>
        </div>
      )}

      {/* Criteria Items List */}
      <div className="space-y-4">
        {activeCriterios.map((criterio) => {
          const avaliacao = avaliacoesMap.get(criterio.id) || {
            criterio_id: criterio.id,
            nota: null,
            solucao: '',
          };

          const currentNota = avaliacao.nota;
          const slug = activePilar?.slug || 'instagram';

          const rotulo1 = activePilar?.rotulo_1 || getRotuloPadrao(slug, 1);
          const rotulo2 = activePilar?.rotulo_2 || getRotuloPadrao(slug, 2);
          const rotulo3 = activePilar?.rotulo_3 || getRotuloPadrao(slug, 3);

          return (
            <div
              key={criterio.id}
              className={`bg-white dark:bg-[#161d2e] p-5 sm:p-6 rounded-2xl border transition-all ${
                currentNota !== null
                  ? 'border-slate-200 dark:border-slate-800 shadow-xs'
                  : 'border-dashed border-slate-300 dark:border-slate-700/80 bg-slate-50/40 dark:bg-[#161d2e]/40'
              }`}
            >
              {/* Item Title & Description */}
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                    {criterio.ordem}
                  </span>
                  <h3 className="font-heading text-sm sm:text-base font-bold text-[#131a2b] dark:text-[#e8ecf5]">
                    {criterio.nome}
                  </h3>
                </div>
                {criterio.descricao && (
                  <p className="text-xs text-[#5d6680] dark:text-slate-400 mt-1 pl-7">
                    {criterio.descricao}
                  </p>
                )}
              </div>

              {/* 3 Large Rating Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {/* Nota 1 */}
                <button
                  type="button"
                  onClick={() => handleSetNota(criterio.id, 1)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    currentNota === 1
                      ? 'bg-rose-50 dark:bg-rose-950/50 border-[#d64545] ring-2 ring-[#d64545]'
                      : 'border-slate-200 dark:border-slate-700/80 hover:border-rose-300 dark:hover:border-rose-800 bg-white dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-heading font-black text-sm text-[#d64545]">
                      1 · {rotulo1}
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        currentNota === 1
                          ? 'border-[#d64545] bg-[#d64545] text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {currentNota === 1 && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                    {criterio.guia_1}
                  </p>
                </button>

                {/* Nota 2 */}
                <button
                  type="button"
                  onClick={() => handleSetNota(criterio.id, 2)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    currentNota === 2
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-[#e3a008] ring-2 ring-[#e3a008]'
                      : 'border-slate-200 dark:border-slate-700/80 hover:border-amber-300 dark:hover:border-amber-800 bg-white dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-heading font-black text-sm text-[#e3a008]">
                      2 · {rotulo2}
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        currentNota === 2
                          ? 'border-[#e3a008] bg-[#e3a008] text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {currentNota === 2 && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                    {criterio.guia_2}
                  </p>
                </button>

                {/* Nota 3 */}
                <button
                  type="button"
                  onClick={() => handleSetNota(criterio.id, 3)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    currentNota === 3
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-[#2e9e5b] ring-2 ring-[#2e9e5b]'
                      : 'border-slate-200 dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-800 bg-white dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-heading font-black text-sm text-[#2e9e5b]">
                      3 · {rotulo3}
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        currentNota === 3
                          ? 'border-[#2e9e5b] bg-[#2e9e5b] text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {currentNota === 3 && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                    {criterio.guia_3}
                  </p>
                </button>
              </div>

              {/* Solution Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Solução recomendada
                </label>
                <textarea
                  value={avaliacao.solucao}
                  onChange={(e) => handleSetSolucao(criterio.id, e.target.value)}
                  rows={2}
                  placeholder="Escreva a orientação prática e recomendação da agência para este ponto..."
                  className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal: Finalize with missing topics */}
      {confirmFinalizeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#161d2e] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 dark:border-amber-900">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-heading text-center text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Finalizar diagnóstico?
            </h3>
            <p className="text-xs text-center text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              Faltam <strong>{missingCount}</strong> tópicos para serem avaliados. Deseja finalizar assim mesmo?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmFinalizeOpen(false)}
                className="flex-1 py-2 px-3 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Voltar e preencher
              </button>
              <button
                type="button"
                onClick={executeFinalize}
                className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Finalizar assim mesmo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete diagnostic */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#161d2e] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 dark:border-rose-900">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-heading text-center text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Excluir diagnóstico?
            </h3>
            <p className="text-xs text-center text-slate-600 dark:text-slate-400 mb-5">
              Esta ação removerá permanentemente as avaliações deste diagnóstico.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="flex-1 py-2 px-3 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteDiagnostic}
                className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Skill Modal */}
      <PasteSkillModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        pilares={pilares}
        criterios={criterios}
        onApply={handleApplySkill}
      />
    </div>
  );
};
