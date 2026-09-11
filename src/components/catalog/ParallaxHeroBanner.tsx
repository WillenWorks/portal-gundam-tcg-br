/* Banner Hero com efeito Parallax suave e transição gradiente para o background da página. */
import { useEffect, useRef, useState, type ReactNode } from "react";

interface ParallaxHeroBannerProps {
  imageSrc?: string;
  image?: string;
  imageAlt?: string;
  title: string;
  badgeText?: string;
  eyebrow?: string;
  badge?: string;
  telemetryCount?: number | string;
  telemetryLabel?: string;
  children?: ReactNode;
  heightClass?: string;
}

export function ParallaxHeroBanner({
  imageSrc,
  image,
  imageAlt = "Banner de fundo",
  title,
  badgeText,
  eyebrow,
  badge,
  telemetryCount,
  telemetryLabel = "indexadas",
  children,
  heightClass = "min-h-[220px] md:min-h-[280px] lg:min-h-[320px]",
}: ParallaxHeroBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);

  const finalImage = imageSrc || image || "/images/unicorn_blueprint_banner.png";
  const finalBadge = badgeText || eyebrow;
  const finalCount = telemetryCount !== undefined ? telemetryCount : badge;

  useEffect(() => {
    let animationFrameId: number;

    const handleScroll = () => {
      animationFrameId = window.requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
          const scrollDistance = -rect.top;
          setOffsetY(scrollDistance * 0.22);
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden border border-white/10 bg-slate-950 ${heightClass} flex flex-col justify-end p-6 md:p-8 lg:p-10 shadow-2xl`}
    >
      {/* Imagem de Fundo com Parallax e escala suave */}
      <div
        className="pointer-events-none absolute -inset-x-0 -top-16 -bottom-16 w-full h-[calc(100%+128px)] transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate3d(0, ${offsetY}px, 0) scale(1.05)`,
        }}
      >
        <img
          src={finalImage}
          alt={imageAlt}
          className="h-full w-full object-cover object-center opacity-90 brightness-[0.95] contrast-[1.05]"
        />
      </div>

      {/* Gradientes de mesclagem para fundir com o fundo (#0b0f19 / slate-950) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/60 to-transparent opacity-95" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0f19]/90 via-[#0b0f19]/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-grid-tech opacity-15" />

      {/* Linha técnica decorativa superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Conteúdo do Banner */}
      <div className="relative z-10 max-w-5xl">
        <div className="flex flex-wrap items-center gap-3">
          {finalBadge ? (
            <span className="inline-flex items-center gap-1.5 border border-primary/50 bg-primary/15 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              {finalBadge}
            </span>
          ) : null}

          {finalCount !== undefined ? (
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400 bg-black/40 px-2.5 py-1 border border-white/10 backdrop-blur-sm">
              <strong className="text-white font-bold">{finalCount}</strong> {typeof finalCount === "number" ? telemetryLabel : ""}
            </span>
          ) : null}
        </div>

        <h1 className="mt-3 font-heading text-4xl sm:text-5xl lg:text-6xl uppercase tracking-wider text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
          {title}
        </h1>

        {children ? <div className="mt-4">{children}</div> : null}
      </div>

      {/* Indicador de Telemetria no canto inferior direito */}
      <div className="pointer-events-none absolute bottom-3 right-4 hidden md:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500/80">
        <span>SYSTEM // ARCHIVE HUD</span>
        <span className="h-2 w-px bg-white/20" />
        <span className="text-emerald-400/90">ONLINE</span>
      </div>
    </div>
  );
}
