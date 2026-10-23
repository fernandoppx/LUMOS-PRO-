import { FaixaScore, PilarSlug } from '../types/database';

export const COLORS = {
  critico: '#d64545',
  atencao: '#e3a008',
  bom: '#2e9e5b',
  neutro: '#b7bfcf',
  cardLight: '#ffffff',
  cardDark: '#161d2e',
  textLight: '#131a2b',
  textMutedLight: '#5d6680',
  primary: '#2f55d4',
  primaryDark: '#6f8cff',
};

export function getFaixaFromMedia(media: number | null | undefined): FaixaScore {
  if (media === null || media === undefined || isNaN(media)) {
    return 'Sem avaliação';
  }
  if (media < 1.67) return 'Crítico';
  if (media <= 2.33) return 'Atenção';
  return 'Bom';
}

export function getColorForNota(nota: number | null | undefined): string {
  if (nota === 1) return COLORS.critico;
  if (nota === 2) return COLORS.atencao;
  if (nota === 3) return COLORS.bom;
  return COLORS.neutro;
}

export function getColorForFaixa(faixa: FaixaScore): string {
  switch (faixa) {
    case 'Crítico':
      return COLORS.critico;
    case 'Atenção':
      return COLORS.atencao;
    case 'Bom':
      return COLORS.bom;
    default:
      return COLORS.neutro;
  }
}

export function getFaixaBadgeClasses(faixa: FaixaScore): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (faixa) {
    case 'Crítico':
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200 dark:border-rose-800/60',
        dot: 'bg-[#d64545]',
      };
    case 'Atenção':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-800 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800/60',
        dot: 'bg-[#e3a008]',
      };
    case 'Bom':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800/60',
        dot: 'bg-[#2e9e5b]',
      };
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-800/60',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-200 dark:border-slate-700',
        dot: 'bg-[#b7bfcf]',
      };
  }
}

export function formatNumberBr(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercentBr(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0%';
  const clamped = Math.max(0, Math.min(100, Math.round(val)));
  return `${clamped}%`;
}

export function formatDateBr(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  // If format is YYYY-MM-DD
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getRotuloPadrao(slug: PilarSlug, nota: number): string {
  if (slug === 'trafego') {
    if (nota === 1) return 'Ruim';
    if (nota === 2) return 'Requer melhorias';
    if (nota === 3) return 'Tá Bom!';
  } else {
    // instagram, comercial
    if (nota === 1) return 'Ruim';
    if (nota === 2) return 'Requer melhorias';
    if (nota === 3) return 'Muito Bom!';
  }
  return '';
}

/**
 * Normalizes text for search, removing accents and casing
 */
export function normalizeSearch(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
