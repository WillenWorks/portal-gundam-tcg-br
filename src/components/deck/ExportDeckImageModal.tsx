/* Modal de Exportação de Imagem com Prévia Reativa e Geração Dedicada de Imagem de Estatísticas
 * Permite alternar opções (Recursos, Estatísticas, Dados do Piloto, Selo OZ).
 * Quando "Estatísticas" estiver ativado, gera uma 2ª imagem dedicada (Infográfico Tático VEDA). */
import { useEffect, useState } from "react";
import { Check, Download, Eye, BarChart3, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  generateDeckImageBlob,
  generateDeckStatsImageBlob,
  type ExportCardEntry,
  type ExportDeckOptions,
  type ExportStatsData,
} from "@/utils/deckImageExport";
import { useSiteLanguage } from "@/i18n/siteLanguage";

interface ExportDeckImageModalProps {
  open: boolean;
  onClose: () => void;
  deckName: string;
  authorName?: string;
  shareId?: string;
  mainCards: ExportCardEntry[];
  resourceCards?: ExportCardEntry[];
  exCards?: ExportCardEntry[];
  colors?: string[];
  statsSummary?: ExportStatsData;
}

export function ExportDeckImageModal({
  open,
  onClose,
  deckName,
  authorName = "Jogador",
  shareId = "OZ-SPEC",
  mainCards,
  resourceCards = [],
  exCards = [],
  colors = [],
  statsSummary,
}: ExportDeckImageModalProps) {
  const { tr } = useSiteLanguage();
  // Configurações e Toggles (Por padrão: apenas deck principal!)
  const [includeResourcesAndEx, setIncludeResourcesAndEx] = useState(false);
  const [includeStats, setIncludeStats] = useState(false);
  const [includeMetaInfo, setIncludeMetaInfo] = useState(true);
  const [includeOzSeal, setIncludeOzSeal] = useState(true);

  // Aba ativa na prévia quando há estatísticas
  const [activePreviewTab, setActivePreviewTab] = useState<"deck" | "stats">("deck");

  // Blobs das imagens geradas
  const [deckBlob, setDeckBlob] = useState<Blob | null>(null);
  const [deckUrl, setDeckUrl] = useState<string | null>(null);

  const [statsBlob, setStatsBlob] = useState<Blob | null>(null);
  const [statsUrl, setStatsUrl] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);

  // Gera as imagens sempre que as opções mudarem
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    setGenerating(true);

    const themePrimaryColor = "#38bdf8";

    const exportOptions: ExportDeckOptions = {
      deckName,
      authorName,
      shareId,
      mainCards,
      resourceCards,
      exCards,
      colors,
      themePrimaryColor,
      includeResourcesAndEx,
      includeStats,
      includeMetaInfo,
      includeOzSeal,
      statsSummary,
    };

    const taskDeck = generateDeckImageBlob(exportOptions);
    const taskStats = includeStats ? generateDeckStatsImageBlob(exportOptions) : Promise.resolve(null);

    Promise.all([taskDeck, taskStats])
      .then(([blob1, blob2]) => {
        if (!isMounted) return;

        setDeckBlob(blob1);
        setDeckUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob1);
        });

        if (blob2) {
          setStatsBlob(blob2);
          setStatsUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob2);
          });
        } else {
          setStatsBlob(null);
          setStatsUrl(null);
          setActivePreviewTab("deck");
        }
      })
      .catch((err) => {
        console.error("Erro ao sintetizar imagens:", err);
        toast.error(tr("Erro ao sintetizar imagem.", "Couldn't generate the image."));
      })
      .finally(() => {
        if (isMounted) setGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    open,
    deckName,
    authorName,
    shareId,
    mainCards,
    resourceCards,
    exCards,
    colors,
    includeResourcesAndEx,
    includeStats,
    includeMetaInfo,
    includeOzSeal,
    statsSummary,
  ]);

  const sanitizedName = (deckName || "deck")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const downloadBlob = (blob: Blob, suffix: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizedName}-${suffix}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadDeck = () => {
    if (!deckBlob) return;
    downloadBlob(deckBlob, "decklist");
    toast.success(tr("Decklist PNG baixada com sucesso!", "Decklist PNG downloaded!"));
  };

  const handleDownloadStats = () => {
    if (!statsBlob) return;
    downloadBlob(statsBlob, "telemetria-stats");
    toast.success(tr("Infográfico de Estatísticas PNG baixado com sucesso!", "Stats PNG downloaded!"));
  };

  const handleDownloadBoth = () => {
    if (deckBlob) downloadBlob(deckBlob, "decklist");
    if (statsBlob) {
      setTimeout(() => downloadBlob(statsBlob, "telemetria-stats"), 600);
    }
    toast.success(tr("Ambas as imagens foram baixadas!", "Both images downloaded!"));
  };

  const currentPreviewUrl = activePreviewTab === "stats" && statsUrl ? statsUrl : deckUrl;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto rounded-none border border-sky-500/40 bg-slate-950 text-white p-6 shadow-2xl">
        <DialogHeader className="border-b border-white/10 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-sky-400">
                {tr("AnaheimHub · Imagem do deck", "AnaheimHub · Deck image")}
              </p>
              <DialogTitle className="font-heading text-2xl uppercase tracking-wider text-white flex items-center gap-2">
                <Eye className="size-5 text-sky-400" /> {tr("Exportação de Imagem em Alta Resolução", "High-Resolution Image Export")}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-1">
                {tr("Ajuste os parâmetros antes de salvar. Por padrão, a imagem exporta apenas o deck principal com selo oficial.", "Adjust the options before saving. By default the image includes only the main deck with the official seal.")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* BARRA DE TOGGLES / OPÇÕES */}
        <div className="py-3 border-b border-white/10">
          <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-2">
            {tr("Parâmetros de Renderização:", "Render options:")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Toggle Recursos & EX */}
            <button
              type="button"
              onClick={() => setIncludeResourcesAndEx(!includeResourcesAndEx)}
              className={`p-2.5 border text-left flex items-center justify-between transition-all ${
                includeResourcesAndEx
                  ? "border-sky-500 bg-sky-950/40 text-white"
                  : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30"
              }`}
            >
              <div>
                <p className="text-xs font-heading uppercase">{tr("Recursos & EX", "Resources & EX")}</p>
                <p className="text-[9px] text-slate-400">
                  {includeResourcesAndEx ? tr("Incluídos na grade", "Included in the grid") : tr("Apenas deck principal", "Main deck only")}
                </p>
              </div>
              <div
                className={`size-4 border flex items-center justify-center ${
                  includeResourcesAndEx ? "border-sky-500 bg-sky-500 text-slate-950" : "border-white/20"
                }`}
              >
                {includeResourcesAndEx && <Check className="size-3" />}
              </div>
            </button>

            {/* Toggle Estatísticas (Gera Imagem 2 Dedicada) */}
            <button
              type="button"
              onClick={() => {
                const next = !includeStats;
                setIncludeStats(next);
                if (next) setActivePreviewTab("stats");
                else setActivePreviewTab("deck");
              }}
              className={`p-2.5 border text-left flex items-center justify-between transition-all ${
                includeStats
                  ? "border-amber-400 bg-amber-950/40 text-white"
                  : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30"
              }`}
            >
              <div>
                <p className="text-xs font-heading uppercase text-amber-300">{tr("Exportar Estatísticas", "Export Stats")}</p>
                <p className="text-[9px] text-slate-400">
                  {includeStats ? tr("Gera 2ª imagem dedicada", "Creates a 2nd image") : tr("Desativado", "Off")}
                </p>
              </div>
              <div
                className={`size-4 border flex items-center justify-center ${
                  includeStats ? "border-amber-400 bg-amber-400 text-slate-950" : "border-white/20"
                }`}
              >
                {includeStats && <Check className="size-3" />}
              </div>
            </button>

            {/* Toggle Informações */}
            <button
              type="button"
              onClick={() => setIncludeMetaInfo(!includeMetaInfo)}
              className={`p-2.5 border text-left flex items-center justify-between transition-all ${
                includeMetaInfo
                  ? "border-emerald-500 bg-emerald-950/30 text-white"
                  : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30"
              }`}
            >
              <div>
                <p className="text-xs font-heading uppercase">{tr("Dados do Piloto", "Player Info")}</p>
                <p className="text-[9px] text-slate-400">
                  {includeMetaInfo ? tr("Autor e data visíveis", "Author and date shown") : tr("Ocultos", "Hidden")}
                </p>
              </div>
              <div
                className={`size-4 border flex items-center justify-center ${
                  includeMetaInfo ? "border-emerald-500 bg-emerald-500 text-slate-950" : "border-white/20"
                }`}
              >
                {includeMetaInfo && <Check className="size-3" />}
              </div>
            </button>

            {/* Toggle Selo Militar OZ */}
            <button
              type="button"
              onClick={() => setIncludeOzSeal(!includeOzSeal)}
              className={`p-2.5 border text-left flex items-center justify-between transition-all ${
                includeOzSeal
                  ? "border-rose-500 bg-rose-950/40 text-white"
                  : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30"
              }`}
            >
              <div>
                <p className="text-xs font-heading uppercase">{tr("Selo AnaheimHub", "AnaheimHub Seal")}</p>
                <p className="text-[9px] text-slate-400">
                  {includeOzSeal ? tr("Carimbo oficial ativo", "Official seal on") : tr("Sem carimbo", "No seal")}
                </p>
              </div>
              <div
                className={`size-4 border flex items-center justify-center ${
                  includeOzSeal ? "border-rose-500 bg-rose-500 text-slate-950" : "border-white/20"
                }`}
              >
                {includeOzSeal && <Check className="size-3" />}
              </div>
            </button>
          </div>
        </div>

        {/* SELEÇÃO DE ABAS DE PRÉ-VISUALIZAÇÃO (SE ESTATÍSTICAS ESTIVER ATIVO) */}
        {includeStats && (
          <div className="flex items-center gap-2 pt-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setActivePreviewTab("deck")}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-mono uppercase tracking-wider transition ${
                activePreviewTab === "deck"
                  ? "border-sky-400 text-sky-400 font-bold bg-sky-950/30"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <ImageIcon className="size-3.5" />
              <span>{tr("Imagem 1: Decklist Tática", "Image 1: Decklist")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab("stats")}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-mono uppercase tracking-wider transition ${
                activePreviewTab === "stats"
                  ? "border-amber-400 text-amber-400 font-bold bg-amber-950/30"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <BarChart3 className="size-3.5" />
              <span>{tr("Imagem 2: Estatísticas", "Image 2: Stats")}</span>
            </button>
          </div>
        )}

        {/* ÁREA DE PRÉ-VISUALIZAÇÃO DA IMAGEM */}
        <div className="relative min-h-[360px] max-h-[55vh] overflow-auto border border-white/10 bg-slate-950/90 flex items-center justify-center p-3">
          {generating ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <div className="size-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
              <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                {tr("Sintetizando alta resolução na rede Anaheim HUB...", "Generating high-resolution image...")}
              </p>
            </div>
          ) : currentPreviewUrl ? (
            <img loading="lazy" decoding="async"
              src={currentPreviewUrl}
              alt={tr("Pré-visualização", "Preview")}
              className="max-w-full h-auto object-contain border border-white/10 shadow-2xl"
            />
          ) : (
            <p className="text-xs text-slate-500 font-mono">{tr("Nenhuma prévia disponível.", "No preview available.")}</p>
          )}
        </div>

        {/* BOTÕES DE AÇÃO E DOWNLOADS */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-none border-white/20 text-xs hover:bg-white/10 text-slate-300"
          >
            {tr("Fechar", "Close")}
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={generating || !deckBlob}
              onClick={handleDownloadDeck}
              variant="outline"
              className="rounded-none border-sky-500/50 bg-sky-950/30 text-sky-300 text-xs uppercase tracking-wider hover:bg-sky-900/40"
            >
              <Download className="mr-1.5 size-3.5" /> {tr("Baixar Decklist (PNG)", "Download Decklist (PNG)")}
            </Button>

            {includeStats && statsBlob && (
              <Button
                disabled={generating}
                onClick={handleDownloadStats}
                variant="outline"
                className="rounded-none border-amber-500/50 bg-amber-950/30 text-amber-300 text-xs uppercase tracking-wider hover:bg-amber-900/40"
              >
                <Download className="mr-1.5 size-3.5" /> {tr("Baixar Estatísticas (PNG)", "Download Stats (PNG)")}
              </Button>
            )}

            {includeStats && statsBlob && (
              <Button
                disabled={generating || !deckBlob}
                onClick={handleDownloadBoth}
                className="rounded-none bg-sky-500 text-slate-950 font-heading uppercase tracking-wider hover:bg-sky-400 shadow-lg shadow-sky-500/20 text-xs"
              >
                <Download className="mr-1.5 size-3.5" /> {tr("Baixar Ambas as Imagens", "Download Both Images")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
