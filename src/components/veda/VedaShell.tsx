import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BarChart3, Layers, MapPin, Trophy } from "lucide-react";
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
  { label: "Torneios & Reports", href: "/torneios", icon: Trophy, hint: "Eventos e súmulas na íntegra" },
  { label: "Arquétipos & Decks", href: "/arquetipos", icon: Layers, hint: "Tier list e listas de cada deck" },
  { label: "Metagame Regional", href: "/metagame/regional", icon: MapPin, hint: "Recorte por estado, cidade e loja" },
  { label: "Estatísticas & Cartas", href: "/stats", icon: BarChart3, hint: "Métricas de cartas, confrontos e tendências" },
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
    { label: "Sistema VEDA", href: "/torneios" },
    ...breadcrumbs,
  ];

  return (
    <PublicShell breadcrumbs={finalBreadcrumbs}>
      <div className="space-y-6">
        {/* Barra superior de navegação rápida entre as 4 frentes competitivas do Sistema VEDA */}
        <div className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-2 sm:p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
              {VEDA_NAV_ITEMS.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.hint}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition ${
                      isActive
                        ? "border border-primary/50 bg-primary/20 text-primary font-bold shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                        : "border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
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

        {/* Cabeçalho padronizado apenas quando title ou description forem informados */}
        {(title || description) && (
          <div className="panel-cut border border-primary/30 hero-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2 max-w-4xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
                  Sistema VEDA · Inteligência Competitiva
                </p>
                {title && (
                  <h1 className="font-heading text-2xl sm:text-3xl uppercase tracking-wider text-slate-900 dark:text-white">
                    {title}
                  </h1>
                )}
                {description && <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{description}</p>}
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

        {/* Nota sintética de rodapé sem repetição excessiva de links externos */}
        <p className="text-center font-mono text-[11px] text-slate-500 dark:text-slate-400">
          Sistema VEDA · Inteligência competitiva consolidada pela equipe AnaheimHub a partir de súmulas oficiais e torneios verificados.
        </p>
      </div>
    </PublicShell>
  );
}
