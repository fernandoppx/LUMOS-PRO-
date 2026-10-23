import React from 'react';
import { formatDateBr, formatNumberBr, getColorForFaixa, getFaixaFromMedia } from '../utils/formatters';

export interface DiagnosticHistoryPoint {
  id: string;
  data_referencia: string;
  media_geral: number | null;
  status: string;
}

interface EvolutionLineChartProps {
  points: DiagnosticHistoryPoint[];
}

export const EvolutionLineChart: React.FC<EvolutionLineChartProps> = ({ points }) => {
  if (points.length < 2) return null;

  // Sort chronological ascending
  const sorted = [...points].sort((a, b) =>
    new Date(a.data_referencia).getTime() - new Date(b.data_referencia).getTime()
  );

  const width = 640;
  const height = 200;
  const paddingX = 45;
  const paddingY = 30;

  const minScore = 1.0;
  const maxScore = 3.0;

  const validPoints = sorted.filter((p) => p.media_geral !== null && !isNaN(p.media_geral));
  if (validPoints.length < 2) return null;

  const getX = (index: number) => {
    return paddingX + (index * (width - 2 * paddingX)) / (validPoints.length - 1);
  };

  const getY = (val: number) => {
    const clamped = Math.max(minScore, Math.min(maxScore, val));
    const ratio = (clamped - minScore) / (maxScore - minScore);
    return height - paddingY - ratio * (height - 2 * paddingY);
  };

  const pathCoordinates = validPoints.map((p, idx) => ({
    x: getX(idx),
    y: getY(p.media_geral!),
    score: p.media_geral!,
    date: p.data_referencia,
    id: p.id,
  }));

  const pathString = pathCoordinates.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  return (
    <div className="w-full bg-white dark:bg-[#161d2e] p-5 sm:p-6 rounded-xl border border-[#dde2ec] dark:border-slate-800 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-heading text-sm sm:text-base font-bold text-[#131a2b] dark:text-[#e8ecf5]">
            Evolução da Nota Geral
          </h3>
          <p className="text-xs text-[#5d6680] dark:text-slate-400">
            Acompanhamento histórico de notas ao longo do tempo (escala de 1,00 a 3,00)
          </p>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 sm:h-52 overflow-visible"
        >
          {/* Reference Horizontal Lines */}
          {[3.0, 2.33, 1.67, 1.0].map((level) => {
            const y = getY(level);
            return (
              <g key={level}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="'Manrope', sans-serif"
                  className="fill-slate-400 dark:fill-slate-500 font-mono"
                >
                  {formatNumberBr(level, 2)}
                </text>
              </g>
            );
          })}

          {/* Area fill under curve */}
          {pathCoordinates.length > 0 && (
            <path
              d={`${pathString} L ${pathCoordinates[pathCoordinates.length - 1].x} ${
                height - paddingY
              } L ${pathCoordinates[0].x} ${height - paddingY} Z`}
              fill="url(#evolutionGradient)"
              opacity="0.15"
            />
          )}

          <defs>
            <linearGradient id="evolutionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f55d4" />
              <stop offset="100%" stopColor="#2f55d4" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Line Stroke */}
          <path
            d={pathString}
            fill="none"
            stroke="#2f55d4"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {pathCoordinates.map((pt) => {
            const faixa = getFaixaFromMedia(pt.score);
            const color = getColorForFaixa(faixa);

            return (
              <g key={pt.id} className="group">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="6"
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-transform group-hover:scale-125"
                />
                {/* Score text above circle */}
                <text
                  x={pt.x}
                  y={pt.y - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="'Unbounded', sans-serif"
                  fill={color}
                  className="select-none"
                >
                  {formatNumberBr(pt.score)}
                </text>
                {/* Date text below bottom axis */}
                <text
                  x={pt.x}
                  y={height - paddingY + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="'Manrope', sans-serif"
                  className="fill-slate-500 dark:fill-slate-400 font-medium"
                >
                  {formatDateBr(pt.date)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
