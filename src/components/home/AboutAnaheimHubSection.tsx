import { Link } from "wouter";
import { ArrowRight, Globe, Shield, Sparkles, Terminal, Users } from "lucide-react";

import anaheimLogo from "@/assets/anaheim-logo.png";
import anaheimLogoTransparent from "@/assets/anaheim-logo-transparent.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AboutAnaheimHubSection() {
  return (
    <section id="sobre-anaheim-hub" className="relative border-t border-white/10 bg-slate-950 py-16 sm:py-24 overflow-hidden">
      {/* Luzes de ambientação de fundo */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[650px] rounded-full bg-cyan-500/5 blur-[140px]" />
      <div className="pointer-events-none absolute -left-20 bottom-0 size-80 rounded-full bg-blue-600/5 blur-[100px]" />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Card Grande Institucional */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950 p-8 sm:p-12 lg:p-16 shadow-[0_0_50px_rgba(6,182,212,0.12)] backdrop-blur-2xl">
          {/* Efeito sutil de linhas de escaneamento militar */}
          <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-10" />

          <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
            {/* Ícone do Site: Elmo do Gundam com A. H. */}
            <div className="relative flex size-28 sm:size-36 items-center justify-center rounded-2xl border border-cyan-400/40 bg-slate-950/80 p-3 shadow-[0_0_32px_rgba(6,182,212,0.35)] transition-transform duration-500 hover:scale-105">
              <img
                src={anaheimLogoTransparent || anaheimLogo}
                alt="Anaheim HUB - Elmo do Gundam com A.H."
                className="size-full object-contain filter drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]"
              />
              <div className="absolute -bottom-2.5 rounded-full border border-cyan-400/50 bg-black px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-cyan-300 shadow-md">
                A. H.
              </div>
            </div>

            {/* Cabeçalho da Mensagem */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                <Sparkles className="size-3.5 text-cyan-400" />
                Diretriz Operacional
              </div>
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl uppercase tracking-wider text-white heading-portal">
                O que é a Anaheim HUB?
              </h2>
            </div>

            {/* Texto Principal Requisitado */}
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-6 sm:p-8 text-left sm:text-center shadow-inner">
              <p className="text-base sm:text-lg md:text-xl text-slate-200 leading-relaxed font-sans font-normal">
                "A Anaheim HUB é uma plataforma criada e destinada aos jogadores de Gundam TCG para trocarem informações de cartas, decks, informações sobre o metagame, treinar no simulador tanto solo quanto outros jogadores e, principalmente, auxiliar os novos jogadores a descobrirem o universo Gundam de maneira simples e guiada. Plataforma em constante evolução para oferecer informações traduzidas e informações importantes para auxiliar a comunidade."
              </p>
            </div>

            {/* Pilares da Plataforma */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-2">
              <div className="flex flex-col items-center p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                <Users className="size-6 text-cyan-400 mb-2" />
                <h4 className="font-heading text-base uppercase text-white">Comunidade & Trocas</h4>
                <p className="text-xs text-slate-400 mt-1">Conectando pilotos e fomentando o cenário em todo o país.</p>
              </div>

              <div className="flex flex-col items-center p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                <Terminal className="size-6 text-cyan-400 mb-2" />
                <h4 className="font-heading text-base uppercase text-white">Simulador & Metagame</h4>
                <p className="text-xs text-slate-400 mt-1">Treino solo inteligente, partidas online e telemetria.</p>
              </div>

              <div className="flex flex-col items-center p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                <Globe className="size-6 text-cyan-400 mb-2" />
                <h4 className="font-heading text-base uppercase text-white">Acolhimento em PT-BR</h4>
                <p className="text-xs text-slate-400 mt-1">Regras traduzidas, glossário tático e suporte a novatos.</p>
              </div>
            </div>

            {/* Breve Disclaimer sobre ser uma comunidade e não um site oficial */}
            <div className="w-full border-t border-white/10 pt-6 mt-4">
              <div className="flex items-start justify-center gap-2.5 text-xs text-slate-400 max-w-2xl mx-auto text-center">
                <Shield className="size-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px] text-slate-400">
                  <strong className="text-slate-300">Aviso da Comunidade:</strong> A Anaheim HUB é uma iniciativa independente, sem fins lucrativos, criada por fãs e para a comunidade brasileira de jogadores. Não somos afiliados, patrocinados nem temos vínculo oficial com a Bandai Co., Ltd., Bandai Namco, Sunrise ou Sotsu. Todas as marcas, ilustrações, personagens e termos de Gundam Card Game são propriedades de seus respectivos detentores de direitos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
