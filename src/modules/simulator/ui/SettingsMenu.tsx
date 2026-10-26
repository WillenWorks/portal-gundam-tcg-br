/* SettingsMenu v9.0 — configurações de partida com skins de tabuleiro,
 * controle de efeitos sonoros táticos e ações de jogo. */
import { useState } from "react";
import { Film, Gauge, LogOut, Palette, Settings, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { sfx } from "../audio/soundEffects";
import {
  ANIM_SPEED_LABELS,
  ANIM_SPEED_LABELS_EN,
  ANIM_SPEEDS,
  getResolutionPacing,
  getSavedAnimSpeed,
  RESOLUTION_PACING_LABELS,
  saveAnimSpeed,
  saveResolutionPacing,
  type AnimSpeed,
  type ResolutionPacing,
} from "./animationSettings";
import { getSavedPlaymatSkin, PLAYMAT_SKINS, savePlaymatSkin, type PlaymatSkinId } from "./playmatSkins";
import { useSiteLanguage } from "@/i18n/siteLanguage";

interface SettingsMenuProps {
  autoPass: boolean;
  onToggleAutoPass: (value: boolean) => void;
  /** "Desistir" (partida em curso) ou "Voltar ao lobby" (fim de jogo). */
  onLeave: () => void;
  gameOver: boolean;
  busy?: boolean;
}

export function SettingsMenu({ autoPass, onToggleAutoPass, onLeave, gameOver, busy }: SettingsMenuProps) {
  const { tr } = useSiteLanguage();
  const [currentSkin, setCurrentSkin] = useState<PlaymatSkinId>(getSavedPlaymatSkin);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => sfx.isEnabled());
  const [animSpeed, setAnimSpeed] = useState<AnimSpeed>(getSavedAnimSpeed);
  const [pacing, setPacing] = useState<ResolutionPacing>(getResolutionPacing);

  const handlePacingChange = (value: ResolutionPacing) => {
    setPacing(value);
    saveResolutionPacing(value);
  };

  const handleAnimSpeedChange = (speed: AnimSpeed) => {
    setAnimSpeed(speed);
    saveAnimSpeed(speed);
  };

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
          aria-label={tr("Configurações da partida", "Match settings")}
          title={tr("Configurações da partida", "Match settings")}
        >
          <Settings className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-arena border-primary/25 bg-slate-950/95 text-soft p-4 shadow-xl">
        <div className="flex flex-col gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{tr("Configurações de Partida", "Match Settings")}</p>

          {/* Visual do Tabuleiro (Playmat Skin) */}
          <div className="space-y-1.5 border-b border-white/10 pb-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Palette className="size-3.5 text-accent" />
              {tr("Tema do Tabuleiro (Playmat)", "Board theme (Playmat)")}
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

          {/* Velocidade das Animações */}
          <div className="space-y-1.5 border-b border-white/10 pb-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Gauge className="size-3.5 text-accent" />
              {tr("Velocidade das Animações", "Animation speed")}
            </label>
            <select
              value={animSpeed}
              onChange={(e) => handleAnimSpeedChange(Number(e.target.value) as AnimSpeed)}
              className="field-shell h-8 w-full px-2 text-xs"
            >
              {ANIM_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {tr(ANIM_SPEED_LABELS[speed], ANIM_SPEED_LABELS_EN[speed])}
                </option>
              ))}
            </select>
          </div>

          {/* Ritmo da resolução (spec simulador-ritmo-de-resolucao) — vale a partir da próxima jogada */}
          <div className="space-y-1.5 border-b border-white/10 pb-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Film className="size-3.5 text-accent" />
              {tr("Ritmo dos efeitos", "Effect pacing")}
            </label>
            <select
              value={pacing}
              onChange={(e) => handlePacingChange(e.target.value as ResolutionPacing)}
              className="field-shell h-8 w-full px-2 text-xs"
              aria-label={tr("Ritmo dos efeitos", "Effect pacing")}
            >
              {(Object.keys(RESOLUTION_PACING_LABELS) as ResolutionPacing[]).map((value) => (
                <option key={value} value={value}>
                  {tr(RESOLUTION_PACING_LABELS[value].pt, RESOLUTION_PACING_LABELS[value].en)}
                </option>
              ))}
            </select>
          </div>

          {/* Efeitos Sonoros */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 text-xs">
            <span className="flex items-center gap-1.5">
              {soundEnabled ? <Volume2 className="size-3.5 text-primary" /> : <VolumeX className="size-3.5 text-slate-500" />}
              <span>{tr("Efeitos Sonoros", "Sound effects")}</span>
            </span>
            <Switch checked={soundEnabled} onCheckedChange={handleToggleSound} aria-label={tr("Efeitos Sonoros", "Sound effects")} />
          </div>

          {/* Auto-passar Ação */}
          <label className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0">
              <span className="block font-medium">{tr("Auto-passar Ação", "Auto-pass Action")}</span>
              <span className="block text-[10px] text-muted-portal">{tr("Avança quando não houver 【Action】 disponível.", "Moves on when no 【Action】 is available.")}</span>
            </span>
            <Switch checked={autoPass} onCheckedChange={onToggleAutoPass} disabled={busy} aria-label={tr("Auto-passar o Passo de Ação", "Auto-pass the Action Step")} />
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
              {gameOver ? tr("Voltar ao lobby", "Back to lobby") : tr("Desistir da partida", "Concede match")}
            </Button>
            {!gameOver ? (
              <p className="mt-1 text-[10px] leading-tight text-muted-portal">
                {tr("Desistir concede a vitória imediata ao oponente.", "Conceding gives your opponent the win immediately.")}
              </p>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
