/* docs/19, Sessão 3 — inspetor de carta (zoom). Acionado por clique/hover no
 * desktop ou toque no mobile. Mostra arte ampliada + todos os dados que o
 * `viewState` expõe (tipo, nível, custo, AP/HP, traits, keywords, link
 * condition) + os modificadores ativos agora na instância (buffs de
 * `statModifiers` / keywords concedidas). Também serve de preview da mão
 * (com um `footer` de ações). */
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { effectiveAp, effectiveHp } from "@/modules/simulator/engine/types";
import type { ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";

interface CardInspectorModalProps {
  card: CardInstance;
  art: ArtLookup;
  onClose: () => void;
  /** ex.: motivo de não poder jogar a carta (mostrado em âmbar). */
  blockedReason?: string;
  footer?: ReactNode;
  /** mostra AP/HP efetivos (carta em campo) em vez dos base (carta na mão). */
  inPlay?: boolean;
}

export function CardInspectorModal({ card, art, onClose, blockedReason, footer, inPlay }: CardInspectorModalProps) {
  const { def } = card;
  const ap = inPlay ? effectiveAp(card) : def.ap;
  const hp = inPlay ? Math.max(0, effectiveHp(card) - card.damage) : def.hp;
  const keywords = [...(def.keywordTags ?? []), ...(def.triggerKeywords ?? []), ...(def.effectKeywords ?? [])];
  const uniqueKeywords = [...new Set(keywords)];
  const activeBuffs = card.statModifiers.map((m) => `${m.stat.toUpperCase()} ${m.amount >= 0 ? "+" : ""}${m.amount}`);
  const grantedKeywords = card.keywordGrants.map((g) => g.keyword);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="panel-cut hero-surface w-full max-w-sm border border-primary/30 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <CardFace nameEn={def.nameEn} code={def.code} art={art} size="lg" className="border border-white/10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-soft">{def.nameEn}</p>
            <p className="text-[10px] text-muted-portal">
              {def.code} · {def.cardType}
              {def.color ? ` · ${def.color}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
              {def.level !== undefined ? <Chip>Nível {def.level}</Chip> : null}
              {def.cost !== undefined ? <Chip>Custo {def.cost}</Chip> : null}
              {ap !== undefined ? <Chip>AP {ap}</Chip> : null}
              {hp !== undefined ? <Chip>HP {hp}</Chip> : null}
            </div>
            {def.traits?.length ? (
              <p className="mt-1.5 text-[10px] text-slate-400">
                <span className="uppercase tracking-wide text-slate-500">Traits:</span> {def.traits.join(" · ")}
              </p>
            ) : null}
            {def.link ? (
              <p className="mt-1 text-[10px] text-amber-300/90">
                <span className="uppercase tracking-wide text-amber-500/70">Link:</span>{" "}
                {def.link.kind === "pilotName" ? def.link.values.map((v) => `[${v}]`).join(" / ") : def.link.values.map((v) => `(${v})`).join(" / ")}
              </p>
            ) : null}
          </div>
        </div>

        {uniqueKeywords.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {uniqueKeywords.map((k) => (
              <span key={k} className="border border-primary/30 bg-primary/10 px-1 text-[9px] font-medium text-primary">
                {k}
              </span>
            ))}
          </div>
        ) : null}

        {activeBuffs.length || grantedKeywords.length ? (
          <div className="mt-2 border-t border-white/10 pt-2 text-[10px]">
            <span className="uppercase tracking-wide text-emerald-500/80">Ativo agora:</span>{" "}
            {[...activeBuffs, ...grantedKeywords].join(" · ")}
          </div>
        ) : null}

        {blockedReason ? <p className="mt-2 text-center text-xs text-amber-400">{blockedReason}</p> : null}

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-none" onClick={onClose}>
            <X className="mr-1 size-3.5" /> Fechar
          </Button>
          {footer}
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className={cn("border border-white/15 bg-white/5 px-1 font-semibold text-slate-200")}>{children}</span>;
}
