/* Layout shell — navegação principal, breadcrumbs e estrutura consistente para as páginas internas. */
import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BookOpenText,
  Boxes,
  Gauge,
  Home,
  LibraryBig,
  ShieldCheck,
  Swords,
  UserCircle2,
} from "lucide-react";

import logoWhite from "@/assets/gundam-logo-white.png";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { AppRoute } from "@/modules/core/types";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/portal", label: "Portal", icon: Home },
  { href: "/cards", label: "Cartas", icon: LibraryBig },
  { href: "/rules", label: "Regras", icon: BookOpenText },
  { href: "/tournaments", label: "Torneios", icon: Gauge },
  { href: "/deckbuilder", label: "Deckbuilder", icon: Swords },
  { href: "/profile", label: "Perfil", icon: UserCircle2 },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
] satisfies { href: AppRoute | "/profile"; label: string; icon: typeof Home }[];

const titles: Record<string, string> = {
  "/portal": "Painel do portal",
  "/cards": "Catálogo de cartas",
  "/rules": "Base de regras e rulings",
  "/tournaments": "Hub competitivo",
  "/deckbuilder": "Deckbuilder MVP",
  "/profile": "Perfil do usuário",
  "/admin": "Centro administrativo",
};

export function PortalShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const currentTitle = location.startsWith("/u/")
    ? "Perfil público"
    : location.startsWith("/deck/")
      ? "Deck compartilhado"
      : titles[location] ?? "Portal";

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-white/10 bg-slate-950/70 px-4 py-6 backdrop-blur-xl sm:px-6 lg:sticky lg:top-0 lg:h-screen lg:px-5">
          <div className="flex items-center gap-3">
            <img src={logoWhite} alt="Gundam Card Game" className="h-10 w-auto opacity-90" />
            <div>
              <p className="font-heading text-lg uppercase tracking-[0.18em]">Portal BR</p>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Sistema integrado</p>
            </div>
          </div>

          <Badge className="mt-5 rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">
            Estrutura interna v0
          </Badge>

          <nav className="mt-8 space-y-2">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "panel-cut flex items-center gap-3 border px-4 py-3 text-sm uppercase tracking-[0.18em] transition",
                    active
                      ? "border-primary/40 bg-primary/12 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className={cn("size-4", active ? "text-primary" : "text-slate-400")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Separator className="my-6 bg-white/10" />

          <div className="panel-cut border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <Boxes className="size-5 text-accent" />
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Camadas ativas</p>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <li>• rotas internas organizadas</li>
              <li>• leitura pública via API filtrada</li>
              <li>• perfil e share link de decks</li>
              <li>• admin para operação manual e importação</li>
            </ul>
          </div>
        </aside>

        <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="mb-8 space-y-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/portal">Portal</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{currentTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="panel-cut border border-white/10 bg-slate-950/55 px-5 py-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Núcleo operacional</p>
              <h1 className="mt-2 font-heading text-5xl uppercase leading-none text-white">{currentTitle}</h1>
            </div>
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}
