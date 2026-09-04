/* Resolução de gatilho(s) de habilidade NUM MOMENTO SEPARADO da ação que os
 * disparou (【When Paired】 ao parear, 【Attack】 ao declarar ataque, …). A fila
 * pode ter 1+ efeitos simultâneos: o jogador ordena (não é cadeia, é ordenação
 * de eventos), escolhe o alvo de cada um (Unit inimiga / Recurso próprio / Unit
 * amiga) e, pra efeito `optional`, ativa ou pula. "Confirmar" envia
 * `resolveAbility` na ordem montada aqui. */
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingDecision } from "@/modules/simulator/engine/types";

type Decision = Extract<PendingDecision, { kind: "abilityResolution" }>;
type TargetScope = Decision["queue"][number]["targetScope"];
type TargetOption = { instanceId: string; label: string };

interface AbilityResolutionModalProps {
  decision: Decision;
  /** opções de alvo por escopo — o pai monta a partir do `view`. */
  targetsByScope: Record<TargetScope, TargetOption[]>;
  busy?: boolean;
  onResolve: (resolutions: Array<{ specId: string; activate: boolean; targetIds: string[] }>) => void;
}

const TRIGGER_LABEL: Record<string, string> = {
  "When Paired": "Vínculo resolvido — 【When Paired】",
  Attack: "Ataque declarado — 【Attack】",
  Deploy: "Carta implantada — 【Deploy】",
};

export function AbilityResolutionModal({ decision, targetsByScope, busy, onResolve }: AbilityResolutionModalProps) {
  const [order, setOrder] = useState<string[]>(() => decision.queue.map((q) => q.specId));
  const [activate, setActivate] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(decision.queue.map((q) => [q.specId, true])),
  );
  const [target, setTarget] = useState<Record<string, string>>({});

  const itemFor = (specId: string) => decision.queue.find((q) => q.specId === specId)!;
  const optionsFor = (specId: string) => targetsByScope[itemFor(specId).targetScope] ?? [];

  const move = (index: number, dir: -1 | 1) => {
    setOrder((current) => {
      const next = [...current];
      const t = index + dir;
      if (t < 0 || t >= next.length) return current;
      [next[index], next[t]] = [next[t], next[index]];
      return next;
    });
  };

  const canConfirm = order.every((specId) => {
    const q = itemFor(specId);
    if (!activate[specId]) return true;
    if (q.needsTarget && optionsFor(specId).length > 0) return Boolean(target[specId]);
    return true;
  });

  const confirm = () =>
    onResolve(
      order.map((specId) => ({
        specId,
        activate: Boolean(activate[specId]),
        targetIds: itemFor(specId).needsTarget && target[specId] ? [target[specId]] : [],
      })),
    );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="panel-cut hero-surface w-full max-w-sm border border-amber-400/50 p-4">
        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-black uppercase tracking-[0.16em] text-amber-300">
          <Sparkles className="size-4" /> {TRIGGER_LABEL[decision.trigger] ?? decision.trigger}
        </p>
        {order.length > 1 ? (
          <p className="mt-1 text-center text-[10px] text-muted-portal">
            Vários efeitos dispararam juntos — escolha a ordem (de cima pra baixo).
          </p>
        ) : null}

        <ol className="mt-3 space-y-2">
          {order.map((specId, i) => {
            const q = itemFor(specId);
            const on = Boolean(activate[specId]);
            const opts = optionsFor(specId);
            return (
              <li key={specId} className="border border-white/10 bg-black/40 p-2">
                <div className="flex items-center gap-2">
                  {order.length > 1 ? (
                    <span className="flex size-5 shrink-0 items-center justify-center bg-amber-400/20 text-[10px] font-black text-amber-300">
                      {i + 1}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 text-xs leading-snug text-soft">{q.label}</span>
                  {order.length > 1 ? (
                    <span className="flex shrink-0">
                      <button type="button" className="p-1 text-slate-400 hover:text-amber-300 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="size-4" />
                      </button>
                      <button type="button" className="p-1 text-slate-400 hover:text-amber-300 disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown className="size-4" />
                      </button>
                    </span>
                  ) : null}
                </div>

                {q.optional ? (
                  <div className="mt-2 flex gap-1">
                    <Toggle active={on} onClick={() => setActivate((s) => ({ ...s, [specId]: true }))}>
                      Ativar
                    </Toggle>
                    <Toggle active={!on} onClick={() => setActivate((s) => ({ ...s, [specId]: false }))}>
                      Pular
                    </Toggle>
                  </div>
                ) : null}

                {on && q.needsTarget ? (
                  opts.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {opts.map((opt) => (
                        <Toggle
                          key={opt.instanceId}
                          active={target[specId] === opt.instanceId}
                          onClick={() => setTarget((s) => ({ ...s, [specId]: opt.instanceId }))}
                        >
                          {opt.label}
                        </Toggle>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-muted-portal">Nenhum alvo legal — o efeito não faz nada.</p>
                  )
                ) : null}
              </li>
            );
          })}
        </ol>

        <Button
          className="mt-4 h-10 w-full rounded-arena bg-amber-400 text-black hover:bg-amber-300"
          disabled={busy || !canConfirm}
          onClick={confirm}
        >
          Confirmar
        </Button>
      </div>
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-8 rounded-arena border px-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
        active ? "border-amber-400 bg-amber-400/20 text-amber-200" : "border-white/10 bg-black/40 text-slate-300 hover:border-amber-400/50",
      )}
    >
      {children}
    </button>
  );
}
