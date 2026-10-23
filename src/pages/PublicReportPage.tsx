import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PublicReportData, FaixaScore, PilarSlug } from '../types/database';
import { dataRepository } from '../lib/dataRepository';
import { ScoreBadge } from '../components/ScoreBadge';
import { PilarBarChart } from '../components/PilarBarChart';
import { PilarPieChart } from '../components/PilarPieChart';
import {
  formatDateBr,
  formatNumberBr,
  formatPercentBr,
  getColorForFaixa,
  getColorForNota,
  getFaixaFromMedia,
} from '../utils/formatters';
import {
  Printer,
  Instagram,
  AlertCircle,
  Calendar,
  Layers,
  ChevronDown,
} from 'lucide-react';

interface PublicReportPageProps {
  token: string;
}

export const PublicReportPage: React.FC<PublicReportPageProps> = ({ token }) => {
  const [data, setData] = useState<PublicReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  const fetchPublicReport = useCallback(async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const reportData = await dataRepository.getPublicReport(token);

      if (!reportData) {
        setErrorState(
          'Relatório indisponível: este link foi desativado ou o relatório ainda não foi liberado.'
        );
        return;
      }

      setData(reportData);
    } catch (err) {
      console.error(err);
      setErrorState('Erro ao carregar o relatório público.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPublicReport();
  }, [fetchPublicReport]);

  // Overall calculations
  const overall = useMemo(() => {
    if (!data || !data.pilares) return null;

    const validMedias = data.pilares
      .map((p) => p.media)
      .filter((m): m is number => m !== null && m !== undefined && !isNaN(m));

    const mediaGeral =
      validMedias.length > 0
        ? validMedias.reduce((a, b) => a + b, 0) / validMedias.length
        : null;

    const percentualGeral = mediaGeral !== null ? ((mediaGeral - 1) / 2) * 100 : null;
    const faixaGeral = getFaixaFromMedia(mediaGeral);

    return {
      mediaGeral,
      percentualGeral,
      faixaGeral,
    };
  }, [data]);

  const scrollToPilar = (slug: string) => {
    const el = document.getElementById(`pilar-section-${slug}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f5f9] dark:bg-[#0e1320] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#161d2e] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md text-center max-w-sm w-full animate-pulse">
          <div className="w-10 h-10 rounded-full bg-[#2f55d4] mx-auto mb-4 animate-bounce" />
          <h2 className="font-heading text-sm font-bold text-slate-800 dark:text-slate-200">
            Carregando Relatório...
          </h2>
          <p className="text-xs text-slate-500 mt-1">LUMOS PRO Diagnóstico Estratégico</p>
        </div>
      </div>
    );
  }

  if (errorState || !data) {
    return (
      <div className="min-h-screen bg-[#f3f5f9] dark:bg-[#0e1320] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#161d2e] p-8 rounded-2xl border border-[#dde2ec] dark:border-slate-800 shadow-xl text-center max-w-md w-full">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-[#e3a008] flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-900">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="font-heading text-lg font-bold text-[#131a2b] dark:text-[#e8ecf5] mb-2">
            Relatório Indisponível
          </h2>
          <p className="text-xs text-[#5d6680] dark:text-slate-400 leading-relaxed mb-6">
            {errorState ||
              'Relatório indisponível: este link foi desativado ou o relatório ainda não foi liberado.'}
          </p>
          <a
            href="#/login"
            className="inline-block px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Acessar com Login
          </a>
        </div>
      </div>
    );
  }

  const scoreVal = overall?.mediaGeral ?? 1.0;
  const needlePercent = Math.max(0, Math.min(100, ((scoreVal - 1.0) / 2.0) * 100));

  return (
    <div className="min-h-screen bg-[#f3f5f9] dark:bg-[#0e1320] text-[#131a2b] dark:text-[#e8ecf5]">
      {/* Public Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#161d2e]/95 backdrop-blur-md border-b border-[#dde2ec] dark:border-slate-800 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 font-heading text-base sm:text-lg font-bold tracking-tight">
            <span className="w-3 h-3 rounded-full bg-[#2f55d4] inline-block shadow-sm"></span>
            <span>LUMOS PRO</span>
            <span className="hidden sm:inline text-xs font-normal text-[#5d6680] dark:text-slate-400 pl-2 border-l border-slate-200 dark:border-slate-700">
              Relatório de Diagnóstico
            </span>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="no-print inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-heading text-xs font-bold text-white bg-[#2f55d4] hover:bg-[#2544ad] transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir ou Salvar PDF</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Client & Executive Hero Box */}
        <div className="bg-white dark:bg-[#161d2e] p-6 sm:p-8 rounded-2xl border border-[#dde2ec] dark:border-slate-800 shadow-xs mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-[#5d6680] dark:text-slate-400 block mb-1">
                Relatório de Diagnóstico · Agência LUMOS
              </span>
              <h1 className="font-heading text-2xl sm:text-3xl font-black text-[#131a2b] dark:text-[#e8ecf5] tracking-tight">
                {data.cliente.nome}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5d6680] dark:text-slate-400">
                {data.cliente.segmento && <span>Segmento: {data.cliente.segmento}</span>}
                {data.cliente.instagram && (
                  <span className="flex items-center gap-1">
                    <Instagram className="w-3.5 h-3.5" />
                    <span>@{data.cliente.instagram.replace('@', '')}</span>
                  </span>
                )}
                {data.diagnostico.data && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Data: {formatDateBr(data.diagnostico.data)}</span>
                  </span>
                )}
              </div>
            </div>

            {overall && (
              <ScoreBadge
                media={overall.mediaGeral}
                faixa={overall.faixaGeral}
                size="lg"
              />
            )}
          </div>

          {/* Overall score numbers and 3-color ruler */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-6 items-center">
            <div className="md:col-span-5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Média Geral da Avaliação
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-heading text-5xl sm:text-6xl font-black tracking-tight tabular-nums"
                  style={{ color: getColorForFaixa(overall?.faixaGeral || 'Sem avaliação') }}
                >
                  {formatNumberBr(overall?.mediaGeral)}
                </span>
                <span className="text-xl sm:text-2xl text-slate-400 font-heading">/ 3,00</span>
              </div>
              <p className="text-xs text-[#5d6680] dark:text-slate-400 mt-1">
                Aproveitamento estratégico: {formatPercentBr(overall?.percentualGeral)}
              </p>

              {/* 3-color ruler */}
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                  <span>1 · Ruim</span>
                  <span>2 · Requer melhorias</span>
                  <span>3 · Muito bom</span>
                </div>
                <div className="relative h-2.5 w-full rounded-full overflow-hidden flex">
                  <div className="h-full w-1/3 bg-[#d64545]" />
                  <div className="h-full w-1/3 bg-[#e3a008]" />
                  <div className="h-full w-1/3 bg-[#2e9e5b]" />
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white ring-2 ring-slate-900 shadow-md"
                    style={{ left: `${needlePercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-7">
              {data.diagnostico.resumo ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Parecer Executivo:
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed italic">
                    "{data.diagnostico.resumo}"
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-500 italic">
                  Diagnóstico completo com notas e recomendações detalhadas por pilar abaixo.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pillars Bar Chart */}
        <div className="mb-8">
          <PilarBarChart
            pilares={data.pilares.map((p) => ({
              slug: p.slug,
              nome: p.nome,
              media: p.media,
              faixa: p.faixa,
            }))}
            onSelectPilar={(slug) => scrollToPilar(slug)}
          />
        </div>

        {/* 3 Pillar Quick Cards Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {data.pilares.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => scrollToPilar(p.slug)}
              className="p-5 rounded-xl bg-white dark:bg-[#161d2e] border border-[#dde2ec] dark:border-slate-800 hover:border-[#2f55d4] transition-all shadow-xs text-left cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-heading text-sm font-bold text-[#131a2b] dark:text-[#e8ecf5] group-hover:text-[#2f55d4]">
                  {p.nome}
                </h3>
                <ScoreBadge media={p.media} faixa={p.faixa} size="sm" showMedia={false} />
              </div>
              <div
                className="text-2xl font-black font-heading tabular-nums my-1"
                style={{ color: getColorForFaixa(p.faixa) }}
              >
                {formatNumberBr(p.media)}
              </div>
              <p className="text-xs text-[#5d6680] dark:text-slate-400">
                Avaliador: {p.avaliador}
              </p>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-[#2f55d4] font-semibold">
                <span>Rolar até detalhes</span>
                <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>

        {/* Individual Pillar Detailed Sections */}
        <div className="space-y-12">
          {data.pilares.map((pilar, pIndex) => {
            const pieTopics = pilar.criterios.map((c, idx) => ({
              ordem: idx + 1,
              nome: c.nome,
              nota: c.nota,
              rotulo: c.rotulo,
              solucao: c.solucao,
            }));

            return (
              <section
                key={pilar.slug}
                id={`pilar-section-${pilar.slug}`}
                className="bg-white dark:bg-[#161d2e] p-6 sm:p-8 rounded-2xl border border-[#dde2ec] dark:border-slate-800 shadow-xs scroll-mt-20 print-break-inside-avoid"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[11px] font-bold text-[#2f55d4] dark:text-[#6f8cff] uppercase tracking-wider">
                      Pilar 0{pIndex + 1}
                    </span>
                    <h2 className="font-heading text-xl sm:text-2xl font-black text-[#131a2b] dark:text-[#e8ecf5] mt-0.5">
                      {pilar.nome}
                    </h2>
                    <p className="text-xs text-[#5d6680] dark:text-slate-400 mt-1">
                      Avaliador responsável: <strong>{pilar.avaliador}</strong> ·{' '}
                      {pilar.criterios.length} critérios analisados
                    </p>
                  </div>

                  <ScoreBadge media={pilar.media} faixa={pilar.faixa} size="md" />
                </div>

                {/* 2-Column Split: Pie Chart with Legend on left, Topics List on right */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                    <PilarPieChart topics={pieTopics} />
                  </div>

                  <div className="lg:col-span-7 space-y-3.5">
                    {pilar.criterios.map((crit, idx) => {
                      const color = getColorForNota(crit.nota);

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 text-xs"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <h4 className="font-heading font-bold text-sm text-[#131a2b] dark:text-[#e8ecf5]">
                                {crit.nome}
                              </h4>
                            </div>

                            {crit.nota !== null ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold"
                                style={{
                                  backgroundColor: `${color}18`,
                                  color: color,
                                }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                                <span>{crit.nota} · {crit.rotulo}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">Sem nota</span>
                            )}
                          </div>

                          {crit.solucao ? (
                            <div className="pl-7 mt-2">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Solução e Plano de Ação:
                              </span>
                              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                {crit.solucao}
                              </p>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 pl-7 italic">
                              Sem recomendações adicionais.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-[#5d6680] dark:text-slate-400">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            LUMOS PRO · Agência LUMOS
          </p>
          <p className="mt-1">
            Diagnóstico estratégico de presença digital, tráfego pago e maturidade comercial.
          </p>
        </footer>
      </main>
    </div>
  );
};
