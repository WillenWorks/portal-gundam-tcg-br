/* Rodapé Institucional Padronizado v1.0 — Anaheim Hub
 * Compartilhado entre páginas públicas (PublicShell, Home) e painel privado (PortalShell).
 * Inclui identidade visual, links de navegação rápida, termos legais e botão de acesso rápido
 * para Apoio Comunitário via Pix Nubank com abertura da CommunitySupportModal.
 */
import { useState } from "react";
import { Link } from "wouter";
import { HeartHandshake, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CommunitySupportModal } from "@/components/support/CommunitySupportModal";
import anaheimLogo from "@/assets/anaheim-logo-transparent.webp";

export function AppFooter({ className }: { className?: string }) {
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  return (
    <>
      <footer
        className={`w-full border-t border-white/10 bg-slate-950/90 text-sm text-slate-400 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/90 light:border-slate-300/80 light:bg-white/90 light:text-slate-600 ${
          className || ""
        }`}
      >
        <div className="mx-auto w-full max-w-[2400px] px-4 py-8 sm:px-6 xl:px-8 2xl:px-10 3xl:px-12">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
            {/* Bloco 1: Brand e Propósito */}
            <div className="space-y-3 lg:col-span-5">
              <div className="flex items-center gap-3">
                <img
                  loading="lazy"
                  decoding="async"
                  src={anaheimLogo}
                  alt="Anaheim Hub"
                  className="h-9 w-auto object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.25)]"
                />
                <p className="font-heading text-xl uppercase tracking-[0.18em] text-white dark:text-white light:text-slate-900">
                  Anaheim Hub
                </p>
              </div>
              <p className="max-w-xl text-xs leading-6 text-slate-400 dark:text-slate-400 light:text-slate-600">
                Cartas, decks, torneios, estatísticas e simulador de Gundam Card Game, feito pela comunidade no Brasil. Aberto e gratuito, com deckbuilder, estatísticas do meta e simulador Asticassia para a comunidade de pilotos.
              </p>
              <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-500 light:text-slate-500">
                Cartas, artes e marcas registradas pertencem à Bandai Co., Ltd. e Sunrise/Sotsu. Anaheim Hub é um projeto comunitário independente sem fins lucrativos.
              </p>
            </div>

            {/* Bloco 2: Navegação Rápida */}
            <div className="space-y-3 lg:col-span-2">
              <p className="text-xs uppercase tracking-[0.22em] text-white dark:text-white light:text-slate-900 font-semibold">
                Navegação
              </p>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/database" className="transition-colors hover:text-primary">
                    Banco de Cartas
                  </Link>
                </li>
                <li>
                  <Link href="/decks" className="transition-colors hover:text-primary">
                    Decks
                  </Link>
                </li>
                <li>
                  <Link href="/rules" className="transition-colors hover:text-primary">
                    Regras Oficiais pt-BR
                  </Link>
                </li>
                <li>
                  <Link href="/torneios" className="transition-colors hover:text-primary">
                    Torneios & Eventos
                  </Link>
                </li>
                <li>
                  <Link href="/stats" className="transition-colors hover:text-primary">
                    Estatísticas
                  </Link>
                </li>
                <li>
                  <Link href="/novidades" className="transition-colors hover:text-primary">
                    Novidades & Changelog
                  </Link>
                </li>
              </ul>
            </div>

            {/* Bloco 3: Diretrizes & Legal */}
            <div className="space-y-3 lg:col-span-2">
              <p className="text-xs uppercase tracking-[0.22em] text-white dark:text-white light:text-slate-900 font-semibold">
                Políticas & Contato
              </p>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/privacidade" className="transition-colors hover:text-primary">
                    Privacidade de Dados
                  </Link>
                </li>
                <li>
                  <Link href="/termos" className="transition-colors hover:text-primary">
                    Termos de Uso
                  </Link>
                </li>
                <li>
                  <a href="mailto:admin@anaheimhub.com" className="transition-colors hover:text-primary">
                    admin@anaheimhub.com
                  </a>
                </li>
                <li>
                  <span className="text-slate-500">Versão 2.2.0 (Produção)</span>
                </li>
              </ul>
            </div>

            {/* Bloco 4: Apoio Comunitário (Acesso Rápido) */}
            <div className="space-y-3 lg:col-span-3">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-400 font-semibold">
                Apoio Comunitário
              </p>
              <p className="text-xs leading-5 text-slate-400 dark:text-slate-400 light:text-slate-600">
                Ajude a manter a infraestrutura de servidores, banco de dados e o simulador online com doações via Pix Nubank.
              </p>
              <div className="pt-1">
                <Button
                  type="button"
                  onClick={() => setSupportModalOpen(true)}
                  className="w-full rounded-none border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-xs font-semibold uppercase tracking-wider text-amber-300 hover:border-amber-400 hover:bg-amber-500/25 hover:text-amber-200 transition-all shadow-sm"
                >
                  <HeartHandshake className="mr-2 size-4 text-amber-400" />
                  Apoie o Anaheim Hub
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck className="size-3.5 text-amber-400" />
                Doações liberam a Insígnia de Apoiador no perfil
              </p>
            </div>
          </div>

          <Separator className="my-6 bg-white/10 dark:bg-white/10 light:bg-slate-300/70" />

          <div className="flex flex-col items-center justify-between gap-4 text-xs text-slate-500 sm:flex-row">
            <p>© {new Date().getFullYear()} Anaheim Hub. Todos os direitos reservados à comunidade.</p>
            <p className="font-mono text-[11px]">FEITO PELA COMUNIDADE · GUNDAM CARD GAME BR</p>
          </div>
        </div>
      </footer>

      {/* Modal de Apoio Comunitário acionada pelo botão rápido */}
      <CommunitySupportModal open={supportModalOpen} onOpenChange={setSupportModalOpen} />
    </>
  );
}
