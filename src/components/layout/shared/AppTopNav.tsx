/* Layout shared v8.1 — topo público consistente, com menu desktop completo e dropdown móvel. */
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, LogIn, LogOut, Menu, Moon, PanelsTopLeft, Sun, UserPlus, X } from "lucide-react";

import logoWhite from "@/assets/gundam-logo-white.png";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const publicTopNav = [
  { href: "/", label: "Home" },
  { href: "/decks", label: "Decks" },
  { href: "/database", label: "Database", children: [
    { href: "/database", label: "Cartas" },
    { href: "/sets", label: "Coleções" },
  ] },
  { href: "/eventos", label: "Eventos" },
  { href: "/rules", label: "Rulings" },
] as const;

function isActiveRoute(currentPath: string, href: string) {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function NavDropdown({ item, active, currentPath }: { item: (typeof publicTopNav)[number]; active: boolean; currentPath: string }) {
  const [open, setOpen] = useState(false);
  const children = "children" in item ? item.children : undefined;
  if (!children) return null;
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-2 text-sm uppercase tracking-[0.18em] nav-hover-soft",
          active ? "text-primary" : "text-slate-300 hover:text-white",
        )}
      >
        {item.label}
        <ChevronDown className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 min-w-[180px] border border-white/10 bg-slate-950/97 py-2 backdrop-blur-xl light:border-slate-300/80 light:bg-white">
          {children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block px-4 py-2 text-sm uppercase tracking-[0.16em] nav-hover-soft",
                isActiveRoute(currentPath, child.href) ? "text-primary" : "text-slate-300 hover:text-white light:text-slate-700 light:hover:text-slate-950",
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
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPath = useMemo(() => location.split("?")[0], [location]);
  const dashboardHref = "/profile";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/92 text-white backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1760px] items-center justify-between gap-4 px-4 py-4 sm:px-6 2xl:px-10">
        <Link href="/" className="flex min-w-0 items-center gap-3 text-white">
          <img src={logoWhite} alt="Gundam Card Game" className="h-9 w-auto opacity-90" />
          <div className="hidden min-w-0 border-l border-white/15 pl-3 md:block">
            <p className="font-heading text-lg uppercase tracking-[0.18em]">Portal BR</p>
            <p className="truncate text-xs uppercase tracking-[0.22em] text-slate-400">Hangar tático da comunidade</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {publicTopNav.map((item) => {
            const active = isActiveRoute(currentPath, item.href);
            if ("children" in item && item.children) {
              return <NavDropdown key={item.href} item={item} active={active} currentPath={currentPath} />;
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center px-3 py-2 text-sm uppercase tracking-[0.18em] nav-hover-soft",
                  active ? "text-primary" : "text-slate-300 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {isAuthenticated ? (
            <>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">
                <Link href={dashboardHref}><PanelsTopLeft className="mr-2 size-4" />Perfil</Link>
              </Button>
              <Button type="button" variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={logout}>
                <LogOut className="mr-2 size-4" />Sair
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">
                <Link href="/login"><LogIn className="mr-2 size-4" />Login</Link>
              </Button>
              <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/login?mode=register"><UserPlus className="mr-2 size-4" />Criar conta</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button type="button" variant="outline" size="icon" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-white/20 bg-white/5 px-3 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            <span className="ml-2">Menu</span>
            <ChevronDown className={cn("size-4 transition", mobileOpen ? "rotate-180" : "rotate-0")} />
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-white/10 bg-slate-950/98 md:hidden">
          <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-2 px-4 py-4 sm:px-6">
            {publicTopNav.map((item) => {
              const active = isActiveRoute(currentPath, item.href);
              const children = "children" in item && item.children ? item.children : null;
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "panel-cut border px-4 py-3 text-sm uppercase tracking-[0.18em] transition",
                      active
                        ? "border-primary/40 bg-primary/10 text-white light:text-slate-950"
                        : "border-white/10 bg-white/5 text-slate-200 nav-hover-soft hover:border-white/20 light:border-slate-400/90 light:bg-white light:text-slate-800",
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                  {children ? (
                    <div className="mt-2 ml-4 grid gap-2 border-l border-white/10 pl-3">
                      {children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "px-3 py-2 text-xs uppercase tracking-[0.16em] nav-hover-soft",
                            isActiveRoute(currentPath, child.href) ? "text-primary" : "text-slate-400 hover:text-white",
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
            })}

            <div className="mt-2 grid gap-2">
              {isAuthenticated ? (
                <>
                  <Link href={dashboardHref} className="panel-cut border border-white/10 bg-white/5 px-4 py-3 text-sm uppercase tracking-[0.18em] text-slate-200 nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-800" onClick={() => setMobileOpen(false)}>
                    Perfil
                  </Link>
                  <button type="button" className="panel-cut border border-white/10 bg-white/5 px-4 py-3 text-left text-sm uppercase tracking-[0.18em] text-slate-200 nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-800" onClick={() => { setMobileOpen(false); logout(); }}>
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="panel-cut border border-white/10 bg-white/5 px-4 py-3 text-sm uppercase tracking-[0.18em] text-slate-200 nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-800" onClick={() => setMobileOpen(false)}>
                    Login
                  </Link>
                  <Link href="/login?mode=register" className="panel-cut border border-primary/30 bg-primary/10 px-4 py-3 text-sm uppercase tracking-[0.18em] text-white" onClick={() => setMobileOpen(false)}>
                    Criar conta
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
