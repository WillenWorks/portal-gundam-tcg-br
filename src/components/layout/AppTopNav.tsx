/* Top nav global — cabeçalho padrão do portal com ações públicas, sessão e alternância de tema. */
import { LogOut, Moon, Sun } from "lucide-react";
import { Link } from "wouter";

import logoWhite from "@/assets/gundam-logo-white.png";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

export const publicTopNav = [
  { href: "/decks", label: "Decks Públicos" },
  { href: "/sets", label: "Coleções" },
  { href: "/cards", label: "Cartas" },
  { href: "/rules", label: "Regras" },
] as const;

export function AppTopNav() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl dark:bg-slate-950/70 light:bg-white/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/topo" className="flex items-center gap-3 text-white dark:text-white light:text-slate-900">
          <img src={logoWhite} alt="Gundam Card Game" className="h-9 w-auto opacity-90" />
          <div className="hidden border-l border-white/15 pl-3 md:block dark:border-white/15 light:border-slate-300/70">
            <p className="font-heading text-lg uppercase tracking-[0.18em]">Portal BR</p>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-400 light:text-slate-500">Hangar tático da comunidade</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {publicTopNav.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm uppercase tracking-[0.18em] text-slate-300 transition hover:text-primary dark:text-slate-300 light:text-slate-700">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white dark:border-white/20 dark:bg-white/5 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 light:hover:bg-slate-100" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {isAuthenticated ? (
            <>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white dark:border-white/20 dark:bg-white/5 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 light:hover:bg-slate-100">
                <Link href={user?.role === "ADMIN" ? "/admin" : "/portal"}>{user?.role === "ADMIN" ? "Admin" : "Minha área"}</Link>
              </Button>
              <Button type="button" variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white dark:border-white/20 dark:bg-white/5 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 light:hover:bg-slate-100" onClick={logout}>
                <LogOut className="mr-2 size-4" />Sair
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white dark:border-white/20 dark:bg-white/5 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 light:hover:bg-slate-100">
              <Link href="/portal">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
