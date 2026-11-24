/* Aviso de cookies (LGPD): aceitar ou recusar com o mesmo esforço. Sem escolha, nada de Google Analytics e
 * só anúncio não personalizado (src/lib/consent.ts). Reabre pelo link "Preferências de cookies" do rodapé. */
import { Cookie, X } from "lucide-react";

import { Link } from "wouter";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { closeConsentPreferences, saveConsent, useConsentBannerVisible, useConsentState } from "@/lib/consent";

export function ConsentBanner() {
  const { tr } = useSiteLanguage();
  const visible = useConsentBannerVisible();
  const { choice, panelOpen } = useConsentState();
  if (!visible) return null;

  const buttonClass = "min-w-24 px-3 py-1.5 text-xs font-semibold uppercase transition-colors";
  return (
    <div
      role="region"
      aria-label={tr("Aviso de cookies", "Cookie notice")}
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl border border-primary/40 bg-slate-950/95 px-4 py-3 text-sm text-slate-100 shadow-2xl backdrop-blur light:bg-white light:text-slate-900"
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2">
          <p>
            {tr(
              "Usamos cookies do Google para medir a audiência (Google Analytics) e para mostrar anúncios personalizados (Google AdSense). Se você recusar, o site funciona igual e os anúncios deixam de ser personalizados.",
              "We use Google cookies to measure traffic (Google Analytics) and to show personalized ads (Google AdSense). If you decline, the site works the same and ads are no longer personalized.",
            )}{" "}
            <Link href="/privacidade" className="text-primary underline underline-offset-2">
              {tr("Política de privacidade", "Privacy policy")}
            </Link>
          </p>
          {panelOpen && choice ? (
            <p className="text-xs text-slate-400">
              {choice.analytics
                ? tr("Sua escolha atual: aceito.", "Your current choice: accepted.")
                : tr("Sua escolha atual: recusado.", "Your current choice: declined.")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`} onClick={() => saveConsent(true)}>
              {tr("Aceitar", "Accept")}
            </button>
            <button type="button" className={`${buttonClass} bg-slate-700 text-white hover:bg-slate-600 light:bg-slate-200 light:text-slate-900`} onClick={() => saveConsent(false)}>
              {tr("Recusar", "Decline")}
            </button>
          </div>
        </div>
        {panelOpen && choice ? (
          <button type="button" aria-label={tr("Fechar", "Close")} className="shrink-0 p-1 text-slate-400 hover:text-white" onClick={closeConsentPreferences}>
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
