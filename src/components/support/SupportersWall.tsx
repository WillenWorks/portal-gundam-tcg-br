/* Mural de apoiadores: contas apoiadoras + nomes de quem apoia pelo Apoia.se sem conta (GET /api/support/supporters,
 * patente mais alta primeiro). Usado em /apoie e no CommunitySupportModal. */
import { Link } from "wouter";

import type { ApiSupporter } from "@/lib/api";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { SupporterBadge } from "@/components/support/SupporterBadge";

export function SupportersWall({ supporters, emptyText }: { supporters: ApiSupporter[]; emptyText?: string }) {
  const { tr } = useSiteLanguage();
  if (supporters.length === 0) {
    return (
      <p className="text-sm dark:text-slate-400 light:text-slate-500">
        {emptyText ?? tr("Ainda não há apoiadores listados — seja o primeiro a aparecer aqui!", "No supporters listed yet — be the first to show up here!")}
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {supporters.map((supporter, idx) => (
        <li
          key={`${supporter.username || supporter.name}-${idx}`}
          title={supporter.message || (supporter.sinceMonth ? `${tr("Apoiador desde", "Supporter since")} ${supporter.sinceMonth}` : undefined)}
          className="inline-flex items-center gap-2 border px-2.5 py-1.5 transition-colors hover:border-primary/40 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] light:border-slate-200 light:bg-slate-100/90 light:hover:bg-slate-200"
        >
          {supporter.username ? (
            <Link href={`/u/${supporter.username}`} className="text-xs font-medium hover:text-primary dark:text-slate-200 light:text-slate-800">
              {supporter.name}
            </Link>
          ) : (
            <span className="text-xs font-medium dark:text-slate-200 light:text-slate-800">{supporter.name}</span>
          )}
          <SupporterBadge size="sm" tier={supporter.tier} />
        </li>
      ))}
    </ul>
  );
}
