/* docs/19, Sessão 3 — modal de ordenação de gatilhos simultâneos. Clique nas
 * setas pra definir a ordem em que os efeitos resolvem; "Confirmar" envia
 * `resolveTriggerOrder`. (Nenhum card de ST01/ST02 dispara 2 triggers de
 * cartas diferentes no mesmo evento ainda — ver `actions.ts` —, então este
 * modal só aparece quando um card assim entrar. Construído agora pra não
 * faltar o ponto de decisão na UI quando isso acontecer.) */
import { useState } from "react";
import { ArrowDown, ArrowUp, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingDecision } from "@/modules/simulator/engine/types";

interface TriggerOrderModalProps {
  decision: Extract<PendingDecision, { kind: "triggerOrder" }>;
  busy?: boolean;
  onResolve: (orderedSpecIds: string[]) => void;
}

/**
 * O pai monta este modal só enquanto existe uma `triggerOrder` pendente e
 * some entre decisões — então o `useState` inicial já basta (não precisa de
 * efeito de "resetar quando a prop mudar"). Se um dia duas rodadas de
 * gatilhos vierem sem intervalo, o pai deve passar `key={...}` pra forçar
 * remontagem.
 */
export function TriggerOrderModal({ decision, busy, onResolve }: TriggerOrderModalProps) {
  const [order, setOrder] = useState<string[]>(() => decision.triggers.map((t) => t.specId));

  const move = (index: number, dir: -1 | 1) => {
    setOrder((current) => {
      const next = [...current];
      const target = index + dir;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const labelFor = (specId: string) => decision.triggers.find((t) => t.specId === specId)?.label ?? specId;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="panel-cut hero-surface w-full max-w-sm border border-primary/40 p-4">
        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-black uppercase tracking-[0.2em] text-primary">
          <Layers className="size-4" /> Ordem dos gatilhos
        </p>
        <p className="mt-1 text-center text-[10px] text-muted-portal">Vários efeitos dispararam juntos — escolha a ordem em que resolvem (de cima pra baixo).</p>
        <ol className="mt-3 space-y-1">
          {order.map((specId, i) => (
            <li key={specId} className="flex items-center gap-2 border border-white/10 bg-black/40 px-2 py-1.5">
              <span className="flex size-5 items-center justify-center bg-primary/20 text-[10px] font-black text-primary">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-soft">{labelFor(specId)}</span>
              <button type="button" className="p-1 text-slate-400 hover:text-primary disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-4" />
              </button>
              <button type="button" className="p-1 text-slate-400 hover:text-primary disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-4" />
              </button>
            </li>
          ))}
        </ol>
        <Button className="mt-4 h-10 w-full rounded-arena bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={() => onResolve(order)}>
          Confirmar ordem
        </Button>
      </div>
    </div>
  );
}
