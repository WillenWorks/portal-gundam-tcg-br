/* Layout público v8.1 — topo global consistente, área pública sem sidebar e largura mais generosa. */
import { type ReactNode } from "react";
import { Link } from "wouter";

import { AppTopNav } from "@/components/layout/shared/AppTopNav";
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

type Crumb = { label: string; href?: string };

export function PublicShell({ children, breadcrumbs, title, description }: { children: ReactNode; breadcrumbs?: Crumb[]; title?: string; description?: string }) {
  const trail = breadcrumbs?.length ? breadcrumbs : [{ label: title || "Página pública" }];

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden text-white dark:text-white light:text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-grid-tech opacity-30 dark:opacity-30 light:opacity-12" />
      <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-15 dark:opacity-15 light:opacity-0" />

      <AppTopNav />

      <main id="topo" className="relative mx-auto w-full max-w-[1760px] flex-1 px-4 py-8 sm:px-6 xl:px-8 2xl:px-10 lg:py-10">
        <div className="space-y-6">
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
                    ) : index === trail.length - 1 ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink>{crumb.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          {(title || description) ? (
            <div className="panel-cut border border-white/10 bg-slate-950/70 px-5 py-5 dark:border-white/10 dark:bg-slate-950/70 light:border-slate-300/80 light:bg-white/86 light:shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Núcleo público</p>
                  {title ? <h1 className="mt-2 font-heading text-3xl uppercase leading-none sm:text-4xl lg:text-5xl dark:text-white light:text-slate-900">{title}</h1> : null}
                  {description ? <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{description}</p> : null}
                </div>
                <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">Hangar público</Badge>
              </div>
            </div>
          ) : null}

          {children}
        </div>
      </main>

      <footer className="border-t border-white/10 bg-slate-950/88 dark:border-white/10 dark:bg-slate-950/88 light:border-slate-300/80 light:bg-white/82">
        <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6 px-4 py-8 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between xl:px-8 2xl:px-10 dark:text-slate-400 light:text-slate-600">
          <div>
            <p className="font-heading text-xl uppercase tracking-[0.16em] text-white dark:text-white light:text-slate-900">Portal Gundam TCG BR</p>
            <p className="mt-2 max-w-2xl leading-7">Projeto de comunidade voltado ao público brasileiro. Regras, nomes e materiais oficiais devem sempre manter referência clara às fontes originais.</p>
          </div>
          <div className="min-w-[280px]">
            <Separator className="mb-4 bg-white/10 lg:hidden dark:bg-white/10 light:bg-slate-300/70" />
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Feito pela comunidade</p>
            <p className="mt-2 text-white dark:text-white light:text-slate-900">Catálogo oficial · Regras em pt-BR · Deckbuilder</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
