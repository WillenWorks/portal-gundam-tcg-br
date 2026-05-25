/* Shell pública — mantém a mesma base visual da home para páginas públicas, sem sidebar de portal antigo. */
import { type ReactNode } from "react";
import { Link } from "wouter";

import logoWhite from "@/assets/gundam-logo-white.png";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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

type Crumb = { label: string; href?: string };

const publicNav = [
  { href: "/decks", label: "Decks Públicos" },
  { href: "/sets", label: "Coleções" },
  { href: "/stats", label: "Estatísticas" },
  { href: "/tournaments", label: "Campeonatos" },
  { href: "/cards", label: "Cartas" },
  { href: "/rules", label: "Regras" },
] as const;

export function PublicShell({ children, breadcrumbs, title, description }: { children: ReactNode; breadcrumbs?: Crumb[]; title?: string; description?: string }) {
  const { isAuthenticated, user } = useAuth();
  const trail = breadcrumbs?.length ? breadcrumbs : [{ label: title || "Página pública" }];

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white">
      <div className="pointer-events-none absolute inset-0 bg-grid-tech opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-15" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/topo" className="flex items-center gap-3 text-white">
            <img src={logoWhite} alt="Gundam Card Game" className="h-9 w-auto opacity-90" />
            <div className="hidden border-l border-white/15 pl-3 md:block">
              <p className="font-heading text-lg uppercase tracking-[0.18em]">Portal BR</p>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Ecossistema público</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex">
            {publicNav.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm uppercase tracking-[0.18em] text-slate-300 transition hover:text-primary">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {user?.role === "ADMIN" ? (
                  <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                    <Link href="/admin">Admin</Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/portal">Minha área</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/portal">Entrar</Link>
                </Button>
                <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/cadastro">Criar conta</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="topo" className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="space-y-6">
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
                    ) : index === trail.length - 1 ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink>{crumb.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          {(title || description) ? (
            <div className="panel-cut border border-white/10 bg-slate-950/55 px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Núcleo público</p>
                  {title ? <h1 className="mt-2 font-heading text-5xl uppercase leading-none text-white">{title}</h1> : null}
                  {description ? <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{description}</p> : null}
                </div>
                <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">
                  Base pública unificada
                </Badge>
              </div>
            </div>
          ) : null}

          {children}
        </div>
      </main>

      <footer className="border-t border-white/10 bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="font-heading text-xl uppercase tracking-[0.16em] text-white">Portal Gundam TCG BR</p>
            <p className="mt-2 max-w-2xl leading-7">Base pública contínua para descoberta, estudo e navegação. Área pessoal e admin ficam isoladas em dashboards próprios.</p>
          </div>
          <div className="min-w-[280px]">
            <Separator className="mb-4 bg-white/10 lg:hidden" />
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Estrutura atual</p>
            <p className="mt-2 text-white">Home pública unificada · Dashboard do usuário · Dashboard admin</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
