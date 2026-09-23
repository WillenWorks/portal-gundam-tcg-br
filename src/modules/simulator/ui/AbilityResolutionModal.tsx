/* Resolução de gatilho(s) de habilidade NUM MOMENTO SEPARADO da ação que os
 * disparou (【When Paired】 ao parear, 【Attack】 ao declarar ataque, …). A fila
 * pode ter 1+ efeitos simultâneos: o jogador ordena (não é cadeia, é ordenação
 * de eventos), escolhe o alvo de cada um (Unit inimiga / Recurso próprio / Unit
 * amiga) e, pra efeito `optional`, ativa ou pula. "Confirmar" envia
 * `resolveAbility` na ordem montada aqui.
 *
 * docs/56 tarefa 3 — reancorado no topo (era centralizado com `bg-black/85`
 * cobrindo a tela). Listas de alvo usam SCROLL HORIZONTAL compacto (não mais
 * `flex-wrap`, que crescia verticalmente e podia empurrar o painel até cobrir
 * a mão) — a Battle Area, Recursos e mão do jogador continuam visíveis.
 *
 * "Nova leva de correções" (item 4, plano v2) — alvo em UNIT (targetScope
 * "enemyUnit"/"friendlyUnit"/"anyUnit") não usa mais lista de pills aqui: o
 * jogador seleciona clicando direto na Unit no tabuleiro (glow verde =
 * aliado legal, vermelho = inimigo legal — ver `BattleSlot.tsx`
 * `abilityTargetPool`/`abilitySelected`). Por isso `targets`/`secondaryTargets`/
 * `activate` agora são CONTROLADOS pelo pai (`SimulatorMatchPage.tsx`), que
 * também escreve neles a partir do clique no tabuleiro — sem isso, o clique
 * no tabuleiro e o clique aqui dentro do modal escreveriam em cópias
 * diferentes do estado. Alvo em Recurso/Base/mão/deck/lixeira continua
 * exatamente como antes (pills aqui dentro, sem equivalente de glow). */
import { type Dispatch, type ReactNode, type SetStateAction, useState } from "react";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingDecision } from "@/modules/simulator/engine/types";

type Decision = Extract<PendingDecision, { kind: "abilityResolution" }>;
type QueueItem = Decision["queue"][number];

/** `targetScope`s que representam uma Unit no tabuleiro (têm glow inline em
 *  `BattleSlot`) — o resto (`ownResource`/`friendlyBase`/etc.) não tem
 *  equivalente visual ainda, continua resolvendo via pills no modal. */
const UNIT_TARGET_SCOPES = new Set(["enemyUnit", "friendlyUnit", "anyUnit"]);

export function isUnitTargetScope(scope: string): boolean {
  return UNIT_TARGET_SCOPES.has(scope);
}

/** `true` quando o alvo PRIMÁRIO deste item da fila é resolvido via glow no
 *  tabuleiro (em vez de pills) — usado tanto aqui quanto pelo pai pra decidir
 *  o que desenhar. */
export function usesBoardTargetingForPrimary(q: QueueItem): boolean {
  return q.needsTarget && isUnitTargetScope(q.targetScope);
}

export function usesBoardTargetingForSecondary(q: QueueItem): boolean {
  return Boolean(q.secondaryTarget && isUnitTargetScope(q.secondaryTarget.targetScope));
}

/** alterna um alvo de escolha única (substitui a seleção anterior; clicar de
 *  novo no mesmo desfaz). Pura — usada tanto pelo modal quanto pelo clique
 *  direto no tabuleiro, pra nunca divergir a lógica dos dois caminhos. */
export function pickSingleTarget(
  targets: Record<string, string[]>,
  specId: string,
  instanceId: string,
): Record<string, string[]> {
  return { ...targets, [specId]: targets[specId]?.[0] === instanceId ? [] : [instanceId] };
}

export function pickSecondaryTarget(
  secondaryTargets: Record<string, string[]>,
  specId: string,
  instanceId: string,
): Record<string, string[]> {
  return { ...secondaryTargets, [specId]: secondaryTargets[specId]?.[0] === instanceId ? [] : [instanceId] };
}

/** alterna um alvo de escolha múltipla (até `max`) — clicar de novo remove;
 *  clicar num novo adiciona até o teto. */
export function toggleMultiTarget(
  targets: Record<string, string[]>,
  specId: string,
  instanceId: string,
  max: number,
): Record<string, string[]> {
  const cur = targets[specId] ?? [];
  if (cur.includes(instanceId)) {
    return { ...targets, [specId]: cur.filter((id) => id !== instanceId) };
  }
  if (cur.length < max) {
    return { ...targets, [specId]: [...cur, instanceId] };
  }
  return targets;
}

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
  /** controlado pelo pai — o clique no tabuleiro (alvo em Unit) escreve aqui direto. */
  targets: Record<string, string[]>;
  setTargets: Dispatch<SetStateAction<Record<string, string[]>>>;
  secondaryTargets: Record<string, string[]>;
  setSecondaryTargets: Dispatch<SetStateAction<Record<string, string[]>>>;
  activate: Record<string, boolean>;
  setActivate: Dispatch<SetStateAction<Record<string, boolean>>>;
  onResolve: (resolutions: Array<{ specId: string; activate: boolean; targetIds: string[]; secondaryTargetIds?: string[] }>) => void;
}

const TRIGGER_LABEL: Record<string, string> = {
  "When Paired": "Vínculo resolvido — 【When Paired】",
  Attack: "Ataque declarado — 【Attack】",
  Deploy: "Carta implantada — 【Deploy】",
  Main: "Comando — 【Main】",
  Action: "Comando — 【Action】",
};

export function AbilityResolutionModal({
  decision,
  resolveLabel,
  resolveHandLabel,
  busy,
  targets,
  setTargets,
  secondaryTargets,
  setSecondaryTargets,
  activate,
  setActivate,
  onResolve,
}: AbilityResolutionModalProps) {
  const [order, setOrder] = useState<string[]>(() => decision.queue.map((q) => q.specId));
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

  const pickSingle = (specId: string, instanceId: string) => setTargets((s) => pickSingleTarget(s, specId, instanceId));

  const pickSecondary = (specId: string, instanceId: string) =>
    setSecondaryTargets((s) => pickSecondaryTarget(s, specId, instanceId));

  const toggleMulti = (specId: string, instanceId: string, max: number) =>
    setTargets((s) => toggleMultiTarget(s, specId, instanceId, max));

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
    <div className="fixed top-2 inset-x-0 z-[75] pointer-events-none flex justify-center px-2 animate-in slide-in-from-top-2 fade-in duration-200 motion-reduce:animate-none">
      <div className="pointer-events-auto panel-cut hero-surface mx-auto w-[min(96vw,44rem)] max-h-[38vh] overflow-y-auto border border-amber-400/70 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-amber-300">
            <Sparkles className="size-3.5" /> {TRIGGER_LABEL[decision.trigger] ?? decision.trigger}
          </p>
          <div className="flex items-center gap-2">
            {order.length > 1 ? (
              <span className="text-[10px] text-muted-portal">Ordene e escolha os alvos:</span>
            ) : null}
            <Button
              size="sm"
              className="h-7 rounded-arena bg-amber-400 px-3 text-xs font-bold text-black hover:bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
              disabled={busy || !canConfirm}
              onClick={confirm}
            >
              Confirmar
            </Button>
          </div>
        </div>

        <ol className="mt-2 space-y-1.5">
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
                      {usesBoardTargetingForPrimary(q) ? (
                        <BoardTargetHint
                          side={q.targetScope === "friendlyUnit" ? "ally" : q.targetScope === "enemyUnit" ? "enemy" : "both"}
                          count={(targets[specId] ?? []).length}
                          max={q.targetCount?.max ?? 1}
                          label="Selecione no tabuleiro ou abaixo:"
                        />
                      ) : q.targetCount && q.targetCount.max > 1 ? (
                        <p className="text-[10px] text-amber-300">
                          Escolha de {q.targetCount.min ?? 1} a {q.targetCount.max} alvos (selecionados: {(targets[specId] ?? []).length}/{q.targetCount.max}):
                        </p>
                      ) : null}
                      <div className="scrollbar-ghost flex flex-wrap gap-1 pb-1">
                        {opts.map((opt) => {
                          const isSelected = (targets[specId] ?? []).includes(opt.instanceId);
                          const maxTargets = q.targetCount?.max ?? 1;
                          const isAlly = q.targetScope === "friendlyUnit";
                          const isEnemy = q.targetScope === "enemyUnit";
                          return (
                            <Toggle
                              key={opt.instanceId}
                              active={isSelected}
                              onClick={() => (maxTargets > 1 ? toggleMulti(specId, opt.instanceId, maxTargets) : pickSingle(specId, opt.instanceId))}
                            >
                              <span className="inline-flex items-center gap-1">
                                {isAlly ? (
                                  <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
                                ) : isEnemy ? (
                                  <span className="size-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.8)]" />
                                ) : null}
                                {opt.label}
                              </span>
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
                      {usesBoardTargetingForSecondary(q) ? (
                        <BoardTargetHint
                          side={q.secondaryTarget.targetScope === "friendlyUnit" ? "ally" : q.secondaryTarget.targetScope === "enemyUnit" ? "enemy" : "both"}
                          count={(secondaryTargets[specId] ?? []).length}
                          max={1}
                          label="E também (no tabuleiro ou abaixo):"
                        />
                      ) : (
                        <p className="text-[10px] text-amber-300">E também:</p>
                      )}
                      <div className="scrollbar-ghost flex flex-wrap gap-1 pb-1">
                        {q.secondaryTarget.legalTargets.map((instanceId) => {
                          const isSelected = (secondaryTargets[specId] ?? []).includes(instanceId);
                          const isAlly = q.secondaryTarget!.targetScope === "friendlyUnit";
                          const isEnemy = q.secondaryTarget!.targetScope === "enemyUnit";
                          return (
                            <Toggle
                              key={instanceId}
                              active={isSelected}
                              onClick={() => pickSecondary(specId, instanceId)}
                            >
                              <span className="inline-flex items-center gap-1">
                                {isAlly ? (
                                  <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
                                ) : isEnemy ? (
                                  <span className="size-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.8)]" />
                                ) : null}
                                {resolveLabel(instanceId)}
                              </span>
                            </Toggle>
                          );
                        })}
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
                      <div className="scrollbar-ghost flex gap-1 overflow-x-auto pb-1">
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
                    <div className="scrollbar-ghost flex gap-1 overflow-x-auto pb-1">
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
                      <div className="scrollbar-ghost flex gap-1 overflow-x-auto pb-1">
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
                    <div className="scrollbar-ghost flex gap-1 overflow-x-auto pb-1">
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
                    <div className="scrollbar-ghost flex gap-1 overflow-x-auto pb-1">
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
      </div>
    </div>
  );
}

/** substitui a lista de pills quando o alvo é Unit no tabuleiro (item 4, plano
 *  v2): só um lembrete de qual glow procurar — a seleção em si acontece
 *  clicando na `BattleSlot` (verde = aliado legal, vermelho = inimigo legal,
 *  ver `abilityTargetPool`/`abilitySelected`). Clicar de novo no mesmo alvo
 *  desfaz; clicar em outro troca (ou soma, até `max`, se `targetCount.max > 1`). */
function BoardTargetHint({
  side,
  count,
  max,
  label = "Selecione no tabuleiro:",
}: {
  side: "ally" | "enemy" | "both";
  count: number;
  max: number;
  label?: string;
}) {
  const swatch =
    side === "ally" ? (
      <span className="inline-flex items-center gap-1">
        <span className="size-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" /> aliado
      </span>
    ) : side === "enemy" ? (
      <span className="inline-flex items-center gap-1">
        <span className="size-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.9)]" /> inimigo
      </span>
    ) : (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" /> aliado
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.9)]" /> inimigo
        </span>
      </span>
    );
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-portal">
      {label} {swatch}
      {max > 1 ? (
        <span className="text-amber-300">
          ({count}/{max} selecionado{max === 1 ? "" : "s"})
        </span>
      ) : null}
    </p>
  );
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
        "min-h-8 shrink-0 rounded-arena border px-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
        active ? "border-amber-400 bg-amber-400/20 text-amber-200" : "border-white/10 bg-black/40 text-slate-300 hover:border-amber-400/50",
        disabled && "cursor-not-allowed opacity-40 hover:border-white/10",
      )}
    >
      {children}
    </button>
  );
}
