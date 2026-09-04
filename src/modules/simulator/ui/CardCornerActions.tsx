/* Cluster de ações no canto SUP. DIREITO de uma carta — mão OU campo (pedido do
 * Willen 2026-09-03): "Ver" (olho) SEMPRE presente e ancorado no canto; as ações
 * de contexto (Jogar / Atacar / Ativar / Blocker / Mirar) aparecem à esquerda
 * dele. Sempre visível (não depende de hover — o hover não pegava de forma
 * confiável). Cada botão faz `stopPropagation` pra o clique nunca cair no corpo
 * da carta por baixo (era o conflito "atacar abre a imagem").
 *
 * V6.3 (docs/34) — achado do Willen: a mão usava um tamanho/posição
 * (`size-6`, salta pra fora do canto) e o campo usava outro (`size-5`,
 * dentro do canto) — inconsistente, e os dois abaixo do alvo de toque de
 * 44px já usado em Shield/Recurso. Unificado: 1 tamanho só (`size-7`,
 * maior que os dois anteriores) e 1 posição só (dentro do canto, nunca mais
 * salta pra fora — reduz a chance de 2 cartas vizinhas colidirem o cluster
 * uma da outra, relevante com o espaçamento apertado do mobile).
 *
 * V6.4 (docs/35) — bug real reportado pelo Willen (print de mobile): `size-7`
 * FIXO (28px) não respeitava `--card-w-std` — em telas cramped a carta em si
 * podia encolher pra ~27px (piso de `useArenaScale`), então o botão sozinho
 * ficava do tamanho da carta INTEIRA ou maior, cobrindo a arte. Agora o
 * tamanho é `clamp()` sobre `--card-w-std`: acompanha a carta pra baixo no
 * mobile, mas nunca passa de 1.75rem (o `size-7` de antes) no desktop nem
 * fica menor que 1.125rem (ainda tocável). */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** ~45% da largura da carta — 2 botões lado a lado (Ver + 1 ação de contexto)
 *  ainda cabem sem se sobrepor nem estourar o canto. Piso/teto preservam o
 *  alvo de toque em telas normais (era `size-7` fixo). */
const BUTTON_SIZE = "size-[clamp(1.125rem,calc(var(--card-w-std,2.17rem)*0.45),1.75rem)]";
const ICON_SIZE = "size-[clamp(0.625rem,calc(var(--card-w-std,2.17rem)*0.26),1rem)]";

export type CornerTone = "view" | "primary" | "accent" | "sky" | "emerald";

const TONE: Record<CornerTone, string> = {
  view: "bg-slate-900/95 text-slate-200 hover:text-primary",
  primary: "bg-primary/95 text-black hover:bg-primary",
  accent: "bg-accent text-black hover:bg-accent/90",
  sky: "bg-sky-500 text-white hover:bg-sky-400",
  emerald: "bg-emerald-500 text-white hover:bg-emerald-400",
};

export interface CornerAction {
  key: string;
  icon: LucideIcon;
  label: string;
  tone: CornerTone;
  onClick: () => void;
  disabled?: boolean;
}

interface CardCornerActionsProps {
  /** ordem visual da ESQUERDA pra direita — passe as ações de contexto primeiro
   *  e "Ver" por último, pra "Ver" encostar no canto direito. */
  actions: CornerAction[];
  className?: string;
}

export function CardCornerActions({ actions, className }: CardCornerActionsProps) {
  if (actions.length === 0) return null;
  return (
    <div
      // absoluto encostado no canto direito, DENTRO da carta (nunca mais
      // salta pra fora — mão e campo usam o mesmo `top-0.5 right-0.5`
      // default agora); cresce pra ESQUERDA conforme ganha botões.
      className={cn("absolute top-0.5 right-0.5 z-40 flex items-start gap-0.5", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          title={a.label}
          aria-label={a.label}
          disabled={a.disabled}
          onClick={(e) => {
            e.stopPropagation();
            a.onClick();
          }}
          className={cn(
            "flex items-center justify-center rounded-arena border border-black/40 shadow-lg transition-colors disabled:opacity-40 motion-reduce:transition-none",
            BUTTON_SIZE,
            TONE[a.tone],
          )}
        >
          <a.icon className={ICON_SIZE} aria-hidden />
        </button>
      ))}
    </div>
  );
}
