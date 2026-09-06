/* Aviso/confirmação da partida (pedido do Willen, capturas 4 + ajuste): o que o
 * `ActionDock` resume no canto — "escolha o alvo", "pague o custo", "defenda ou
 * passe" — ecoado num painel estilo modal.
 *
 * Ajuste 2026-09-03: antes era texto 2xl no MEIO da tela e, mesmo com
 * `pointer-events-none`, tapava visualmente as Units que você precisa clicar pra
 * parear/mirar. Agora é um painel compacto no TOPO-centro, FORA do caminho do
 * tabuleiro, `pointer-events-none` (nunca intercepta clique nem hover). */
import { Info, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchPromptProps {
  /** mensagem atual (ou `null` pra esconder). */
  message: string | null;
  /** tom — `info` (padrão) ciano, `warn` âmbar (combate/decisão urgente). */
  tone?: "info" | "warn";
}

export function MatchPrompt({ message, tone = "info" }: MatchPromptProps) {
  if (!message) return null;
  const Icon = tone === "warn" ? Swords : Info;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3">
      <div
        key={message}
        role="status"
        className={cn(
          // Frente 4 (feedback Willen 3ª rodada): `rounded-arena` (não
          // `panel-cut` — o chanfro cortava o fim do texto); `w-fit`/`max-w`
          // pra caber sem truncar.
          "flex w-fit max-w-[min(38rem,calc(100vw-1.5rem))] items-center gap-2 rounded-arena border bg-slate-950/95 px-3.5 py-2 shadow-2xl backdrop-blur-sm",
          tone === "warn" ? "border-amber-400/60 text-amber-200" : "border-primary/45 text-primary",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <p className="text-xs font-bold uppercase leading-snug tracking-[0.04em] sm:text-sm">{message}</p>
      </div>
    </div>
  );
}
