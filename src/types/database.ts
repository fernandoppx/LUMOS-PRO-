export type LumosRole = 'administrador' | 'auditor';
export type PapelUsuario = 'admin' | 'analista' | 'administrador' | 'auditor';

export interface CurrentUser {
  id: string;
  nome: string;
  email: string;
  papel: LumosRole;
}

export interface AdminUser {
  id: string;
  nome: string;
  email: string;
  papel: LumosRole;
  created_at: string;
  clientes_count: number;
  diagnosticos_count: number;
}

export interface Profile {
  id: string;
  nome: string;
  email: string;
  papel: LumosRole | PapelUsuario;
  aprovado?: boolean;
  created_at: string;
}

export type PilarSlug = 'instagram' | 'trafego' | 'comercial';

export interface Pilar {
  id: number;
  slug: PilarSlug;
  nome: string;
  avaliador: string;
  rotulo_1: string;
  rotulo_2: string;
  rotulo_3: string;
  ordem: number;
}

export interface Criterio {
  id: string;
  pilar_id: number;
  ordem: number;
  nome: string;
  descricao: string;
  guia_1: string;
  guia_2: string;
  guia_3: string;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  segmento?: string | null;
  instagram?: string | null;
  site?: string | null;
  whatsapp?: string | null;
  cidade?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  criado_por?: string | null;
  created_at: string;
  updated_at?: string | null;
  _pendingSync?: boolean;
}

export type StatusDiagnostico = 'rascunho' | 'finalizado';

export interface Diagnostico {
  id: string;
  cliente_id: string;
  data_referencia: string; // YYYY-MM-DD
  status: StatusDiagnostico;
  resumo?: string | null;
  compartilhado: boolean;
  share_token: string;
  criado_por?: string | null;
  created_at: string;
  updated_at?: string | null;
  _pendingSync?: boolean;
}

export interface Avaliacao {
  id?: string;
  diagnostico_id: string;
  criterio_id: string;
  nota: number | null; // 1 | 2 | 3 | null
  solucao?: string | null;
  observacao?: string | null;
  recomendacao?: string | null;
  evidencia_url?: string | null;
}

export type FaixaScore = 'Crítico' | 'Atenção' | 'Bom' | 'Sem avaliação';

export interface ScorePilarView {
  diagnostico_id: string;
  cliente_id: string;
  pilar_id: number;
  slug: PilarSlug;
  nome: string;
  ordem: number;
  total_criterios: number;
  avaliados: number;
  media: number | null;
  percentual: number | null;
  faixa: FaixaScore;
}

export interface ScoreDiagnosticoView {
  diagnostico_id: string;
  cliente_id: string;
  cliente_nome: string;
  data_referencia: string;
  status: StatusDiagnostico;
  media_instagram: number | null;
  media_trafego: number | null;
  media_comercial: number | null;
  media_geral: number | null;
  percentual_geral: number | null;
  faixa_geral: FaixaScore;
  avaliados: number;
  total_criterios: number;
}

export interface PublicReportCriterio {
  nome: string;
  nota: number | null;
  rotulo: string;
  solucao: string | null;
}

export interface PublicReportPilar {
  slug: PilarSlug;
  nome: string;
  avaliador: string;
  media: number | null;
  faixa: FaixaScore;
  criterios: PublicReportCriterio[];
}

export interface PublicReportData {
  cliente: {
    nome: string;
    segmento?: string | null;
    instagram?: string | null;
  };
  diagnostico: {
    data: string;
    resumo?: string | null;
  };
  pilares: PublicReportPilar[];
}
