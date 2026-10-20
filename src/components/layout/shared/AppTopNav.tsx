/* Layout shared v8.3 — topo público adaptativo e responsivo A2: sem estouro em 1366px, menu "Mais" dinâmico, dropdown acessível e drawer mobile. */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, CircleHelp, HeartHandshake, LogIn, LogOut, Menu, Moon, PanelsTopLeft, ShieldCheck, Sun, Swords, Trophy, X } from "lucide-react";
import { toast } from "sonner";

import anaheimLogo from "@/assets/anaheim-logo-transparent.webp";
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
import { GlobalSearch } from "@/components/layout/shared/GlobalSearch";
import { LanguageSwitcher } from "@/components/layout/shared/LanguageSwitcher";
import { useSiteLanguage } from "@/i18n/siteLanguage";

export type NavItem = {
  href: string;
  label: string;
  /** rótulo com o site em inglês */
  labelEn: string;
  authRequired?: boolean;
  children?: readonly { href: string; label: string; labelEn: string }[];
};

/** Rótulo do item no idioma do site. */
export function navLabel(item: { label: string; labelEn: string }, isEn: boolean) {
  return isEn ? item.labelEn : item.label;
}

export const publicTopNav: readonly NavItem[] = [
  { href: "/", label: "Início", labelEn: "Home" },
  { href: "/decks", label: "Decks", labelEn: "Decks" },
  {
    href: "/database",
    label: "Catálogo",
    labelEn: "Catalog",
    children: [
      { href: "/database", label: "Cartas", labelEn: "Cards" },
      { href: "/sets", label: "Produtos", labelEn: "Products" },
    ],
  },
  { href: "/torneios", label: "Torneios", labelEn: "Tournaments" },
  { href: "/stats", label: "Estatísticas", labelEn: "Stats" },
  // { href: "/series", label: "Universo" },
  // { href: "/articles", label: "Artigos" },
  { href: "/rules", label: "Regras", labelEn: "Rules" },
  { href: "/simulador", label: "Simulador", labelEn: "Simulator", authRequired: true },
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
  const { isEn, tr } = useSiteLanguage();
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
            aria-label={`${navLabel(item, isEn)} ${tr("(menu suspenso)", "(dropdown menu)")}`}
          >
            <span>{navLabel(item, isEn)}</span>
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
                  {navLabel(child, isEn)}
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
  const { tr } = useSiteLanguage();

  const isMoreActive = useMemo(() => {
    return (
      isActiveRoute(currentPath, "/torneios") ||
      // isActiveRoute(currentPath, "/series") ||
      // isActiveRoute(currentPath, "/articles") ||
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
            aria-label={tr("Mais seções do site (menu suspenso)", "More site sections (dropdown menu)")}
          >
            <span>{tr("Mais", "More")}</span>
            <ChevronDown className={cn("size-3 transition-transform duration-200", open ? "rotate-180" : "")} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="min-w-[190px] rounded-none border border-white/10 bg-slate-950/98 py-1.5 shadow-2xl backdrop-blur-xl text-white light:border-slate-300/80 light:bg-white light:text-slate-900 z-50"
        >
          {/* Torneios aparece no Mais em lg (< 1280px); em xl+ (>= 1280px) já fica na barra */}
          <DropdownMenuItem asChild className="rounded-none cursor-pointer p-0 xl:hidden focus:bg-white/10 focus:text-primary">
            <Link
              href="/torneios"
              onClick={() => setOpen(false)}
              className={cn(
                "flex w-full items-center px-4 py-2.5 text-xs uppercase tracking-[0.14em] transition-colors",
                isActiveRoute(currentPath, "/torneios")
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-slate-300 hover:text-white light:text-slate-700 light:hover:text-slate-950",
              )}
            >
              {tr("Torneios & Eventos", "Tournaments & Events")}
            </Link>
          </DropdownMenuItem>

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
              {tr("Estatísticas", "Stats")}
            </Link>
          </DropdownMenuItem>

          {/* Universo e Artigos comentados / escondidos temporariamente
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
          */}

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
              {tr("Regras", "Rules")}
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
              {tr("Novidades & Atualizações", "News & Updates")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AppTopNav() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isEn, tr } = useSiteLanguage();
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
      toast.info(tr("Acesse sua conta para entrar no Simulador.", "Sign in to use the Simulator."));
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
            aria-label={tr("Anaheim Hub - Página Inicial", "Anaheim Hub - Home")}
          >
            <img loading="lazy" decoding="async"
              src={anaheimLogo}
              alt="Anaheim Hub - Gundam Card Game"
              className="h-10 sm:h-11 xl:h-12 w-auto object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.25)]"
            />
            <div className="hidden min-w-0 border-l border-white/15 pl-3 3xl:block">
              <p className="font-heading text-lg xl:text-xl uppercase tracking-[0.16em] xl:tracking-[0.2em] text-white">Anaheim Hub</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-0.5 xl:gap-1 lg:flex" aria-label={tr("Navegação principal", "Main navigation")}>
            {/* 1. Home */}
            <Link
              href="/"
              className={cn(
                "inline-flex items-center px-2.5 xl:px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] xl:tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              {tr("Início", "Home")}
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

            {/* 4. Torneios — visível a partir de xl (1280px, incluindo 1366px); em lg fica no Mais */}
            <Link
              href="/torneios"
              className={cn(
                "hidden xl:inline-flex items-center px-2.5 xl:px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] xl:tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/torneios") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              {tr("Torneios", "Tournaments")}
            </Link>

            {/* 5. Estatísticas — visível a partir de xl (1280px, incluindo 1366px); em lg fica no Mais */}
            <Link
              href="/stats"
              className={cn(
                "hidden xl:inline-flex items-center px-2.5 xl:px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] xl:tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/stats") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              {tr("Estatísticas", "Stats")}
            </Link>

            {/* 5. Universo — visível a partir de 2xl (1536px); em telas menores fica no Mais (ocultado temporariamente)
            <Link
              href="/series"
              className={cn(
                "hidden 2xl:inline-flex items-center px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/series") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              Universo
            </Link>
            */}

            {/* 6. Artigos — visível a partir de 2xl (1536px); em telas menores fica no Mais (ocultado temporariamente)
            <Link
              href="/articles"
              className={cn(
                "hidden 2xl:inline-flex items-center px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/articles") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              Artigos
            </Link>
            */}

            {/* 7. Regras — visível a partir de 2xl (1536px); em telas menores fica no Mais */}
            <Link
              href="/rules"
              className={cn(
                "hidden 2xl:inline-flex items-center px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] nav-hover-soft transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActiveRoute(currentPath, "/rules") ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
              )}
            >
              {tr("Regras", "Rules")}
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
              <span>{tr("Simulador", "Simulator")}</span>
              <span className="rounded-xs border border-primary/40 bg-primary/20 px-1 py-0.5 text-[9px] font-bold tracking-wider text-primary">
                BETA
              </span>
            </Link>

            {/* 9. Menu "Mais" — agrupa itens secundários em telas compactas e notebook 1366px */}
            <MoreDropdown currentPath={currentPath} />
          </nav>
        </div>

        {/* Bloco Direito Desktop: Busca, Apoiar, Novidades (só 2xl; abaixo disso fica no Mais), Tema e Autenticação */}
        <div className="hidden items-center gap-1.5 sm:gap-2 md:flex">
          <GlobalSearch shortcut className="rounded-none" />
          <Button
            type="button"
            size="icon"
            className="rounded-none border border-primary/50 bg-primary/15 text-primary hover:bg-primary/25 2xl:size-auto 2xl:px-3.5 2xl:py-2"
            onClick={() => setSupportOpen(true)}
            title={tr("Apoiar o Anaheim Hub via Pix", "Support Anaheim Hub (Pix)")}
            aria-label={tr("Apoiar o Anaheim Hub via Pix", "Support Anaheim Hub (Pix)")}
          >
            <HeartHandshake className="size-4 2xl:mr-1.5 2xl:size-3.5" />
            <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] 2xl:inline">{tr("Apoiar", "Support")}</span>
          </Button>

          <Button
            asChild
            variant="outline"
            size="icon"
            className="hidden 2xl:inline-flex rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-primary light:border-slate-400/90 light:bg-white light:text-slate-950"
            title={tr("Novidades e Atualizações do Portal", "Site news & updates")}
            aria-label={tr("Novidades e Atualizações do Portal", "Site news & updates")}
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
            title={theme === "dark" ? tr("Modo Claro", "Light mode") : tr("Modo Escuro", "Dark mode")}
            aria-label={theme === "dark" ? tr("Alternar para Modo Claro", "Switch to light mode") : tr("Alternar para Modo Escuro", "Switch to dark mode")}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          <LanguageSwitcher compact />

          {isAuthenticated ? (
            <>
              {user?.role === "ADMIN" && (
                <Button asChild variant="outline" size="sm" className="rounded-none border-amber-400/50 bg-amber-400/10 text-xs font-mono font-semibold uppercase tracking-[0.12em] text-amber-300 hover:bg-amber-400/20">
                  <Link href="/admin"><ShieldCheck className="mr-1.5 size-3.5 text-amber-400" />Admin</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.12em] xl:tracking-[0.14em] text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">
                <Link href={dashboardHref}><PanelsTopLeft className="mr-1.5 size-3.5" />{tr("Perfil", "Profile")}</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.12em] xl:tracking-[0.14em] text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={logout}>
                <LogOut className="mr-1.5 size-3.5" />{tr("Sair", "Sign out")}
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="rounded-none bg-primary px-3 xl:px-4 text-xs font-semibold uppercase tracking-[0.14em] xl:tracking-[0.16em] text-primary-foreground hover:bg-primary/90">
              <Link href="/login"><LogIn className="mr-1.5 size-3.5" />{tr("Entrar", "Sign in")}</Link>
            </Button>
          )}
        </div>

        {/* Mobile Header Actions (< 1024px) */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden">
          <GlobalSearch className="rounded-none md:hidden" />
          <Button
            asChild
            variant="outline"
            size="icon"
            className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-primary light:border-slate-400/90 light:bg-white light:text-slate-950"
            title={tr("Novidades", "News")}
            aria-label={tr("Novidades e Atualizações", "News & Updates")}
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
            title={theme === "dark" ? tr("Modo Claro", "Light mode") : tr("Modo Escuro", "Dark mode")}
            aria-label={theme === "dark" ? tr("Alternar para Modo Claro", "Switch to light mode") : tr("Alternar para Modo Escuro", "Switch to dark mode")}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <LanguageSwitcher compact className="md:hidden" />
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-white/20 bg-white/5 px-2.5 py-1 text-xs text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950 min-h-[36px]"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? tr("Fechar menu de navegação", "Close navigation menu") : tr("Abrir menu de navegação", "Open navigation menu")}
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
          aria-label={tr("Menu principal de navegação", "Main navigation menu")}
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
                      <span>{navLabel(item, isEn)}</span>
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
                            {navLabel(child, isEn)}
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
                    {item.href === "/torneios" ? <Trophy className="size-3.5 text-amber-400" /> : null}
                    {navLabel(item, isEn)}
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
              <span>{tr("Novidades & Atualizações", "News & Updates")}</span>
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
              <span>{tr("Apoiar o Anaheim Hub", "Support Anaheim Hub")}</span>
            </button>

            {/* Seção de Autenticação / Perfil no Mobile */}
            <div className="mt-2 pt-2 border-t border-white/10">
              {isAuthenticated ? (
                <div className={cn("grid gap-2", user?.role === "ADMIN" ? "grid-cols-3" : "grid-cols-2")}>
                  {user?.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      className="flex min-h-[44px] items-center justify-center gap-1.5 border border-amber-400/50 bg-amber-400/10 px-3 py-3 text-center text-xs font-mono font-semibold uppercase tracking-[0.14em] text-amber-300 transition-colors hover:bg-amber-400/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                      onClick={() => setMobileOpen(false)}
                    >
                      <ShieldCheck className="size-3.5 text-amber-400" />
                      Admin
                    </Link>
                  )}
                  <Link
                    href={dashboardHref}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 border border-white/15 bg-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition-colors hover:border-white/30 light:border-slate-300 light:bg-white light:text-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    onClick={() => setMobileOpen(false)}
                  >
                    <PanelsTopLeft className="size-3.5" />
                    {tr("Perfil", "Profile")}
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
                    {tr("Sair", "Sign out")}
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="flex w-full min-h-[44px] items-center justify-center gap-2 border border-primary bg-primary px-4 py-3.5 text-center text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  <LogIn className="size-4" />
                  {tr("Entrar", "Sign in")}
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
