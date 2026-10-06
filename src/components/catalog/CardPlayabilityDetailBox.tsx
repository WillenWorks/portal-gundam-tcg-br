import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, HelpCircle, ExternalLink, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCardPlayability } from "./useCardPlayability";
import { CardPlayabilityBadge } from "./CardPlayabilityBadge";
import type { CardStatusEntry } from "@/lib/api";

export interface CardPlayabilityDetailBoxProps {
  code?: string;
  entry?: CardStatusEntry | null;
  className?: string;
}

export function CardPlayabilityDetailBox({
  code,
  entry: propEntry,
  className,
}: CardPlayabilityDetailBoxProps) {
  const query = useCardPlayability(propEntry ? undefined : code);
  const entry = propEntry || query.entry;
  const status = entry?.status || query.status || "fora";
  const missingClauses = entry?.missingClauses || query.missingClauses || [];

  const totalClauses = entry?.totalClauses ?? 0;
  const implementedClauses = entry?.implementedClauses ?? 0;
  const hasClauseRatio = totalClauses > 0;
  const progressPercent = hasClauseRatio
    ? Math.round((implementedClauses / totalClauses) * 100)
    : status === "apta"
      ? 100
      : 0;

  return (
    <Card className={`panel-cut rounded-none surface-panel ${className ?? ""}`}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono uppercase tracking-[0.24em] text-slate-400">
                Simulador AnaheimHub
              </p>
              <CardPlayabilityBadge
                entry={entry}
                code={code}
                size="sm"
                showTooltip={false}
              />
            </div>
            <h2 className="mt-1 font-heading text-2xl uppercase tracking-wide">
              Status de Jogabilidade
            </h2>
          </div>

          <Link
            href="/rules"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline self-start sm:self-auto"
          >
            <span>Ver regras e rulings</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </div>

        {status === "apta" ? (
          <div className="border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
              <span>Carta 100% pronta para jogar</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Todas as regras, gatilhos e efeitos desta carta foram implementados e auditados no motor do simulador. Decks que contenham esta carta são aceitos no <strong>Treino Solo (Bot)</strong>, na <strong>Fila Casual</strong> e em <strong>Convites Diretos</strong>.
            </p>
          </div>
        ) : null}

        {status === "revisao" ? (
          <div className="space-y-4">
            <div className="border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-start gap-2.5 text-amber-300 font-semibold text-sm">
                <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <p>Carta em revisão no motor do simulador</p>
                  <p className="text-xs font-normal text-amber-200/80 mt-0.5">
                    Decks com esta carta não podem entrar em partidas no simulador até que todas as cláusulas sejam concluídas.
                  </p>
                </div>
              </div>

              {hasClauseRatio ? (
                <div className="space-y-1.5 border-t border-amber-500/20 pt-3">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                    <span>Progresso de implementação</span>
                    <span className="font-bold text-amber-300">
                      {implementedClauses} de {totalClauses} cláusulas ({progressPercent}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 border border-white/10 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {missingClauses.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-amber-400" />
                  <h3 className="text-xs font-mono uppercase tracking-[0.16em] text-slate-300">
                    O que falta implementar no simulador:
                  </h3>
                  <Badge variant="outline" className="border-amber-400/40 text-amber-300 text-[10px]">
                    {missingClauses.length} cláusula{missingClauses.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                <div className="grid gap-2">
                  {missingClauses.map((clauseText, index) => (
                    <div
                      key={index}
                      className="border border-white/10 bg-slate-950/60 p-3 text-xs leading-relaxed"
                    >
                      <span className="font-mono text-amber-400 font-bold mr-2">
                        [Cláusula {index + 1}]
                      </span>
                      <span className="text-slate-300 italic font-serif">"{clauseText}"</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {status === "fora" ? (
          <div className="border border-slate-600/40 bg-slate-800/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
              <HelpCircle className="size-4 shrink-0 text-slate-400" />
              <span>Fora do catálogo ativo do simulador</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Esta carta pertence a um conjunto ou produto que ainda não foi adicionado ao ciclo ativo de implementação do simulador (ex.: coleções futuras). Assim que for programada no motor, o status passará a refletir sua disponibilidade automaticamente.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default CardPlayabilityDetailBox;
