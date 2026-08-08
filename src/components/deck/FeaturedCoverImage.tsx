/* Capa do deck montada a partir de até 2 cartas de destaque (a carta inteira, cortada
 * ao meio) — sem processar imagem nenhuma, só CSS. Não temos arte sem moldura/sem
 * "SAMPLE" na base (vem do mesmo dataset usado no catálogo inteiro), então a carta
 * completa é o que dá pra mostrar de forma honesta. */
export function FeaturedCoverImage({ cards, fallbackLabel = "Sem capa", className = "" }: { cards?: Array<{ id: string; name: string; imageUrl: string | null }>; fallbackLabel?: string; className?: string }) {
  const withImage = (cards || []).filter((card) => card.imageUrl).slice(0, 2);

  if (!withImage.length) {
    return <div className={`flex h-full w-full items-center justify-center text-center text-xs uppercase tracking-[0.22em] text-slate-600 ${className}`}>{fallbackLabel}</div>;
  }

  if (withImage.length === 1) {
    return (
      <div className={`h-full w-full overflow-hidden ${className}`}>
        <img src={withImage[0].imageUrl!} alt={withImage[0].name} className="h-full w-full object-cover object-top" />
      </div>
    );
  }

  return (
    <div className={`flex h-full w-full overflow-hidden ${className}`}>
      {withImage.map((card) => (
        <div key={card.id} className="h-full w-1/2 overflow-hidden">
          <img src={card.imageUrl!} alt={card.name} className="h-full w-full object-cover object-top" />
        </div>
      ))}
    </div>
  );
}
