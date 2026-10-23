import React from 'react';
import { FaixaScore } from '../types/database';
import { formatNumberBr, getFaixaBadgeClasses } from '../utils/formatters';

interface ScoreBadgeProps {
  media: number | null | undefined;
  faixa: FaixaScore;
  showMedia?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  media,
  faixa,
  showMedia = true,
  size = 'md',
  className = '',
}) => {
  const classes = getFaixaBadgeClasses(faixa);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs sm:text-sm px-2.5 py-1 gap-2',
    lg: 'text-sm sm:text-base px-3.5 py-1.5 gap-2.5 font-semibold',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-lg border font-medium tabular-nums ${classes.bg} ${classes.text} ${classes.border} ${sizeClasses} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${classes.dot}`} aria-hidden="true" />
      {showMedia && media !== null && media !== undefined && !isNaN(media) && (
        <span className="font-bold">{formatNumberBr(media)}</span>
      )}
      <span className="font-medium tracking-wide">{faixa}</span>
    </span>
  );
};
