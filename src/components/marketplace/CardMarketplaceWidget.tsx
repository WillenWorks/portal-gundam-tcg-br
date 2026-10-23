import { ExternalLink, ShoppingBag, Tag, TrendingDown } from "lucide-react";
import { getCardMarketLinks } from "@/lib/marketplace";
import { useSiteLanguage } from "@/i18n/siteLanguage";

interface CardMarketplaceWidgetProps {
  card: {
    code?: string | null;
    namePt?: string | null;
    nameEn?: string | null;
    setName?: string | null;
  };
  compact?: boolean;
}

export function CardMarketplaceWidget({ card, compact = false }: CardMarketplaceWidgetProps) {
  const { tr } = useSiteLanguage();
  const links = getCardMarketLinks(card);

  return (
    <div className="relative overflow-hidden border dark:border-white/10 dark:bg-slate-900/50 light:border-slate-300 light:bg-white p-4 sm:p-5 backdrop-blur-sm">
      {/* Cabeçalho do Bloco Comercial */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b dark:border-white/10 light:border-slate-200 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded bg-primary/10 text-primary border border-primary/30">
            <ShoppingBag className="size-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] dark:text-white light:text-slate-900 flex items-center gap-1.5">
              {tr("Mercado & Onde Comprar", "Market & Where to Buy")}
              <span className="text-[10px] font-mono font-normal text-slate-400">({card.code || tr("Avulsa", "Singles")})</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {tr("Compare preços e disponibilidade em marketplaces de TCG", "Compare prices and availability across TCG marketplaces")}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-xs">
          <TrendingDown className="size-3" /> {tr("Compare preços", "Compare prices")}
        </span>
      </div>

      {/* Grade de Botões de Lojas / Plataformas */}
      <div className={`grid gap-2.5 ${compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}>
        {/* Liga Gundam (LigaMagic) */}
        <a
          href={links.ligaGundamUrl}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="group flex flex-col justify-between border dark:border-white/10 light:border-slate-300 dark:bg-slate-950/70 light:bg-slate-50 p-3 transition hover:border-emerald-500/60 hover:bg-emerald-500/[0.04]"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300 flex items-center gap-1">
              Liga Gundam
            </span>
            <ExternalLink className="size-3 text-slate-400 group-hover:text-emerald-400 transition-colors" />
          </div>
          <p className="text-[10px] text-slate-400 line-clamp-1">
            {tr("Comparar menor preço na rede", "Compare lowest price")}
          </p>
        </a>

        {/* MyPcards */}
        <a
          href={links.myPcardsUrl}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="group flex flex-col justify-between border dark:border-white/10 light:border-slate-300 dark:bg-slate-950/70 light:bg-slate-50 p-3 transition hover:border-purple-500/60 hover:bg-purple-500/[0.04]"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-purple-400 group-hover:text-purple-300 flex items-center gap-1">
              MyPcards
            </span>
            <ExternalLink className="size-3 text-slate-400 group-hover:text-purple-400 transition-colors" />
          </div>
          <p className="text-[10px] text-slate-400 line-clamp-1">
            {tr("Buscar anúncios de jogadores", "Browse player listings")}
          </p>
        </a>

        {/* Mercado Livre */}
        <a
          href={links.mercadoLivreUrl}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="group flex flex-col justify-between border dark:border-white/10 light:border-slate-300 dark:bg-slate-950/70 light:bg-slate-50 p-3 transition hover:border-amber-400/60 hover:bg-amber-400/[0.04]"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-amber-400 group-hover:text-amber-300 flex items-center gap-1">
              Mercado Livre
            </span>
            <ExternalLink className="size-3 text-slate-400 group-hover:text-amber-400 transition-colors" />
          </div>
          <p className="text-[10px] text-slate-400 line-clamp-1">
            {tr("Avulsas e produtos selados", "Singles and sealed products")}
          </p>
        </a>

        {/* Amazon Brasil */}
        <a
          href={links.amazonUrl}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="group flex flex-col justify-between border dark:border-white/10 light:border-slate-300 dark:bg-slate-950/70 light:bg-slate-50 p-3 transition hover:border-sky-400/60 hover:bg-sky-400/[0.04]"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300 flex items-center gap-1">
              Amazon Brasil
            </span>
            <ExternalLink className="size-3 text-slate-400 group-hover:text-sky-400 transition-colors" />
          </div>
          <p className="text-[10px] text-slate-400 line-clamp-1">
            {tr("Starters, boxes e protetores", "Starters, boxes and sleeves")}
          </p>
        </a>
      </div>

      {/* Nota de Isenção / Transparência */}
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t dark:border-white/5 light:border-slate-200">
        <span className="flex items-center gap-1">
          <Tag className="size-3" />
          {tr("Links de parceiros oficiais e marketplaces de TCG.", "Official partners and TCG marketplace links.")}
        </span>
        <span className="hidden sm:inline">
          {tr("Preços e disponibilidade definidos pelos lojistas.", "Prices and availability set by sellers.")}
        </span>
      </div>
    </div>
  );
}
