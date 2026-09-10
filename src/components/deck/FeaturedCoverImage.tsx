/* Capa do deck vertical v9.0 — orientada para proporções de carta de TCG (portrait),
 * exibindo a arte dos Mobile Suits e Pilotos com dignidade e foco nas ilustrações. */
import React from "react";

const ART_PORTRAIT_STYLE: React.CSSProperties = {
  backgroundSize: "cover",
  backgroundPosition: "center 15%",
  backgroundRepeat: "no-repeat",
};

export function FeaturedCoverImage({
  cards,
  fallbackLabel = "Sem capa",
  className = "",
}: {
  cards?: Array<{ id: string; name: string; imageUrl: string | null }>;
  fallbackLabel?: string;
  className?: string;
}) {
  const withImage = (cards || []).filter((card) => card.imageUrl).slice(0, 2);

  if (!withImage.length) {
    return (
      <div className={`flex h-full w-full items-center justify-center text-center text-xs uppercase tracking-[0.22em] text-slate-500 ${className}`}>
        {fallbackLabel}
      </div>
    );
  }

  if (withImage.length === 1) {
    return (
      <div
        role="img"
        aria-label={withImage[0].name}
        className={`relative h-full w-full overflow-hidden ${className}`}
        style={{ ...ART_PORTRAIT_STYLE, backgroundImage: `url(${withImage[0].imageUrl})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
      </div>
    );
  }

  return (
    <div className={`relative flex h-full w-full overflow-hidden ${className}`}>
      {withImage.map((card, idx) => (
        <div
          key={card.id}
          role="img"
          aria-label={card.name}
          className={`relative h-full w-1/2 ${idx === 0 ? "border-r border-white/10" : ""}`}
          style={{ ...ART_PORTRAIT_STYLE, backgroundImage: `url(${card.imageUrl})` }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}
