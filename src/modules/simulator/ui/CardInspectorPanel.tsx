/* Sprint 1 (redesenho visual "Nível Arena") — inspetor lateral ESTÁTICO das
 * asas de monitores largos. Mesma leitura do `CardInspectorModal` (arte + tudo
 * que o `viewState` expõe + modificadores ativos na instância), mas sem overlay
 * nem `fixed`: fica fixo na coluna lateral e reage a hover/foco de qualquer
 * carta do campo ou da mão, dispensando modais durante o jogo.
 *
 * Componente apresentacional puro e prop-driven. `card: null` => estado de
 * espera ("Nenhuma carta selecionada"). `inPlay` alterna entre AP/HP efetivos
 * (carta em campo) e base (carta na mão). */
import type { ReactNode } from "react";
import { Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardInstance, GameState } from "@/modules/simulator/engine/types";
import { effectiveAp, effectiveHp } from "@/modules/simulator/engine/types";
import type { ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";

interface CardInspectorPanelProps {
  card: CardInstance | null;
  art: ArtLookup;
  /** mostra AP/HP efetivos (carta em campo) em vez dos base (carta na mão). */
  inPlay?: boolean;
  /** estado do jogo — pros AP/HP efetivos incluírem bônus estáticos 【During Pair】/【During Link】. */
  state?: GameState;
  /** ex.: motivo de não poder jogar a carta (mostrado em âmbar). */
  blockedReason?: string;
  className?: string;
}

export function CardInspectorPanel({ card, art, inPlay, state, blockedReason, className }: CardInspectorPanelProps) {
  return (
    <aside
      aria-label="Detalhes da carta"
      className={cn("panel-cut surface-panel flex w-full flex-col border border-primary/20 p-3", className)}
    >
      <p className="mb-2 text-[10px] font-semibold tracking-wide text-slate-400">Detalhes da carta</p>
      {card ? <PanelBody card={card} art={art} inPlay={inPlay} state={state} blockedReason={blockedReason} /> : <PanelIdle />}
    </aside>
  );
}

function PanelIdle() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
      <Crosshair className="size-8 text-slate-600 motion-safe:animate-pulse" aria-hidden />
      <p className="text-xs font-semibold text-slate-400">Nenhuma carta selecionada</p>
      <p className="max-w-[16rem] text-[11px] leading-relaxed text-slate-500">
        Passe o cursor sobre uma carta do campo ou da mão para ver os detalhes.
      </p>
    </div>
  );
}

function PanelBody({
  card,
  art,
  inPlay,
  state,
  blockedReason,
}: {
  card: CardInstance;
  art: ArtLookup;
  inPlay?: boolean;
  state?: GameState;
  blockedReason?: string;
}) {
  const { def } = card;
  const ap = inPlay ? effectiveAp(card, state) : def.ap;
  const hp = inPlay ? Math.max(0, effectiveHp(card, state) - card.damage) : def.hp;
  const apBuffed = ap !== undefined && ap !== (def.ap ?? 0);
  const hpDamaged = inPlay && card.damage > 0;

  const keywords = [...new Set([...(def.keywordTags ?? []), ...(def.triggerKeywords ?? []), ...(def.effectKeywords ?? [])])];
  const activeBuffs = card.statModifiers.map((m) => `${m.stat.toUpperCase()} ${m.amount >= 0 ? "+" : ""}${m.amount}`);
  const grantedKeywords = card.keywordGrants.map((g) => g.keyword);

  return (
    // V6.2 (docs/33): `justify-center` — a asa já estica pela altura da
    // linha inteira desde a rodada 3 (`self-center` removido no pai), mas
    // faltava isto pra CENTRALIZAR o grupo [imagem + infos] dentro dessa
    // altura (antes ficava colado no topo, print "CapturaWide" do Willen).
    // A imagem (`mx-auto`) já centraliza em X; isto centraliza em Y.
    <div className="flex flex-1 flex-col justify-center gap-3 overflow-y-auto">
      <CardFace nameEn={def.nameEn} code={def.code} art={art} size="lg" className="mx-auto border border-white/10" />

      <div>
        <p className="font-heading text-sm font-bold leading-tight text-soft">{def.nameEn}</p>
        <p className="text-[10px] text-muted-portal">
          {def.code} · {def.cardType}
          {def.color ? ` · ${def.color}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 text-[10px]">
        {def.level !== undefined ? <Stat label="Nível" value={def.level} /> : null}
        {def.cost !== undefined ? <Stat label="Custo" value={def.cost} /> : null}
        {ap !== undefined ? <Stat label="AP" value={ap} tone={apBuffed ? "buff" : undefined} /> : null}
        {hp !== undefined ? <Stat label="HP" value={hp} tone={hpDamaged ? "damage" : undefined} /> : null}
      </div>

      {def.traits?.length ? (
        <p className="text-[10px] text-slate-400">
          <span className="uppercase tracking-wide text-slate-500">Traits:</span> {def.traits.join(" · ")}
        </p>
      ) : null}

      {def.link ? (
        <p className="text-[10px] text-amber-300/90">
          <span className="uppercase tracking-wide text-amber-500/70">Link:</span>{" "}
          {def.link.kind === "pilotName"
            ? def.link.values.map((v) => `[${v}]`).join(" / ")
            : def.link.values.map((v) => `(${v})`).join(" / ")}
        </p>
      ) : null}

      {keywords.length ? (
        <div className="flex flex-wrap gap-1">
          {keywords.map((k) => (
            <span key={k} className="border border-primary/30 bg-primary/10 px-1 text-[9px] font-medium text-primary">
              {k}
            </span>
          ))}
        </div>
      ) : null}

      {activeBuffs.length || grantedKeywords.length ? (
        <div className="border-t border-white/10 pt-2">
          <p className="mb-1 text-[9px] uppercase tracking-wide text-emerald-500/80">Ativo agora</p>
          <div className="flex flex-wrap gap-1">
            {[...activeBuffs, ...grantedKeywords].map((b) => (
              <span key={b} className="border border-emerald-400/40 bg-emerald-500/10 px-1 text-[9px] font-medium text-emerald-300">
                {b}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {blockedReason ? <p className="mt-auto text-center text-xs text-amber-400">{blockedReason}</p> : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "buff" | "damage" }) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between border px-1.5 py-1",
        tone === "buff"
          ? "border-accent/50 bg-accent/10"
          : tone === "damage"
            ? "border-red-500/50 bg-red-500/10"
            : "border-white/10 bg-white/[0.03]",
      )}
    >
      <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span
        className={cn(
          "font-mono text-sm font-black tabular-nums",
          tone === "buff" ? "text-accent" : tone === "damage" ? "text-red-400" : "text-slate-200",
        )}
      >
        {value}
      </span>
    </div>
  );
}
