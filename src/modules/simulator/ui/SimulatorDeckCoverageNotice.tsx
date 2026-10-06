import { ShieldAlert } from "lucide-react";
import type { SimulatorDeckOption } from "@/lib/api";
import { CardInspectorPlayabilityBadge } from "./CardInspectorPlayabilityBadge";

/**
 * Mensagem persistente (não é toast — fica na tela) explicando por que um
 * deck do próprio jogador está bloqueado no simulador: carta(s) sem
 * cobertura no motor. Aparece quando o jogador SELECIONA um deck vermelho e
 * insiste em tentar usá-lo (docs/debates 2026-09-14, pedido do Willen —
 * "se ele insistir, aparece a mensagem na tela com o impeditivo").
 */
export function SimulatorDeckCoverageNotice({ deck }: { deck: SimulatorDeckOption }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-red-500/40 bg-red-950/30 p-3 text-xs leading-relaxed text-red-200">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-400" />
      <div className="space-y-1.5">
        <p className="font-semibold uppercase tracking-wide text-red-300">
          "{deck.name}" não pode entrar em partida
        </p>
        {deck.unplayableCards.length > 0 ? (
          <div>
            <p className="mb-1 text-slate-300">
              Carta(s) sem cobertura no motor do simulador ainda:
            </p>
            <div className="flex flex-wrap gap-1.5 py-0.5">
              {deck.unplayableCards.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-slate-900/90 px-1.5 py-0.5 font-mono text-[11px] text-red-200"
                >
                  <span className="font-bold">{code}</span>
                  <CardInspectorPlayabilityBadge code={code} className="scale-90" />
                </span>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-red-300/80">
              Troque essas cartas no deckbuilder ou escolha outro deck.
            </p>
          </div>
        ) : (
          <p>{deck.reason ?? "Este deck não passou na checagem de cobertura do simulador."}</p>
        )}
      </div>
    </div>
  );
}
