import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Sparkles, Clipboard } from 'lucide-react';
import { Criterio, Pilar, PilarSlug } from '../types/database';

export interface ParsedSkillItem {
  pilar: PilarSlug;
  item: number;
  topico?: string;
  nota: number;
  solucao?: string;
}

export interface ParsedSkillPayload {
  cliente?: string;
  resumo?: string;
  avaliacoes: ParsedSkillItem[];
}

interface PasteSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  pilares: Pilar[];
  criterios: Criterio[];
  onApply: (data: {
    resumo?: string;
    avaliacoes: Array<{ criterioId: string; nota: number; solucao: string }>;
  }) => void;
}

export const PasteSkillModal: React.FC<PasteSkillModalProps> = ({
  isOpen,
  onClose,
  pilares,
  criterios,
  onApply,
}) => {
  const [rawText, setRawText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<{
    matched: Array<{ criterioId: string; nome: string; pilarNome: string; nota: number; solucao: string }>;
    unmatched: string[];
    resumo?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleParse = () => {
    setErrorMsg(null);
    setParsedResult(null);

    if (!rawText.trim()) {
      setErrorMsg('Cole o texto ou resposta do Claude contendo o JSON.');
      return;
    }

    try {
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('Nenhum objeto JSON válido (com { e }) foi encontrado no texto.');
      }

      const jsonStr = rawText.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonStr) as ParsedSkillPayload;

      if (!parsed.avaliacoes || !Array.isArray(parsed.avaliacoes)) {
        throw new Error('O JSON precisa conter a propriedade "avaliacoes" com a lista de tópicos.');
      }

      // Map criteria by pilar slug + order
      // We know pilares have id: 1 (instagram), 2 (trafego), 3 (comercial)
      const pilarMap = new Map<number, Pilar>();
      pilares.forEach((p) => pilarMap.set(p.id, p));

      const matched: Array<{
        criterioId: string;
        nome: string;
        pilarNome: string;
        nota: number;
        solucao: string;
      }> = [];
      const unmatched: string[] = [];

      parsed.avaliacoes.forEach((item, index) => {
        // Normalize pilar slug
        const rawPilar = String(item.pilar || '').toLowerCase().trim();
        let normalizedSlug: PilarSlug | null = null;
        if (rawPilar.includes('insta')) normalizedSlug = 'instagram';
        else if (rawPilar.includes('traf') || rawPilar.includes('tráf')) normalizedSlug = 'trafego';
        else if (rawPilar.includes('comerc')) normalizedSlug = 'comercial';

        const pilarObj = pilares.find((p) => p.slug === normalizedSlug);

        // Find criterio by pilar and item order
        let targetCriterio: Criterio | undefined;
        if (pilarObj) {
          targetCriterio = criterios.find(
            (c) => c.pilar_id === pilarObj.id && c.ordem === Number(item.item)
          );
        }

        // Fallback by name match if order didn't match
        if (!targetCriterio && item.topico) {
          const cleanItemName = item.topico.toLowerCase().trim();
          targetCriterio = criterios.find((c) =>
            c.nome.toLowerCase().includes(cleanItemName) || cleanItemName.includes(c.nome.toLowerCase())
          );
        }

        if (targetCriterio) {
          const validNota = Math.max(1, Math.min(3, Math.round(Number(item.nota))));
          matched.push({
            criterioId: targetCriterio.id,
            nome: targetCriterio.nome,
            pilarNome: pilarObj?.nome || 'Pilar',
            nota: isNaN(validNota) ? 1 : validNota,
            solucao: item.solucao || '',
          });
        } else {
          unmatched.push(
            `Item #${index + 1}: ${item.pilar || 'Pilar desconhecido'} - Item ${item.item ?? '?'} (${
              item.topico || 'Sem título'
            })`
          );
        }
      });

      setParsedResult({
        matched,
        unmatched,
        resumo: parsed.resumo,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar JSON da skill.';
      setErrorMsg(msg);
    }
  };

  const handleConfirmApply = () => {
    if (!parsedResult || parsedResult.matched.length === 0) return;

    onApply({
      resumo: parsedResult.resumo,
      avaliacoes: parsedResult.matched.map((m) => ({
        criterioId: m.criterioId,
        nota: m.nota,
        solucao: m.solucao,
      })),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#161d2e] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#dde2ec] dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#2f55d4] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-[#131a2b] dark:text-[#e8ecf5]">
                Colar Resultado da Skill
              </h3>
              <p className="text-xs text-[#5d6680] dark:text-slate-400">
                Importe a resposta gerada pelo Claude para preencher os 19 tópicos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Cole a resposta do Claude contendo o JSON abaixo:
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder='Cole aqui... O sistema localiza automaticamente do primeiro "{" ao último "}" com formato {"lumos":"diagnostico-v1", ...}'
              rows={7}
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#2f55d4]"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#5d6680] dark:text-slate-400">
              Formato esperado: JSON com `lumos`, `resumo` e `avaliacoes`
            </span>
            <button
              type="button"
              onClick={handleParse}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#2f55d4] hover:bg-[#2544ad] rounded-lg transition-colors cursor-pointer"
            >
              <Clipboard className="w-3.5 h-3.5" />
              Processar Texto
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro ao analisar JSON:</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {parsedResult && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {parsedResult.matched.length} de 19 tópicos identificados com sucesso!
                </span>
              </div>

              {parsedResult.resumo && (
                <div className="text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Resumo extraído:
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 italic">
                    "{parsedResult.resumo}"
                  </p>
                </div>
              )}

              {parsedResult.unmatched.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-bold block mb-1">
                    {parsedResult.unmatched.length} itens não reconhecidos:
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {parsedResult.unmatched.map((un, i) => (
                      <li key={i}>{un}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!parsedResult || parsedResult.matched.length === 0}
            onClick={handleConfirmApply}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#2f55d4] hover:bg-[#2544ad] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
          >
            Aplicar no Diagnóstico ({parsedResult?.matched.length || 0} itens)
          </button>
        </div>
      </div>
    </div>
  );
};
