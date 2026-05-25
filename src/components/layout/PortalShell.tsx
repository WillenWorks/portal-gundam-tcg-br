/* Layout shell — navegação pública + área do usuário + admin, com breadcrumbs clicáveis. */
import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  BookOpenText,
  Boxes,
  FolderKanban,
  Gauge,
  Home,
  LibraryBig,
  ShieldCheck,
  Swords,
  UserCircle2,
  Users,
} from "lucide-react";

import logoWhite from "@/assets/gundam-logo-white.png";
import { useAuth } from "@/contexts/AuthContext";
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
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

const publicNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/decks", label: "Decks Públicos", icon: Users },
  { href: "/sets", label: "Coleções", icon: FolderKanban },
  { href: "/stats", label: "Estatísticas", icon: BarChart3 },
  { href: "/tournaments", label: "Campeonatos", icon: Gauge },
  { href: "/cards", label: "Cartas", icon: LibraryBig },
  { href: "/rules", label: "Regras", icon: BookOpenText },
] as const;

const userNav = [
  { href: "/portal", label: "Minha Área", icon: Home },
  { href: "/deckbuilder", label: "Criar Deck", icon: Swords },
  { href: "/profile", label: "Meu Perfil", icon: UserCircle2 },
] as const;

const adminNav = [{ href: "/admin", label: "Admin", icon: ShieldCheck }] as const;

const titles: Record<string, string> = {
  "/": "Home pública",
  "/portal": "Minha área",
  "/decks": "Decks públicos",
  "/sets": "Coleções",
  "/stats": "Estatísticas",
  "/cards": "Catálogo de cartas",
  "/rules": "Base de regras e rulings",
  "/tournaments": "Campeonatos",
  "/deckbuilder": "Criar deck",
  "/profile": "Perfil do usuário",
  "/admin": "Centro administrativo",
};

export function PortalShell({ children, breadcrumbs }: { children: ReactNode; breadcrumbs?: Crumb[] }) {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();

  const currentTitle = location.startsWith("/u/")
    ? "Perfil público"
    : location.startsWith("/deck/")
      ? "Deck compartilhado"
      : location.startsWith("/cards/")
        ? "Detalhe da carta"
        : location.startsWith("/rules/")
          ? "Detalhe da ruling"
          : location.startsWith("/sets/")
            ? "Coleção"
            : titles[location] ?? "Portal";

  const trail = breadcrumbs?.length ? breadcrumbs : [{ label: currentTitle }];

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-white/10 bg-slate-950/70 px-4 py-6 backdrop-blur-xl sm:px-6 lg:sticky lg:top-0 lg:h-screen lg:px-5">
          <div className="flex items-center gap-3">
            <img src={logoWhite} alt="Gundam Card Game" className="h-10 w-auto opacity-90" />
            <div>
              <p className="font-heading text-lg uppercase tracking-[0.18em]">Portal BR</p>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Ecossistema público + pessoal</p>
            </div>
          </div>

          <Badge className="mt-5 rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">
            Arquitetura vNext
          </Badge>

          <div className="mt-8 space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Acesso público</p>
            {publicNav.map((item) => {
              const Icon = item.icon;
              const active = location === item.href || (item.href !== "/" && location.startsWith(`${item.href}/`));
              return (
                <Link key={item.href} href={item.href} className={cn("panel-cut flex items-center gap-3 border px-4 py-3 text-sm uppercase tracking-[0.18em] transition", active ? "border-primary/40 bg-primary/12 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white")}>
                  <Icon className={cn("size-4", active ? "text-primary" : "text-slate-400")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {isAuthenticated ? (
            <div className="mt-8 space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Área do usuário</p>
              {userNav.map((item) => {
                const Icon = item.icon;
                const active = location === item.href;
                return (
                  <Link key={item.href} href={item.href} className={cn("panel-cut flex items-center gap-3 border px-4 py-3 text-sm uppercase tracking-[0.18em] transition", active ? "border-primary/40 bg-primary/12 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white")}>
                    <Icon className={cn("size-4", active ? "text-primary" : "text-slate-400")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}

          {user?.role === "ADMIN" ? (
            <div className="mt-8 space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Gestão</p>
              {adminNav.map((item) => {
                const Icon = item.icon;
                const active = location === item.href;
                return (
                  <Link key={item.href} href={item.href} className={cn("panel-cut flex items-center gap-3 border px-4 py-3 text-sm uppercase tracking-[0.18em] transition", active ? "border-primary/40 bg-primary/12 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white")}>
                    <Icon className={cn("size-4", active ? "text-primary" : "text-slate-400")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}

          <Separator className="my-6 bg-white/10" />

          <div className="panel-cut border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <Boxes className="size-5 text-accent" />
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Resumo do modo atual</p>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <li>• descoberta pública sem login</li>
              <li>• recursos pessoais só para usuários autenticados</li>
              <li>• gestão isolada para admins</li>
              <li>• detalhes e coleções navegáveis</li>
            </ul>
          </div>
        </aside>

        <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="mb-8 space-y-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {trail.map((crumb, index) => (
                  <div key={`${crumb.label}-${index}`} className="contents">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {crumb.href && index < trail.length - 1 ? (
                        <BreadcrumbLink asChild>
                          <Link href={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      ) : index < trail.length - 1 && crumb.href ? (
                        <BreadcrumbLink asChild>
                          <Link href={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      ) : index < trail.length - 1 ? (
                        <BreadcrumbLink>{crumb.label}</BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
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
