/* docs/19, Sessão 3 — inspetor de carta (zoom).
 *
 * Sprint 5.3 (gaveta lateral + hover de piloto) — o visual principal é a ARTE
 * GRANDE da carta (~78vh); a telemetria (custo/nível/AP/HP/traits/efeito/
 * modificadores) fica numa GAVETA lateral que abre pelo botão tático na borda
 * direita da carta. Se a carta for uma Unit com link `pilotName`, o(s) nome(s)
 * do piloto viram chips com POPOVER de hover mostrando a arte do piloto. */
import { useState, type ReactNode } from "react";
import { ChevronRight, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardInstance, GameState } from "@/modules/simulator/engine/types";
import { effectiveAp, effectiveHp } from "@/modules/simulator/engine/types";
import { artSrc, type ArtLookup, type CardArt } from "./cardArt";

export interface LinkedPilot {
  name: string;
  /** arte da carta do piloto, se resolvida a partir do set/partida. */
  art?: CardArt;
  /** badge sutil, ex. "Na sua mão" / "No seu campo". */
  note?: string;
}

interface CardInspectorModalProps {
  card: CardInstance;
  art: ArtLookup;
  onClose: () => void;
  /** ex.: motivo de não poder jogar a carta (mostrado em âmbar). */
  blockedReason?: string;
  footer?: ReactNode;
  /** mostra AP/HP efetivos (carta em campo) em vez dos base (carta na mão). */
  inPlay?: boolean;
  /** estado do jogo — pros AP/HP efetivos incluírem bônus estáticos 【During Pair】/【During Link】. */
  state?: GameState;
  /** texto de efeito já resolvido (PT com fallback pro EN — do catálogo). Mantido
   *  por compat; prefira passar `effectPt`/`effectEn` separados pra habilitar o
   *  toggle PT/EN. */
  effectText?: string;
  /** texto de efeito traduzido pt-BR (`CardModel.effectPt`). Exibido por padrão. */
  effectPt?: string;
  /** texto de efeito original em inglês (`CardModel.effectEn`). */
  effectEn?: string;
  /** pilotos que satisfazem a link condition (`link.kind === "pilotName"`). */
  linkedPilots?: LinkedPilot[];
}

export function CardInspectorModal({
  card,
  art,
  onClose,
  blockedReason,
  footer,
  inPlay,
  state,
  effectText,
  effectPt,
  effectEn,
  linkedPilots,
}: CardInspectorModalProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { def } = card;
  const src = artSrc(art, def.code, "xl");
  const ap = inPlay ? effectiveAp(card, state) : def.ap;
  const hp = inPlay ? Math.max(0, effectiveHp(card, state) - card.damage) : def.hp;
  const uniqueKeywords = [
    ...new Set([...(def.keywordTags ?? []), ...(def.triggerKeywords ?? []), ...(def.effectKeywords ?? [])]),
  ];
  const activeBuffs = card.statModifiers.map((m) => `${m.stat.toUpperCase()} ${m.amount >= 0 ? "+" : ""}${m.amount}`);
  const grantedKeywords = card.keywordGrants.map((g) => g.keyword);
  const pilots = def.link?.kind === "pilotName" ? (linkedPilots ?? []) : [];
  const hasEffectBody = Boolean(
    effectPt?.trim() || effectText?.trim() || effectEn?.trim(),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative flex items-stretch" onClick={(e) => e.stopPropagation()}>
        {/* ── Carta grande ─────────────────────────────────────────────── */}
        {/* Sprint 6 · P4 — este wrapper NÃO tem `overflow-hidden` (só a arte tem,
            pra recortar no aspect-ratio). O botão da gaveta mora AQUI, fora do
            recorte, senão o `translate-x-full` cai no clip e some. */}
        <div className="relative shrink-0">
          <div className="panel-cut relative h-[78vh] max-h-[80vh] overflow-hidden border border-white/10 bg-black/70 aspect-[63/88]">
            {src ? (
              <img src={src} alt={def.nameEn} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-800 via-slate-900 to-black p-4 text-center">
                <p className="text-lg font-bold uppercase tracking-wide text-slate-200">{def.nameEn}</p>
                <p className="text-xs text-slate-500">{def.code}</p>
              </div>
            )}

            {pilots.length ? (
              <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1 bg-black/65 px-2 py-1.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-400/80">Link</span>
                {pilots.map((p) => (
                  <PilotLinkChip key={p.name} pilot={p} />
                ))}
              </div>
            ) : null}

            {inPlay && (ap !== undefined || hp !== undefined) ? (
              <div className="absolute inset-x-0 bottom-0 flex text-sm font-black">
                {ap !== undefined ? <span className="flex-1 bg-cyan-600/95 py-1 text-center text-white">AP {ap}</span> : null}
                {hp !== undefined ? <span className="flex-1 bg-slate-800/95 py-1 text-center text-white">HP {hp}</span> : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute left-1 top-1 z-10 flex size-8 items-center justify-center bg-black/70 text-slate-300 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-label={drawerOpen ? "Fechar detalhes" : "Abrir detalhes"}
            aria-expanded={drawerOpen}
            className="absolute right-0 top-1/2 z-20 flex h-16 w-6 -translate-y-1/2 translate-x-full items-center justify-center border border-l-0 border-primary/40 bg-slate-950/95 text-primary transition-colors hover:bg-slate-900 motion-reduce:transition-none"
          >
            {drawerOpen ? <ChevronRight className="size-4" /> : <Info className="size-4" />}
          </button>
        </div>

        {/* ── Gaveta de telemetria ─────────────────────────────────────── */}
        {drawerOpen ? (
          <aside className="panel-cut surface-panel ml-8 flex max-h-[80vh] w-72 flex-col overflow-y-auto border border-primary/25 p-3">
            <p className="font-heading text-sm font-bold leading-tight text-soft">{def.nameEn}</p>
            <p className="text-[10px] text-muted-portal">
              {def.code} · {def.cardType}
              {def.color ? ` · ${def.color}` : ""}
            </p>

            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
              {def.cost !== undefined ? <Attr label="Custo" value={def.cost} /> : null}
              {def.level !== undefined ? <Attr label="Nível" value={def.level} /> : null}
              {ap !== undefined ? <Attr label="AP" value={ap} /> : null}
              {hp !== undefined ? <Attr label="HP" value={hp} /> : null}
            </div>

            {def.traits?.length ? (
              <p className="mt-2 text-[11px] text-slate-300">
                <span className="uppercase tracking-wide text-slate-500">Traits: </span>
                {def.traits.join(" · ")}
              </p>
            ) : null}

            {hasEffectBody ? (
              <div className="mt-2 border-t border-white/10 pt-2">
                <CardEffectText effectPt={effectPt} effectEn={effectEn} effectText={effectText} />
              </div>
            ) : uniqueKeywords.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {uniqueKeywords.map((k) => (
                  <span key={k} className="border border-primary/30 bg-primary/10 px-1 text-[9px] font-medium text-primary">
                    {k}
                  </span>
                ))}
              </div>
            ) : null}

            {activeBuffs.length || grantedKeywords.length ? (
              <div className="mt-2 border-t border-white/10 pt-2">
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

            {blockedReason ? <p className="mt-2 text-center text-xs text-amber-400">{blockedReason}</p> : null}
          </aside>
        ) : null}
      </div>

      {footer ? (
        <div
          className="absolute inset-x-0 bottom-6 mx-auto flex w-full max-w-xs flex-col gap-1.5 px-4"
          onClick={(e) => e.stopPropagation()}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Bloco "Efeito" compartilhado pelo modal e pelo `CardInspectorPanel`.
 *  Padrão: mostra `effectPt`; se `effectPt` E `effectEn` vierem e forem diferentes,
 *  renderiza um toggle PT/EN. `effectText` é o fallback já resolvido (compat). */
export function CardEffectText({
  effectPt,
  effectEn,
  effectText,
  className,
}: {
  effectPt?: string;
  effectEn?: string;
  effectText?: string;
  className?: string;
}) {
  const pt = effectPt?.trim() || undefined;
  const en = effectEn?.trim() || undefined;
  const generic = effectText?.trim() || undefined;
  const hasToggle = Boolean(pt && en && pt !== en);
  const [lang, setLang] = useState<"pt" | "en">("pt");
  const body = hasToggle ? (lang === "pt" ? pt : en) : (pt ?? generic ?? en);
  if (!body) return null;

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[9px] uppercase tracking-wide text-slate-500">Efeito</p>
        {hasToggle ? (
          <div className="flex overflow-hidden rounded-arena border border-white/15 text-[8px] font-bold uppercase tracking-wide">
            {(["pt", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={lang === option}
                onClick={() => setLang(option)}
                className={cn(
                  "px-1.5 py-0.5 transition-colors motion-reduce:transition-none",
                  lang === option ? "bg-primary/25 text-primary" : "text-slate-500 hover:text-slate-300",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="whitespace-pre-line text-[11px] leading-relaxed text-slate-200">{body}</p>
    </div>
  );
}

function Attr({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border border-white/10 bg-white/[0.03] px-1.5 py-1">
      <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="font-mono text-sm font-black tabular-nums text-slate-100">{value}</span>
    </div>
  );
}

function PilotLinkChip({ pilot }: { pilot: LinkedPilot }) {
  const src = pilot.art?.imageUrl ?? pilot.art?.imageSmallUrl;
  return (
    <span className="group/pl relative inline-flex items-center gap-1 border border-amber-400/50 bg-amber-500/15 px-1 text-[10px] font-semibold text-amber-100">
      <span tabIndex={0} className="rounded-arena outline-none focus-visible:ring-1 focus-visible:ring-amber-300">
        {pilot.name}
      </span>
      {pilot.note ? (
        <span className="bg-amber-400/20 px-1 text-[8px] font-medium text-amber-200/90">{pilot.note}</span>
      ) : null}
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-24 border border-amber-400/50 bg-slate-950 p-1 shadow-xl group-hover/pl:block group-focus-within/pl:block">
        {src ? (
          <img src={src} alt={pilot.name} className="aspect-[63/88] w-full object-cover" />
        ) : (
          <span className="flex aspect-[63/88] w-full items-center justify-center px-1 text-center text-[8px] text-slate-500">
            {pilot.name}
          </span>
        )}
      </span>
    </span>
  );
}
