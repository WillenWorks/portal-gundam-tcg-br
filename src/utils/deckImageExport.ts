/* Utilitário de Exportação de Decklist em Imagem (PNG de Alta Resolução)
 * Estilo competitivo Egman/MSA com branding da Anaheim HUB e carimbo tático da OZ.
 * Suporta customização por toggles: apenas deck principal (padrão), estatísticas, selo e metadados. */
import { API_BASE_URL } from "@/lib/api";
import { GAME_COLOR_HEX } from "@/lib/gundam-catalog";

export interface ExportCardEntry {
  code: string;
  name: string;
  quantity: number;
  imageUrl?: string | null;
  imageMediumUrl?: string | null;
  color?: string | null;
  cardType?: string | null;
  cost?: number | null;
  section?: string;
}

export interface ExportDeckOptions {
  deckName: string;
  authorName?: string;
  shareId?: string;
  mainCards: ExportCardEntry[];
  resourceCards?: ExportCardEntry[];
  exCards?: ExportCardEntry[];
  colors?: string[];
  themePrimaryColor?: string;
  includeResourcesAndEx?: boolean; // Padrão: FALSE (salva apenas o deck principal!)
  includeStats?: boolean; // Padrão: FALSE
  includeMetaInfo?: boolean; // Padrão: TRUE
  includeOzSeal?: boolean; // Padrão: TRUE
  statsSummary?: {
    avgCost?: string | number;
    units?: number;
    pilots?: number;
    commands?: number;
    bases?: number;
    costCurve?: Array<{ cost: string | number; count: number }>;
  };
}

const proxiedUrl = (src: string) =>
  src ? `${API_BASE_URL}/image-proxy?url=${encodeURIComponent(src)}` : "";

const loadCardImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = proxiedUrl(src);
  });

function drawOzMilitarySeal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  code: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08); // Leve inclinação militar de carimbo manual

  const sealColor = "rgba(225, 29, 72, 0.85)"; // Tom carmesim militar da OZ
  ctx.strokeStyle = sealColor;
  ctx.fillStyle = sealColor;
  ctx.lineWidth = 3;

  // Círculo externo duplo
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius - 6, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Borda dentada / pontilhada interna
  ctx.beginPath();
  ctx.arc(0, 0, radius - 11, 0, Math.PI * 2);
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Estrelas e textos táticos
  ctx.font = "bold 10px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText("★ OZ TACTICAL ARSENAL ★", 0, -radius + 24);

  // Faixa central
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius + 15, -12);
  ctx.lineTo(radius - 15, -12);
  ctx.stroke();

  ctx.font = "900 13px 'Trebuchet MS', sans-serif";
  ctx.fillText("SPECIFICATION APPROVED", 0, 1);

  ctx.beginPath();
  ctx.moveTo(-radius + 15, 14);
  ctx.lineTo(radius - 15, 14);
  ctx.stroke();

  ctx.font = "bold 9px 'Courier New', monospace";
  ctx.fillText("MOBILE SUIT DECK REGISTRY", 0, radius - 28);
  ctx.fillText(`SN: ${code.slice(0, 12).toUpperCase()}`, 0, radius - 16);

  ctx.restore();
}

function drawAnaheimLogo(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);

  // Ícone Anaheim A.H.
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(18, 18, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#090d16";
  ctx.font = "900 15px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AH", 18, 18);

  // Texto Anaheim HUB
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 20px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("ANAHEIM HUB", 44, 18);

  ctx.restore();
}

export async function generateDeckImageBlob(options: ExportDeckOptions): Promise<Blob> {
  const {
    deckName,
    authorName = "Piloto da OZ",
    shareId = "OZ-SPEC",
    mainCards,
    resourceCards = [],
    exCards = [],
    colors = [],
    themePrimaryColor = "#3b82f6",
    includeResourcesAndEx = false, // Padrão: apenas deck principal!
    includeStats = false,
    includeMetaInfo = true,
    includeOzSeal = true,
    statsSummary,
  } = options;

  // Carrega as imagens
  const cardsToLoad = [
    ...mainCards,
    ...(includeResourcesAndEx ? resourceCards : []),
    ...(includeResourcesAndEx ? exCards : []),
  ];

  const loadedImages = await Promise.all(
    cardsToLoad.map(async (c) => {
      const src = c.imageUrl || c.imageMediumUrl;
      const img = src ? await loadCardImage(src) : null;
      return { card: c, img };
    })
  );

  const mainImages = loadedImages.slice(0, mainCards.length);
  const resourceImages = includeResourcesAndEx
    ? loadedImages.slice(mainCards.length, mainCards.length + resourceCards.length)
    : [];
  const exImages = includeResourcesAndEx
    ? loadedImages.slice(mainCards.length + resourceCards.length)
    : [];

  // Dimensões da grade
  const COLS = 10;
  const CARD_W = 140;
  const CARD_H = 195;
  const GAP = 12;
  const MARGIN = 40;
  const HEADER_H = 120;
  const SECTION_LABEL_H = 34;
  const SECTION_GAP = 28;
  const STATS_BAR_H = includeStats ? 90 : 0;
  const FOOTER_H = 110;

  const totalWidth = MARGIN * 2 + COLS * CARD_W + (COLS - 1) * GAP;

  const calcRows = (count: number) => (count > 0 ? Math.ceil(count / COLS) : 0);

  let contentHeight = HEADER_H;
  if (mainImages.length > 0) {
    contentHeight += SECTION_LABEL_H + calcRows(mainImages.length) * (CARD_H + GAP) + SECTION_GAP;
  }
  if (includeResourcesAndEx && resourceImages.length > 0) {
    contentHeight += SECTION_LABEL_H + calcRows(resourceImages.length) * (CARD_H + GAP) + SECTION_GAP;
  }
  if (includeResourcesAndEx && exImages.length > 0) {
    contentHeight += SECTION_LABEL_H + calcRows(exImages.length) * (CARD_H + GAP) + SECTION_GAP;
  }
  contentHeight += STATS_BAR_H + FOOTER_H + MARGIN;

  const canvas = document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = contentHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Falha ao inicializar contexto 2D do Canvas.");

  // Fundo com gradiente industrial escuro
  const bgGrad = ctx.createLinearGradient(0, 0, 0, contentHeight);
  bgGrad.addColorStop(0, "#080c14");
  bgGrad.addColorStop(0.5, "#0b121e");
  bgGrad.addColorStop(1, "#06090f");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, totalWidth, contentHeight);

  // Grade tática em wireframe sutil
  ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
  ctx.lineWidth = 1;
  for (let x = 0; x < totalWidth; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, contentHeight);
    ctx.stroke();
  }
  for (let y = 0; y < contentHeight; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(totalWidth, y);
    ctx.stroke();
  }

  // === CABEÇALHO ===
  drawAnaheimLogo(ctx, MARGIN, MARGIN);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 28px 'Trebuchet MS', sans-serif";
  ctx.fillText((deckName || "NOVO DECK").toUpperCase(), MARGIN, MARGIN + 44);

  if (includeMetaInfo) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 13px sans-serif";
    ctx.fillText(`PILOTO: ${authorName.toUpperCase()} · FORMATO CONSTRUÍDO`, MARGIN, MARGIN + 80);
  }

  // Contagem de cartas e esferas no topo direito
  const totalMainCount = mainCards.reduce((acc, c) => acc + (c.quantity || 1), 0);
  const totalResCount = resourceCards.reduce((acc, c) => acc + (c.quantity || 1), 0);

  ctx.textAlign = "right";
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 14px monospace";
  ctx.fillText(
    includeResourcesAndEx
      ? `${totalMainCount} CARTAS · ${totalResCount} RECURSOS`
      : `${totalMainCount} CARTAS (DECK PRINCIPAL)`,
    totalWidth - MARGIN,
    MARGIN + 48
  );

  // Esferas coloridas
  if (colors.length > 0) {
    let sphereX = totalWidth - MARGIN - 10;
    for (let i = colors.length - 1; i >= 0; i--) {
      const col = colors[i];
      const hex = GAME_COLOR_HEX[col] || "#64748b";
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.arc(sphereX, MARGIN + 22, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      sphereX -= 24;
    }
  }

  // Linha divisória do cabeçalho
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, MARGIN + HEADER_H - 10);
  ctx.lineTo(totalWidth - MARGIN, MARGIN + HEADER_H - 10);
  ctx.stroke();

  // === RENDERIZADOR DE GRADE DE CARTAS ===
  let cursorY = MARGIN + HEADER_H;

  const renderSection = (
    title: string,
    items: { card: ExportCardEntry; img: HTMLImageElement | null }[],
    badgeCount: number
  ) => {
    if (items.length === 0) return;

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#38bdf8";
    ctx.font = "900 13px 'Trebuchet MS', sans-serif";
    ctx.fillText(`${title.toUpperCase()} [${badgeCount}]`, MARGIN, cursorY);

    const gridTop = cursorY + SECTION_LABEL_H;

    items.forEach((entry, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = MARGIN + col * (CARD_W + GAP);
      const y = gridTop + row * (CARD_H + GAP);

      ctx.fillStyle = "#111827";
      ctx.fillRect(x, y, CARD_W, CARD_H);

      if (entry.img) {
        ctx.drawImage(entry.img, x, y, CARD_W, CARD_H);
      } else {
        const cardColHex = entry.card.color ? GAME_COLOR_HEX[entry.card.color] : "#334155";
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(x, y, CARD_W, CARD_H);
        ctx.strokeStyle = cardColHex || "#475569";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, CARD_W - 4, CARD_H - 4);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(entry.card.code, x + CARD_W / 2, y + CARD_H / 2 - 10);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
        const shortName = (entry.card.name || "").slice(0, 18);
        ctx.fillText(shortName, x + CARD_W / 2, y + CARD_H / 2 + 10);
      }

      // Badge de Quantidade
      const qty = entry.card.quantity || 1;
      const badgeW = 28;
      const badgeH = 24;
      const bx = x + CARD_W - badgeW - 4;
      const by = y + 4;

      ctx.fillStyle = "rgba(11, 18, 32, 0.92)";
      ctx.fillRect(bx, by, badgeW, badgeH);
      ctx.strokeStyle = themePrimaryColor || "#3b82f6";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, badgeW, badgeH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${qty}x`, bx + badgeW / 2, by + badgeH / 2);
    });

    const rows = calcRows(items.length);
    cursorY = gridTop + rows * (CARD_H + GAP) + SECTION_GAP;
  };

  renderSection("Deck Principal", mainImages, totalMainCount);

  if (includeResourcesAndEx && resourceImages.length > 0) {
    renderSection("Deck de Recursos", resourceImages, totalResCount);
  }

  if (includeResourcesAndEx && exImages.length > 0) {
    const totalExCount = exCards.reduce((acc, c) => acc + (c.quantity || 1), 0);
    renderSection("Componentes EX", exImages, totalExCount);
  }

  // === BARRA DE ESTATÍSTICAS (OPCIONAL) ===
  if (includeStats && statsSummary) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(MARGIN, cursorY, totalWidth - MARGIN * 2, STATS_BAR_H - 15);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(MARGIN, cursorY, totalWidth - MARGIN * 2, STATS_BAR_H - 15);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 12px monospace";
    ctx.fillText("TELEMETRIA OPERACIONAL DO ARSENAL", MARGIN + 20, cursorY + 22);

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    const compText = `CUSTO MÉDIO: ${statsSummary.avgCost || "2.8"} · UNIDADES: ${statsSummary.units || 0} · PILOTOS: ${statsSummary.pilots || 0} · COMANDOS: ${statsSummary.commands || 0} · BASES: ${statsSummary.bases || 0}`;
    ctx.fillText(compText, MARGIN + 20, cursorY + 48);

    cursorY += STATS_BAR_H;
  }

  // === RODAPÉ ===
  const footerY = cursorY + 10;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, footerY);
  ctx.lineTo(totalWidth - MARGIN, footerY);
  ctx.stroke();

  if (includeMetaInfo) {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 11px monospace";
    ctx.fillText("PORTAL GUNDAM TCG BRASIL · HANGAR DE CRIAÇÃO DA OZ", MARGIN, footerY + 24);
    ctx.fillText(
      `COMPARTILHAMENTO: #${shareId} · GERADO EM ${new Date().toLocaleDateString("pt-BR")}`,
      MARGIN,
      footerY + 42
    );
    ctx.fillStyle = "#475569";
    ctx.font = "10px sans-serif";
    ctx.fillText(
      "Este documento constitui especificação técnica e estratégica de Mobile Suit para ambiente competitivo.",
      MARGIN,
      footerY + 62
    );
  }

  // Carimbo Militar Tático da OZ
  if (includeOzSeal) {
    drawOzMilitarySeal(ctx, totalWidth - MARGIN - 75, footerY + 55, 52, shareId);
  }

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Falha ao sintetizar PNG do deck.");
  return blob;
}

export async function downloadDeckImage(options: ExportDeckOptions): Promise<void> {
  const blob = await generateDeckImageBlob(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const sanitizedName = (options.deckName || "deck")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  a.href = url;
  a.download = `${sanitizedName}-oz-hangar.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
