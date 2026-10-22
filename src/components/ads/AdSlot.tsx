import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { useSiteLanguage } from "@/i18n/siteLanguage";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSlotProps {
  /** ID do bloco de anúncio no Google AdSense (ex: '1234567890') */
  slotId?: string;
  /** ID do cliente AdSense (caso não informado, usa import.meta.env.VITE_ADSENSE_CLIENT_ID) */
  clientId?: string;
  /** Formato do anúncio: leaderboard (728x90), rectangle (300x250), banner (320x100) ou responsive */
  format?: "leaderboard" | "rectangle" | "banner" | "responsive";
  /** Identificador para Carbon Ads (opcional) */
  carbonPlacement?: string;
  className?: string;
}

const DEFAULT_ADSENSE_CLIENT =
  (import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined) || "ca-pub-4516039090052126";

export function AdSlot({
  slotId,
  clientId = DEFAULT_ADSENSE_CLIENT,
  format = "responsive",
  carbonPlacement,
  className = "",
}: AdSlotProps) {
  const { tr } = useSiteLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  // Dimensões com reserva de espaço rígida para evitar Layout Shift (CLS)
  const formatClasses = {
    leaderboard: "min-h-[90px] max-w-[728px] mx-auto",
    rectangle: "min-h-[250px] max-w-[300px] mx-auto",
    banner: "min-h-[100px] max-w-[468px] mx-auto",
    responsive: "min-h-[100px] w-full",
  }[format];

  const isConfigured = Boolean(clientId && slotId) || Boolean(carbonPlacement);

  useEffect(() => {
    if (!isConfigured || !containerRef.current || adLoaded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();

          // 1. Caso seja Google AdSense
          if (clientId && slotId) {
            try {
              // Garante script global do AdSense carregado de forma assíncrona
              const scriptId = "google-adsense-script";
              if (
                !document.getElementById(scriptId) &&
                !document.querySelector('script[src*="adsbygoogle.js"]')
              ) {
                const script = document.createElement("script");
                script.id = scriptId;
                script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
                script.async = true;
                script.crossOrigin = "anonymous";
                document.head.appendChild(script);
              }

              // Dispara o push do AdSense
              (window.adsbygoogle = window.adsbygoogle || []).push({});
              setAdLoaded(true);
            } catch (err) {
              console.warn("AdSense push failed:", err);
              setAdError(true);
            }
          }

          // 2. Caso seja Carbon Ads
          if (carbonPlacement && containerRef.current) {
            try {
              const script = document.createElement("script");
              script.id = "_carbonads_js";
              script.src = `//cdn.carbonads.com/carbon.js?serve=${encodeURIComponent(carbonPlacement)}&placement=anaheimhub`;
              script.async = true;
              containerRef.current.appendChild(script);
              setAdLoaded(true);
            } catch (err) {
              console.warn("Carbon ads injection failed:", err);
              setAdError(true);
            }
          }
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [clientId, slotId, carbonPlacement, isConfigured, adLoaded]);

  return (
    <aside
      ref={containerRef}
      aria-label={tr("Espaço Publicitário", "Advertisement")}
      className={`relative flex flex-col items-center justify-center overflow-hidden border dark:border-white/5 dark:bg-slate-950/60 light:border-slate-200 light:bg-slate-50 p-2 text-center transition-all ${formatClasses} ${className}`}
    >
      {/* Rótulo regulatório sutil */}
      <div className="absolute top-1 right-2 flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-slate-500 select-none">
        <Info className="size-2.5 opacity-50" />
        <span>{tr("Publicidade", "Advertisement")}</span>
      </div>

      {isConfigured && !adError ? (
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format={format === "responsive" ? "auto" : undefined}
          data-full-width-responsive={format === "responsive" ? "true" : undefined}
        />
      ) : (
        /* Placeholder tático quando as chaves de anúncio ainda não foram preenchidas */
        <div className="flex flex-col items-center justify-center py-4 text-slate-500">
          <p className="text-[11px] font-mono uppercase tracking-[0.18em]">
            {tr("Espaço de Patrocínio do Hub", "Hub Sponsorship Space")}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">
            {tr("Google AdSense / Carbon Ads / Parceiros", "Google AdSense / Carbon Ads / Partners")}
          </p>
        </div>
      )}
    </aside>
  );
}
