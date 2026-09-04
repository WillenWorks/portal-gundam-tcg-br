/* Sprint 1 (redesenho visual "Nível Arena") — overlay tático que pede a
 * orientação paisagem em celulares no modo retrato. Substitui o antigo truque
 * de `transform: rotate(90deg)` no board (que quebrava toque e overflow): aqui
 * NENHUM elemento é rotacionado por CSS — só o ícone anima, convidando a girar
 * o aparelho. Componente apresentacional puro; a detecção de viewport/orientação
 * mora na página (`SimulatorMatchPage`). */
import { RotateCw, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface RotateDevicePromptProps {
  className?: string;
}

export function RotateDevicePrompt({ className }: RotateDevicePromptProps) {
  return (
    <div
      role="alertdialog"
      aria-label="Gire o dispositivo para o modo paisagem"
      className={cn(
        "fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-slate-950/95 px-8 text-center",
        className,
      )}
    >
      <div className="relative flex size-24 items-center justify-center border border-primary/40 bg-primary/10">
        <Smartphone className="size-10 text-primary" aria-hidden />
        <RotateCw
          className="absolute -right-3 -top-3 size-7 animate-spin text-accent [animation-duration:3s] motion-reduce:animate-none"
          aria-hidden
        />
      </div>

      <div className="max-w-xs space-y-2">
        <p className="font-heading text-xl font-black uppercase tracking-[0.14em] text-soft">
          Gire para o modo paisagem
        </p>
        <p className="text-xs leading-relaxed text-muted-portal">
          A arena de combate exige a tela na horizontal. Deite o aparelho para
          assumir o cockpit.
        </p>
      </div>

      <span className="border border-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        Aguardando orientação
      </span>
    </div>
  );
}
