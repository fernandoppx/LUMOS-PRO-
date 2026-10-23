import React from 'react';
import { getColorForNota } from '../utils/formatters';

export interface PieTopicItem {
  ordem: number;
  nome: string;
  nota: number | null | undefined;
  rotulo?: string;
  solucao?: string | null;
}

interface PilarPieChartProps {
  topics: PieTopicItem[];
  rotulo1?: string;
  rotulo2?: string;
  rotulo3?: string;
  activeTopicIndex?: number | null;
  onTopicHover?: (index: number | null) => void;
}

export const PilarPieChart: React.FC<PilarPieChartProps> = ({
  topics,
  rotulo1 = 'Ruim',
  rotulo2 = 'Requer melhorias',
  rotulo3 = 'Muito Bom!',
  activeTopicIndex,
  onTopicHover,
}) => {
  const count = topics.length;
  if (count === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[#5d6680]">
        Nenhum tópico disponível para este pilar.
      </div>
    );
  }

  const size = 260;
  const center = size / 2;
  const radius = 105;
  const innerRadius = 38; // donut style for elegance and readability

  const sliceAngle = (2 * Math.PI) / count;

  return (
    <div className="flex flex-col items-center">
      {/* SVG Pie Chart */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full drop-shadow-xs"
          role="img"
          aria-label="Gráfico de tópicos do pilar"
        >
          {topics.map((t, i) => {
            const startAngle = i * sliceAngle - Math.PI / 2;
            const endAngle = (i + 1) * sliceAngle - Math.PI / 2;

            // Coordinates for outer arc
            const x1 = center + radius * Math.cos(startAngle);
            const y1 = center + radius * Math.sin(startAngle);
            const x2 = center + radius * Math.cos(endAngle);
            const y2 = center + radius * Math.sin(endAngle);

            // Coordinates for inner arc
            const ix1 = center + innerRadius * Math.cos(endAngle);
            const iy1 = center + innerRadius * Math.sin(endAngle);
            const ix2 = center + innerRadius * Math.cos(startAngle);
            const iy2 = center + innerRadius * Math.sin(startAngle);

            const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

            const pathData = [
              `M ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              `L ${ix1} ${iy1}`,
              `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix2} ${iy2}`,
              'Z',
            ].join(' ');

            const midAngle = (startAngle + endAngle) / 2;
            const textRadius = (radius + innerRadius) / 2;
            const tx = center + textRadius * Math.cos(midAngle);
            const ty = center + textRadius * Math.sin(midAngle) + 4; // slight vertical adjust

            const color = getColorForNota(t.nota);
            const isActive = activeTopicIndex === i;

            return (
              <g
                key={t.ordem}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => onTopicHover?.(i)}
                onMouseLeave={() => onTopicHover?.(null)}
              >
                <path
                  d={pathData}
                  fill={color}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="2"
                  className={`transition-opacity duration-200 ${
                    isActive ? 'opacity-100 filter drop-shadow-md' : 'opacity-90 hover:opacity-100'
                  }`}
                />
                {/* Topic Order Number */}
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="'Unbounded', sans-serif"
                  className="pointer-events-none select-none drop-shadow-sm"
                >
                  {t.ordem}
                </text>
              </g>
            );
          })}

          {/* Center circle */}
          <circle
            cx={center}
            cy={center}
            r={innerRadius - 4}
            fill="currentColor"
            className="text-white dark:text-[#161d2e]"
          />
          <text
            x={center}
            y={center + 3}
            textAnchor="middle"
            fontSize="10"
            fontFamily="'Unbounded', sans-serif"
            fontWeight="bold"
            className="fill-slate-500 dark:fill-slate-400 select-none"
          >
            {count} ITENS
          </text>
        </svg>
      </div>

      {/* Legend below the pie */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#d64545] shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">1:</span>
          <span className="text-[#5d6680] dark:text-slate-400">{rotulo1}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#e3a008] shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">2:</span>
          <span className="text-[#5d6680] dark:text-slate-400">{rotulo2}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#2e9e5b] shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">3:</span>
          <span className="text-[#5d6680] dark:text-slate-400">{rotulo3}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#b7bfcf] shrink-0" />
          <span className="text-[#5d6680] dark:text-slate-400">Sem nota</span>
        </div>
      </div>
    </div>
  );
};
