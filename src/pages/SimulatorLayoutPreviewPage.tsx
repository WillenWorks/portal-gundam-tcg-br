/* DEV-ONLY — Preview de layout cru do simulador (docs/38, Frente 4).
 *
 * O Willen valida a F4 em navegadores / displays reais SEM logar nem entrar
 * numa partida. Esta página monta o `ArenaPlaymat` COMPLETO (os dois lados +
 * mão + overlay) com um fixture ESTÁTICO: zero motor, zero rede, zero fetch.
 * As cartas são os `CardDef` REAIS de ST01 (`ST01_CARD_DEFS`) e ST02
 * (`ST02_CARD_DEFS`) — nomes/stats/keywords/link corretos; a arte usa o verso
 * genérico (`cardBackUrl`) como amostra, igual ao resto do simulador quando
 * não há arte do set.
 *
 * Barra de controle (fora do canvas): alterna POV, nº de recursos ativos do
 * jogador, liga/desliga a seta de ataque "no jogador" (pra ver a mira na
 * coluna Base/Escudos à esquerda — docs/38 §3.4), força `prefers-reduced-motion`
 * via classe e dispara as microinterações (draw / Burst / embaralhamento).
 *
 * Rota: `/simulador/preview-layout` (só existe em `import.meta.env.DEV`, sem
 * `RequireAuth` — ver `App.tsx`). O componente ainda retorna `null` fora de DEV
 * como segunda trava. */
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { CardDef, CardInstance, CombatState, GameState, PlayerId } from "@/modules/simulator/engine/types";
import { ST01_CARD_DEFS } from "@/modules/simulator/fixtures/st01Deck";
import { ST02_CARD_DEFS } from "@/modules/simulator/fixtures/st02Deck";
import {
  ActionDock,
  type ActionDockState,
  ArenaPlaymat,
  type ArenaSide,
  BaseCardGauge,
  BattleSlot,
  BurstModal,
  cardBackUrl,
  CardInspectorModal,
  type LinkedPilot,
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

const S1 = ST01_CARD_DEFS;
const S2 = ST02_CARD_DEFS;

// ─────────────────────────────────────────────────────────────────────────────
// Fixture estático (cartas reais ST01 / ST02)
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
  /** mão mostrada em leque (a mesma pros dois — é só amostra visual). */
  hand: { card: CardInstance; playable: boolean; blockedReason?: string }[];
}

let SEQ = 0;

function mkInst(def: CardDef, inst: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: `prev-${SEQ++}`,
    def,
    owner: "A",
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
    ...inst,
  };
}

/** Burst de amostra pro cenário "Revelação de Burst". */
const BURST_DEF: CardDef = {
  code: "ST01-014",
  nameEn: S1.UNFORESEEN_INCIDENT.nameEn,
  cardType: "COMMAND",
  color: "white",
  hasBurst: true,
};

const BURST_DECISION = {
  kind: "burst" as const,
  cardInstanceId: "prev-burst",
  cardDef: BURST_DEF,
  choices: [] as string[],
  queuedInstanceIds: [] as string[],
};

function sideA(): PreviewSidePlayer {
  const p = (def: CardDef, over: Partial<CardInstance> = {}) => mkInst(def, { owner: "A", ...over });
  return {
    slots: [
      // Gundam + Amuro Ray — Link ativo (link "Amuro Ray")
      {
        unit: p(S1.GUNDAM, { instanceId: "A-gundam", pairedPilotId: "A-amuro" }),
        pilot: p(S1.AMURO_RAY, { instanceId: "A-amuro", owner: "A", pairedUnitId: "A-gundam" }),
      },
      { unit: p(S1.GUNCANNON, { damage: 2 }), pilot: null }, // dano marcado
      { unit: p(S1.GM, { rested: true }), pilot: null }, // rested
      // Guntank + Amuro Ray — PAREADO mas SEM Link (Guntank pede "Hayato Kobayashi")
      {
        unit: p(S1.GUNTANK, { instanceId: "A-guntank", pairedPilotId: "A-amuro2" }),
        pilot: p(S1.AMURO_RAY, { instanceId: "A-amuro2", owner: "A", pairedUnitId: "A-guntank" }),
      },
      { unit: p(S1.AERIAL_BIT_FORM, { damage: 1, rested: true }), pilot: null }, // dano + rested
      { unit: p(S1.DEMI_TRAINER), pilot: null }, // Blocker
    ],
    base: p(S1.WHITE_BASE, { zone: "baseSection", damage: 3 }), // hp 5 → 2/5
    shields: 5,
    resources: buildResources("A", { active: 6, rested: 2, ex: 1, code: S1.RESOURCE.code }),
    deckCount: 34,
    resourceDeckCount: 7,
    trash: [p(S1.GM, { zone: "trash" }), p(S1.THOROUGHLY_DAMAGED, { zone: "trash" }), p(S1.ZOWORT, { zone: "trash" })],
    exile: [p(S1.KAIS_RESOLVE, { zone: "exile" })],
    handCount: 6,
  };
}

function sideB(): PreviewSidePlayer {
  const p = (def: CardDef, over: Partial<CardInstance> = {}) => mkInst(def, { owner: "B", ...over });
  return {
    slots: [
      // Wing Gundam + Heero Yuy — Link ativo (link "Heero Yuy"), + 【During Link】 AP+1/HP+1
      {
        unit: p(S2.WING_GUNDAM, { instanceId: "B-wing", pairedPilotId: "B-heero" }),
        pilot: p(S2.HEERO_YUY, { instanceId: "B-heero", owner: "B", pairedUnitId: "B-wing" }),
      },
      // Tallgeese + Zechs Merquise — Link ativo (link "Zechs Merquise")
      {
        unit: p(S2.TALLGEESE, { instanceId: "B-tallgeese", pairedPilotId: "B-zechs" }),
        pilot: p(S2.ZECHS_MERQUISE, { instanceId: "B-zechs", owner: "B", pairedUnitId: "B-tallgeese" }),
      },
      { unit: p(S2.GUNDAM_HEAVYARMS, { damage: 2 }), pilot: null },
      { unit: p(S2.LEO, { rested: true }), pilot: null },
      { unit: p(S2.ARIES), pilot: null }, // Blocker
      { unit: p(S2.TRAGOS, { rested: true }), pilot: null }, // Blocker + rested
    ],
    base: p(S2.SAINT_GABRIEL_INSTITUTE, { zone: "baseSection", damage: 1 }), // hp 5 → 4/5
    shields: 2,
    resources: buildResources("B", { active: 4, rested: 3, ex: 0, code: S2.RESOURCE.code }),
    deckCount: 12,
    resourceDeckCount: 4,
    trash: [p(S2.LEO, { zone: "trash" }), p(S2.SIEGE_PLOY, { zone: "trash" })],
    exile: [p(S2.MAGANAC, { zone: "exile" }), p(S2.ARIES, { zone: "exile" })],
    handCount: 5,
  };
}

function buildResources(
  owner: string,
  o: { active: number; rested: number; ex: number; code: string },
): PreviewResource[] {
  return [
    ...Array.from({ length: o.active }, (_, i) => ({ instanceId: `${owner}-r-a${i}`, rested: false, isEx: false, code: o.code })),
    ...Array.from({ length: o.rested }, (_, i) => ({ instanceId: `${owner}-r-r${i}`, rested: true, isEx: false, code: o.code })),
    ...Array.from({ length: o.ex }, (_, i) => ({ instanceId: `${owner}-r-x${i}`, rested: false, isEx: true, code: o.code })),
  ];
}

export function buildLayoutPreviewFixture(): LayoutPreviewFixture {
  SEQ = 0;
  const h = (def: CardDef, playable: boolean, blockedReason?: string) => ({
    card: mkInst(def, { zone: "hand" as const }),
    playable,
    blockedReason,
  });
  return {
    A: sideA(),
    B: sideB(),
    hand: [
      h(S1.GUNDAM, true),
      h(S1.GUNTANK, true),
      h(S1.THOROUGHLY_DAMAGED, false, "Fora da Fase Principal."),
      h(S1.AMURO_RAY, true),
      h(S1.AERIAL_SCORE_SIX, false, "Recursos insuficientes."),
      h(S2.SIMULTANEOUS_FIRE, true),
    ],
  };
}

/** GameState mínimo pra os componentes computarem os bônus estáticos
 *  (【During Link】/【During Pair】) — só o que `computeStaticStatBonus` lê:
 *  `players[owner].battleArea` + `activePlayer`. */
function buildPreviewState(fx: LayoutPreviewFixture, activePlayer: PlayerId): GameState {
  const areaOf = (side: PreviewSidePlayer): CardInstance[] =>
    side.slots.flatMap((s) => (s.pilot ? [s.unit, s.pilot] : [s.unit]));
  return {
    activePlayer,
    players: { A: { battleArea: areaOf(fx.A) }, B: { battleArea: areaOf(fx.B) } },
  } as unknown as GameState;
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
  fx.hand.forEach((entry) => put(entry.card.def.code));
  put(BURST_DEF.code);
  return art;
}

/** pilotos que satisfazem o link `pilotName` da Unit (pra o inspetor). */
function linkedPilotsFor(unit: CardInstance, pilot: CardInstance | null): LinkedPilot[] {
  const link = unit.def.link;
  if (link?.kind !== "pilotName" || !pilot) return [];
  const matches = link.values.some((v) => pilot.def.nameEn.includes(v));
  return matches ? [{ name: pilot.def.nameEn, note: "No seu campo" }] : [];
}

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
  const previewState = useMemo(() => buildPreviewState(fixture, pov), [fixture, pov]);

  const [activeResources, setActiveResources] = useState(6);
  const [showArrow, setShowArrow] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [replayKey, setReplayKey] = useState(0);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const [inspectLinkedPilots, setInspectLinkedPilots] = useState<LinkedPilot[]>([]);
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth));

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // POV = puro espelhamento: só troca qual lado renderiza embaixo (você) vs no
  // topo (oponente). A câmera e o layout do `ArenaPlaymat` são idênticos;
  // nenhum controle depende do POV além disso.
  const viewer = pov;
  const opp: PlayerId = pov === "A" ? "B" : "A";

  function openInspect(card: CardInstance, linked: LinkedPilot[] = []) {
    setInspectLinkedPilots(linked);
    setInspect(card);
  }

  /** nº de recursos ATIVOS do jogador vem do controle (pra ver o badge xN crescer). */
  function viewerResources(side: PreviewSidePlayer): PreviewResource[] {
    const keep = side.resources.filter((r) => r.rested || r.isEx);
    const active = Array.from({ length: activeResources }, (_, i) => ({
      instanceId: `${viewer}-r-scaled-${i}`,
      rested: false,
      isEx: false,
      code: side.resources[0]?.code ?? "ST01-RESOURCE",
    }));
    return [...active, ...keep];
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
    const resources = isViewer ? viewerResources(side) : side.resources;

    return {
      shields: (
        <ShieldRail
          orientation="vertical"
          count={side.shields}
          underAim={Boolean(combat && combat.currentTarget === "player" && combat.defendingPlayer === pid)}
        />
      ),
      base: <BaseCardGauge base={side.base} art={art} onInspect={(c) => openInspect(c)} />,
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
      trash: (
        <PileTray label="Descarte" count={side.trash.length} cards={side.trash} art={art} onInspect={(c) => openInspect(c)} />
      ),
      exile: (
        <PileTray label="Exílio" count={side.exile.length} cards={side.exile} art={art} onInspect={(c) => openInspect(c)} />
      ),
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
                state={previewState}
                isAttacker={Boolean(slot && combat?.attackerId === slot.unit.instanceId)}
                onInspect={(c) =>
                  slot && c.instanceId === slot.unit.instanceId
                    ? openInspect(c, linkedPilotsFor(slot.unit, slot.pilot))
                    : openInspect(c)
                }
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
                onPeek={(c) => openInspect(c)}
                onInspect={(c) => openInspect(c)}
              />
            }
            overlay={
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.35))]" />
            }
          />
        </div>
      </div>

      {combat ? (
        <CombatLane
          combat={combat}
          attacker={attackerCard}
          targetUnit={null}
          viewerSeat={viewer}
          state={previewState}
          rectOf={board.rectOf}
        />
      ) : null}

      <ActionDock state={dockState} />

      {inspect ? (
        <CardInspectorModal
          card={inspect}
          art={art}
          inPlay
          state={previewState}
          linkedPilots={inspectLinkedPilots}
          onClose={() => setInspect(null)}
        />
      ) : null}

      {scenario === "burst" ? (
        <BurstModal decision={BURST_DECISION} art={art} onResolve={() => setScenario("normal")} />
      ) : null}
      {scenario === "shuffle" ? (
        <FirstPlayerReveal goesFirst onDismiss={() => setScenario("normal")} autoDismissMs={99_999} />
      ) : null}

      <div className="pointer-events-none fixed bottom-1.5 left-2 z-[70] flex flex-col gap-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-300/80">
        <span className="font-black">Preview de layout — dados estáticos, sem motor</span>
        <span className="text-slate-500">viewport {vw}px · POV {pov} · cartas ST01/ST02 reais</span>
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
          <option value="A">Jogador A (ST01)</option>
          <option value="B">Jogador B (ST02)</option>
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-muted-portal">Recursos ativos (você)</span>
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
        title="Remonta a mão pra re-disparar a animação de compra de carta"
        className="rounded-arena border border-primary/40 px-2 py-0.5 font-semibold text-primary hover:bg-primary/10"
      >
        ▶ animar compra
      </button>
    </div>
  );
}
