import { Link } from "wouter";
import { PublicShell } from "@/components/layout/PublicShell";
import { ABOUT_CONTACT, ABOUT_LEAD, ABOUT_SECTIONS, ABOUT_TITLE, ABOUT_UPDATED } from "@/lib/aboutContent";

/** Página "Sobre" (/sobre). O texto mora em src/lib/aboutContent.ts, o mesmo que o servidor põe no HTML. */
export default function AboutPage() {
  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-3xl px-4 py-10 text-sm leading-7 text-slate-300 md:py-14 light:text-slate-700">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Anaheim Hub</p>
        <h1 className="mt-3 font-heading text-3xl uppercase text-white md:text-4xl light:text-slate-900">{ABOUT_TITLE}</h1>
        <p className="text-xs text-slate-500">Última atualização: {ABOUT_UPDATED}</p>
        <p className="mt-5 text-base leading-8 text-slate-200 light:text-slate-800">{ABOUT_LEAD}</p>

        {ABOUT_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mt-8 font-heading text-xl uppercase text-white light:text-slate-900">{section.title}</h2>
            {section.items?.length ? (
              <ul className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <li key={item.label ?? item.text} className="ml-5 list-disc">
                    {item.label ? (
                      item.href ? (
                        <Link href={item.href} className="font-semibold text-primary hover:underline">{item.label}</Link>
                      ) : (
                        <strong className="text-white light:text-slate-900">{item.label}</strong>
                      )
                    ) : null}
                    {item.label ? ": " : ""}
                    {item.text}
                  </li>
                ))}
              </ul>
            ) : null}
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-3">{paragraph}</p>
            ))}
          </section>
        ))}

        <h2 className="mt-8 font-heading text-xl uppercase text-white light:text-slate-900">Contato</h2>
        <p className="mt-3">
          Dúvidas, correções e parcerias: <a href={`mailto:${ABOUT_CONTACT}`} className="text-primary hover:underline">{ABOUT_CONTACT}</a>
        </p>

        <p className="mt-10 text-xs text-slate-500">
          Veja também: <Link href="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link> ·{" "}
          <Link href="/termos" className="text-primary hover:underline">Termos de Uso</Link>
        </p>
      </article>
    </PublicShell>
  );
}
