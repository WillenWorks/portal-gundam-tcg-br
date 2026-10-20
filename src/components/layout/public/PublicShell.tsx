/* Layout público v8.1 — topo global consistente, área pública sem sidebar e largura mais generosa. */
import { type ReactNode } from "react";
import { Link } from "wouter";

import { AppTopNav } from "@/components/layout/shared/AppTopNav";
import { AppFooter } from "@/components/layout/shared/AppFooter";
import { SiteAnnouncementBanner } from "@/components/layout/shared/SiteAnnouncementBanner";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Crumb = { label: string; href?: string };

export function PublicShell({ children, breadcrumbs, title, description, heroBanner }: { children: ReactNode; breadcrumbs?: Crumb[]; title?: string; description?: string; heroBanner?: ReactNode }) {
  const trail = breadcrumbs?.length ? breadcrumbs : [{ label: title || "Página pública" }];

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden text-white dark:text-white light:text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-grid-tech opacity-30 dark:opacity-30 light:opacity-12" />
      <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-15 dark:opacity-15 light:opacity-0" />

      <SiteAnnouncementBanner />
      <AppTopNav />

      <main id="topo" className="relative mx-auto w-full max-w-[2400px] flex-1 px-4 py-8 sm:px-6 xl:px-8 2xl:px-10 3xl:px-12 lg:py-10">
        <div className="space-y-6">
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

          {heroBanner ? heroBanner : null}

          {!heroBanner && (title || description) ? (
            <div className="panel-cut border border-white/10 bg-slate-950/70 px-5 py-5 dark:border-white/10 dark:bg-slate-950/70 light:border-slate-300/80 light:bg-white/86 light:shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Núcleo público</p>
                  {title ? <h1 className="mt-2 font-heading text-3xl uppercase leading-none sm:text-4xl lg:text-5xl dark:text-white light:text-slate-900">{title}</h1> : null}
                  {description ? <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{description}</p> : null}
                </div>
                <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">Área pública</Badge>
              </div>
            </div>
          ) : null}

          {children}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
