/* Layout shared v8.2 — topo público consistente, alinhado à esquerda, com Simulador integrado e menu mobile intuitivo. */
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, CircleHelp, LogIn, LogOut, Menu, Moon, PanelsTopLeft, Sun, Swords, X } from "lucide-react";
import { toast } from "sonner";

import anaheimLogo from "@/assets/anaheim-logo-transparent.png";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
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
  { href: "/simulador", label: "Simulador", authRequired: true },
  { href: "/rules", label: "Regras" },
] as const;

function isActiveRoute(currentPath: string, href: string) {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function NavDropdown({ item, active, currentPath }: { item: NavItem; active: boolean; currentPath: string }) {
  const [open, setOpen] = useState(false);
  const children = item.children;
  if (!children) return null;
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] nav-hover-soft transition-colors",
          active ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
        )}
      >
        {item.label}
        <ChevronDown className={cn("size-3 transition-transform duration-200", open ? "rotate-180" : "")} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 min-w-[190px] border border-white/10 bg-slate-950/98 py-1.5 shadow-2xl backdrop-blur-xl light:border-slate-300/80 light:bg-white">
          {children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block px-4 py-2.5 text-xs uppercase tracking-[0.14em] nav-hover-soft transition-colors",
                isActiveRoute(currentPath, child.href) ? "text-primary font-semibold" : "text-slate-300 hover:text-white light:text-slate-700 light:hover:text-slate-950",
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AppTopNav() {
  const { isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileDatabaseOpen, setMobileDatabaseOpen] = useState(false);

  const currentPath = useMemo(() => location.split("?")[0], [location]);
  const dashboardHref = "/profile";

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

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/92 text-white backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1760px] items-center justify-between gap-4 px-4 py-2 sm:px-6 2xl:px-10">
        {/* Bloco Esquerdo: Logo Anaheim Hub + Navegação alinhada logo ao lado */}
        <div className="flex min-w-0 items-center gap-6 lg:gap-8 xl:gap-10">
          <Link href="/" className="flex shrink-0 items-center gap-3 text-white transition-opacity hover:opacity-95">
            <img
              src={anaheimLogo}
              alt="Anaheim Hub - Gundam Card Game"
              className="h-11 sm:h-12 w-auto object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.25)]"
            />
            <div className="hidden min-w-0 border-l border-white/15 pl-3.5 md:block">
              <p className="font-heading text-xl uppercase tracking-[0.2em] text-white">Anaheim Hub</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {publicTopNav.map((item) => {
              const active = isActiveRoute(currentPath, item.href);
              if (item.children) {
                return <NavDropdown key={item.href} item={item} active={active} currentPath={currentPath} />;
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] nav-hover-soft transition-colors",
                    active ? "text-primary font-semibold" : "text-slate-300 hover:text-white",
                  )}
                >
                  {item.label}
                  {item.href === "/simulador" && (
                    <span className="rounded-xs border border-primary/40 bg-primary/20 px-1 py-0.5 text-[9px] font-bold tracking-wider text-primary">
                      BETA
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bloco Direito: Botão ? de novidades, alternador de tema e autenticação */}
        <div className="hidden items-center gap-2 md:flex">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-primary light:border-slate-400/90 light:bg-white light:text-slate-950"
            title="Novidades e Atualizações do Portal"
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
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {isAuthenticated ? (
            <>
              <Button asChild variant="outline" size="sm" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.14em] text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">
                <Link href={dashboardHref}><PanelsTopLeft className="mr-1.5 size-3.5" />Perfil</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.14em] text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={logout}>
                <LogOut className="mr-1.5 size-3.5" />Sair
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="rounded-none bg-primary px-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground hover:bg-primary/90">
              <Link href="/login"><LogIn className="mr-1.5 size-3.5" />Entrar</Link>
            </Button>
          )}
        </div>

        {/* Mobile Header Actions */}
        <div className="flex items-center gap-2 lg:hidden">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-primary light:border-slate-400/90 light:bg-white light:text-slate-950"
            title="Novidades"
          >
            <Link href="/novidades">
              <CircleHelp className="size-4" />
            </Link>
          </Button>
          <Button type="button" variant="outline" size="icon" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-white/20 bg-white/5 px-2.5 py-1 text-xs text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            <span className="ml-1.5">Menu</span>
            <ChevronDown className={cn("size-3.5 transition-transform duration-200", mobileOpen ? "rotate-180" : "rotate-0")} />
          </Button>
        </div>
      </div>

      {/* Drawer Mobile redesenhado, elegante e 100% alinhado */}
      {mobileOpen ? (
        <div className="border-t border-white/10 bg-slate-950/98 shadow-2xl backdrop-blur-2xl lg:hidden">
          <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-2 p-4 sm:px-6">
            {publicTopNav.map((item) => {
              const active = isActiveRoute(currentPath, item.href);
              const hasChildren = Boolean(item.children && item.children.length > 0);

              if (hasChildren && item.children) {
                return (
                  <div key={item.href} className="w-full">
                    <button
                      type="button"
                      onClick={() => setMobileDatabaseOpen((prev) => !prev)}
                      className={cn(
                        "flex w-full items-center justify-between border px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors",
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
                              "flex items-center px-3 py-2 text-xs uppercase tracking-[0.14em] transition-colors",
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
                    "flex w-full items-center justify-between border px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors",
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
                "flex w-full items-center gap-2.5 border px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors",
                isActiveRoute(currentPath, "/novidades")
                  ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                  : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 light:border-slate-300 light:bg-white light:text-slate-800",
              )}
              onClick={() => setMobileOpen(false)}
            >
              <CircleHelp className="size-3.5 text-primary" />
              <span>Novidades & Atualizações</span>
            </Link>

            {/* Seção de Autenticação / Perfil no Mobile */}
            <div className="mt-2 pt-2 border-t border-white/10">
              {isAuthenticated ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={dashboardHref}
                    className="flex items-center justify-center gap-1.5 border border-white/15 bg-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition-colors hover:border-white/30 light:border-slate-300 light:bg-white light:text-slate-800"
                    onClick={() => setMobileOpen(false)}
                  >
                    <PanelsTopLeft className="size-3.5" />
                    Perfil
                  </Link>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 border border-white/15 bg-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition-colors hover:border-red-500/50 hover:text-red-400 light:border-slate-300 light:bg-white light:text-slate-800"
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
                  className="flex w-full items-center justify-center gap-2 border border-primary bg-primary px-4 py-3.5 text-center text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.99]"
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
    </header>
  );
}
