import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Cliente,
  Criterio,
  Diagnostico,
  Pilar,
  PilarSlug,
  ScoreDiagnosticoView,
  ScorePilarView,
} from '../types/database';
import { dataRepository } from '../lib/dataRepository';
import { ScoreBadge } from '../components/ScoreBadge';
import { PilarBarChart } from '../components/PilarBarChart';
import { PilarPieChart } from '../components/PilarPieChart';
import { exportElementToPdf } from '../utils/pdfGenerator';
import {
  formatDateBr,
  formatNumberBr,
  formatPercentBr,
  getColorForFaixa,
  getColorForNota,
  getFaixaFromMedia,
  getRotuloPadrao,
} from '../utils/formatters';
import {
  ArrowLeft,
  FileDown,
  Share2,
  Copy,
  ExternalLink,
  RefreshCw,
  Check,
  Edit3,
  AlertTriangle,
  ChevronRight,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface DiagnosticDashboardPageProps {
  diagnosticId: string;
  initialPilarSlug?: string;
  canExportPdf?: boolean;
}

interface LocalEvaluation {
  criterio_id: string;
  nota: number | null;
  solucao?: string | null;
}

export const DiagnosticDashboardPage: React.FC<DiagnosticDashboardPageProps> = ({
  diagnosticId,
  initialPilarSlug,
  canExportPdf = false,
}) => {
  const [diagnostic, setDiagnostic] = useState<Diagnostico | null>(null);
  const [client, setClient] = useState<Cliente | null>(null);
  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<LocalEvaluation[]>([]);
  const [scoreDiag, setScoreDiag] = useState<ScoreDiagnosticoView | null>(null);
  const [scoresPilar, setScoresPilar] = useState<ScorePilarView[]>([]);

  const [activePilarSlug, setActivePilarSlug] = useState<PilarSlug>(
    (initialPilarSlug as PilarSlug) || 'instagram'
  );
  const [hoveredTopicIndex, setHoveredTopicIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [updatingShare, setUpdatingShare] = useState(false);

  const fetchDashboardData = useCallback(async () => {
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

      // 2. Fetch Client via dataRepository
      const clientData = await dataRepository.getClientById(diagData.cliente_id);
      if (clientData) {
        setClient(clientData);
      }

      // 3. Fetch Pilares via dataRepository
      const pilaresData = await dataRepository.getPilares();
      setPilares(pilaresData);

      // 4. Fetch Criterios via dataRepository
      const criteriosData = await dataRepository.getCriterios();
      setCriterios(criteriosData);

      // 5. Fetch Avaliacoes via dataRepository
      const avaliacoesData = await dataRepository.getAvaliacoes(diagnosticId);
      setAvaliacoes((avaliacoesData as LocalEvaluation[]) || []);

      // 6. Fetch computed scores via dataRepository
      const { diagScore: computedDiag, pilaresScore: computedPilares } =
        await dataRepository.getDiagnosticScores(diagnosticId);

      if (computedDiag) {
        setScoreDiag(computedDiag);
      }
      if (computedPilares && computedPilares.length > 0) {
        setScoresPilar(computedPilares);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [diagnosticId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Compute pillar stats from avaliacoes and criterios as fallback if views are empty
  const computedScores = useMemo(() => {
    const pilarList = pilares.map((p) => {
      const pCrit = criterios.filter((c) => c.pilar_id === p.id);
      const critIds = new Set(pCrit.map((c) => c.id));
      const evals = avaliacoes.filter(
        (a) => critIds.has(a.criterio_id) && a.nota !== null && a.nota !== undefined
      );

      const avaliados = evals.length;
      const total_criterios = pCrit.length;
      const sum = evals.reduce((acc, curr) => acc + (curr.nota || 0), 0);
      const media = avaliados > 0 ? sum / avaliados : null;
      const percentual = media !== null ? ((media - 1) / 2) * 100 : null;
      const faixa = getFaixaFromMedia(media);

      return {
        slug: p.slug,
        nome: p.nome,
        avaliador: p.avaliador,
        ordem: p.ordem,
        total_criterios,
        avaliados,
        media,
        percentual,
        faixa,
      };
    });

    const validMedias = pilarList
      .map((p) => p.media)
      .filter((m): m is number => m !== null && !isNaN(m));

    const mediaGeral =
      validMedias.length > 0
        ? validMedias.reduce((a, b) => a + b, 0) / validMedias.length
        : null;

    const percentualGeral = mediaGeral !== null ? ((mediaGeral - 1) / 2) * 100 : null;
    const faixaGeral = getFaixaFromMedia(mediaGeral);
    const totalAvaliados = avaliacoes.filter((a) => a.nota !== null).length;

    return {
      mediaGeral: scoreDiag?.media_geral ?? mediaGeral,
      faixaGeral: scoreDiag?.faixa_geral ?? faixaGeral,
      percentualGeral: scoreDiag?.percentual_geral ?? percentualGeral,
      totalAvaliados: scoreDiag?.avaliados ?? totalAvaliados,
      pilares: pilarList,
    };
  }, [pilares, criterios, avaliacoes, scoreDiag]);

  // Share Token Link Helpers
  const shareUrl = useMemo(() => {
    if (!diagnostic?.share_token) return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}#/r/${diagnostic.share_token}`;
  }, [diagnostic?.share_token]);

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleToggleShare = async (activate: boolean) => {
    setUpdatingShare(true);
    try {
      await dataRepository.updateDiagnostic(diagnosticId, {
        compartilhado: activate,
      });

      setDiagnostic((prev) => (prev ? { ...prev, compartilhado: activate } : null));
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar compartilhamento.');
    } finally {
      setUpdatingShare(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (
      !confirm(
        'Tem certeza que deseja trocar o link? O link anterior deixará de funcionar imediatamente.'
      )
    ) {
      return;
    }

    setUpdatingShare(true);
    try {
      const newToken = crypto.randomUUID();
      await dataRepository.updateDiagnostic(diagnosticId, {
        share_token: newToken,
        compartilhado: true,
      });

      setDiagnostic((prev) => (prev ? { ...prev, share_token: newToken, compartilhado: true } : null));
    } catch (err) {
      console.error(err);
      alert('Erro ao renovar token de compartilhamento.');
    } finally {
      setUpdatingShare(false);
    }
  };

  // PDF Generation
  const handleGeneratePdf = async () => {
    if (!client || !diagnostic || !canExportPdf) return;
    setGeneratingPdf(true);
    try {
      const safeClient = client.nome.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeDate = diagnostic.data_referencia || 'diagnostico';
      const filename = `LUMOS-PRO_${safeClient}_${safeDate}.pdf`;
      await exportElementToPdf('printable-pdf-document', filename);
    } catch (err) {
      console.error('Falha ao gerar PDF:', err);
      alert('Não foi possível gerar o PDF. Verifique se o navegador bloqueou popups ou downloads.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-6">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
        <div className="h-44 bg-white dark:bg-[#161d2e] rounded-xl border border-slate-200"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-64 bg-white dark:bg-[#161d2e] rounded-xl border"></div>
          <div className="h-64 bg-white dark:bg-[#161d2e] rounded-xl border"></div>
          <div className="h-64 bg-white dark:bg-[#161d2e] rounded-xl border"></div>
        </div>
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

  const activePilarObj = pilares.find((p) => p.slug === activePilarSlug) || pilares[0];
  const activePilarCriteria = criterios
    .filter((c) => c.pilar_id === activePilarObj?.id)
    .sort((a, b) => a.ordem - b.ordem);

  const activePilarScoreItem = computedScores.pilares.find((p) => p.slug === activePilarSlug);

  const pieTopics = activePilarCriteria.map((c) => {
    const av = avaliacoes.find((a) => a.criterio_id === c.id);
    const nota = av?.nota ?? null;
    const rotulo = nota ? getRotuloPadrao(activePilarSlug, nota) : 'Sem nota';
    return {
      ordem: c.ordem,
      nome: c.nome,
      nota,
      rotulo,
      solucao: av?.solucao || '',
    };
  });

  // Calculate needle position on 3-color ruler (1.0 to 3.0 scale)
  const scoreVal = computedScores.mediaGeral ?? 1.0;
  const needlePercent = Math.max(0, Math.min(100, ((scoreVal - 1.0) / 2.0) * 100));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Top Breadcrumb & Actions */}
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
          <span className="text-xs text-[#5d6680] dark:text-slate-400">
            {formatDateBr(diagnostic.data_referencia)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`#/editar/${diagnosticId}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar Notas</span>
          </a>

          {canExportPdf && (
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-heading text-xs sm:text-sm font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad] transition-all shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" />
            <span>{generatingPdf ? 'Gerando PDF...' : 'Gerar PDF'}</span>
          </button>
          )}
        </div>
      </div>

      {/* Main Grid: General Score Card & Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Card: Nota Geral LUMOS (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#161d2e] p-6 rounded-2xl border border-[#dde2ec] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#5d6680] dark:text-slate-400 block mb-0.5">
                  Diagnóstico LUMOS PRO
                </span>
                <h1 className="font-heading text-lg sm:text-xl font-black text-[#131a2b] dark:text-[#e8ecf5]">
                  {client.nome}
                </h1>
              </div>

              <ScoreBadge
                media={computedScores.mediaGeral}
                faixa={computedScores.faixaGeral}
                size="md"
              />
            </div>

            {/* Big Score Callout */}
            <div className="my-5 flex items-baseline gap-2">
              <span
                className="font-heading text-5xl sm:text-6xl font-black tabular-nums tracking-tight"
                style={{ color: getColorForFaixa(computedScores.faixaGeral) }}
              >
                {formatNumberBr(computedScores.mediaGeral)}
              </span>
              <span className="text-xl sm:text-2xl text-slate-400 dark:text-slate-500 font-heading font-medium">
                / 3,00
              </span>
            </div>

            {/* Metadata strip: percentage and evaluated count */}
            <div className="flex items-center gap-3 text-xs text-[#5d6680] dark:text-slate-400 mb-5">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Aproveitamento: {formatPercentBr(computedScores.percentualGeral)}
              </span>
              <span>·</span>
              <span className="font-mono">
                {computedScores.totalAvaliados} de 19 tópicos avaliados
              </span>
            </div>

            {/* 3-Color Ruler with indicator */}
            <div className="space-y-1.5 mb-6">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>1 · Ruim</span>
                <span>2 · Requer melhorias</span>
                <span>3 · Muito bom</span>
              </div>

              <div className="relative h-3 w-full rounded-full overflow-hidden flex">
                <div className="h-full w-1/3 bg-[#d64545]" title="Crítico (< 1,67)" />
                <div className="h-full w-1/3 bg-[#e3a008]" title="Atenção (1,67 a 2,33)" />
                <div className="h-full w-1/3 bg-[#2e9e5b]" title="Bom (> 2,33)" />

                {/* Needle Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white ring-2 ring-slate-900 shadow-md transition-all duration-500 ease-out"
                  style={{ left: `${needlePercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Diagnostic Summary */}
          {diagnostic.resumo && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Resumo Geral:
              </span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed italic">
                "{diagnostic.resumo}"
              </p>
            </div>
          )}
        </div>

        {/* Bar Chart: Nota por Pilar (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col">
          <PilarBarChart
            pilares={computedScores.pilares}
            selectedSlug={activePilarSlug}
            onSelectPilar={(slug) => setActivePilarSlug(slug)}
          />
        </div>
      </div>

      {/* 3 Pillars Summary Cards Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {computedScores.pilares.map((p) => {
          const isActive = p.slug === activePilarSlug;
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => setActivePilarSlug(p.slug)}
              className={`p-5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-blue-50/50 dark:bg-blue-950/30 border-[#2f55d4] ring-2 ring-[#2f55d4]'
                  : 'bg-white dark:bg-[#161d2e] border-[#dde2ec] dark:border-slate-800 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-heading text-sm font-bold text-[#131a2b] dark:text-[#e8ecf5]">
                    {p.nome}
                  </h3>
                  <ScoreBadge media={p.media} faixa={p.faixa} size="sm" showMedia={false} />
                </div>
                <div className="text-2xl font-black font-heading tabular-nums my-1" style={{ color: getColorForFaixa(p.faixa) }}>
                  {formatNumberBr(p.media)}
                </div>
                <p className="text-xs text-[#5d6680] dark:text-slate-400">
                  Avaliador: {p.avaliador}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[#5d6680] dark:text-slate-500 font-mono">
                  {p.avaliados}/{p.total_criterios} tópicos
                </span>
                <span className="text-[#2f55d4] dark:text-[#6f8cff] font-semibold flex items-center gap-0.5">
                  <span>Ver tópicos</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Pilar Detail Section: Pie Chart + Criteria Topics List */}
      <div className="bg-white dark:bg-[#161d2e] p-6 sm:p-8 rounded-2xl border border-[#dde2ec] dark:border-slate-800 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-lg sm:text-xl font-black text-[#131a2b] dark:text-[#e8ecf5]">
                Pilar: {activePilarObj?.nome}
              </h2>
              {activePilarScoreItem && (
                <ScoreBadge
                  media={activePilarScoreItem.media}
                  faixa={activePilarScoreItem.faixa}
                  size="sm"
                />
              )}
            </div>
            <p className="text-xs text-[#5d6680] dark:text-slate-400 mt-1">
              Avaliador responsável: <strong>{activePilarObj?.avaliador}</strong> ·{' '}
              {pieTopics.length} tópicos analisados
            </p>
          </div>

          <div className="flex items-center gap-2">
            {pilares.map((pil) => (
              <button
                key={pil.slug}
                type="button"
                onClick={() => setActivePilarSlug(pil.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  pil.slug === activePilarSlug
                    ? 'bg-[#2f55d4] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {pil.nome}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Split: Pie Chart with Legend on left, Topics List with Solutions on right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Pie Chart (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80">
            <PilarPieChart
              topics={pieTopics}
              rotulo1={activePilarObj?.rotulo_1}
              rotulo2={activePilarObj?.rotulo_2}
              rotulo3={activePilarObj?.rotulo_3}
              activeTopicIndex={hoveredTopicIndex}
              onTopicHover={(idx) => setHoveredTopicIndex(idx)}
            />
          </div>

          {/* Right Column: Topics List with Solutions (7 cols) */}
          <div className="lg:col-span-7 space-y-3.5">
            {pieTopics.map((item, index) => {
              const isHovered = hoveredTopicIndex === index;
              const color = getColorForNota(item.nota);

              return (
                <div
                  key={item.ordem}
                  onMouseEnter={() => setHoveredTopicIndex(index)}
                  onMouseLeave={() => setHoveredTopicIndex(null)}
                  className={`p-4 rounded-xl border transition-all ${
                    isHovered
                      ? 'border-[#2f55d4] ring-1 ring-[#2f55d4] bg-blue-50/20 dark:bg-blue-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                        {item.ordem}
                      </span>
                      <h4 className="font-heading text-xs sm:text-sm font-bold text-[#131a2b] dark:text-[#e8ecf5]">
                        {item.nome}
                      </h4>
                    </div>

                    {item.nota !== null ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: `${color}18`,
                          color: color,
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span>{item.nota} · {item.rotulo}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-mono">Sem nota</span>
                    )}
                  </div>

                  {item.solucao ? (
                    <div className="pl-7 mt-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Solução recomendada:
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        {item.solucao}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 pl-7 italic">
                      Nenhuma solução anotada para este tópico.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card: Link para o Cliente */}
      <div className="bg-white dark:bg-[#161d2e] p-6 rounded-2xl border border-[#dde2ec] dark:border-slate-800 shadow-xs mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#2f55d4] flex items-center justify-center">
            <Share2 className="w-4 h-4" />
          </div>
          <h3 className="font-heading text-base font-bold text-[#131a2b] dark:text-[#e8ecf5]">
            Link para o Cliente
          </h3>
        </div>

        {diagnostic.status !== 'finalizado' ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
              <Info className="w-4 h-4 shrink-0" />
              <span>Finalize o diagnóstico para gerar um link de acesso para o cliente.</span>
            </div>
            <a
              href={`#/editar/${diagnosticId}`}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            >
              Ir para o Editor
            </a>
          </div>
        ) : !diagnostic.compartilhado ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs text-[#5d6680] dark:text-slate-400">
                O diagnóstico está finalizado, mas o link ainda está inativo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleShare(true)}
              disabled={updatingShare}
              className="px-4 py-2 text-xs font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad] rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {updatingShare ? 'Ativando...' : 'Gerar link para o cliente'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 w-fit">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Link ativo e acessível pelo cliente</span>
            </div>

            {/* URL Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 select-all focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad] transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar link'}</span>
              </button>

              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Abrir</span>
              </a>
            </div>

            {/* Secondary Link actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
              <button
                type="button"
                onClick={handleRegenerateToken}
                disabled={updatingShare}
                className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Trocar link (o atual para de funcionar)</span>
              </button>

              <span className="text-slate-300 dark:text-slate-700">·</span>

              <button
                type="button"
                onClick={() => handleToggleShare(false)}
                disabled={updatingShare}
                className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer font-medium"
              >
                Desativar link
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Printable A4 report container positioned off-screen for jsPDF capture */}
      <div
        id="printable-pdf-document"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          opacity: 1,
          pointerEvents: 'none',
          zIndex: -100,
        }}
      >
        {/* Page 1: Capa Executiva */}
        <div
          className="pdf-page bg-white text-slate-900 p-12 flex flex-col justify-between"
          style={{ width: '800px', minHeight: '1130px', boxSizing: 'border-box' }}
        >
          <div>
            {/* Dark Top Banner */}
            <div className="bg-[#131a2b] text-white p-6 rounded-xl flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full bg-[#2f55d4]" />
                <span className="font-heading text-xl font-black tracking-tight">LUMOS PRO</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {formatDateBr(diagnostic.data_referencia)}
              </span>
            </div>

            {/* Title & Client */}
            <div className="mb-6">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                Relatório de Diagnóstico Estratégico
              </span>
              <h1 className="font-heading text-3xl font-black text-slate-900 mt-1">
                {client.nome}
              </h1>
              {client.segmento && (
                <p className="text-sm text-slate-600 mt-0.5">Segmento: {client.segmento}</p>
              )}
            </div>

            {/* Overall Score Box */}
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 mb-8 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Nota Geral LUMOS
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className="font-heading text-4xl font-black"
                    style={{ color: getColorForFaixa(computedScores.faixaGeral) }}
                  >
                    {formatNumberBr(computedScores.mediaGeral)}
                  </span>
                  <span className="text-lg text-slate-400 font-bold">/ 3,00</span>
                </div>
              </div>
              <div className="text-right">
                <ScoreBadge
                  media={computedScores.mediaGeral}
                  faixa={computedScores.faixaGeral}
                  size="md"
                />
                <span className="block text-xs text-slate-500 mt-1">
                  Aproveitamento: {formatPercentBr(computedScores.percentualGeral)}
                </span>
              </div>
            </div>

            {/* Pillars Table */}
            <div className="mb-8">
              <h3 className="font-heading text-sm font-bold text-slate-900 mb-3">
                Desempenho por Pilar
              </h3>
              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Pilar</th>
                    <th className="py-2.5 px-3 text-left">Avaliador</th>
                    <th className="py-2.5 px-3 text-center">Média</th>
                    <th className="py-2.5 px-3 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {computedScores.pilares.map((p) => (
                    <tr key={p.slug}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{p.nome}</td>
                      <td className="py-2.5 px-3 text-slate-600">{p.avaliador}</td>
                      <td className="py-2.5 px-3 text-center font-bold tabular-nums">
                        {formatNumberBr(p.media)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">
                        <span style={{ color: getColorForFaixa(p.faixa) }}>{p.faixa}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumo */}
            {diagnostic.resumo && (
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 block mb-1">
                  Resumo Executivo da Agência:
                </span>
                <p className="text-slate-700 leading-relaxed italic">"{diagnostic.resumo}"</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 flex justify-between">
            <span>Agência LUMOS · Relatório Confidencial</span>
            <span>Página 1 de 4</span>
          </div>
        </div>

        {/* Pages 2, 3, 4: One per pillar */}
        {pilares.map((pilar, pIndex) => {
          const pCrit = criterios
            .filter((c) => c.pilar_id === pilar.id)
            .sort((a, b) => a.ordem - b.ordem);

          const pScore = computedScores.pilares.find((p) => p.slug === pilar.slug);

          return (
            <div
              key={pilar.slug}
              className="pdf-page bg-white text-slate-900 p-12 flex flex-col justify-between"
              style={{ width: '800px', minHeight: '1130px', boxSizing: 'border-box' }}
            >
              <div>
                {/* Header banner */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Pilar {pIndex + 1} de 3
                    </span>
                    <h2 className="font-heading text-2xl font-black text-slate-900">
                      {pilar.nome}
                    </h2>
                    <span className="text-xs text-slate-500">Avaliador: {pilar.avaliador}</span>
                  </div>

                  <div className="text-right">
                    <span
                      className="font-heading text-3xl font-black block tabular-nums"
                      style={{ color: getColorForFaixa(pScore?.faixa || 'Sem avaliação') }}
                    >
                      {formatNumberBr(pScore?.media)}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{pScore?.faixa}</span>
                  </div>
                </div>

                {/* Topics evaluated */}
                <div className="space-y-3">
                  {pCrit.map((crit) => {
                    const av = avaliacoes.find((a) => a.criterio_id === crit.id);
                    const nota = av?.nota ?? null;
                    const rotulo = nota ? getRotuloPadrao(pilar.slug, nota) : 'Sem nota';
                    const color = getColorForNota(nota);

                    return (
                      <div
                        key={crit.id}
                        className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-900">
                            {crit.ordem}. {crit.nome}
                          </span>
                          <span
                            className="font-bold px-2 py-0.5 rounded text-[11px]"
                            style={{
                              backgroundColor: `${color}20`,
                              color: color,
                            }}
                          >
                            {nota !== null ? `${nota} · ${rotulo}` : 'Sem nota'}
                          </span>
                        </div>
                        {av?.solucao ? (
                          <p className="text-slate-600 mt-1 pl-2 border-l-2 border-slate-300">
                            <strong>Solução:</strong> {av.solucao}
                          </p>
                        ) : (
                          <p className="text-slate-400 italic">Sem solução informada.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 flex justify-between">
                <span>LUMOS PRO · {client.nome}</span>
                <span>Página {pIndex + 2} de 4</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
