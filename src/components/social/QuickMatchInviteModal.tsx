/* Modal de Confirmação ou Declínio de Partida Rápida (Guest Quick Match Invite Modal)
 * Exibida na tela do piloto convidado em tempo real ao receber o desafio de um amigo online. */
import { Swords, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface QuickMatchInviteModalProps {
  open: boolean;
  hostUser?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  onAccept: () => void;
  onDecline: () => void;
}

export function QuickMatchInviteModal({
  open,
  hostUser,
  onAccept,
  onDecline,
}: QuickMatchInviteModalProps) {
  if (!hostUser) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDecline()}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-md w-full border-primary/40 bg-slate-950/98 p-5 text-white rounded-none shadow-[0_0_50px_rgba(6,182,212,0.35)] backdrop-blur-md"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-lg uppercase tracking-wider text-primary flex items-center gap-2">
            <Swords className="size-5 text-primary animate-pulse" /> Desafio de Partida Rápida!
          </DialogTitle>
        </DialogHeader>

        <div className="py-3 space-y-4">
          <div className="flex items-center gap-3.5 p-3.5 border border-white/10 bg-slate-900/80">
            <Avatar className="size-12 border border-primary/40">
              <AvatarImage src={hostUser.avatarUrl || undefined} />
              <AvatarFallback className="text-sm bg-slate-800 text-white font-mono">
                {hostUser.displayName?.slice(0, 2).toUpperCase() || "PL"}
              </AvatarFallback>
            </Avatar>

            <div>
              <p className="font-heading text-base uppercase text-white tracking-wide">
                {hostUser.displayName}
              </p>
              <p className="text-xs font-mono text-primary">@{hostUser.username}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Convidou você para um combate 1v1 no Simulador Anaheim.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed text-center">
            Ao aceitar, ambos entrarão imediatamente no Simulador para selecionar o deck de combate.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={onDecline}
              className="rounded-none border-white/20 text-xs uppercase tracking-wider text-slate-300 hover:bg-white/10"
            >
              <X className="size-3.5 mr-1" />
              Recusar
            </Button>

            <Button
              type="button"
              onClick={onAccept}
              className="rounded-none bg-emerald-600 hover:bg-emerald-500 text-white text-xs uppercase tracking-wider font-semibold px-4"
            >
              <Check className="size-3.5 mr-1" />
              Aceitar Partida
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
