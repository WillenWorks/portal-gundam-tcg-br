/* docs/19, Sessão 3 — a "cara" de uma carta (arte real com fallback
 * tipográfico) e o verso genérico. Usados por todos os componentes de
 * tabuleiro e pelos modais. */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { artSrc, CARD_FACE_WIDTH, type ArtLookup, type CardFaceSize } from "./cardArt";

interface CardFaceProps {
  nameEn: string;
  code: string;
  art: ArtLookup;
  size?: CardFaceSize;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  dimmed?: boolean;
}

export function CardFace({ nameEn, code, art, size = "md", className, style, children, dimmed }: CardFaceProps) {
  const src = artSrc(art, code, size);
  return (
    <div className={cn("relative shrink-0 overflow-hidden", CARD_FACE_WIDTH[size], className)} style={style}>
      <div className={cn("aspect-[63/88] w-full bg-black/50", dimmed && "grayscale")}>
        {src ? (
          <img src={src} alt={nameEn} loading="lazy" className={cn("h-full w-full object-cover", dimmed && "opacity-45")} />
        ) : (
          <div
            className={cn(
              "flex h-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-slate-800 via-slate-900 to-black px-1 text-center",
              dimmed && "opacity-45",
            )}
          >
            <p className="text-[8px] font-semibold uppercase leading-tight tracking-wide text-slate-300">{nameEn}</p>
            <p className="text-[7px] text-slate-500">{code}</p>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function CardBack({ size = "sm", className, label }: { size?: CardFaceSize; className?: string; label?: string }) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden", CARD_FACE_WIDTH[size], className)}>
      <div className="flex aspect-[63/88] w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black">
        <div className="size-1/2 rounded-full border border-primary/20 bg-primary/5" />
      </div>
      {label ? (
        <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[8px] font-bold text-slate-300">{label}</span>
      ) : null}
    </div>
  );
}
