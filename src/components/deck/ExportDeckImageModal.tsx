/* Modal de Exportação de Imagem com Prévia Reativa e Customização (Exburst style)
 * Permite ativar/desativar seções antes de baixar o PNG final. Por padrão, salva apenas o deck principal. */
import { useEffect, useState } from "react";
import { Check, Download, Eye, Layers, Shield, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  generateDeckImageBlob,
  type ExportCardEntry,
  type ExportDeckOptions,
} from "@/utils/deckImageExport";

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
  statsSummary?: ExportDeckOptions["statsSummary"];
}

export function ExportDeckImageModal({
  open,
  onClose,
  deckName,
  authorName = "Piloto da OZ",
  shareId = "OZ-SPEC",
  mainCards,
  resourceCards = [],
  exCards = [],
  colors = [],
  statsSummary,
}: ExportDeckImageModalProps) {
  // Configurações e Toggles (Por padrão, apenas o deck principal!)
  const [includeResourcesAndEx, setIncludeResourcesAndEx] = useState(false);
  const [includeStats, setIncludeStats] = useState(false);
  const [includeMetaInfo, setIncludeMetaInfo] = useState(true);
  const [includeOzSeal, setIncludeOzSeal] = useState(true);

  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Gera a imagem sempre que as opções mudarem
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    setGenerating(true);

    const themePrimaryColor =
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#3b82f6";

    generateDeckImageBlob({
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
    })
      .then((blob) => {
        if (!isMounted) return;
        setPreviewBlob(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      })
      .catch((err) => {
        console.error("Erro ao sintetizar prévia da imagem:", err);
        toast.error("Erro ao sintetizar prévia.");
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
  ]);

  const handleDownload = () => {
    if (!previewBlob) return;
    const url = URL.createObjectURL(previewBlob);
    const a = document.createElement("a");
    const sanitizedName = (deckName || "deck")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    a.href = url;
    a.download = `${sanitizedName}-oz-arsenal.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Imagem do deck baixada com sucesso!");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-none border border-primary/40 bg-slate-950 text-white p-6">
        <DialogHeader className="border-b border-white/10 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-heading text-2xl uppercase tracking-wider text-white flex items-center gap-2">
                <Eye className="size-5 text-primary" /> Pré-Visualização da Imagem
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-1">
                Ajuste as opções visuais antes de salvar. Por padrão, a imagem renderiza estritamente as 50 cartas do deck principal.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* BARRA DE TOGGLES / OPÇÕES (Exburst style) */}
        <div className="py-3 border-b border-white/10">
          <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-2">
            Configurações de Exportação:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Toggle Recursos & EX */}
            <button
              type="button"
              onClick={() => setIncludeResourcesAndEx(!includeResourcesAndEx)}
              className={`p-2.5 border text-left flex items-center justify-between transition-all ${
                includeResourcesAndEx
                  ? "border-primary bg-primary/20 text-white"
                  : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30"
              }`}
            >
              <div>
                <p className="text-xs font-heading uppercase">Recursos & EX</p>
                <p className="text-[9px] text-slate-400">
                  {includeResourcesAndEx ? "Incluídos" : "Apenas deck principal"}
                </p>
              </div>
              <div
                className={`size-4 border flex items-center justify-center ${
                  includeResourcesAndEx ? "border-primary bg-primary text-black" : "border-white/20"
                }`}
              >
                {includeResourcesAndEx && <Check className="size-3" />}
              </div>
            </button>

            {/* Toggle Estatísticas */}
            <button
              type="button"
              onClick={() => setIncludeStats(!includeStats)}
              className={`p-2.5 border text-left flex items-center justify-between transition-all ${
                includeStats
                  ? "border-sky-500 bg-sky-950/40 text-white"
                  : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30"
              }`}
            >
              <div>
                <p className="text-xs font-heading uppercase">Estatísticas</p>
                <p className="text-[9px] text-slate-400">
                  {includeStats ? "Barra ativa" : "Sem estatísticas"}
                </p>
              </div>
              <div
                className={`size-4 border flex items-center justify-center ${
                  includeStats ? "border-sky-500 bg-sky-500 text-black" : "border-white/20"
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
                <p className="text-xs font-heading uppercase">Dados do Piloto</p>
                <p className="text-[9px] text-slate-400">
                  {includeMetaInfo ? "Autor e data visíveis" : "Ocultos"}
                </p>
              </div>
              <div
                className={`size-4 border flex items-center justify-center ${
                  includeMetaInfo ? "border-emerald-500 bg-emerald-500 text-black" : "border-white/20"
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
                <p className="text-xs font-heading uppercase">Selo Militar OZ</p>
                <p className="text-[9px] text-slate-400">
                  {includeOzSeal ? "Carimbo ativo" : "Sem carimbo"}
                </p>
              </div>
              <div
                className={`size-4 border flex items-center justify-center ${
                  includeOzSeal ? "border-rose-500 bg-rose-500 text-black" : "border-white/20"
                }`}
              >
                {includeOzSeal && <Check className="size-3" />}
              </div>
            </button>
          </div>
        </div>

        {/* ÁREA DE PRÉ-VISUALIZAÇÃO DA IMAGEM */}
        <div className="relative min-h-[300px] max-h-[55vh] overflow-auto border border-white/10 bg-slate-950/90 flex items-center justify-center p-2">
          {generating ? (
            <div className="flex flex-col items-center gap-2 py-16">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-xs font-mono text-slate-400">Sintetizando imagem do Arsenal...</p>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Pré-visualização do Deck"
              className="max-w-full h-auto object-contain border border-white/5 shadow-2xl"
            />
          ) : (
            <p className="text-xs text-slate-500">Nenhuma prévia disponível.</p>
          )}
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-none border-white/20 hover:bg-white/10"
          >
            Cancelar
          </Button>
          <Button
            disabled={generating || !previewBlob}
            onClick={handleDownload}
            className="rounded-none bg-primary text-primary-foreground font-heading uppercase tracking-wider hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            <Download className="mr-2 size-4" /> Baixar Imagem PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
