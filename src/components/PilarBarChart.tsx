import React from 'react';
import { FaixaScore, PilarSlug } from '../types/database';
import { formatNumberBr, getColorForFaixa, getFaixaFromMedia } from '../utils/formatters';

interface PilarScoreItem {
  slug: PilarSlug;
  nome: string;
  media: number | null;
  faixa?: FaixaScore;
  totalCriterios?: number;
  avaliados?: number;
}

interface PilarBarChartProps {
  pilares: PilarScoreItem[];
  onSelectPilar?: (slug: PilarSlug) => void;
  selectedSlug?: PilarSlug | null;
}

export const PilarBarChart: React.FC<PilarBarChartProps> = ({
  pilares,
  onSelectPilar,
  selectedSlug,
}) => {
  const maxScore = 3.0;

  return (
    <div className="w-full bg-white dark:bg-[#161d2e] p-5 sm:p-6 rounded-xl border border-[#dde2ec] dark:border-slate-800 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-heading text-sm sm:text-base font-bold text-[#131a2b] dark:text-[#e8ecf5]">
            Nota por Pilar
          </h3>
          <p className="text-xs text-[#5d6680] dark:text-slate-400">
            Escala de 1,00 a 3,00 · Clique em uma barra para detalhes
          </p>
        </div>
      </div>

      <div className="pt-6 pb-2">
        <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end h-52 sm:h-56 border-b border-slate-200 dark:border-slate-700 relative">
          {/* Reference grid lines */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full flex justify-end pr-1">
              <span>3,00</span>
            </div>
            <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full flex justify-end pr-1">
              <span>2,00</span>
            </div>
            <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full flex justify-end pr-1">
              <span>1,00</span>
            </div>
            <div className="w-full flex justify-end pr-1">
              <span>0,00</span>
            </div>
          </div>

          {pilares.map((p) => {
            const mediaVal = p.media ?? 0;
            const heightPercent = Math.min(100, Math.max(8, (mediaVal / maxScore) * 100));
            const faixa = p.faixa || getFaixaFromMedia(p.media);
            const color = p.media ? getColorForFaixa(faixa) : '#b7bfcf';
            const isSelected = selectedSlug === p.slug;

            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => onSelectPilar?.(p.slug)}
                className={`relative flex flex-col items-center justify-end h-full group transition-transform focus:outline-hidden ${
                  onSelectPilar ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'
                }`}
                title={`Ver detalhes de ${p.nome}`}
              >
                {/* Score label directly on top of the bar */}
                <div
                  className={`text-xs sm:text-sm font-bold font-heading mb-1.5 transition-all tabular-nums ${
                    isSelected ? 'scale-110' : ''
                  }`}
                  style={{ color }}
                >
                  {p.media ? formatNumberBr(p.media) : '—'}
                </div>

                {/* Animated colored bar */}
                <div className="w-full max-w-[72px] sm:max-w-[96px] bg-slate-100 dark:bg-slate-800/80 rounded-t-lg overflow-hidden h-full flex items-end relative">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ease-out relative ${
                      isSelected ? 'ring-2 ring-offset-2 ring-[#2f55d4]' : ''
                    }`}
                    style={{
                      height: `${heightPercent}%`,
                      backgroundColor: color,
                    }}
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Pillar label below axis */}
                <div className="mt-3 text-center w-full">
                  <span
                    className={`block text-xs sm:text-sm font-medium transition-colors truncate ${
                      isSelected
                        ? 'text-[#2f55d4] dark:text-[#6f8cff] font-bold'
                        : 'text-[#131a2b] dark:text-[#e8ecf5] group-hover:text-[#2f55d4]'
                    }`}
                  >
                    {p.nome}
                  </span>
                  <span className="text-[11px] text-[#5d6680] dark:text-slate-400 block font-mono">
                    {faixa}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
