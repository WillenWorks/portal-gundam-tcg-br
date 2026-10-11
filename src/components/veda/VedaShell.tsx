import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BarChart3, Calendar, Layers, MapPin, Trophy } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { VedaSampleNote } from "@/components/veda/VedaSampleNote";
import { VedaSourceCredit } from "@/components/veda/VedaSourceCredit";
import type { VedaSample, VedaSource } from "@/lib/veda/types";

export interface VedaShellProps {
  children: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  title?: string;
  description?: string;
  sample?: VedaSample | null;
  source?: VedaSource | null;
  sourceUrl?: string | null;
  heroActions?: ReactNode;
}

const VEDA_NAV_ITEMS = [
  { label: "Torneios & Reports", href: "/torneios", icon: Trophy },
  { label: "Arquétipos", href: "/arquetipos", icon: Layers },
  { label: "Metagame Regional", href: "/metagame/regional", icon: MapPin },
  { label: "Veda Analytics", href: "/stats", icon: BarChart3 },
  { label: "Hub de Eventos", href: "/eventos", icon: Calendar },
];

export function VedaShell({
  children,
  breadcrumbs = [],
  title,
  description,
  sample,
  source,
  sourceUrl,
  heroActions,
}: VedaShellProps) {
  const [location] = useLocation();

  const finalBreadcrumbs = [
    { label: "Veda System", href: "/torneios" },
    ...breadcrumbs,
  ];

  return (
    <PublicShell breadcrumbs={finalBreadcrumbs}>
      <div className="space-y-6">
        {/* Barra superior de navegação rápida entre frentes competitivas */}
        <div className="panel-cut border border-white/10 bg-slate-950/80 p-2 sm:p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
              {VEDA_NAV_ITEMS.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href) && item.href !== "/eventos");
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition ${
                      isActive
                        ? "border border-primary/50 bg-primary/20 text-primary font-bold shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                        : "border border-transparent text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Amostra rápida no topo se fornecida */}
            {sample && (
              <div className="hidden lg:block">
                <VedaSampleNote sample={sample} variant="badge" />
              </div>
            )}
          </div>
        </div>

        {/* Cabeçalho do módulo se title ou description existirem */}
        {(title || description || heroActions || sample || source) && (
          <div className="panel-cut border border-primary/30 hero-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2 max-w-4xl">
                {title && (
                  <h1 className="font-heading text-2xl sm:text-3xl uppercase tracking-wider text-white">
                    {title}
                  </h1>
                )}
                {description && <p className="text-sm text-slate-300 leading-relaxed">{description}</p>}
                {(sample || source || sourceUrl) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                    {sample && <VedaSampleNote sample={sample} variant="inline" />}
                    {(source || sourceUrl) && (
                      <VedaSourceCredit source={source} sourceUrl={sourceUrl} />
                    )}
                  </div>
                )}
              </div>

              {heroActions && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">{heroActions}</div>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo da página */}
        {children}
      </div>
    </PublicShell>
  );
}
