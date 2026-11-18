/* Página "Apoiadores" (/apoiadores): o mural em destaque, agrupado por patente — para linkar no Apoia.se e no
 * Instagram. Os dados vêm de GET /api/support/supporters (server/routes/supporterRoutes.ts); o mesmo agrupamento
 * vai no HTML do servidor (server/htmlContent.ts → supportersBody). */
import { useEffect, useState } from "react";
import { Link } from "wouter";

import { api, type ApiSupporter } from "@/lib/api";
import { groupSupportersByTier, SUPPORTERS_LEAD, SUPPORTERS_TITLE } from "@/lib/supportContent";
import { SupporterBadge } from "@/components/support/SupporterBadge";
import { SUPPORT_URL } from "@/lib/supportLinks";


function SupporterCard({ supporter }: { supporter: ApiSupporter }) {
  const name = supporter.username ? (
    <Link href={`/u/${supporter.username}`} className="font-medium text-white hover:text-primary light:text-slate-900">
      {supporter.name}
    </Link>
  ) : (
    <span className="font-medium text-white light:text-slate-900">{supporter.name}</span>
  );
  return (
    <li className="panel-cut border border-white/10 bg-slate-950/60 p-3 light:border-slate-200 light:bg-white">
      <div className="flex flex-wrap items-center gap-2">
        {name}
        <SupporterBadge size="sm" tier={supporter.tier} />
      </div>
      {supporter.message ? <p className="mt-1.5 text-xs italic text-slate-400 light:text-slate-600">“{supporter.message}”</p> : null}
      {supporter.sinceMonth ? <p className="mt-1 text-[11px] text-slate-500">Apoiando desde {supporter.sinceMonth}</p> : null}
    </li>
  );
}

export default function SupportersPage() {
  const [supporters, setSupporters] = useState<ApiSupporter[] | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .getSupporters()
      .then((list) => alive && setSupporters(Array.isArray(list) ? list : []))
      .catch(() => alive && setSupporters([]));
    return () => {
      alive = false;
    };
  }, []);

  const groups = supporters ? groupSupportersByTier(supporters) : [];

  return (
    <div className="page-shell py-10 text-slate-300 light:text-slate-700">
      <article className="mx-auto max-w-4xl text-sm leading-7">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Anaheim Hub · Lab</p>
        <h1 className="mt-3 font-heading text-3xl uppercase text-white md:text-4xl light:text-slate-900">{SUPPORTERS_TITLE}</h1>
        <img
          src="/images/apoie-hangar-suprimentos.svg"
          alt="Hangar do Anaheim Hub recebendo caixas de suprimentos: servidor, domínio e spoilers"
          width={1200}
          height={600}
          className="mt-6 w-full border border-white/10 light:border-slate-200"
        />
        <p className="mt-6 text-base text-slate-200 light:text-slate-800">{SUPPORTERS_LEAD}</p>
        {supporters && supporters.length > 0 ? (
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-primary">
            {supporters.length} {supporters.length === 1 ? "piloto mantendo o hangar" : "pilotos mantendo o hangar"}
          </p>
        ) : null}

        {supporters === null ? (
          <p className="mt-8 text-xs text-slate-500">Carregando o mural…</p>
        ) : groups.length === 0 ? (
          <div className="panel-cut mt-8 border border-primary/30 bg-primary/5 p-6 text-center">
            <p className="font-heading text-lg uppercase text-white light:text-slate-900">O mural ainda está vazio</p>
            <p className="mt-2">O primeiro nome aqui pode ser o seu.</p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="mt-10" aria-labelledby={`patente-${group.key}`}>
              <h2 id={`patente-${group.key}`} className="flex items-baseline gap-2 font-heading text-xl uppercase text-white light:text-slate-900">
                {group.icon ? <span aria-hidden="true">{group.icon}</span> : null}
                {group.title}
                <span className="font-mono text-xs text-slate-500">({group.supporters.length})</span>
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.supporters.map((s, i) => (
                  <SupporterCard key={`${s.username || s.name}-${i}`} supporter={s} />
                ))}
              </ul>
            </section>
          ))
        )}

        <div className="panel-cut mt-12 flex flex-wrap items-center gap-4 border border-white/10 bg-slate-950/60 p-5 light:border-slate-200 light:bg-white">
          <p className="flex-1 text-sm">Quer seu nome aqui? Escolha uma patente e ajude a manter o Anaheim Hub no ar.</p>
          {SUPPORT_URL ? (
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
              Apoiar no Apoia.se →
            </a>
          ) : null}
          <Link href="/apoie" className="border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:border-primary hover:text-primary light:border-slate-300 light:text-slate-800">
            Ver patentes e formas de apoio
          </Link>
        </div>
      </article>
    </div>
  );
}
