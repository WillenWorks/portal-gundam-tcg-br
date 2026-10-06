/* Layout shared v8.3 — topo público adaptativo e responsivo A2: sem estouro em 1366px, menu "Mais" dinâmico, dropdown acessível e drawer mobile. */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, CircleHelp, HeartHandshake, LogIn, LogOut, Menu, Moon, PanelsTopLeft, Sun, Swords, X } from "lucide-react";
import { toast } from "sonner";

import anaheimLogo from "@/assets/anaheim-logo-transparent.png";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { CommunitySupportModal } from "@/components/support/CommunitySupportModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  authRequired?: boolean;
  children?: readonly { href: string; label: string }[];
};

export const publicTopNav: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/decks", label: "Decks" },
  {
    href: "/database",
    label: "Database",
    children: [
      { href: "/database", label: "Cartas" },
      { href: "/sets", label: "Produtos" },
    ],
  },
  { href: "/series", label: "Universo" },
  { href: "/articles", label: "Artigos" },
  { href: "/stats", label: "Estatísticas" },
  { href: "/simulador", label: "Simulador", authRequired: true },
  { href: "/rules", label: "Regras" },
] as const;

function isActiveRoute(currentPath: string, href: string) {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function NavDropdown({
  item,
  active,
  currentPath,
}: {
  item: NavItem;
  active: boolean;
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);
  const children = item.children;
  if (!children) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 px-2.5 xl:px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] xl:tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
              active ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
            )}
            aria-label={`${item.label} (menu suspenso)`}
          >
            <span>{item.label}</span>
            <ChevronDown className={cn("size-3 transition-transform duration-200", open ? "rotate-180" : "")} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="min-w-[190px] rounded-none border border-white/10 bg-slate-950/98 py-1.5 shadow-2xl backdrop-blur-xl text-white light:border-slate-300/80 light:bg-white light:text-slate-900 z-50"
        >
          {children.map((child) => {
            const childActive = isActiveRoute(currentPath, child.href);
            return (
              <DropdownMenuItem
                key={child.href}
                asChild
                className="rounded-none cursor-pointer p-0 focus:bg-white/10 focus:text-primary"
              >
                <Link
                  href={child.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex w-full items-center px-4 py-2.5 text-xs uppercase tracking-[0.14em] transition-colors",
                    childActive
                      ? "text-primary font-semibold bg-primary/10"
                      : "text-slate-300 hover:text-white light:text-slate-700 light:hover:text-slate-950",
                  )}
                >
                  {child.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MoreDropdown({
  currentPath,
}: {
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);

  const isMoreActive = useMemo(() => {
    return (
      isActiveRoute(currentPath, "/series") ||
      isActiveRoute(currentPath, "/articles") ||
      isActiveRoute(currentPath, "/rules") ||
      isActiveRoute(currentPath, "/stats") ||
      isActiveRoute(currentPath, "/novidades")
    );
  }, [currentPath]);

  return (
    <div
      className="relative 2xl:hidden"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 px-2.5 xl:px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] xl:tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
              isMoreActive ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
            )}
            aria-label="Mais seções do site (menu suspenso)"
          >
            <span>Mais</span>
            <ChevronDown className={cn("size-3 transition-transform duration-200", open ? "rotate-180" : "")} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="min-w-[190px] rounded-none border border-white/10 bg-slate-950/98 py-1.5 shadow-2xl backdrop-blur-xl text-white light:border-slate-300/80 light:bg-white light:text-slate-900 z-50"
        >
          {/* Estatísticas aparece no Mais em lg (< 1280px); em xl+ (>= 1280px) já fica na barra */}
          <DropdownMenuItem asChild className="rounded-none cursor-pointer p-0 xl:hidden focus:bg-white/10 focus:text-primary">
            <Link
              href="/stats"
              onClick={() => setOpen(false)}
              className={cn(
                "flex w-full items-center px-4 py-2.5 text-xs uppercase tracking-[0.14em] transition-colors",
                isActiveRoute(currentPath, "/stats")
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-slate-300 hover:text-white light:text-slate-700 light:hover:text-slate-950",
              )}
            >
              Estatísticas
            </Link>
          </DropdownMenuItem>

          {/* Universo, Artigos, Regras aparecem no Mais até 2xl (< 1536px); em 2xl+ já ficam na barra */}
          <DropdownMenuItem asChild className="rounded-none cursor-pointer p-0 focus:bg-white/10 focus:text-primary">
            <Link
              href="/series"
              onClick={() => setOpen(false)}
              className={cn(
                "flex w-full items-center px-4 py-2.5 text-xs uppercase tracking-[0.14em] transition-colors",
                isActiveRoute(currentPath, "/series")
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-slate-300 hover:text-white light:text-slate-700 light:hover:text-slate-950",
              )}
            >
              Universo
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="rounded-none cursor-pointer p-0 focus:bg-white/10 focus:text-primary">
            <Link
              href="/articles"
              onClick={() => setOpen(false)}
              className={cn(
                "flex w-full items-center px-4 py-2.5 text-xs uppercase tracking-[0.14em] transition-colors",
                isActiveRoute(currentPath, "/articles")
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-slate-300 hover:text-white light:text-slate-700 light:hover:text-slate-950",
              )}
            >
              Artigos
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="rounded-none cursor-pointer p-0 focus:bg-white/10 focus:text-primary">
            <Link
              href="/rules"
              onClick={() => setOpen(false)}
              className={cn(
                "flex w-full items-center px-4 py-2.5 text-xs uppercase tracking-[0.14em] transition-colors",
                isActiveRoute(currentPath, "/rules")
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-slate-300 hover:text-white light:text-slate-700 light:hover:text-slate-950",
              )}
            >
              Regras
            </Link>
          </DropdownMenuItem>

          {/* Novidades aparece no Mais em telas menores que xl */}
          <DropdownMenuItem asChild className="rounded-none cursor-pointer p-0 xl:hidden focus:bg-white/10 focus:text-primary border-t border-white/10 light:border-slate-200">
            <Link
              href="/novidades"
              onClick={() => setOpen(false)}
              className={cn(
                "flex w-full items-center px-4 py-2.5 text-xs uppercase tracking-[0.14em] transition-colors",
                isActiveRoute(currentPath, "/novidades")
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-slate-300 hover:text-white light:text-slate-700 light:hover:text-slate-950",
              )}
            >
              Novidades & Atualizações
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AppTopNav() {
  const { isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileDatabaseOpen, setMobileDatabaseOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const currentPath = useMemo(() => location.split("?")[0], [location]);
  const dashboardHref = "/profile";

  // Fecha o drawer mobile ao mudar de rota ou ao teclar Escape
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const handleNavClick = (e: React.MouseEvent, item: NavItem) => {
    if (item.authRequired && !isAuthenticated) {
      e.preventDefault();
      toast.info("Acesse sua conta para entrar no Simulador.");
      navigate("/login?redirect=" + encodeURIComponent(item.href));
      setMobileOpen(false);
      return;
    }
    setMobileOpen(false);
  };

  const databaseItem = publicTopNav.find((i) => i.href === "/database")!;
  const simuladorItem = publicTopNav.find((i) => i.href === "/simulador")!;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/92 text-white backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[2400px] items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 xl:px-8 2xl:px-10 3xl:px-12 py-2">
        {/* Bloco Esquerdo: Logo Anaheim Hub + Navegação Desktop Adaptativa */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4 lg:gap-5 xl:gap-6 2xl:gap-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 sm:gap-3 text-white transition-opacity hover:opacity-95"
            aria-label="Anaheim Hub - Página Inicial"
          >
            <img
              src={anaheimLogo}
              alt="Anaheim Hub - Gundam Card Game"
              className="h-10 sm:h-11 xl:h-12 w-auto object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.25)]"
            />
            <div className="hidden min-w-0 border-l border-white/15 pl-3 xl:block">
              <p className="font-heading text-lg xl:text-xl uppercase tracking-[0.16em] xl:tracking-[0.2em] text-white">Anaheim Hub</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-0.5 xl:gap-1 lg:flex" aria-label="Navegação principal">
            {/* 1. Home */}
            <Link
              href="/"
              className={cn(
                "inline-flex items-center px-2.5 xl:px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] xl:tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              Home
            </Link>

            {/* 2. Decks */}
            <Link
              href="/decks"
              className={cn(
                "inline-flex items-center px-2.5 xl:px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] xl:tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/decks") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              Decks
            </Link>

            {/* 3. Database (Cartas / Produtos) */}
            <NavDropdown
              item={databaseItem}
              active={isActiveRoute(currentPath, "/database") || isActiveRoute(currentPath, "/sets")}
              currentPath={currentPath}
            />

            {/* 4. Estatísticas — visível a partir de xl (1280px, incluindo 1366px); em lg fica no Mais */}
            <Link
              href="/stats"
              className={cn(
                "hidden xl:inline-flex items-center px-2.5 xl:px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] xl:tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/stats") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              Estatísticas
            </Link>

            {/* 5. Universo — visível a partir de 2xl (1536px); em telas menores fica no Mais */}
            <Link
              href="/series"
              className={cn(
                "hidden 2xl:inline-flex items-center px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/series") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              Universo
            </Link>

            {/* 6. Artigos — visível a partir de 2xl (1536px); em telas menores fica no Mais */}
            <Link
              href="/articles"
              className={cn(
                "hidden 2xl:inline-flex items-center px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/articles") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              Artigos
            </Link>

            {/* 7. Regras — visível a partir de 2xl (1536px); em telas menores fica no Mais */}
            <Link
              href="/rules"
              className={cn(
                "hidden 2xl:inline-flex items-center px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/rules") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              Regras
            </Link>

            {/* 8. Simulador — destaque com selo BETA */}
            <Link
              href="/simulador"
              onClick={(e) => handleNavClick(e, simuladorItem)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] xl:tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/simulador") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              <span>Simulador</span>
              <span className="rounded-xs border border-primary/40 bg-primary/20 px-1 py-0.5 text-[9px] font-bold tracking-wider text-primary">
                BETA
              </span>
            </Link>

            {/* 9. Menu "Mais" — agrupa itens secundários em telas compactas e notebook 1366px */}
            <MoreDropdown currentPath={currentPath} />
          </nav>
        </div>

        {/* Bloco Direito Desktop: Apoiar, Novidades, Tema e Autenticação */}
        <div className="hidden items-center gap-1.5 sm:gap-2 md:flex">
          <Button
            type="button"
            size="icon"
            className="rounded-none border border-primary/50 bg-primary/15 text-primary hover:bg-primary/25 2xl:size-auto 2xl:px-3.5 2xl:py-2"
            onClick={() => setSupportOpen(true)}
            title="Apoiar o Anaheim Hub via Pix"
            aria-label="Apoiar o Anaheim Hub via Pix"
          >
            <HeartHandshake className="size-4 2xl:mr-1.5 2xl:size-3.5" />
            <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] 2xl:inline">Apoiar</span>
          </Button>

          <Button
            asChild
            variant="outline"
            size="icon"
            className="hidden xl:inline-flex rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-primary light:border-slate-400/90 light:bg-white light:text-slate-950"
            title="Novidades e Atualizações do Portal"
            aria-label="Novidades e Atualizações do Portal"
          >
            <Link href="/novidades">
              <CircleHelp className="size-4" />
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"
            onClick={toggleTheme}
            title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
            aria-label={theme === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {isAuthenticated ? (
            <>
              <Button asChild variant="outline" size="sm" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.12em] xl:tracking-[0.14em] text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">
                <Link href={dashboardHref}><PanelsTopLeft className="mr-1.5 size-3.5" />Perfil</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.12em] xl:tracking-[0.14em] text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={logout}>
                <LogOut className="mr-1.5 size-3.5" />Sair
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="rounded-none bg-primary px-3 xl:px-4 text-xs font-semibold uppercase tracking-[0.14em] xl:tracking-[0.16em] text-primary-foreground hover:bg-primary/90">
              <Link href="/login"><LogIn className="mr-1.5 size-3.5" />Entrar</Link>
            </Button>
          )}
        </div>

        {/* Mobile Header Actions (< 1024px) */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-primary light:border-slate-400/90 light:bg-white light:text-slate-950"
            title="Novidades"
            aria-label="Novidades e Atualizações"
          >
            <Link href="/novidades">
              <CircleHelp className="size-4" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"
            onClick={toggleTheme}
            title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
            aria-label={theme === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-white/20 bg-white/5 px-2.5 py-1 text-xs text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950 min-h-[36px]"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            <span className="ml-1.5 font-medium uppercase tracking-[0.1em]">Menu</span>
            <ChevronDown className={cn("size-3.5 transition-transform duration-200", mobileOpen ? "rotate-180" : "rotate-0")} />
          </Button>
        </div>
      </div>

      {/* Drawer Mobile: acessível, foco limpo, tecla Escape, scroll suave e alvos >= 44px */}
      {mobileOpen ? (
        <div
          role="dialog"
          aria-label="Menu principal de navegação"
          aria-modal="true"
          className="border-t border-white/10 bg-slate-950/98 shadow-2xl backdrop-blur-2xl lg:hidden max-h-[calc(100vh-65px)] overflow-y-auto"
        >
          <div className="mx-auto flex w-full max-w-[2400px] flex-col gap-2 p-4 sm:px-6">
            {publicTopNav.map((item) => {
              const active = isActiveRoute(currentPath, item.href);
              const hasChildren = Boolean(item.children && item.children.length > 0);

              if (hasChildren && item.children) {
                return (
                  <div key={item.href} className="w-full">
                    <button
                      type="button"
                      onClick={() => setMobileDatabaseOpen((prev) => !prev)}
                      aria-expanded={mobileDatabaseOpen}
                      className={cn(
                        "flex w-full min-h-[44px] items-center justify-between border px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                        active
                          ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                          : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 light:border-slate-300 light:bg-white light:text-slate-800",
                      )}
                    >
                      <span>{item.label}</span>
                      <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-200", mobileDatabaseOpen ? "rotate-180" : "")} />
                    </button>

                    {mobileDatabaseOpen ? (
                      <div className="mt-1.5 ml-3 flex flex-col gap-1.5 border-l-2 border-primary/30 pl-3">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex min-h-[44px] items-center px-3 py-2 text-xs uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                              isActiveRoute(currentPath, child.href) ? "text-primary font-semibold" : "text-slate-400 hover:text-white",
                            )}
                            onClick={() => setMobileOpen(false)}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item)}
                  className={cn(
                    "flex w-full min-h-[44px] items-center justify-between border px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                      : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 light:border-slate-300 light:bg-white light:text-slate-800",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {item.href === "/simulador" ? <Swords className="size-3.5 text-primary" /> : null}
                    {item.label}
                  </span>
                  {item.href === "/simulador" ? (
                    <span className="rounded-xs border border-primary/40 bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-primary">
                      BETA
                    </span>
                  ) : null}
                </Link>
              );
            })}

            {/* Link de Novidades */}
            <Link
              href="/novidades"
              className={cn(
                "flex w-full min-h-[44px] items-center gap-2.5 border px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/novidades")
                  ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                  : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 light:border-slate-300 light:bg-white light:text-slate-800",
              )}
              onClick={() => setMobileOpen(false)}
            >
              <CircleHelp className="size-3.5 text-primary" />
              <span>Novidades & Atualizações</span>
            </Link>

            {/* Apoiar (Pix) */}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setSupportOpen(true);
              }}
              className="flex w-full min-h-[44px] items-center gap-2.5 border border-primary/40 bg-primary/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <HeartHandshake className="size-3.5" />
              <span>Apoiar o Anaheim Hub</span>
            </button>

            {/* Seção de Autenticação / Perfil no Mobile */}
            <div className="mt-2 pt-2 border-t border-white/10">
              {isAuthenticated ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={dashboardHref}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 border border-white/15 bg-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition-colors hover:border-white/30 light:border-slate-300 light:bg-white light:text-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    onClick={() => setMobileOpen(false)}
                  >
                    <PanelsTopLeft className="size-3.5" />
                    Perfil
                  </Link>
                  <button
                    type="button"
                    className="flex min-h-[44px] items-center justify-center gap-1.5 border border-white/15 bg-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition-colors hover:border-red-500/50 hover:text-red-400 light:border-slate-300 light:bg-white light:text-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                  >
                    <LogOut className="size-3.5" />
                    Sair
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="flex w-full min-h-[44px] items-center justify-center gap-2 border border-primary bg-primary px-4 py-3.5 text-center text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  <LogIn className="size-4" />
                  Entrar
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <CommunitySupportModal open={supportOpen} onOpenChange={setSupportOpen} />
    </header>
  );
}
