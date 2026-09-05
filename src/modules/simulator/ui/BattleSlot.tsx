/* docs/19, Sessão 3 — um dos 6 slots fixos da Battle Area. Moldura tática
 * escura com acento ciano/dourado; Unit com badges de AP efetivo / HP
 * restante; overlay "RESTED"; Piloto acoplado (DockedPilot) com badge LINK;
 * realce verde/dourado quando é alvo legal de uma ação.
 *
 * Sprint 5 (refinamento Arena 3D) — o slot é RIGOROSAMENTE `aspect-[63/88]`.
 *
 * Ações de campo — cluster no canto SUP. DIREITO (`CardCornerActions`): "Ver"
 * (olho) SEMPRE ancorado no canto; Atacar / Ativar / Blocker / Mirar aparecem à
 * esquerda dele quando a jogada é possível. Sem badge "BLK" na carta — o botão
 * de escudo só aparece quando é hora de bloquear. */
import { Crosshair, ShieldCheck, Swords, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardInstance, GameState } from "@/modules/simulator/engine/types";
import { effectiveAp, effectiveHp, effectivePilotDef, hasKeyword, satisfiesLinkCondition } from "@/modules/simulator/engine/types";
import { isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardCornerActions, type CornerAction } from "./CardCornerActions";
import { CardFace } from "./CardFace";
import { DockedPilot } from "./DockedPilot";

export interface BattleSlotActions {
  onAttack?: (unit: CardInstance) => void;
  onDeclareTarget?: (unit: CardInstance) => void;
  onBlocker?: (unit: CardInstance) => void;
  /** 【Activate·Main】 de carta em campo (ex.: Tallgeese "Set active") — Etapa 3. */
  onActivate?: (unit: CardInstance) => void;
}

interface BattleSlotProps {
  unit: CardInstance | null;
  /** Pilot pareado com esta Unit (achado pelo pai via `pairedPilotId`). */
  pilot: CardInstance | null;
  art: ArtLookup;
  /** alvo legal de uma seleção/ataque em andamento — realça em verde/dourado. */
  legalTarget?: boolean;
  selected?: boolean;
  isAttacker?: boolean;
  /** Frente 4 (docs/38 §4.3) — Unit que ativou <Blocker> nesta batalha: sobe
   *  ~6px com inclinação oposta à do atacante. */
  isBlocking?: boolean;
  busy?: boolean;
  onSelect?: (unit: CardInstance) => void;
  onInspect?: (card: CardInstance) => void;
  /** hover / foco na Unit (ou `null` ao sair) — alimenta o inspetor lateral (Sprint 3). */
  onHoverCard?: (card: CardInstance | null) => void;
  /** estado do jogo (ViewGameState servido cast) — pra os badges de AP/HP
   *  incluírem os bônus estáticos 【During Pair】/【During Link】 e não só o
   *  modificador impresso do Piloto. */
  state?: GameState;
  actions?: BattleSlotActions;
  /** ref-callback pra o CombatLane medir a posição desta Unit (linha de mira). */
  registerRef?: (el: HTMLElement | null) => void;
}

export function BattleSlot({
  unit,
  pilot,
  art,
  legalTarget,
  selected,
  isAttacker,
  isBlocking,
  busy,
  onSelect,
  onInspect,
  onHoverCard,
  state,
  actions,
  registerRef,
}: BattleSlotProps) {
  if (!unit) {
    return (
      // V6.3 (docs/34): mesma altura total (carta + tira reservada) do slot
      // ocupado abaixo — senão a linha do grid (que soma a MAIOR célula)
      // ficaria mais alta só quando algum slot da fileira tem Piloto pareado,
      // e as vazias/sem-piloto pareciam "cair pra cima".
      <div className="flex w-full flex-col">
        <div className="relative aspect-[63/88] w-full rounded-arena border border-dashed border-primary/25 bg-slate-900/40">
          <div className="absolute inset-1 rounded-arena border border-primary/10" aria-hidden />
        </div>
        <div className="h-[clamp(1.15rem,calc(var(--card-w-std,2.17rem)*0.34),2.1rem)] shrink-0" aria-hidden />
      </div>
    );
  }

  // `state` (quando o pai passa) cobre os bônus estáticos 【During Pair】/
  // 【During Link】; o `pilot` direto cobre o modificador impresso do Piloto
  // (Comprehensive Rules 3-3-5) mesmo sem `state`.
  const ap = effectiveAp(unit, state, pilot);
  const hpRemaining = Math.max(0, effectiveHp(unit, state, pilot) - unit.damage);
  const apBuffed = ap !== (unit.def.ap ?? 0);
  const hpDamaged = unit.damage > 0;
  // Frente 4 (feedback Willen 3ª rodada): a Unit ganha só um selo curto "LINK"
  // (sem números — o modificador já está no AP/HP final acima e no chip do
  // piloto). Antes o "+2/+1 LINK" na tira do piloto truncava.
  const isLinkUnit = Boolean(pilot) && satisfiesLinkCondition(effectivePilotDef(pilot!), unit.def);

  const showAttack = Boolean(actions?.onAttack) && !unit.rested;
  const showTarget = Boolean(actions?.onDeclareTarget);
  const showBlocker = Boolean(actions?.onBlocker) && !unit.rested && hasKeyword(unit, "Blocker");
  const showActivate = Boolean(actions?.onActivate);

  // Frente 4 (docs/38 §3.1) — sem botão de "olho": o cluster de canto guarda só
  // ações OPERACIONAIS (Atacar / Ativar / Blocker / Mirar). Inspecionar é por
  // clique na área neutra da carta (ver `bodyInspects`).
  const cornerActions: CornerAction[] = [];
  if (showAttack) cornerActions.push({ key: "attack", icon: Swords, label: "Atacar", tone: "primary", disabled: busy, onClick: () => actions!.onAttack!(unit) });
  if (showActivate) cornerActions.push({ key: "activate", icon: Zap, label: "Ativar habilidade", tone: "accent", disabled: busy, onClick: () => actions!.onActivate!(unit) });
  if (showBlocker) cornerActions.push({ key: "blocker", icon: ShieldCheck, label: "Ativar Blocker", tone: "sky", disabled: busy, onClick: () => actions!.onBlocker!(unit) });
  if (showTarget) cornerActions.push({ key: "target", icon: Crosshair, label: "Mirar aqui", tone: "emerald", disabled: busy, onClick: () => actions!.onDeclareTarget!(unit) });

  // clique na carta (fora de seleção de alvo) abre o inspetor.
  const bodyInspects = Boolean(onInspect) && !legalTarget;

  const hoverProps = onHoverCard
    ? {
        onMouseEnter: () => onHoverCard(unit),
        onMouseLeave: () => onHoverCard(null),
        onFocus: () => onHoverCard(unit),
        onBlur: () => onHoverCard(null),
      }
    : {};

  return (
    <div
      ref={registerRef}
      {...hoverProps}
      className={cn(
        "group/slot relative flex w-full flex-col overflow-hidden rounded-arena border bg-gradient-to-b from-slate-900/80 to-black/80 transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        // no hover/foco o slot sobe no empilhamento pra a tira de ações (canto
        // sup. direito, levemente pra fora) passar por cima do slot vizinho.
        "hover:z-30 focus-within:z-30",
        // Frente 4 (docs/38 §4.3) — Unit que declarou ataque/bloqueio sobe ~6px
        // com leve inclinação (elevação tática, estilo Master Duel).
        // `motion-reduce` neutraliza o transform.
        isAttacker && "z-20 -translate-y-1.5 rotate-[-2deg] motion-reduce:transform-none",
        isBlocking && "z-20 -translate-y-1.5 rotate-[2deg] motion-reduce:transform-none",
        legalTarget
          ? "border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]"
          : selected || isAttacker
            ? "border-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            : "border-primary/20",
      )}
    >
      {/* corpo da carta: só é clicável quando é ALVO LEGAL de uma seleção
          (pareamento / mira de efeito). Inspecionar é sempre pelo botão "Ver"
          no canto — remove o conflito "clicar em Atacar abre a imagem".
          V6.3 (docs/34): antes o `DockedPilot` era um overlay ABSOLUTO por
          cima da base da arte (cobria a carta) — agora essa div É
          `aspect-[63/88]` sozinha (só a carta), e o Piloto ganha uma tira
          RESERVADA logo abaixo (nunca mais rouba espaço de dentro da arte). */}
      <div
        role={legalTarget || bodyInspects ? "button" : undefined}
        tabIndex={legalTarget || bodyInspects ? 0 : undefined}
        aria-label={bodyInspects ? `Ver ${unit.def.nameEn}` : undefined}
        onClick={
          legalTarget && onSelect
            ? () => onSelect(unit)
            : bodyInspects && onInspect
              ? () => onInspect(unit)
              : undefined
        }
        onKeyDown={
          legalTarget && onSelect
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(unit);
                }
              }
            : bodyInspects && onInspect
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onInspect(unit);
                  }
                }
              : undefined
        }
        className={cn("relative block aspect-[63/88] w-full", legalTarget || bodyInspects ? "cursor-pointer" : "cursor-default")}
      >
        <CardFace
          nameEn={unit.def.nameEn}
          code={unit.def.code}
          art={art}
          size="sm"
          className="h-full w-full"
          dimmed={unit.rested}
          backFallback={isGenericArtCard(unit.def.cardType, unit.def.isToken)}
        >
          {/* Frente 4 (feedback Willen 3ª rodada): selo curto "LINK" no topo da
              arte quando é Link Unit — sem números (o AP/HP final já reflete o
              buff). */}
          {isLinkUnit ? (
            <span
              className="absolute left-0 top-0 z-10 rounded-br-arena bg-amber-400 px-1 text-[clamp(0.5rem,calc(var(--card-w-std,2.17rem)*0.14),0.8125rem)] font-black uppercase leading-tight tracking-wider text-black shadow-[0_0_6px_rgba(251,191,36,0.6)]"
              aria-label="Link Unit"
            >
              Link
            </span>
          ) : null}
          {/* AP / HP efetivos — badges de canto (V6.3: sempre no rodapé da
              arte agora — o Piloto não overlay mais em cima delas). */}
          {/* Frente 4 (feedback Willen 2ª rodada): badges escalam com
              `--card-w-std` (eram `text-[9px]`/`[7px]` fixos, ilegíveis). */}
          <span
            className={cn(
              "absolute bottom-0 left-0 z-10 min-w-[1.4em] px-1 py-0.5 text-center text-[clamp(0.625rem,calc(var(--card-w-std,2.17rem)*0.17),1rem)] font-black leading-none tabular-nums",
              apBuffed ? "bg-amber-500 text-black" : "bg-cyan-600/95 text-white",
            )}
            aria-label={`AP ${ap}`}
          >
            {ap}
          </span>
          <span
            className={cn(
              "absolute bottom-0 right-0 z-10 flex items-baseline gap-0.5 px-1 py-0.5 text-[clamp(0.625rem,calc(var(--card-w-std,2.17rem)*0.17),1rem)] font-black leading-none tabular-nums",
              hpDamaged ? "bg-red-600/95 text-white" : "bg-slate-700/95 text-white",
            )}
            aria-label={`HP ${hpRemaining}`}
          >
            {hpRemaining}
            {hpDamaged ? (
              <span className="text-[clamp(0.5rem,calc(var(--card-w-std,2.17rem)*0.13),0.8125rem)] font-bold text-red-200">
                -{unit.damage}
              </span>
            ) : null}
          </span>
          {unit.rested ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45">
              <span className="rotate-[-12deg] border border-slate-300/60 bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-slate-200">
                Rested
              </span>
            </div>
          ) : null}
        </CardFace>
      </div>

      {/* Tira reservada pro Piloto pareado — SEMPRE presente (mesma altura
          com ou sem Piloto), pra a fileira do grid não ficar mais alta só
          quando ALGUM slot tem Piloto (as vazias/sem-piloto "cairiam pra
          cima" se a altura total variasse por slot). */}
      <div className="h-[clamp(1.15rem,calc(var(--card-w-std,2.17rem)*0.34),2.1rem)] shrink-0">
        {pilot ? <DockedPilot pilot={pilot} unit={unit} art={art} onInspect={onInspect} /> : null}
      </div>

      {/* No campo o cluster fica DENTRO do canto (não pra fora como na mão): as 2
          Battle Areas ficam perto e um `-top` faria os botões caírem em cima da
          carta do oponente / da seam, roubando o clique. */}
      {/* V6.3 (docs/34): tamanho/posição agora são o default do componente
          (unificado com a mão — não passa mais `size`/`className` custom). */}
      <CardCornerActions actions={cornerActions} />
    </div>
  );
}
