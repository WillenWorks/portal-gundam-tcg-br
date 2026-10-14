import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowRight, CheckCircle2, Info, Megaphone, ShieldAlert, X } from "lucide-react";
import { api, type PublicSiteConfig } from "@/lib/api";
import { cn } from "@/lib/utils";

const BANNER_STORAGE_KEY = "portal-gundam-tcg-br:dismissed-announcement";

export function SiteAnnouncementBanner() {
  const [config, setConfig] = useState<PublicSiteConfig["announcement"] | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .getPublicSiteConfig()
      .then((res) => {
        if (!mounted) return;
        if (res?.announcement?.active && res.announcement.message) {
          const stored = sessionStorage.getItem(BANNER_STORAGE_KEY);
          if (stored !== res.announcement.message) {
            setConfig(res.announcement);
            setDismissed(false);
          }
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  if (!config || dismissed || !config.active || !config.message) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (config?.message) {
      sessionStorage.setItem(BANNER_STORAGE_KEY, config.message);
    }
  };

  const typeStyles = {
    INFO: {
      bar: "border-primary/40 bg-slate-950/95 text-white shadow-[0_0_20px_rgba(56,189,248,0.15)]",
      badge: "border-primary/50 bg-primary/20 text-primary",
      icon: <Info className="size-4 text-primary shrink-0" />,
      dot: "bg-primary shadow-[0_0_8px_rgba(56,189,248,0.8)]",
    },
    WARNING: {
      bar: "border-amber-500/40 bg-slate-950/95 text-white shadow-[0_0_20px_rgba(245,158,11,0.15)]",
      badge: "border-amber-500/50 bg-amber-500/20 text-amber-400",
      icon: <AlertCircle className="size-4 text-amber-400 shrink-0" />,
      dot: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]",
    },
    SUCCESS: {
      bar: "border-emerald-500/40 bg-slate-950/95 text-white shadow-[0_0_20px_rgba(16,185,129,0.15)]",
      badge: "border-emerald-500/50 bg-emerald-500/20 text-emerald-400",
      icon: <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />,
      dot: "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
    },
    URGENT: {
      bar: "border-red-500/50 bg-slate-950/95 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]",
      badge: "border-red-500/60 bg-red-500/25 text-red-400",
      icon: <ShieldAlert className="size-4 text-red-400 shrink-0" />,
      dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-ping",
    },
  }[config.type || "INFO"];

  return (
    <div
      role="region"
      aria-label="Aviso do Portal"
      className={cn(
        "relative z-50 border-b px-4 py-2.5 text-xs transition-all backdrop-blur-md",
        typeStyles.bar
      )}
    >
      <div className="mx-auto flex w-full max-w-[2400px] items-center justify-between gap-3 sm:gap-4 px-2 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <span className="relative flex size-2 shrink-0">
            <span className={cn("absolute inline-flex size-full rounded-full opacity-75", typeStyles.dot)} />
            <span className={cn("relative inline-flex size-2 rounded-full", typeStyles.dot)} />
          </span>

          <span className={cn("hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border rounded-none", typeStyles.badge)}>
            {typeStyles.icon}
            <span>Aviso do Portal</span>
          </span>

          <p className="min-w-0 flex-1 truncate font-medium text-slate-100 sm:text-xs">
            {config.message}
          </p>

          {config.link ? (
            <Link
              href={config.link}
              className="inline-flex shrink-0 items-center gap-1 font-semibold uppercase tracking-wider text-primary hover:text-white transition-colors underline-offset-4 hover:underline text-[11px]"
            >
              <span>{config.linkText || "Saiba mais"}</span>
              <ArrowRight className="size-3" />
            </Link>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-1 text-slate-400 hover:text-white transition-colors"
          title="Fechar aviso"
          aria-label="Fechar aviso"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
