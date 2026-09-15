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

interface AbilityResolutionModalProps {
  decision: Decision;
  /**
   * Nome pra mostrar por `instanceId` (o pai monta a partir do `view`, cartas
   * públicas — enemyUnit/friendlyUnit/ownResource sempre são). V0 (docs/25):
   * a LISTA de opções em si já vem pronta e filtrada em
   * `decision.queue[i].legalTargets` (calculada no servidor com o
   * `targetFilter` de cada carta — HP/nível/descansada/etc.) — este
   * componente só resolve o RÓTULO, nunca decide quem é legal.
   */
  resolveLabel: (instanceId: string) => string;
  /**
   * Nome de uma carta da MÃO do jogador por `instanceId` — usado só pelas
   * entradas com `handChoice` (ST03-010 Full Frontal 【When Paired】). O pai
   * monta a partir de `view.players[seat].hand` (a própria mão é sempre
   * visível ao dono).
   */
  resolveHandLabel?: (instanceId: string) => string;
  busy?: boolean;
  onResolve: (resolutions: Array<{ specId: string; activate: boolean; targetIds: string[]; secondaryTargetIds?: string[] }>) => void;
}

const TRIGGER_LABEL: Record<string, string> = {
  "When Paired": "Vínculo resolvido — 【When Paired】",
  Attack: "Ataque declarado — 【Attack】",
  Deploy: "Carta implantada — 【Deploy】",
  Main: "Comando — 【Main】",
  Action: "Comando — 【Action】",
};

export function AbilityResolutionModal({ decision, resolveLabel, resolveHandLabel, busy, onResolve }: AbilityResolutionModalProps) {
  const [order, setOrder] = useState<string[]>(() => decision.queue.map((q) => q.specId));
  const [activate, setActivate] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(decision.queue.map((q) => [q.specId, true])),
  );
  const [targets, setTargets] = useState<Record<string, string[]>>({});
  /** docs/47 Fase 5 — escolha do 2º pool de alvo (`q.secondaryTarget`), ex. ST05-010 Mikazuki Augus. */
  const [secondaryTargets, setSecondaryTargets] = useState<Record<string, string[]>>({});
  /** docs/47 Classe A — atribuição carta→posição pra `deckReorder` (specId → slotName → instanceId). */
  const [reorder, setReorder] = useState<Record<string, Record<string, string>>>({});

  const itemFor = (specId: string) => decision.queue.find((q) => q.specId === specId)!;
  const optionsFor = (specId: string) => itemFor(specId).legalTargets.map((instanceId) => ({ instanceId, label: resolveLabel(instanceId) }));

  /** atribui `cardId` a `slotName` (specId), tirando-o de qualquer outro slot do mesmo spec. */
  const assignReorder = (specId: string, slotName: string, cardId: string) =>
    setReorder((s) => {
      const cur = { ...(s[specId] ?? {}) };
      for (const k of Object.keys(cur)) if (cur[k] === cardId) delete cur[k];
      cur[slotName] = cur[slotName] === cardId ? "" : cardId;
      if (!cur[slotName]) delete cur[slotName];
      return { ...s, [specId]: cur };
    });

  /** `deckTopReveal`/`handDiscard`/`deckReorder`/`enumChoice`/`trashSearch` ignoram o toggle Ativar/Pular (mandatórios). */
  const showActivateToggle = (specId: string) => {
    const q = itemFor(specId);
    return q.optional && !q.deckTopReveal && !q.handDiscard && !q.deckReorder && !q.enumChoice && !q.trashSearch;
  };

  const pickSingle = (specId: string, instanceId: string) =>
    setTargets((s) => ({
      ...s,
      [specId]: s[specId]?.[0] === instanceId ? [] : [instanceId],
    }));

  const pickSecondary = (specId: string, instanceId: string) =>
    setSecondaryTargets((s) => ({
      ...s,
      [specId]: s[specId]?.[0] === instanceId ? [] : [instanceId],
    }));

  const toggleMulti = (specId: string, instanceId: string, max: number) =>
    setTargets((s) => {
      const cur = s[specId] ?? [];
      if (cur.includes(instanceId)) {
        return { ...s, [specId]: cur.filter((id) => id !== instanceId) };
      }
      if (cur.length < max) {
        return { ...s, [specId]: [...cur, instanceId] };
      }
      return s;
    });

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
    const chosen = targets[specId] ?? [];
    if (q.deckTopReveal) return true; // revelar 1 ou nenhuma — sempre válido
    if (q.handDiscard) return q.handDiscard.legalHandIds.length === 0 || chosen.length > 0;
    if (q.deckReorder) {
      const want = Math.min(q.deckReorder.slots.length, q.deckReorder.topCards.length);
      return Object.keys(reorder[specId] ?? {}).length === want;
    }
    if (q.enumChoice) return chosen.length > 0;
    if (q.trashSearch) return true; // 0 ou 1 id da lixeira — sempre válido
    if (!activate[specId]) return true;
    if (q.handChoice) return q.handChoice.legalHandIds.length === 0 || chosen.length > 0;
    if (q.needsTarget && optionsFor(specId).length > 0) {
      const min = q.targetCount?.min ?? 1;
      if (chosen.length < Math.min(min, optionsFor(specId).length)) return false;
    }
    if (q.secondaryTarget && q.secondaryTarget.legalTargets.length > 0) {
      return (secondaryTargets[specId] ?? []).length > 0;
    }
    return true;
  });

  const confirm = () =>
    onResolve(
      order.map((specId) => {
        const q = itemFor(specId);
        const chosen = targets[specId] ?? [];
        const secondaryChosen = q.secondaryTarget ? (secondaryTargets[specId] ?? []) : undefined;
        if (q.deckTopReveal) return { specId, activate: true, targetIds: chosen };
        if (q.handDiscard) return { specId, activate: true, targetIds: chosen };
        if (q.deckReorder) {
          const map = reorder[specId] ?? {};
          return { specId, activate: true, targetIds: q.deckReorder.slots.map((s) => map[s.name]).filter(Boolean) };
        }
        if (q.enumChoice) return { specId, activate: true, targetIds: chosen };
        if (q.trashSearch) return { specId, activate: true, targetIds: chosen };
        const on = Boolean(activate[specId]);
        if (q.handChoice) return { specId, activate: on, targetIds: on ? chosen : [] };
        return {
          specId,
          activate: on,
          targetIds: q.needsTarget ? chosen : [],
          secondaryTargetIds: q.secondaryTarget ? (on ? secondaryChosen : []) : undefined,
        };
      }),
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

                {showActivateToggle(specId) ? (
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
                    <div className="mt-2 space-y-1">
                      {q.targetCount && q.targetCount.max > 1 ? (
                        <p className="text-[10px] text-amber-300">
                          Escolha de {q.targetCount.min ?? 1} a {q.targetCount.max} alvos (selecionados: {(targets[specId] ?? []).length}/{q.targetCount.max}):
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-1">
                        {opts.map((opt) => {
                          const isSelected = (targets[specId] ?? []).includes(opt.instanceId);
                          const maxTargets = q.targetCount?.max ?? 1;
                          return (
                            <Toggle
                              key={opt.instanceId}
                              active={isSelected}
                              onClick={() => (maxTargets > 1 ? toggleMulti(specId, opt.instanceId, maxTargets) : pickSingle(specId, opt.instanceId))}
                            >
                              {opt.label}
                            </Toggle>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-muted-portal">Nenhum alvo legal — o efeito não faz nada.</p>
                  )
                ) : null}

                {on && q.secondaryTarget ? (
                  q.secondaryTarget.legalTargets.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-amber-300">E também:</p>
                      <div className="flex flex-wrap gap-1">
                        {q.secondaryTarget.legalTargets.map((instanceId) => (
                          <Toggle
                            key={instanceId}
                            active={(secondaryTargets[specId] ?? []).includes(instanceId)}
                            onClick={() => pickSecondary(specId, instanceId)}
                          >
                            {resolveLabel(instanceId)}
                          </Toggle>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-muted-portal">Nenhum alvo legal pro 2º escolhido — o efeito não faz nada.</p>
                  )
                ) : null}

                {on && q.handChoice ? (
                  q.handChoice.legalHandIds.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-muted-portal">Escolha 1 Unidade da sua mão pra implantar sem custo:</p>
                      <div className="flex flex-wrap gap-1">
                        {q.handChoice.legalHandIds.map((instanceId) => (
                          <Toggle
                            key={instanceId}
                            active={(targets[specId] ?? []).includes(instanceId)}
                            onClick={() => pickSingle(specId, instanceId)}
                          >
                            {resolveHandLabel?.(instanceId) ?? "Carta"}
                          </Toggle>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-muted-portal">Nenhuma Unidade elegível na mão — o efeito não faz nada.</p>
                  )
                ) : null}

                {q.deckTopReveal ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-muted-portal">
                      Topo do deck ({q.deckTopReveal.count}) — revele 1 Unidade (Zeon)/(Neo Zeon) ou nenhuma. O resto vai
                      pro fundo.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {q.deckTopReveal.topCards.map((card) => {
                        const revealable = q.deckTopReveal!.revealableIds.includes(card.instanceId);
                        return (
                          <Toggle
                            key={card.instanceId}
                            active={(targets[specId] ?? []).includes(card.instanceId)}
                            disabled={!revealable}
                            onClick={() => pickSingle(specId, card.instanceId)}
                          >
                            {card.def.nameEn}
                            {revealable ? "" : " (não revelável)"}
                          </Toggle>
                        );
                      })}
                      <Toggle active={(targets[specId] ?? []).length === 0} onClick={() => setTargets((s) => ({ ...s, [specId]: [] }))}>
                        Não revelar
                      </Toggle>
                    </div>
                  </div>
                ) : null}

                {q.handDiscard ? (
                  q.handDiscard.legalHandIds.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-muted-portal">Escolha 1 carta da mão pra descartar:</p>
                      <div className="flex flex-wrap gap-1">
                        {q.handDiscard.legalHandIds.map((instanceId) => (
                          <Toggle
                            key={instanceId}
                            active={(targets[specId] ?? []).includes(instanceId)}
                            onClick={() => pickSingle(specId, instanceId)}
                          >
                            {resolveHandLabel?.(instanceId) ?? "Carta"}
                          </Toggle>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-muted-portal">Mão vazia — nada pra descartar.</p>
                  )
                ) : null}

                {q.deckReorder ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-muted-portal">
                      Topo do deck — coloque 1 no topo e 1 no fundo:
                    </p>
                    <div className="space-y-1">
                      {q.deckReorder.topCards.map((card) => (
                        <div key={card.instanceId} className="flex items-center gap-1">
                          <span className="min-w-0 flex-1 truncate text-[10px] text-soft">{card.def.nameEn}</span>
                          {q.deckReorder!.slots.map((slot) => (
                            <Toggle
                              key={slot.name}
                              active={(reorder[specId] ?? {})[slot.name] === card.instanceId}
                              onClick={() => assignReorder(specId, slot.name, card.instanceId)}
                            >
                              {slot.position === "top" ? "↑ topo" : "↓ fundo"}
                            </Toggle>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {q.enumChoice ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-muted-portal">Escolha:</p>
                    <div className="flex flex-wrap gap-1">
                      {q.enumChoice.options.map((opt) => (
                        <Toggle
                          key={opt.value}
                          active={(targets[specId] ?? []).includes(opt.value)}
                          onClick={() => pickSingle(specId, opt.value)}
                        >
                          {opt.label}
                        </Toggle>
                      ))}
                    </div>
                  </div>
                ) : null}

                {q.trashSearch ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-muted-portal">
                      Lixeira ({q.trashSearch.legalTrashIds.length} cartas) — escolha 1 carta (ou nenhuma):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {q.trashSearch.legalTrashIds.map((instanceId) => (
                        <Toggle
                          key={instanceId}
                          active={(targets[specId] ?? []).includes(instanceId)}
                          onClick={() => pickSingle(specId, instanceId)}
                        >
                          {resolveLabel(instanceId)}
                        </Toggle>
                      ))}
                      <Toggle
                        active={(targets[specId] ?? []).length === 0}
                        onClick={() => setTargets((s) => ({ ...s, [specId]: [] }))}
                      >
                        Nenhuma
                      </Toggle>
                    </div>
                  </div>
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

function withoutKey(map: Record<string, string>, key: string): Record<string, string> {
  const next = { ...map };
  delete next[key];
  return next;
}

function Toggle({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "min-h-8 rounded-arena border px-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
        active ? "border-amber-400 bg-amber-400/20 text-amber-200" : "border-white/10 bg-black/40 text-slate-300 hover:border-amber-400/50",
        disabled && "cursor-not-allowed opacity-40 hover:border-white/10",
      )}
    >
      {children}
    </button>
  );
}
