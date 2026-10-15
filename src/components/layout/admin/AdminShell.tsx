/* AdminShell — Console Operacional e Terminal de Comando Administrativo
 * Layout exclusivo e desacoplado do portal do jogador (PortalShell).
 * Foco: Alta densidade, segurança, governança de catálogo, usuários e simulador.
 */
import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  ArrowUpRight,
  BookMarked,
  Bot,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FileCode,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  PanelsTopLeft,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Tags,
  User,
  Users,
  X,
} from "lucide-react";

import anaheimLogo from "@/assets/anaheim-logo-transparent.png";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export type AdminCrumb = { label: string; href?: string };

type NavItem = {
  href: string;
  label: string;
  badge?: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  title: string;
  items: ReadonlyArray<NavItem>;
};

const adminNavGroups: ReadonlyArray<NavGroup> = [
  {
    title: "Comando Central",
    items: [
      { href: "/admin", label: "Dashboard Geral", icon: LayoutDashboard },
    ],
  },
  {
    title: "Catálogo & Acervo",
    items: [
      { href: "/admin/cards", label: "Cartas & MS", icon: PanelsTopLeft },
      { href: "/admin/collections", label: "Coleções", icon: BookMarked },
      { href: "/admin/rulings", label: "Regras & Rulings", icon: ScrollText },
      { href: "/admin/traits", label: "Traits & Taxonomias", icon: Tags },
      { href: "/admin/media", label: "Mídias & Uploads", icon: Image },
    ],
  },
  {
    title: "Editorial & CMS",
    items: [
      { href: "/admin/articles", label: "Artigos & Notícias", icon: Newspaper },
    ],
  },
  {
    title: "Comunidade & Torneios",
    items: [
      { href: "/admin/users", label: "Gestão de Usuários", icon: Users },
      { href: "/admin/events", label: "Torneios & Eventos", icon: CalendarDays },
      { href: "/admin/seasons", label: "Temporadas VEDA", icon: CalendarRange },
    ],
  },
  {
    title: "Engenharia & Simulador",
    items: [
      { href: "/admin/simulador/cobertura", label: "Cobertura de Efeitos", icon: FileCode },
      { href: "/admin/simulador/autoria", label: "RAG de Autoria (AI)", icon: Bot },
    ],
  },
] as const;

const adminTitles: Record<string, string> = {
  "/admin": "Terminal de Comando Geral",
  "/admin/dashboard": "Terminal de Comando Geral",
  "/admin/users": "Gestão de Usuários & Permissões",
  "/admin/cards": "Catálogo de Cartas & Mobile Suits",
  "/admin/collections": "Coleções & Expansões",
  "/admin/seasons": "Temporadas do Sistema VEDA",
  "/admin/media": "Central de Mídias & Uploads",
  "/admin/traits": "Traits & Taxonomias Oficiais",
  "/admin/articles": "Módulo Editorial & Artigos",
  "/admin/rulings": "Regras Oficiais & Rulings",
  "/admin/events": "Gestão de Torneios & Eventos",
  "/admin/simulador/cobertura": "Cobertura de Efeitos do Simulador",
  "/admin/simulador/autoria": "RAG & Assistente de Autoria",
};

function AdminSidebarNav({
  location,
  collapsed,
  searchFilter,
  onNavigate,
}: {
  location: string;
  collapsed: boolean;
  searchFilter: string;
  onNavigate?: () => void;
}) {
  const currentPath = location.split("?")[0];
  const query = searchFilter.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!query) return adminNavGroups;
    return adminNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(query) || item.href.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <div className="space-y-6">
      {filteredGroups.map((group) => (
        <div key={group.title} className="space-y-1.5">
          {!collapsed ? (
            <p className="px-2 text-[10px] font-mono uppercase tracking-[0.22em] text-amber-500/80">
              {group.title}
            </p>
          ) : null}

          {group.items.map((item) => {
            const Icon = item.icon;
            const active =
              currentPath === item.href ||
              (item.href !== "/admin" && currentPath.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "panel-cut flex items-center gap-3 border px-3.5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] transition-all",
                  collapsed ? "justify-center px-0" : "",
                  active
                    ? "border-amber-400/60 bg-amber-400/15 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                    : "border-white/5 bg-slate-900/60 text-slate-300 hover:border-amber-400/30 hover:bg-slate-800/80 hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active ? "text-amber-400" : "text-slate-400 group-hover:text-amber-300"
                  )}
                />
                {!collapsed ? (
                  <span className="flex-1 truncate">{item.label}</span>
                ) : null}
                {!collapsed && item.badge ? (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-mono text-amber-300">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}

      {filteredGroups.length === 0 ? (
        <p className="px-2 py-4 text-center text-xs text-slate-500">
          Nenhum módulo encontrado para "{searchFilter}".
        </p>
      ) : null}
    </div>
  );
}

export function AdminShell({
  children,
  breadcrumbs,
}: {
  children: ReactNode;
  breadcrumbs?: AdminCrumb[];
}) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("anaheimhub:admin-sidebar-collapsed") === "1";
  });

  useEffect(() => {
    window.localStorage.setItem("anaheimhub:admin-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const currentPath = useMemo(() => location.split("?")[0], [location]);
  const currentTitle = adminTitles[currentPath] ?? "Console Administrativo";
  const trail = breadcrumbs?.length ? breadcrumbs : [{ label: currentTitle }];
  const isAdmin = user?.role === "ADMIN";

  // Fallback de segurança duplo: se um não-admin chegar aqui, não renderiza nenhuma interface de comando
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <Card className="panel-cut max-w-md rounded-none border-red-500/40 bg-slate-900/95 shadow-2xl">
          <CardContent className="space-y-5 p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10">
              <ShieldAlert className="size-7 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-red-400">
                Acesso Interrompido · Nível Alpha Requerido
              </p>
              <h2 className="mt-1 font-heading text-2xl uppercase tracking-wider text-white">
                Console Administrativo
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Esta rota é de acesso exclusivo para contas com permissão de Administrador (Role ADMIN).
              Retorne ao portal principal para continuar navegando como piloto.
            </p>
            <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/portal">Ir para o Portal do Jogador</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {/* Topo Tático do Admin Console */}
      <header className="sticky top-0 z-40 border-b border-amber-500/20 bg-slate-950/95 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="mx-auto flex w-full max-w-[2600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 xl:px-8">
          {/* Lado Esquerdo: Identidade do Console */}
          <div className="flex min-w-0 items-center gap-3.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="size-4" />
              <span className="ml-1.5 text-xs uppercase tracking-wider">Módulos</span>
            </Button>

            <Link href="/admin" className="flex items-center gap-3 transition-opacity hover:opacity-90">
              <img
                src={anaheimLogo}
                alt="Anaheim Electronics"
                className="h-10 w-auto object-contain drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]"
              />
              <div className="hidden border-l border-white/10 pl-3 md:block">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-lg uppercase tracking-[0.18em] text-white">
                    Anaheim Hub
                  </span>
                  <Badge className="rounded-none border border-amber-400/40 bg-amber-400/10 px-1.5 py-0 text-[10px] font-mono tracking-widest text-amber-300 uppercase">
                    Admin Ops
                  </Badge>
                </div>
                <p className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                  Central de Governança & Terminal Root
                </p>
              </div>
            </Link>
          </div>

          {/* Centro: Status do Sistema VEDA */}
          <div className="hidden items-center gap-4 lg:flex">
            <div className="flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-[11px] font-mono text-emerald-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span>VEDA CORE ONLINE</span>
            </div>

            <div className="flex items-center gap-2 border border-amber-500/25 bg-amber-500/5 px-3 py-1 text-[11px] font-mono text-amber-300">
              <ShieldCheck className="size-3.5 text-amber-400" />
              <span>ROLE: ROOT ADMIN</span>
            </div>
          </div>

          {/* Lado Direito: Ações de Alternância, Perfil e Logout */}
          <div className="flex items-center gap-2.5">
            {/* Botão de retorno ao Portal do Jogador */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="panel-cut rounded-none border-primary/40 bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary hover:bg-primary/20 hover:text-white"
            >
              <Link href="/portal" title="Alternar para o Hangar do Jogador">
                <ArrowUpRight className="mr-1.5 size-3.5" />
                <span className="hidden sm:inline">Portal do Jogador</span>
                <span className="sm:hidden">Portal</span>
              </Link>
            </Button>

            {/* Acesso ao Perfil de Usuário Pessoal */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-none border-white/10 bg-slate-900/80 text-xs uppercase tracking-wider text-slate-300 hover:border-amber-400/40 hover:text-white"
            >
              <Link href="/profile" title="Ver ou editar seus dados de perfil pessoal">
                <User className="mr-1.5 size-3.5 text-slate-400" />
                <span className="max-w-[110px] truncate">{user?.displayName || "Perfil"}</span>
              </Link>
            </Button>

            {/* Alternador de Tema */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none border-white/10 bg-slate-900/80 text-slate-300 hover:text-white"
              onClick={toggleTheme}
              title="Alternar tema"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>

            {/* Logout Seguro */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none border-red-500/30 bg-red-500/5 text-xs uppercase tracking-wider text-red-300 hover:bg-red-500/20 hover:text-red-100"
              onClick={logout}
              title="Encerrar sessão administrativa"
            >
              <LogOut className="mr-1.5 size-3.5" />
              <span className="hidden md:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Grid Principal do Console */}
      <div
        className={cn(
          "grid min-h-[calc(100vh-61px)] w-full transition-[grid-template-columns] duration-200",
          collapsed
            ? "lg:grid-cols-[72px_minmax(0,1fr)]"
            : "lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]"
        )}
      >
        {/* Sidebar Administrativa Desktop */}
        <aside
          className={cn(
            "hidden border-r border-amber-500/15 bg-slate-950/90 py-5 backdrop-blur-xl lg:flex lg:sticky lg:top-[61px] lg:h-[calc(100vh-61px)] lg:flex-col lg:overflow-y-auto",
            collapsed ? "px-2" : "px-4"
          )}
        >
          {/* Cabeçalho da Sidebar */}
          {!collapsed ? (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                  Módulos de Gestão
                </span>
                <span className="text-[10px] font-mono text-amber-400">12 Módulos</span>
              </div>

              {/* Filtro rápido de módulos */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
                <Input
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filtrar menu..."
                  className="h-8 rounded-none border-white/10 bg-slate-900/80 pl-8 pr-7 text-xs text-white placeholder:text-slate-500 focus-visible:border-amber-400/50"
                />
                {filterText ? (
                  <button
                    type="button"
                    onClick={() => setFilterText("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Links de Navegação da Sidebar */}
          <div className="flex-1 overflow-y-auto pr-0.5">
            <AdminSidebarNav
              location={location}
              collapsed={collapsed}
              searchFilter={filterText}
            />
          </div>

          <Separator className="my-3 bg-white/10" />

          {/* Painel do Operador Logado */}
          {!collapsed ? (
            <div className="border border-white/10 bg-slate-900/60 p-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-none bg-amber-500/20 font-heading text-xs font-bold text-amber-300">
                  {user?.displayName?.slice(0, 2).toUpperCase() || "AD"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{user?.displayName}</p>
                  <p className="truncate text-[10px] font-mono text-slate-400">{user?.email}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Botão de Recolher Sidebar */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "mt-3 hidden w-full rounded-none border-white/10 bg-slate-900/60 text-slate-300 hover:border-amber-400/40 hover:text-white lg:inline-flex",
              collapsed ? "justify-center px-0" : "justify-start"
            )}
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expandir barra de navegação" : "Recolher barra de navegação"}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <>
                <ChevronLeft className="mr-2 size-4" />
                <span className="text-xs uppercase tracking-wider">Recolher Menu</span>
              </>
            )}
          </Button>
        </aside>

        {/* Área de Trabalho / Conteúdo do Admin */}
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <main className="min-w-0 max-w-[2600px] flex-1 px-4 py-5 sm:px-6 xl:px-8 lg:py-6">
            {/* Header de Contexto e Breadcrumbs do Admin */}
            <div className="mb-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href="/admin" className="text-amber-400/90 hover:text-amber-300 font-mono text-xs uppercase tracking-wider">
                          Admin Console
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    {trail.map((crumb, index) => (
                      <div key={`${crumb.label}-${index}`} className="contents">
                        <BreadcrumbSeparator className="text-slate-600" />
                        <BreadcrumbItem>
                          {crumb.href && index < trail.length - 1 ? (
                            <BreadcrumbLink asChild>
                              <Link href={crumb.href} className="text-slate-400 hover:text-white text-xs uppercase tracking-wider">
                                {crumb.label}
                              </Link>
                            </BreadcrumbLink>
                          ) : (
                            <BreadcrumbPage className="font-semibold text-slate-100 text-xs uppercase tracking-wider">
                              {crumb.label}
                            </BreadcrumbPage>
                          )}
                        </BreadcrumbItem>
                      </div>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>

                {/* Banner sutil de modo operacional */}
                <div className="flex items-center gap-2 text-[11px] font-mono text-amber-300/80">
                  <Activity className="size-3.5 text-amber-400" />
                  <span>SESSÃO ELEVADA ATIVA</span>
                </div>
              </div>

              {/* Faixa Tática de Segurança do Admin */}
              <div className="panel-cut flex flex-wrap items-center justify-between gap-3 border border-amber-500/30 bg-amber-500/[0.04] px-4 py-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="font-mono uppercase tracking-wider text-amber-300">
                    Ambiente Administrativo de Produção
                  </span>
                  <span className="hidden text-slate-400 md:inline">
                    · Todas as mutações e cadastros afetam os dados ao vivo do portal.
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                  <span>Rota atual:</span>
                  <code className="bg-slate-900 px-1.5 py-0.5 text-amber-200 border border-white/10">
                    {currentPath}
                  </code>
                </div>
              </div>
            </div>

            {/* Conteúdo Dinâmico da Página */}
            {children}
          </main>

          {/* Rodapé Administrativo Compacto */}
          <footer className="border-t border-white/10 bg-slate-950/80 px-6 py-4 text-xs text-slate-500">
            <div className="mx-auto flex max-w-[2600px] flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
              <div>
                © 2026 Anaheim Hub · Console Administrativo & Terminal de Governança
              </div>
              <div className="flex items-center gap-4">
                <Link href="/portal" className="text-slate-400 hover:text-amber-300">
                  Hangar do Jogador
                </Link>
                <span>·</span>
                <Link href="/profile" className="text-slate-400 hover:text-amber-300">
                  Configurações de Conta
                </Link>
                <span>·</span>
                <span className="text-emerald-400">API Status: OK</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Drawer Mobile da Sidebar */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-[340px] border-amber-500/20 bg-slate-950 text-white">
          <SheetHeader className="border-b border-white/10 pb-4 text-left">
            <div className="flex items-center gap-2">
              <Badge className="rounded-none border border-amber-400/40 bg-amber-400/10 text-[10px] font-mono text-amber-300 uppercase">
                Admin Ops
              </Badge>
              <SheetTitle className="font-heading text-xl uppercase tracking-wider text-white">
                Console Root
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-slate-400">
              Módulos de gestão e comando do Anaheim Hub.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex flex-col space-y-4 px-2 pb-6">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filtrar menu..."
                className="h-8 rounded-none border-white/10 bg-slate-900/80 pl-8 text-xs text-white placeholder:text-slate-500"
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              <AdminSidebarNav
                location={location}
                collapsed={false}
                searchFilter={filterText}
                onNavigate={() => setMobileSidebarOpen(false)}
              />
            </div>

            <Separator className="my-2 bg-white/10" />

            <div className="space-y-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full justify-start rounded-none border-primary/40 text-primary hover:bg-primary/10"
              >
                <Link href="/portal" onClick={() => setMobileSidebarOpen(false)}>
                  <ArrowUpRight className="mr-2 size-4" />
                  Voltar ao Portal do Jogador
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full justify-start rounded-none border-white/10 text-slate-300 hover:text-white"
              >
                <Link href="/profile" onClick={() => setMobileSidebarOpen(false)}>
                  <User className="mr-2 size-4" />
                  Meu Perfil de Usuário
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start rounded-none border-red-500/30 text-red-300 hover:bg-red-500/10"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  logout();
                }}
              >
                <LogOut className="mr-2 size-4" />
                Sair da Sessão Admin
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
