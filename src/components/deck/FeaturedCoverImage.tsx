/* Capa do deck montada a partir de até 2 cartas de destaque (a carta inteira, cortada
 * ao meio) — sem processar imagem nenhuma, só CSS. Não temos arte sem moldura/sem
 * "SAMPLE" na base (vem do mesmo dataset usado no catálogo inteiro), então a carta
 * completa é o que dá pra mostrar de forma honesta.
 *
 * Usa background-image (não <img> + object-fit) porque dá controle independente de
 * zoom (background-size) e foco (background-position) — isso permite aproximar um
 * "recorte da área de arte", evitando o badge de custo/nível (canto superior esquerdo)
 * e o rodapé de nome/efeito. É uma aproximação por CSS, não um recorte por coordenada
 * real — Unit/Pilot/Command têm proporção de moldura levemente diferente, então não
 * fica cirurgicamente preciso pra carta nenhuma, mas melhora bastante o resultado geral. */
const ART_FOCUS_STYLE: React.CSSProperties = { backgroundSize: "210% auto", backgroundPosition: "70% 8%", backgroundRepeat: "no-repeat" };

export function FeaturedCoverImage({ cards, fallbackLabel = "Sem capa", className = "" }: { cards?: Array<{ id: string; name: string; imageUrl: string | null }>; fallbackLabel?: string; className?: string }) {
  const withImage = (cards || []).filter((card) => card.imageUrl).slice(0, 2);

  if (!withImage.length) {
    return <div className={`flex h-full w-full items-center justify-center text-center text-xs uppercase tracking-[0.22em] text-slate-600 ${className}`}>{fallbackLabel}</div>;
  }

  if (withImage.length === 1) {
    return <div role="img" aria-label={withImage[0].name} className={`h-full w-full ${className}`} style={{ ...ART_FOCUS_STYLE, backgroundImage: `url(${withImage[0].imageUrl})` }} />;
  }

  return (
    <div className={`flex h-full w-full overflow-hidden ${className}`}>
      {withImage.map((card) => (
        <div key={card.id} role="img" aria-label={card.name} className="h-full w-1/2" style={{ ...ART_FOCUS_STYLE, backgroundImage: `url(${card.imageUrl})` }} />
      ))}
    </div>
  );
}
