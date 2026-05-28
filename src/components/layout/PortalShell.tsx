/* Portal shell v8 — topo global compartilhado e sidebar apenas para navegação privada/admin. */
import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookMarked, Heart, Home, LibraryBig, Settings, ShieldCheck, Swords, UserCircle2, Users } from "lucide-react";

import { AppTopNav } from "@/components/layout/AppTopNav";
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

const userNav = [
  { href: "/portal", label: "Minha Área", icon: Home },
  { href: "/deckbuilder", label: "Decks", icon: Swords },
  { href: "/profile", label: "Configurações", icon: Settings },
  { href: "/wishlist", label: "Lista de Desejos", icon: Heart },
  { href: "/owned", label: "Cartas Possuídas", icon: BookMarked },
] as const;

const adminNav = [
  { href: "/admin", label: "Admin", icon: ShieldCheck },
  { href: "/admin?tab=cards", label: "Cartas", icon: LibraryBig },
  { href: "/admin?tab=users", label: "Usuários", icon: Users },
  { href: "/admin?tab=sets", label: "Coleções", icon: BookMarked },
] as const;

const titles: Record<string, string> = {
  "/portal": "Minha área",
  "/deckbuilder": "Decks",
  "/profile": "Configurações",
  "/wishlist": "Lista de desejos",
  "/owned": "Cartas possuídas",
  "/admin": "Centro administrativo",
};

export function PortalShell({ children, breadcrumbs }: { children: ReactNode; breadcrumbs?: Crumb[] }) {
  const [location] = useLocation();
  const { user } = useAuth();

  const currentPath = location.split("?")[0];
  const currentTitle = titles[currentPath] ?? "Portal";
  const trail = breadcrumbs?.length ? breadcrumbs : [{ label: currentTitle }];

  return (
    <div className="min-h-screen text-white dark:text-white light:text-slate-900">
      <AppTopNav />
      <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-white/10 bg-slate-950/70 px-4 py-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 light:border-slate-300/70 light:bg-white/85 sm:px-6 lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:px-5">
          <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">Área privada</Badge>

          <div className="mt-8 space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Painel do usuário</p>
            {userNav.map((item) => {
              const Icon = item.icon;
              const active = location === item.href || currentPath === item.href;
              return (
                <Link key={item.href} href={item.href} className={cn("panel-cut flex items-center gap-3 border px-4 py-3 text-sm uppercase tracking-[0.18em] transition", active ? "border-primary/40 bg-primary/12 text-white dark:text-white light:text-slate-900" : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white dark:border-white/10 dark:bg-white/5 dark:text-slate-300 light:border-slate-300/70 light:bg-white light:text-slate-700 light:hover:bg-slate-100") }>
                  <Icon className={cn("size-4", active ? "text-primary" : "text-slate-400")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {user?.role === "ADMIN" ? (
            <>
              <Separator className="my-6 bg-white/10 dark:bg-white/10 light:bg-slate-300/70" />
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Gestão</p>
                {adminNav.map((item) => {
                  const Icon = item.icon;
                  const active = location === item.href || (item.href.startsWith("/admin") && currentPath === "/admin" && location.includes(item.href.split("?")[1] || ""));
                  return (
                    <Link key={item.href} href={item.href} className={cn("panel-cut flex items-center gap-3 border px-4 py-3 text-sm uppercase tracking-[0.18em] transition", active ? "border-primary/40 bg-primary/12 text-white dark:text-white light:text-slate-900" : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white dark:border-white/10 dark:bg-white/5 dark:text-slate-300 light:border-slate-300/70 light:bg-white light:text-slate-700 light:hover:bg-slate-100") }>
                      <Icon className={cn("size-4", active ? "text-primary" : "text-slate-400")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </>
          ) : null}
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
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="panel-cut border border-white/10 bg-slate-950/55 px-5 py-5 dark:border-white/10 dark:bg-slate-950/55 light:border-slate-300/70 light:bg-white/90">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Núcleo operacional</p>
              <h1 className="mt-2 font-heading text-5xl uppercase leading-none">{currentTitle}</h1>
            </div>
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}
