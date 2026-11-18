import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Check, Copy } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { SUPPORT_LEAD, SUPPORT_TIER_PERKS, SUPPORT_TITLE, SUPPORT_WHY, supportChannels } from "@/lib/supportContent";
import { SUPPORTER_TIERS } from "@/lib/supporters";
import { api, type ApiSupporter } from "@/lib/api";
import { SupportersWall } from "@/components/support/SupportersWall";

const channels = supportChannels({
  supportUrl: import.meta.env.VITE_SUPPORT_URL as string | undefined,
  pixKey: import.meta.env.VITE_SUPPORT_PIX_KEY as string | undefined,
  instagramUrl: import.meta.env.VITE_INSTAGRAM_URL as string | undefined,
  discordUrl: import.meta.env.VITE_DISCORD_INVITE_URL as string | undefined,
  mypCoupon: import.meta.env.VITE_MYPCARDS_COUPON as string | undefined,
});

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="mt-3 inline-flex items-center gap-2 border border-white/15 px-3 py-1.5 font-mono text-xs text-white hover:border-primary light:text-slate-900"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copiado" : value}
    </button>
  );
}

const SUPPORT_URL = /^https:\/\//.test(import.meta.env.VITE_SUPPORT_URL || "") ? (import.meta.env.VITE_SUPPORT_URL as string) : "";

/** Página "Apoie" (/apoie). O texto mora em src/lib/supportContent.ts, o mesmo que o servidor põe no HTML. */
export default function SupportPage() {
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

  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-3xl px-4 py-10 text-sm leading-7 text-slate-300 md:py-14 light:text-slate-700">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Anaheim Hub</p>
        <h1 className="mt-3 font-heading text-3xl uppercase text-white md:text-4xl light:text-slate-900">{SUPPORT_TITLE}</h1>
        <img
          src="/images/apoie-hangar-suprimentos.svg"
          alt="Hangar do Anaheim Hub recebendo caixas de suprimentos: servidor, domínio e spoilers"
          width={1200}
          height={600}
          className="mt-6 w-full border border-white/10 light:border-slate-200"
        />
        <p className="mt-5 text-base leading-8 text-slate-200 light:text-slate-800">{SUPPORT_LEAD}</p>
        <ul className="mt-4 space-y-1">
          {SUPPORT_WHY.map((line) => (
            <li key={line} className="ml-5 list-disc">{line}</li>
          ))}
        </ul>

        <h2 className="mt-10 font-heading text-xl uppercase text-white light:text-slate-900">Patentes de apoiador</h2>
        <p className="mt-2">Cada patente do Apoia.se inclui tudo das anteriores.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SUPPORTER_TIERS.map((tier) => (
            <section key={tier.key} className="panel-cut border border-white/10 bg-slate-950/60 p-4 light:border-slate-200 light:bg-white">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-base uppercase text-white light:text-slate-900">
                  <span aria-hidden="true" className="mr-1.5">{tier.icon}</span>
                  {tier.label}
                </h3>
                <span className="font-mono text-xs text-primary">R$ {tier.minMonthly}/mês</span>
              </div>
              <ul className="mt-2 space-y-1 text-xs leading-5">
                {(SUPPORT_TIER_PERKS[tier.key] ?? []).map((perk) => (
                  <li key={perk} className="ml-4 list-disc">{perk}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {SUPPORT_URL ? (
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
            Escolher minha patente no Apoia.se →
          </a>
        ) : null}

        <h2 className="mt-10 font-heading text-xl uppercase text-white light:text-slate-900">Mural de apoiadores</h2>
        <p className="mt-2">
          Quem mantém o hangar funcionando. Muito obrigado!{" "}
          <Link href="/apoiadores" className="text-primary hover:underline">Ver o mural completo, por patente →</Link>
        </p>
        <div className="mt-4">
          {supporters === null ? <p className="text-xs text-slate-500">Carregando o mural…</p> : <SupportersWall supporters={supporters} emptyText="O mural ainda está vazio — o primeiro nome aqui pode ser o seu." />}
        </div>

        <h2 className="mt-10 font-heading text-xl uppercase text-white light:text-slate-900">Como ajudar</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {channels.map((c) => (
            <section key={c.title} className="panel-cut border border-white/10 bg-slate-950/60 p-5 light:border-slate-200 light:bg-white">
              <h3 className="font-heading text-base uppercase text-white light:text-slate-900">{c.title}</h3>
              <p className="mt-2">{c.text}</p>
              {c.copy ? <CopyButton value={c.copy} /> : null}
              {c.href ? (
                <a href={c.href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-semibold text-primary hover:underline">
                  {c.cta ?? "Abrir"} →
                </a>
              ) : null}
            </section>
          ))}
        </div>

        <p className="mt-10 text-xs text-slate-500">
          Veja também: <Link href="/sobre" className="text-primary hover:underline">Sobre o Anaheim Hub</Link> ·{" "}
          <Link href="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>
        </p>
      </article>
    </PublicShell>
  );
}
