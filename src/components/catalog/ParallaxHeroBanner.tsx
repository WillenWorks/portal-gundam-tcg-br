/* Hero banner cinematográfico com leve parallax no scroll -- usado nos topos de
 * /cards e /sets no lugar do painel de título padrão do PublicShell (ver prop
 * `heroBanner`). A imagem já vem com fade inferior embutido (bottom alpha fade);
 * o gradiente CSS por cima garante mesclagem 100% invisível com o fundo da página
 * mesmo que o PNG não tenha o alfa perfeito, e cobre a versão .jpg (sem alfa). */
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface ParallaxHeroBannerProps {
  image: string;
  eyebrow?: string;
  title: string;
  badge?: string;
  className?: string;
}

const PARALLAX_FACTOR = 0.28;

export function ParallaxHeroBanner({ image, eyebrow, title, badge, className }: ParallaxHeroBannerProps) {
  const [offsetY, setOffsetY] = useState(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = media.matches;
    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
      if (event.matches) setOffsetY(0);
    };
    media.addEventListener("change", handleMotionChange);

    if (reducedMotionRef.current) return () => media.removeEventListener("change", handleMotionChange);

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setOffsetY(window.scrollY);
        ticking = false;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      media.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <div className={`panel-cut relative isolate h-[280px] overflow-hidden border border-white/10 sm:h-[340px] lg:h-[400px] ${className ?? ""}`}>
      <div
        className="absolute inset-0 -top-16 bg-cover bg-center will-change-transform"
        style={{ backgroundImage: `url(${image})`, transform: `translateY(${offsetY * PARALLAX_FACTOR}px)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/20 to-[#0b0f19]" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/10 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-end gap-3 p-6 sm:p-8 lg:p-10">
        {eyebrow ? <p className="text-xs uppercase tracking-[0.28em] text-primary font-semibold">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-heading text-4xl uppercase leading-none text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-5xl lg:text-6xl">{title}</h1>
          {badge ? <Badge className="rounded-none border border-primary/40 bg-slate-950/70 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.24em] text-primary backdrop-blur-sm">{badge}</Badge> : null}
        </div>
      </div>
    </div>
  );
}
