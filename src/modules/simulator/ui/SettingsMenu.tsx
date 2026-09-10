/* SettingsMenu v9.0 — configurações de partida com skins de tabuleiro,
 * controle de efeitos sonoros táticos e ações de jogo. */
import { useState } from "react";
import { LogOut, Palette, Settings, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { sfx } from "../audio/soundEffects";
import { getSavedPlaymatSkin, PLAYMAT_SKINS, savePlaymatSkin, type PlaymatSkinId } from "./playmatSkins";

interface SettingsMenuProps {
  autoPass: boolean;
  onToggleAutoPass: (value: boolean) => void;
  /** "Desistir" (partida em curso) ou "Voltar ao lobby" (fim de jogo). */
  onLeave: () => void;
  gameOver: boolean;
  busy?: boolean;
}

export function SettingsMenu({ autoPass, onToggleAutoPass, onLeave, gameOver, busy }: SettingsMenuProps) {
  const [currentSkin, setCurrentSkin] = useState<PlaymatSkinId>(getSavedPlaymatSkin);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => sfx.isEnabled());

  const handleSkinChange = (skinId: PlaymatSkinId) => {
    setCurrentSkin(skinId);
    savePlaymatSkin(skinId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("asticassia:playmat:change", { detail: skinId }));
    }
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    sfx.setEnabled(enabled);
    if (enabled) sfx.playClick();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-arena border-primary/30 bg-slate-950/70"
          aria-label="Configurações da partida"
          title="Configurações da partida"
        >
          <Settings className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-arena border-primary/25 bg-slate-950/95 text-soft p-4 shadow-xl">
        <div className="flex flex-col gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Configurações de Partida</p>

          {/* Visual do Tabuleiro (Playmat Skin) */}
          <div className="space-y-1.5 border-b border-white/10 pb-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Palette className="size-3.5 text-accent" />
              Tema do Tabuleiro (Playmat)
            </label>
            <select
              value={currentSkin}
              onChange={(e) => handleSkinChange(e.target.value as PlaymatSkinId)}
              className="field-shell h-8 w-full px-2 text-xs"
            >
              {Object.values(PLAYMAT_SKINS).map((skin) => (
                <option key={skin.id} value={skin.id}>
                  {skin.name}
                </option>
              ))}
            </select>
          </div>

          {/* Efeitos Sonoros */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 text-xs">
            <span className="flex items-center gap-1.5">
              {soundEnabled ? <Volume2 className="size-3.5 text-primary" /> : <VolumeX className="size-3.5 text-slate-500" />}
              <span>Efeitos Sonoros</span>
            </span>
            <Switch checked={soundEnabled} onCheckedChange={handleToggleSound} aria-label="Efeitos Sonoros" />
          </div>

          {/* Auto-passar Ação */}
          <label className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0">
              <span className="block font-medium">Auto-passar Ação</span>
              <span className="block text-[10px] text-muted-portal">Avança quando não houver 【Action】 disponível.</span>
            </span>
            <Switch checked={autoPass} onCheckedChange={onToggleAutoPass} disabled={busy} aria-label="Auto-passar o Passo de Ação" />
          </label>

          {/* Sair / Desistir */}
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-arena border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs"
              disabled={busy}
              onClick={onLeave}
            >
              <LogOut className="mr-1.5 size-3.5" />
              {gameOver ? "Voltar ao lobby" : "Desistir da partida"}
            </Button>
            {!gameOver ? (
              <p className="mt-1 text-[10px] leading-tight text-muted-portal">
                Desistir concede a vitória imediata ao oponente.
              </p>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
