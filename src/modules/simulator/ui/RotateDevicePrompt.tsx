/* Sprint 1 (redesenho visual "Nível Arena") — overlay tático que pede a
 * orientação paisagem em celulares no modo retrato. Substitui o antigo truque
 * de `transform: rotate(90deg)` no board (que quebrava toque e overflow): aqui
 * NENHUM elemento é rotacionado por CSS — só o ícone anima, convidando a girar
 * o aparelho. Componente apresentacional puro; a detecção de viewport/orientação
 * mora na página (`SimulatorMatchPage`). */
import { RotateCw, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteLanguage } from "@/i18n/siteLanguage";

interface RotateDevicePromptProps {
  className?: string;
}

export function RotateDevicePrompt({ className }: RotateDevicePromptProps) {
  const { tr } = useSiteLanguage();
  return (
    <div
      role="alertdialog"
      aria-label={tr("Gire o dispositivo para o modo paisagem", "Rotate your device to landscape")}
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
          {tr("Gire para o modo paisagem", "Rotate to landscape")}
        </p>
        <p className="text-xs leading-relaxed text-muted-portal">
          {tr("O tabuleiro precisa da tela na horizontal. Gire o aparelho para continuar.", "The board needs a landscape screen. Rotate your device to continue.")}
        </p>
      </div>

      <span className="border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {tr("Aguardando o giro da tela", "Waiting for rotation")}
      </span>
    </div>
  );
}
