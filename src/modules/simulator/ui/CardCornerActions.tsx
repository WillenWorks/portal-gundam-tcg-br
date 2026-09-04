/* Cluster de ações no canto SUP. DIREITO de uma carta — mão OU campo (pedido do
 * Willen 2026-09-03): "Ver" (olho) SEMPRE presente e ancorado no canto; as ações
 * de contexto (Jogar / Atacar / Ativar / Blocker / Mirar) aparecem à esquerda
 * dele. Sempre visível (não depende de hover — o hover não pegava de forma
 * confiável). Cada botão faz `stopPropagation` pra o clique nunca cair no corpo
 * da carta por baixo (era o conflito "atacar abre a imagem"). */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /** `md` (mão, `size-6`) ou `sm` (campo, `size-5` — cobre menos a arte). */
  size?: "sm" | "md";
  className?: string;
}

export function CardCornerActions({ actions, size = "md", className }: CardCornerActionsProps) {
  if (actions.length === 0) return null;
  return (
    <div
      // absoluto encostado no canto direito; cresce pra ESQUERDA conforme ganha
      // botões. `-top-2` (default) põe a fila levemente pra fora da carta — o
      // caller passa `top-0.5` quando não pode passar pra fora (campo).
      className={cn("absolute -top-2 right-0 z-40 flex items-start gap-0.5", className)}
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
            "flex items-center justify-center rounded-none border border-black/40 shadow-lg transition-colors disabled:opacity-40 motion-reduce:transition-none",
            size === "sm" ? "size-5" : "size-6",
            TONE[a.tone],
          )}
        >
          <a.icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
        </button>
      ))}
    </div>
  );
}
