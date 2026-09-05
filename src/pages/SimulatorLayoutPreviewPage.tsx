/* DEV-ONLY — Preview de layout cru do simulador (docs/38, Frente 4).
 *
 * O Willen valida a F4 em navegadores / displays reais SEM logar nem entrar
 * numa partida. Esta página monta o `ArenaPlaymat` COMPLETO (os dois lados +
 * mão + overlay) com um fixture ESTÁTICO: zero motor, zero rede, zero fetch —
 * todas as cartas usam a arte de verso (`cardBackUrl`) e campos fixos.
 *
 * Barra de controle (fora do canvas): alterna POV, nº de recursos ativos,
 * liga/desliga a seta de ataque "no jogador" (pra ver a mira na coluna
 * Base/Escudos à esquerda — docs/38 §3.4), força `prefers-reduced-motion` via
 * classe e dispara as microinterações (draw / Burst / embaralhamento) on demand.
 *
 * Rota: `/simulador/preview-layout` (só existe em `import.meta.env.DEV`, sem
 * `RequireAuth` — ver `App.tsx`). O componente ainda retorna `null` fora de DEV
 * como segunda trava. */
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { CardDef, CardInstance, CardType, CombatState, PlayerId } from "@/modules/simulator/engine/types";
import {
  ActionDock,
  type ActionDockState,
  ArenaPlaymat,
  type ArenaSide,
  BaseCardGauge,
  BattleSlot,
  BurstModal,
  cardBackUrl,
  CombatLane,
  CounterChip,
  FirstPlayerReveal,
  HandFan,
  PileTray,
  playerAreaKey,
  playerShieldKey,
  ResourceMeter,
  ShieldRail,
  useBoardElements,
  type ArtLookup,
} from "@/modules/simulator/ui";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture estático
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewSlot {
  unit: CardInstance;
  pilot: CardInstance | null;
}

interface PreviewResource {
  instanceId: string;
  rested: boolean;
  isEx: boolean;
  code: string;
}

interface PreviewSidePlayer {
  slots: PreviewSlot[];
  base: CardInstance | null;
  shields: number;
  resources: PreviewResource[];
  deckCount: number;
  resourceDeckCount: number;
  trash: CardInstance[];
  exile: CardInstance[];
  handCount: number;
}

export interface LayoutPreviewFixture {
  A: PreviewSidePlayer;
  B: PreviewSidePlayer;
  /** mão do POV atual (o mesmo baralho pros dois — é só amostra visual). */
  hand: { card: CardInstance; playable: boolean; blockedReason?: string }[];
}

let SEQ = 0;

function mkCard(
  nameEn: string,
  cardType: CardType,
  def: Partial<CardDef> = {},
  inst: Partial<CardInstance> = {},
): CardInstance {
  const code = def.code ?? `PREV-${nameEn.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase()}`;
  const base: CardInstance = {
    instanceId: `prev-${SEQ++}`,
    def: { code, nameEn, cardType, color: "blue", ...def },
    owner: "A",
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
  };
  return { ...base, ...inst, def: base.def };
}

function makeSide(owner: PlayerId, opts: { shields: number; baseDamage: number }): PreviewSidePlayer {
  const u = (nameEn: string, ap: number, hp: number, over: Partial<CardInstance> = {}, def: Partial<CardDef> = {}) =>
    mkCard(nameEn, "UNIT", { ap, hp, level: 3, cost: 3, ...def }, { owner, zone: "battleArea", ...over });
  const pilot = (nameEn: string, ap: number, hp: number) =>
    mkCard(nameEn, "PILOT", { ap, hp }, { owner, zone: "battleArea" });

  const slots: PreviewSlot[] = [
    {
      // Unit com Pilot LINKado (link casa pelo nome do Pilot) — badge LINK dourado
      unit: u("RX-78-2 Gundam", 3, 4, {}, { link: { kind: "pilotName", values: ["Amuro"] } }),
      pilot: pilot("Amuro Ray", 1, 1),
    },
    { unit: u("Guncannon", 2, 3, { damage: 2 }), pilot: null }, // dano marcado, sem pilot
    { unit: u("GM Sniper", 2, 2, { rested: true }), pilot: null }, // rested
    { unit: u("Zaku II", 2, 3), pilot: pilot("Char Aznable", 2, 0) }, // pareado, sem link
    { unit: u("Gundam Aerial", 3, 4, { damage: 1, rested: true }), pilot: null }, // dano + rested
    { unit: u("Demi Trainer", 1, 2), pilot: null },
  ];

  const trash = [
    mkCard("Zaku I", "UNIT", { ap: 1, hp: 2 }, { owner, zone: "trash" }),
    mkCard("Haro", "COMMAND", { cost: 1 }, { owner, zone: "trash" }),
    mkCard("GM", "UNIT", { ap: 2, hp: 2 }, { owner, zone: "trash" }),
  ];
  const exile = [mkCard("Gundam Barbatos", "UNIT", { ap: 4, hp: 4 }, { owner, zone: "exile" })];

  const resources: PreviewResource[] = [
    ...Array.from({ length: 6 }, (_, i) => ({ instanceId: `${owner}-res-${i}`, rested: false, isEx: false, code: "PREV-RES" })),
    { instanceId: `${owner}-res-r0`, rested: true, isEx: false, code: "PREV-RES" },
    { instanceId: `${owner}-res-r1`, rested: true, isEx: false, code: "PREV-RES" },
    { instanceId: `${owner}-res-ex`, rested: false, isEx: true, code: "PREV-EXRES" },
  ];

  return {
    slots,
    base: mkCard("White Base", "BASE", { hp: 6 }, { owner, zone: "baseSection", damage: opts.baseDamage }),
    shields: opts.shields,
    resources,
    deckCount: 34,
    resourceDeckCount: 7,
    trash,
    exile,
    handCount: 6,
  };
}

export function buildLayoutPreviewFixture(): LayoutPreviewFixture {
  SEQ = 0;
  const hand = [
    { card: mkCard("RX-78-2 Gundam", "UNIT", { ap: 3, hp: 4, cost: 3, level: 3 }, { zone: "hand" }), playable: true },
    { card: mkCard("Guntank", "UNIT", { ap: 2, hp: 5, cost: 2, level: 2 }, { zone: "hand" }), playable: true },
    {
      card: mkCard("Kai's Reckless Fire", "COMMAND", { cost: 1 }, { zone: "hand" }),
      playable: false,
      blockedReason: "Fora da Fase Principal.",
    },
    { card: mkCard("Amuro Ray", "PILOT", { ap: 1, hp: 1, cost: 1 }, { zone: "hand" }), playable: true },
    {
      card: mkCard("Gundam Aerial", "UNIT", { ap: 3, hp: 4, cost: 4, level: 4 }, { zone: "hand" }),
      playable: false,
      blockedReason: "Recursos insuficientes.",
    },
    { card: mkCard("Haro", "COMMAND", { cost: 1 }, { zone: "hand" }), playable: true },
  ];
  return {
    A: makeSide("A", { shields: 4, baseDamage: 2 }),
    B: makeSide("B", { shields: 2, baseDamage: 4 }),
    hand,
  };
}

/** Arte de amostra: todo `code` do fixture aponta pro verso genérico. */
function buildPreviewArt(fx: LayoutPreviewFixture): ArtLookup {
  const art: ArtLookup = {};
  const put = (code: string) => {
    art[code] = { imageUrl: cardBackUrl, imageSmallUrl: cardBackUrl };
  };
  for (const side of [fx.A, fx.B]) {
    side.slots.forEach((s) => {
      put(s.unit.def.code);
      if (s.pilot) put(s.pilot.def.code);
    });
    if (side.base) put(side.base.def.code);
    side.trash.forEach((c) => put(c.def.code));
    side.exile.forEach((c) => put(c.def.code));
    side.resources.forEach((r) => put(r.code));
  }
  fx.hand.forEach((h) => put(h.card.def.code));
  put("PREV-BURST");
  return art;
}

const BURST_DECISION = {
  kind: "burst" as const,
  cardInstanceId: "prev-burst",
  cardDef: {
    code: "PREV-BURST",
    nameEn: "Saturn Nights",
    cardType: "COMMAND" as CardType,
    color: "blue",
    hasBurst: true,
  } satisfies CardDef,
  choices: [] as string[],
  queuedInstanceIds: [] as string[],
};

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

type Scenario = "normal" | "burst" | "shuffle";

export default function SimulatorLayoutPreviewPage() {
  // 2ª trava além do guard de rota em App.tsx — nunca renderiza fora de DEV.
  if (!import.meta.env.DEV) return null;
  return <LayoutPreview />;
}

function LayoutPreview() {
  const fixture = useMemo(() => buildLayoutPreviewFixture(), []);
  const art = useMemo(() => buildPreviewArt(fixture), [fixture]);
  const board = useBoardElements();

  const [pov, setPov] = useState<PlayerId>("A");
  const [activeResources, setActiveResources] = useState(6);
  const [showArrow, setShowArrow] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [replayKey, setReplayKey] = useState(0);
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth));

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const viewer = pov;
  const opp: PlayerId = pov === "A" ? "B" : "A";

  /** aplica o nº de recursos ativos escolhido no controle (só ao lado visível). */
  function scaledResources(side: PreviewSidePlayer, isViewer: boolean): PreviewResource[] {
    if (!isViewer) return side.resources;
    const nonActive = side.resources.filter((r) => r.rested || r.isEx);
    const active = Array.from({ length: activeResources }, (_, i) => ({
      instanceId: `${viewer}-res-scaled-${i}`,
      rested: false,
      isEx: false,
      code: "PREV-RES",
    }));
    return [...active, ...nonActive];
  }

  const combat: CombatState | null = useMemo(() => {
    if (!showArrow) return null;
    const attackerUnit = fixture[opp].slots[0]?.unit;
    if (!attackerUnit) return null;
    return {
      step: "attack",
      attackerId: attackerUnit.instanceId,
      attackingPlayer: opp,
      defendingPlayer: viewer,
      originalTarget: "player",
      currentTarget: "player",
      actionPasses: { A: false, B: false },
      actionPriority: viewer,
    };
  }, [showArrow, opp, viewer, fixture]);

  const attackerCard = combat ? (fixture[opp].slots[0]?.unit ?? null) : null;

  function arenaSide(pid: PlayerId): ArenaSide {
    const isViewer = pid === viewer;
    const side = fixture[pid];
    const resources = scaledResources(side, isViewer);

    return {
      shields: (
        <ShieldRail
          orientation="vertical"
          count={side.shields}
          underAim={Boolean(combat && combat.currentTarget === "player" && combat.defendingPlayer === pid)}
        />
      ),
      base: <BaseCardGauge base={side.base} art={art} onInspect={() => {}} />,
      resources: (
        <div className="flex items-end justify-center gap-2">
          <CounterChip variant="stack" label="Deck de Recursos" count={side.resourceDeckCount} />
          <ResourceMeter resources={resources} level={resources.length} art={art} readOnly={!isViewer} />
        </div>
      ),
      deck: (
        <CounterChip
          variant="stack"
          label="Deck"
          count={side.deckCount}
          tone={side.deckCount <= 2 ? "crit" : side.deckCount <= 5 ? "warn" : "normal"}
        />
      ),
      trash: <PileTray label="Trash" count={side.trash.length} cards={side.trash} art={art} onInspect={() => {}} />,
      exile: <PileTray label="Exílio" count={side.exile.length} cards={side.exile} art={art} onInspect={() => {}} />,
      battleRow: (
        <>
          {Array.from({ length: 6 }).map((_, i) => {
            const slot = side.slots[i] ?? null;
            return (
              <BattleSlot
                key={slot?.unit.instanceId ?? `${pid}-empty-${i}`}
                unit={slot?.unit ?? null}
                pilot={slot?.pilot ?? null}
                art={art}
                isAttacker={Boolean(slot && combat?.attackerId === slot.unit.instanceId)}
                onInspect={() => {}}
                registerRef={slot ? board.register(slot.unit.instanceId) : undefined}
              />
            );
          })}
        </>
      ),
      battleAreaRef: board.register(playerAreaKey(pid)),
      shieldStationRef: board.register(playerShieldKey(pid)),
      handSummary: isViewer ? undefined : (
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Mão ({side.handCount})</p>
      ),
    };
  }

  const dockState: ActionDockState = combat
    ? { kind: "attacking", attackerName: attackerCard?.def.nameEn ?? "Unit" }
    : { kind: "idle", yourTurn: true, phaseLabel: "Fase Principal · Ação", timerSeconds: 42, turnNumber: 5 };

  return (
    <div
      className={cn(
        "fixed inset-0 flex flex-col bg-slate-950 text-soft",
        // "forçar prefers-reduced-motion" via classe: mata as animações/transições
        // CSS de todos os descendentes (aproxima o que o `motion-reduce:` faria).
        reducedMotion && "[&_*]:!animate-none [&_*]:!transition-none",
      )}
    >
      <ControlBar
        pov={pov}
        onPov={setPov}
        activeResources={activeResources}
        onActiveResources={setActiveResources}
        showArrow={showArrow}
        onShowArrow={setShowArrow}
        reducedMotion={reducedMotion}
        onReducedMotion={setReducedMotion}
        scenario={scenario}
        onScenario={setScenario}
        onReplayDraw={() => setReplayKey((k) => k + 1)}
      />

      <div className="relative flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-2">
        <div className="flex min-w-0 flex-1 justify-center">
          <ArenaPlaymat
            key={`${pov}-${replayKey}`}
            opponent={arenaSide(opp)}
            self={arenaSide(viewer)}
            hand={
              <HandFan
                anchored
                cards={fixture.hand}
                art={art}
                onPeek={() => {}}
                onInspect={() => {}}
              />
            }
            overlay={
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.35))]" />
            }
          />
        </div>
      </div>

      {combat ? (
        <CombatLane combat={combat} attacker={attackerCard} targetUnit={null} viewerSeat={viewer} rectOf={board.rectOf} />
      ) : null}

      <ActionDock state={dockState} />

      {scenario === "burst" ? (
        <BurstModal decision={BURST_DECISION} art={art} onResolve={() => setScenario("normal")} />
      ) : null}
      {scenario === "shuffle" ? (
        <FirstPlayerReveal goesFirst onDismiss={() => setScenario("normal")} autoDismissMs={99_999} />
      ) : null}

      <div className="pointer-events-none fixed bottom-1.5 left-2 z-[70] flex flex-col gap-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-300/80">
        <span className="font-black">Preview de layout — dados estáticos, sem motor</span>
        <span className="text-slate-500">viewport {vw}px · POV {pov}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Barra de controle (fora do canvas)
// ─────────────────────────────────────────────────────────────────────────────

interface ControlBarProps {
  pov: PlayerId;
  onPov: (p: PlayerId) => void;
  activeResources: number;
  onActiveResources: (n: number) => void;
  showArrow: boolean;
  onShowArrow: (v: boolean) => void;
  reducedMotion: boolean;
  onReducedMotion: (v: boolean) => void;
  scenario: Scenario;
  onScenario: (s: Scenario) => void;
  onReplayDraw: () => void;
}

function ControlBar(p: ControlBarProps) {
  return (
    <div className="z-[60] flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-primary/25 bg-slate-950/95 px-3 py-2 text-xs">
      <span className="font-black uppercase tracking-[0.16em] text-primary">F4 · preview</span>

      <label className="flex items-center gap-1.5">
        <span className="text-muted-portal">POV</span>
        <select
          value={p.pov}
          onChange={(e) => p.onPov(e.target.value as PlayerId)}
          className="rounded-arena border border-white/15 bg-slate-900 px-1.5 py-0.5"
        >
          <option value="A">Jogador A</option>
          <option value="B">Jogador B</option>
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-muted-portal">Recursos ativos</span>
        <input
          type="range"
          min={0}
          max={12}
          value={p.activeResources}
          onChange={(e) => p.onActiveResources(Number(e.target.value))}
        />
        <span className="w-5 font-mono tabular-nums">{p.activeResources}</span>
      </label>

      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={p.showArrow} onChange={(e) => p.onShowArrow(e.target.checked)} />
        <span>Seta de ataque (no jogador)</span>
      </label>

      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={p.reducedMotion} onChange={(e) => p.onReducedMotion(e.target.checked)} />
        <span>Forçar reduced-motion</span>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-muted-portal">Cenário</span>
        <select
          value={p.scenario}
          onChange={(e) => p.onScenario(e.target.value as Scenario)}
          className="rounded-arena border border-white/15 bg-slate-900 px-1.5 py-0.5"
        >
          <option value="normal">Normal</option>
          <option value="burst">Revelação de Burst</option>
          <option value="shuffle">Embaralhamento</option>
        </select>
      </label>

      <button
        type="button"
        onClick={p.onReplayDraw}
        className="rounded-arena border border-primary/40 px-2 py-0.5 font-semibold text-primary hover:bg-primary/10"
      >
        ▶ tocar draw
      </button>
    </div>
  );
}
