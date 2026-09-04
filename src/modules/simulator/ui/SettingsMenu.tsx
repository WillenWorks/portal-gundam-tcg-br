/* Header enxuto (pedido do Willen, capturas 3): no lugar da barra do topo
 * inteira (Sair + textos de turno/fase/timer/sync) sobra só este ⚙ + o 🐞 ao
 * lado. O ⚙ abre um popover com o que era ação de header: auto-passar Action
 * Step e Desistir/Voltar ao lobby. */
import { LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

interface SettingsMenuProps {
  autoPass: boolean;
  onToggleAutoPass: (value: boolean) => void;
  /** "Desistir" (partida em curso) ou "Voltar ao lobby" (fim de jogo). */
  onLeave: () => void;
  gameOver: boolean;
  busy?: boolean;
}

export function SettingsMenu({ autoPass, onToggleAutoPass, onLeave, gameOver, busy }: SettingsMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-none border-primary/30 bg-slate-950/70"
          aria-label="Configurações da partida"
          title="Configurações da partida"
        >
          <Settings className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 rounded-none border-primary/25 bg-slate-950/95 text-soft">
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0">
              <span className="block font-semibold">Auto-passar Action Step</span>
              <span className="block text-[10px] text-muted-portal">Passa sozinho quando você não tem jogada 【Action】.</span>
            </span>
            <Switch checked={autoPass} onCheckedChange={onToggleAutoPass} disabled={busy} aria-label="Auto-passar Action Step" />
          </label>

          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-none border-red-500/40 text-red-300 hover:bg-red-500/10"
            disabled={busy}
            onClick={onLeave}
          >
            <LogOut className="mr-1.5 size-3.5" />
            {gameOver ? "Voltar ao lobby" : "Desistir da partida"}
          </Button>
          {!gameOver ? (
            <p className="text-[10px] leading-tight text-muted-portal">
              Desistir encerra o duelo e concede a vitória ao oponente.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
