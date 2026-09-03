/* Aviso/confirmação no CENTRO da tela (pedido do Willen, capturas 4): o que hoje
 * é só a `hint` do `ActionDock` no canto — "escolha o alvo", "confirme o
 * pagamento", "defenda ou passe" — passa despercebido. Este overlay ecoa a
 * mesma mensagem no meio do canvas, grande e translúcida, sem bloquear clique
 * (`pointer-events-none`). O pai decide QUANDO há mensagem; aqui é só
 * apresentação. */
import { cn } from "@/lib/utils";

interface CenterAnnounceProps {
  /** mensagem atual (ou `null` pra esconder). */
  message: string | null;
  /** tom — `info` (padrão) ciano, `warn` âmbar (combate/decisão urgente). */
  tone?: "info" | "warn";
}

export function CenterAnnounce({ message, tone = "info" }: CenterAnnounceProps) {
  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[38%] z-40 flex justify-center px-4">
      <p
        key={message}
        className={cn(
          "max-w-lg text-balance text-center text-lg font-black uppercase leading-tight tracking-[0.06em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] sm:text-2xl",
          tone === "warn" ? "text-amber-300" : "text-primary",
        )}
      >
        {message}
      </p>
    </div>
  );
}
