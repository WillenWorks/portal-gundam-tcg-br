/* Layout privado v8.1 — painel em tela cheia, topo privado sem links públicos e sidebar responsiva. */
import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { BookMarked, ChevronLeft, ChevronRight, Globe, Home, LogOut, Menu, Moon, Settings, ShieldCheck, Sun, Trophy } from "lucide-react";

import anaheimLogo from "@/assets/anaheim-logo-transparent.png";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { AppFooter } from "@/components/layout/shared/AppFooter";
import { SiteAnnouncementBanner } from "@/components/layout/shared/SiteAnnouncementBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  { href: "/", label: "Página Inicial", icon: Globe },
  { href: "/portal", label: "Painel", icon: Home },
  { href: "/binders", label: "Pastas", icon: BookMarked },
  { href: "/profile", label: "Configurações", icon: Settings },
] as const;

const hosterNav = [
  { href: "/organizador", label: "Meus eventos", icon: Trophy },
] as const;

const titles: Record<string, string> = {
  "/portal": "Minha área",
  "/deckbuilder": "Deckbuilder",
  "/profile": "Configurações",
  "/binders": "Pastas",
  "/organizador": "Meus eventos",
  "/simulador": "Simulador",
  "/simulador/treino": "Treino contra o bot",
};

function SidebarLinks({ location, isAdmin, isHoster, onNavigate, collapsed = false }: { location: string; isAdmin: boolean; isHoster: boolean; onNavigate?: () => void; collapsed?: boolean }) {
  const currentPath = location.split("?")[0];
  const navGroups: Array<{ title: string; items: ReadonlyArray<{ href: string; label: string; icon: ComponentType<{ className?: string }> }> }> = [
    { title: "Painel do usuário", items: userNav },
  ];
  if (isHoster || isAdmin) navGroups.push({ title: "Organizador", items: hosterNav });

  return (
    <div className="space-y-6">
      {navGroups.map((group) => (
        <div key={group.title} className="space-y-2">
          {!collapsed ? <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{group.title}</p> : null}
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = location === item.href || currentPath === item.href || (item.href.includes("?") && location.includes(item.href.split("?")[1] || ""));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "panel-cut flex items-center gap-3 border px-4 py-3 text-sm uppercase tracking-[0.18em] transition",
                  collapsed ? "justify-center px-0" : "",
                  active
                    ? "border-primary/40 bg-primary/12 text-white dark:text-white light:text-slate-900"
                    : "border-white/10 bg-white/5 text-slate-300 nav-hover-soft hover:border-white/20 hover:text-white dark:border-white/10 dark:bg-white/5 dark:text-slate-300 light:border-slate-300/70 light:bg-white/80 light:text-slate-800 light:hover:text-slate-950",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-slate-400")} />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}

      {/* Acesso separado para Administrador — sem misturar menus no portal de jogador */}
      {isAdmin ? (
        <div className="pt-2">
          {!collapsed ? (
            <div className="panel-cut border border-amber-500/30 bg-amber-500/[0.06] p-3 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Credencial Root</span>
                <Badge variant="outline" className="rounded-none border-amber-500/40 text-[9px] text-amber-300">ADMIN</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">Console isolado de governança e catálogo</p>
              <Link
                href="/admin"
                onClick={onNavigate}
                className="mt-2.5 flex items-center justify-center gap-2 border border-amber-400/40 bg-amber-400/10 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300 transition hover:bg-amber-400/20"
              >
                <ShieldCheck className="size-3.5 text-amber-400" />
                Abrir Console Admin
              </Link>
            </div>
          ) : (
            <Link
              href="/admin"
              onClick={onNavigate}
              title="Abrir Console de Administração"
              className="panel-cut flex items-center justify-center border border-amber-400/40 bg-amber-400/10 py-2.5 text-amber-300 transition hover:bg-amber-400/20"
            >
              <ShieldCheck className="size-4" />
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PortalShell({ children, breadcrumbs }: { children: ReactNode; breadcrumbs?: Crumb[] }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("portal-gundam-tcg-br:sidebar-collapsed") === "1";
  });

  useEffect(() => {
    window.localStorage.setItem("portal-gundam-tcg-br:sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const currentPath = useMemo(() => location.split("?")[0], [location]);
  const currentTitle = titles[currentPath] ?? "Portal";
  const trail = breadcrumbs?.length ? breadcrumbs : [{ label: currentTitle }];
  const isAdmin = user?.role === "ADMIN";
  const isHoster = Boolean(user?.isHoster);

  return (
    <div className="min-h-screen text-white dark:text-white light:text-slate-900">
      <SiteAnnouncementBanner />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[2400px] items-center justify-between gap-4 px-4 py-4 sm:px-6 xl:px-8 2xl:px-10 3xl:px-12">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950 lg:hidden" onClick={() => setMobileSidebarOpen(true)}>
              <Menu className="size-4" />
              <span className="ml-2">Painel</span>
            </Button>
            <Link href="/portal" className="flex min-w-0 items-center gap-3 text-white transition-opacity hover:opacity-95">
              <img loading="lazy" decoding="async" src={anaheimLogo} alt="Anaheim Hub - Gundam Card Game" className="h-11 sm:h-12 w-auto object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.25)]" />
              <div className="hidden min-w-0 border-l border-white/15 pl-3.5 md:block">
                <p className="font-heading text-xl uppercase tracking-[0.2em]">Anaheim Hub</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex rounded-none border-amber-500/40 bg-amber-500/10 text-xs font-mono uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 hover:text-amber-100">
                <Link href="/admin">
                  <ShieldCheck className="mr-1.5 size-3.5 text-amber-400" />
                  Console Admin
                </Link>
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button type="button" variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={logout}>
              <LogOut className="mr-2 size-4" />Sair
            </Button>
          </div>
        </div>
      </header>

      <div className={cn("grid min-h-[calc(100vh-73px)] w-full transition-[grid-template-columns] duration-200", collapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]")}>
        <aside className={cn("hidden border-r border-white/10 bg-slate-950/82 py-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/82 light:border-slate-300/70 light:bg-white/82 lg:flex lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:flex-col lg:overflow-y-auto", collapsed ? "px-2" : "px-5")}>
          {!collapsed ? <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">Área privada</Badge> : null}
          <div className={cn("flex-1", collapsed ? "mt-2" : "mt-8")}>
            <SidebarLinks location={location} isAdmin={isAdmin} isHoster={isHoster} collapsed={collapsed} />
          </div>
          <Button type="button" variant="outline" className={cn("mt-4 hidden w-full rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950 lg:inline-flex", collapsed ? "justify-center px-0" : "justify-start")} onClick={() => setCollapsed((current) => !current)} title={collapsed ? "Expandir painel" : "Recolher painel"}>
            {collapsed ? <ChevronRight className="size-4" /> : <><ChevronLeft className="mr-2 size-4" />Recolher</>}
          </Button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="min-w-0 max-w-[2400px] flex-1 px-4 py-6 sm:px-6 xl:px-8 2xl:px-10 3xl:px-12 lg:py-8">
          <header className="mb-8 space-y-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/">Início</Link>
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

            <div className="panel-cut border border-white/10 bg-slate-950/70 px-5 py-5 dark:border-white/10 dark:bg-slate-950/70 light:border-slate-300/80 light:bg-white/88 light:shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Terminal do Piloto</p>
              <h1 className="mt-2 font-heading text-5xl uppercase leading-none dark:text-white light:text-slate-900">{currentTitle}</h1>
            </div>
          </header>

          {children}
        </div>

        <AppFooter />
      </div>
    </div>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-[360px] border-white/10 bg-slate-950 text-white">
          <SheetHeader className="border-b border-white/10 pb-4">
            <SheetTitle className="font-heading text-2xl uppercase tracking-[0.16em] text-white">Painel</SheetTitle>
            <SheetDescription className="text-slate-400">Navegação privada sobreposta para mobile.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">Área privada</Badge>
            <div className="mt-6">
              <SidebarLinks location={location} isAdmin={isAdmin} isHoster={isHoster} onNavigate={() => setMobileSidebarOpen(false)} />
            </div>
            <Separator className="my-6 bg-white/10" />
            <div className="grid gap-2">
              <button type="button" className="panel-cut border border-white/10 bg-white/5 px-4 py-3 text-left text-sm uppercase tracking-[0.18em] text-slate-200" onClick={() => { setMobileSidebarOpen(false); logout(); }}>
                Sair
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
