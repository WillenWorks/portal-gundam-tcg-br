/* Sprint "Mulligan" — modal de início de partida (Comprehensive Rules 6-2 /
 * ruling oficial). Mostra a mão de 5 cartas comprada e pergunta se o jogador
 * quer trocar. Uma chance só. Modela em `BurstModal`. */
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CardInstance } from "@/modules/simulator/engine/types";
import type { ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";

interface MulliganModalProps {
  /** as 5 cartas da mão comprada (do próprio jogador — sempre visível a ele). */
  hand: CardInstance[];
  art: ArtLookup;
  busy?: boolean;
  onResolve: (keep: boolean) => void;
}

export function MulliganModal({ hand, art, busy, onResolve }: MulliganModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="panel-cut hero-surface w-full max-w-md border border-primary/45 p-4">
        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-black uppercase tracking-[0.18em] text-primary">
          <RefreshCw className="size-4" /> Mão inicial
        </p>
        <p className="mt-1 text-center text-[11px] text-muted-portal">
          Você comprou 5 cartas. Quer ficar com esta mão ou trocá-la por 5 novas? Só uma vez.
        </p>

        <div className="my-3 flex items-end justify-center gap-1">
          {hand.map((c) => (
            <CardFace
              key={c.instanceId}
              nameEn={c.def.nameEn}
              code={c.def.code}
              art={art}
              size="md"
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
            Ficar com esta mão
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-[3px] border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
            disabled={busy}
            onClick={() => onResolve(false)}
          >
            Trocar a mão (Mulligan)
          </Button>
        </div>
      </div>
    </div>
  );
}
