import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Flame,
  Layers,
  Share2,
  ShieldAlert,
  Swords,
  User,
  Users,
} from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { Button } from "@/components/ui/button";

const STARTER_DECKS = [
  { id: "ST01", name: "ST01 · Federation White" },
  { id: "ST02", name: "ST02 · Zeon Red" },
  { id: "ST03", name: "ST03 · SEED Blue" },
  { id: "ST04", name: "ST04 · Witch Green" },
];

type Modality = "2x2" | "battle-royale";

export default function SimulatorMultiplayerPage() {
  const [, navigate] = useLocation();
  const [modality, setModality] = useState<Modality>("2x2");
  const [deckId, setDeckId] = useState<string>("ST01");

  return (
    <PublicShell
      breadcrumbs={[
        { label: "Simulador", href: "/simulador" },
        { label: "Arena Multiplayer" },
      ]}
    >
      {/* Container Panorâmico Widescreen com a Guerra Total entre os 4 Gundams */}
      <div className="relative mx-auto w-full max-w-[1720px] overflow-hidden rounded-2xl border border-violet-500/40 bg-slate-950 shadow-[0_0_60px_rgba(139,92,246,0.25)]">
        {/* Background Artwork em Alta Resolução (Nu Gundam, Sinanju, Deathscythe e Qubeley) */}
        <div className="pointer-events-none absolute inset-0">
          <img
            src="/images/multiplayer_total_war_arena.jpg"
            alt="Guerra Total no Espaço: Nu Gundam, Sinanju, Deathscythe e Qubeley com Funnels"
            className="h-full w-full object-cover object-center opacity-95 brightness-105 contrast-105"
          />
          {/* Gradientes sutis para harmonização da moldura com a página */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-transparent to-[#0b0f19]/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f19]/50 via-transparent to-[#0b0f19]/75" />
          <div className="absolute inset-0 bg-grid-tech opacity-10" />
        </div>

        {/* Área Central com o Card de Configuração Multiplayer */}
        <div className="relative z-10 flex min-h-[740px] lg:min-h-[820px] xl:min-h-[900px] 2xl:min-h-[940px] items-center justify-center p-4 sm:p-6 lg:p-10">
          <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-violet-500/40 bg-slate-950/90 shadow-2xl backdrop-blur-md">
            {/* ── CAMADA 1: CONTEÚDO DO CARD (RENDERIZADO SOB A BARREIRA) ──────── */}
            <div className="select-none pointer-events-none opacity-25 grayscale-[45%] blur-[0.6px] p-6 sm:p-8 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-violet-400 font-semibold flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    Arena Asticassia · Protocolo Multiplayer 4P
                  </p>
                  <h1 className="mt-1.5 font-heading text-3xl sm:text-4xl uppercase text-white heading-portal">
                    Arena Multiplayer
                  </h1>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-soft">
                    Confrontos táticos em larga escala para até 4 pilotos. Partidas cooperativas 2x2 ou guerra total Battle Royale.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-arena border-white/20 hover:bg-white/10"
                  onClick={() => navigate("/simulador")}
                >
                  <ArrowLeft className="mr-1.5 size-3.5" />
                  Voltar
                </Button>
              </div>

              {/* Seletor de Modalidade: 2x2 vs Battle Royale */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Modalidade de Combate (4 Pilotos)
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModality("2x2")}
                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                      modality === "2x2"
                        ? "border-violet-500 bg-violet-950/40 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                        : "border-white/10 bg-black/30 text-soft"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm uppercase tracking-wider">
                      <Layers className="size-3.5 text-violet-400" />
                      2x2 Duplas
                    </div>
                    <span className="text-[10px] text-muted-portal mt-0.5">
                      Cooperação de Esquadrão
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModality("battle-royale")}
                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                      modality === "battle-royale"
                        ? "border-violet-500 bg-violet-950/40 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                        : "border-white/10 bg-black/30 text-soft"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm uppercase tracking-wider">
                      <Flame className="size-3.5 text-amber-400" />
                      Battle Royale
                    </div>
                    <span className="text-[10px] text-muted-portal mt-0.5">
                      Todos contra Todos (4P)
                    </span>
                  </button>
                </div>
              </div>

              {/* Seletor de Deck */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 flex items-center gap-1.5">
                  <User className="size-3 text-violet-400" />
                  Seu Deck de Combate
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {STARTER_DECKS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDeckId(d.id)}
                      className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                        deckId === d.id
                          ? "border-violet-500 bg-violet-500/20 text-violet-300"
                          : "border-white/10 bg-black/20 text-soft"
                      }`}
                    >
                      {d.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botões de Ação de Matchmaking */}
              <div className="space-y-2.5 pt-1">
                <Button className="w-full rounded-arena bg-violet-600 text-white hover:bg-violet-700">
                  <Swords className="mr-2 size-4" />
                  Entrar na Fila Oficial 4P (FIFO Online)
                </Button>

                <Button variant="outline" className="w-full rounded-arena border-white/20">
                  <Share2 className="mr-2 size-4" />
                  Convidar Esquadrão (Link Direto 4P)
                </Button>
              </div>

              {/* Prévia da Sala com Trava FIFO (4 Slots de Piloto) */}
              <div className="rounded-lg border border-white/10 bg-black/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-muted-portal">
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Sala de Espera FIFO (1/4 Pilotos Conectados)
                  </span>
                  <span className="text-violet-400 font-bold">Trava 4/4</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-950/20 p-2 text-emerald-300">
                    <span className="size-2 rounded-full bg-emerald-400" />
                    <span className="font-semibold text-[11px] truncate">1. Você (Host)</span>
                  </div>
                  <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] p-2 text-slate-500">
                    <span className="size-2 rounded-full bg-slate-600" />
                    <span className="text-[11px] truncate">2. Vaga Aberta...</span>
                  </div>
                  <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] p-2 text-slate-500">
                    <span className="size-2 rounded-full bg-slate-600" />
                    <span className="text-[11px] truncate">3. Vaga Aberta...</span>
                  </div>
                  <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] p-2 text-slate-500">
                    <span className="size-2 rounded-full bg-slate-600" />
                    <span className="text-[11px] truncate">4. Vaga Aberta...</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-tight">
                  Trava de vagas FIFO: a partida inicia imediatamente ao completar 4 pilotos, bloqueando conexões excedentes.
                </p>
              </div>
            </div>

            {/* ── CAMADA 2: BARREIRA HOLOGRÁFICA COM SHADING E LISTRAS DE ALERTA ── */}
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              {/* Shading escuro profundo e vinheta avermelhada */}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/70 to-slate-950/95" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.12)_0%,rgba(15,23,42,0.75)_65%,rgba(11,15,25,0.95)_100%)]" />

              {/* Listras diagonais de advertência tática / barreira de energia */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.06)_0px,rgba(239,68,68,0.06)_16px,transparent_16px,transparent_32px)]" />

              {/* Scanlines & Grid tático */}
              <div className="absolute inset-0 bg-scanlines opacity-30" />
              <div className="absolute inset-0 bg-grid-tech opacity-20" />

              {/* Feixes de contenção a laser */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_15px_rgba(239,68,68,0.9)]" />
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_15px_rgba(239,68,68,0.9)]" />
            </div>

            {/* ── CAMADA 3: ALERTA VERMELHO FRONTAL "BLOQUEADO" ──────────────── */}
            <div className="absolute inset-0 z-30 flex items-center justify-center p-6 text-center pointer-events-auto">
              <div className="relative w-full max-w-md overflow-hidden rounded-xl border-2 border-red-500/80 bg-slate-950/95 p-6 sm:p-7 shadow-[0_0_80px_rgba(239,68,68,0.45),inset_0_0_24px_rgba(239,68,68,0.15)] backdrop-blur-2xl">
                {/* Feixe luminoso de emergência vermelha */}
                <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 size-36 rounded-full bg-red-600/30 blur-3xl" />

                {/* Marcadores táticos nos quatro cantos */}
                <div className="pointer-events-none absolute top-2 left-2 size-2 border-t-2 border-l-2 border-red-500/80" />
                <div className="pointer-events-none absolute top-2 right-2 size-2 border-t-2 border-r-2 border-red-500/80" />
                <div className="pointer-events-none absolute bottom-2 left-2 size-2 border-b-2 border-l-2 border-red-500/80" />
                <div className="pointer-events-none absolute bottom-2 right-2 size-2 border-b-2 border-r-2 border-red-500/80" />

                <div className="relative z-10 flex flex-col items-center">
                  {/* Badge com luz pulsante de protocolo */}
                  <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-red-400 shadow-[0_0_16px_rgba(239,68,68,0.25)]">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                    </span>
                    <ShieldAlert className="size-3.5 text-red-400" />
                    Acesso Restrito · Anaheim Hub
                  </div>

                  {/* Título "BLOQUEADO" em vermelho neon vibrante */}
                  <h2 className="mt-3 font-heading text-4xl sm:text-5xl uppercase tracking-wider text-red-500 drop-shadow-[0_0_24px_rgba(239,68,68,0.7)]">
                    Bloqueado
                  </h2>

                  {/* Linha divisória tática */}
                  <div className="my-2.5 flex w-32 items-center gap-1.5">
                    <div className="h-[1px] flex-1 bg-red-500/40" />
                    <div className="size-1.5 rotate-45 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    <div className="h-[1px] flex-1 bg-red-500/40" />
                  </div>

                  {/* Texto explicativo transparente */}
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-300 max-w-sm">
                    O simulador para 4 jogadores (modalidades 2x2 e Battle Royale com fila FIFO e salas de esquadrão) está em fase de modelagem de rede e sincronização. Todo o módulo está previsto no roadmap oficial do Anaheim Hub.
                  </p>

                  {/* Tags técnicas de status */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 pt-3 border-t border-red-500/20 text-[10px] font-mono uppercase tracking-wider text-red-400/90">
                    <span className="px-2 py-0.5 rounded-xs border border-red-500/30 bg-red-950/50">
                      Capacidade: 4 Pilotos
                    </span>
                    <span className="px-2 py-0.5 rounded-xs border border-red-500/30 bg-red-950/50">
                      Modos: 2x2 & BR
                    </span>
                    <span className="px-2 py-0.5 rounded-xs border border-red-500/30 bg-red-950/50">
                      Em Engenharia
                    </span>
                  </div>

                  {/* Botão de Retorno à Arena Principal */}
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-5 rounded-arena border-white/20 bg-white/5 text-xs uppercase tracking-wider text-white hover:bg-white/10 hover:border-white/40"
                    onClick={() => navigate("/simulador")}
                  >
                    <ArrowLeft className="mr-1.5 size-3.5" />
                    Voltar ao Simulador
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
