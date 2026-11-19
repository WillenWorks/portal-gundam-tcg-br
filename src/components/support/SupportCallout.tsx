/* Chamadas de apoio fora do rodapé: faixa na home (com os nomes do mural) e uma linha no fim dos artigos.
 * Discretas de propósito: nada de pop-up ou banner fixo. */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Camera, HeartHandshake, MessagesSquare, Users } from "lucide-react";

import { SupporterBadge } from "@/components/support/SupporterBadge";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { api, type ApiSupporter } from "@/lib/api";
import { SUPPORT_MONTHLY_COST } from "@/lib/supportContent";
import { DISCORD_URL, INSTAGRAM_URL } from "@/lib/supportLinks";

/** Quantos nomes do mural aparecem na faixa da home (o mural já vem por patente, mais alta primeiro). */
const HOME_NAMES = 6;

function SupportLinks({ compact = false }: { compact?: boolean }) {
  const { tr } = useSiteLanguage();
  const base = "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors";
  const box = compact ? "" : " border px-4 py-2";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link href="/apoie" className={`${base}${box} ${compact ? "text-primary hover:text-primary/80" : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"}`}>
        <HeartHandshake className="size-3.5" />
        {tr("Apoiar", "Support")}
      </Link>
      <Link href="/apoiadores" className={`${base}${box} ${compact ? "text-slate-300 hover:text-primary light:text-slate-700" : "border-white/20 bg-white/5 text-white hover:border-primary/60 hover:text-primary light:border-slate-400 light:bg-white light:text-slate-900"}`}>
        <Users className="size-3.5" />
        {tr("Mural de apoiadores", "Supporters wall")}
      </Link>
      {INSTAGRAM_URL ? (
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={`${base}${box} ${compact ? "text-slate-300 hover:text-primary light:text-slate-700" : "border-white/20 bg-white/5 text-white hover:border-primary/60 hover:text-primary light:border-slate-400 light:bg-white light:text-slate-900"}`}>
          <Camera className="size-3.5" />
          Instagram
        </a>
      ) : null}
      {DISCORD_URL ? (
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className={`${base}${box} ${compact ? "text-slate-300 hover:text-primary light:text-slate-700" : "border-white/20 bg-white/5 text-white hover:border-primary/60 hover:text-primary light:border-slate-400 light:bg-white light:text-slate-900"}`}>
          <MessagesSquare className="size-3.5" />
          Discord
        </a>
      ) : null}
    </div>
  );
}

/** Faixa da home: por que apoiar, os primeiros nomes do mural e os links. */
export function HomeSupportStrip() {
  const { tr } = useSiteLanguage();
  const [supporters, setSupporters] = useState<ApiSupporter[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .getSupporters()
      .then((list) => {
        if (alive) setSupporters(list.slice(0, HOME_NAMES));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section aria-labelledby="home-apoio-titulo" className="border-t border-white/10 py-10 light:border-slate-300/80">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 2xl:max-w-[1600px] 3xl:max-w-[1800px]">
        <div className="flex flex-col gap-6 border border-primary/30 bg-primary/5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">{tr("Hangar de suprimentos", "Supply hangar")}</p>
            <h2 id="home-apoio-titulo" className="font-heading text-2xl uppercase tracking-wide dark:text-white light:text-slate-950">
              {tr("Mantido por quem joga", "Kept running by players")}
            </h2>
            <p className="text-sm leading-6 text-slate-400 light:text-slate-600">
              {tr(
                `O Anaheim Hub é gratuito e sem paywall. O servidor custa ${SUPPORT_MONTHLY_COST} e é pago com anúncios e com a ajuda da comunidade.`,
                "Anaheim Hub is free with no paywall. The server is paid for by ads and by the community's help.",
              )}
            </p>
            {supporters.length > 0 ? (
              <ul aria-label={tr("Apoiadores", "Supporters")} className="flex flex-wrap gap-2 pt-1">
                {supporters.map((s) => (
                  <li key={`${s.username ?? ""}:${s.name}`} className="inline-flex items-center gap-1.5 border border-white/10 bg-slate-950/40 px-2 py-1 text-xs light:border-slate-300 light:bg-white">
                    {s.username ? (
                      <Link href={`/u/${s.username}`} className="font-semibold hover:text-primary">
                        {s.name}
                      </Link>
                    ) : (
                      <span className="font-semibold">{s.name}</span>
                    )}
                    {s.tier ? <SupporterBadge size="sm" tier={s.tier} /> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <SupportLinks />
        </div>
      </div>
    </section>
  );
}

/** Linha no fim de artigos e spoilers. */
export function ArticleSupportLine() {
  const { tr } = useSiteLanguage();
  return (
    <aside aria-label={tr("Apoie o Anaheim Hub", "Support Anaheim Hub")} className="mt-8 flex flex-col gap-3 border-l-2 border-primary/60 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm text-slate-300 light:text-slate-700">
        <ArrowRight className="size-4 shrink-0 text-primary" />
        {tr("Gostou? O Anaheim Hub é gratuito e mantido por apoiadores.", "Enjoyed it? Anaheim Hub is free and kept running by supporters.")}
      </p>
      <SupportLinks compact />
    </aside>
  );
}
