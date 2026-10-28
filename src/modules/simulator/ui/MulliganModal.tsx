/* Sprint "Mulligan" — modal de início de partida (Comprehensive Rules 6-2 /
 * ruling oficial). Mostra a mão de 5 cartas comprada e pergunta se o jogador
 * quer trocar. Uma chance só. Modela em `BurstModal`. */
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CardInstance } from "@/modules/simulator/engine/types";
import type { ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import { useSiteLanguage } from "@/i18n/siteLanguage";

interface MulliganModalProps {
  /** as 5 cartas da mão comprada (do próprio jogador — sempre visível a ele). */
  hand: CardInstance[];
  art: ArtLookup;
  busy?: boolean;
  /** largura real da carta NA MÃO (px), medida pelo pai — `--card-w-std` só existe dentro do `<ArenaPlaymat>`; este
   *  modal é um `fixed inset-0` irmão, fora dele. É o teto: num display estreito as 5 encolhem para caber na caixa. */
  cardW: number;
  onResolve: (keep: boolean) => void;
}

export function MulliganModal({ hand, art, busy, cardW, onResolve }: MulliganModalProps) {
  const { tr } = useSiteLanguage();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="panel-cut hero-surface w-full max-w-xl border border-primary/45 p-4">
        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-black uppercase tracking-[0.18em] text-primary">
          <RefreshCw className="size-4" /> {tr("Mão inicial", "Opening hand")}
        </p>
        <p className="mt-1 text-center text-[11px] text-muted-portal">
          {tr("Você comprou 5 cartas. Quer ficar com esta mão ou trocá-la por 5 novas? Só uma vez.", "You drew 5 cards. Keep this hand or swap it for 5 new ones? Only once.")}
        </p>

        {/* spec simulador-cadencia-de-mesa (P1): 5 colunas iguais que nunca passam da largura da caixa nem do tamanho
            da carta na mão (o modal não pode ter carta maior do que ela fica depois) */}
        <div
          data-testid="mulligan-hand"
          className="mx-auto my-3 grid w-full items-end gap-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, hand.length)}, minmax(0, 1fr))`, maxWidth: cardW > 0 ? hand.length * cardW + (hand.length - 1) * 6 : undefined }}
        >
          {hand.map((c) => (
            <CardFace
              key={c.instanceId}
              nameEn={c.def.nameEn}
              code={c.def.code}
              art={art}
              size="md"
              // `size="md"` só resolve a ARTE; o LAYOUT é a coluna da grade
              style={{ width: "100%" }}
              className="border border-white/10"
            />
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            className="h-11 flex-1 rounded-[3px] bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy}
            onClick={() => onResolve(true)}
          >
            {tr("Ficar com esta mão", "Keep this hand")}
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-[3px] border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
            disabled={busy}
            onClick={() => onResolve(false)}
          >
            {tr("Trocar a mão (Mulligan)", "Swap hand (Mulligan)")}
          </Button>
        </div>
      </div>
    </div>
  );
}
