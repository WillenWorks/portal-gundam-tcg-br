/* Utilitário de Exportação de Decklist em Imagem (PNG de Alta Resolução)
 * Estilo competitivo Egman/MSA com branding proeminente da Anaheim HUB e carimbo tático da OZ.
 * Suporta customização por toggles: apenas deck principal (padrão), selo e metadados.
 * Gera Imagem 1 (Decklist) e Imagem 2 (Relatório de Estatísticas e Telemetria). */
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
  level?: number | null;
  ap?: number | null;
  hp?: number | null;
  section?: string;
}

export interface ExportStatsData {
  avgCost?: string | number;
  avgLevel?: string | number;
  synergyScore?: number;
  turn1Odds?: number;
  turn2Odds?: number;
  units?: number;
  pilots?: number;
  commands?: number;
  bases?: number;
  costCurve?: Array<{ cost: string | number; count: number }>;
  levelCurve?: Array<{ level: string | number; count: number }>;
  colorCounts?: Record<string, number>;
  apRange?: Array<{ label: string; count: number }>;
  hpRange?: Array<{ label: string; count: number }>;
  staplesCount?: number;
  engineCount?: number;
  techsCount?: number;
  commonCount?: number;
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
  includeStats?: boolean; // Padrão: FALSE (quando true, gera a 2ª imagem)
  includeMetaInfo?: boolean; // Padrão: TRUE
  includeOzSeal?: boolean; // Padrão: TRUE
  statsSummary?: ExportStatsData;
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

/** Desenha o Selo Militar Oficial da OZ com o logotipo estilizado da organização */
export function drawOzMilitarySeal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  code: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.06); // Leve inclinação militar de carimbo operacional

  const sealColor = "rgba(225, 29, 72, 0.88)"; // Tom carmesim militar da OZ
  ctx.strokeStyle = sealColor;
  ctx.fillStyle = sealColor;
  ctx.lineWidth = 3.5;

  // Círculo externo duplo
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius - 7, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Borda pontilhada / dentada de autenticação
  ctx.beginPath();
  ctx.arc(0, 0, radius - 13, 0, Math.PI * 2);
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Texto do arco superior
  ctx.font = "bold 9px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("★ FORÇAS ESPECIAIS OZ · ARSENAL ★", 0, -radius + 24);

  // === LOGOTIPO CENTRAL DA OZ (Asas Militares + Monograma O Z) ===
  // Asas / Chevrons táticos
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  // Asa esquerda
  ctx.moveTo(-radius + 20, -6);
  ctx.lineTo(-24, -6);
  ctx.lineTo(-30, 6);
  ctx.lineTo(-radius + 24, 6);
  ctx.stroke();

  // Asa direita
  ctx.beginPath();
  ctx.moveTo(radius - 20, -6);
  ctx.lineTo(24, -6);
  ctx.lineTo(30, 6);
  ctx.lineTo(radius - 24, 6);
  ctx.stroke();

  // Monograma "OZ" em destaque
  ctx.font = "900 24px 'Trebuchet MS', sans-serif";
  ctx.fillText("OZ", 0, -1);

  // Faixa de status
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-radius + 18, 14);
  ctx.lineTo(radius - 18, 14);
  ctx.stroke();

  ctx.font = "bold 8px 'Courier New', monospace";
  ctx.fillText("ESPECIFICAÇÃO APROVADA", 0, 23);
  ctx.fillText(`SN: ${code.slice(0, 12).toUpperCase()}`, 0, radius - 16);

  ctx.restore();
}

/** Desenha a logomarca oficial e proeminente da Anaheim HUB */
export function drawAnaheimLogo(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);

  // Brasão Anaheim: Hexágono tecnológico com "AH"
  const size = 36;
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = size + size * Math.cos(angle);
    const py = size + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glow interno sutil
  ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = size + (size - 6) * Math.cos(angle);
    const py = size + (size - 6) * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // Letras "AH" dentro do brasão
  ctx.fillStyle = "#38bdf8";
  ctx.font = "900 24px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AH", size, size + 1);

  // Tipografia do Nome: ANAHEIM HUB em tamanho grande e visível
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Linha 1: Marca principal
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 32px 'Trebuchet MS', sans-serif";
  ctx.fillText("ANAHEIM HUB", size * 2 + 18, 6);

  // Linha 2: Subtítulo militar
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 12px monospace";
  ctx.fillText("LABORATÓRIO TÁTICO & ENGENHARIA GUNDAM CARD GAME", size * 2 + 20, 44);

  ctx.restore();
}

/** GERA IMAGEM 1: A DECKLIST TÁTICA COMPLETA EM ALTA RESOLUÇÃO */
export async function generateDeckImageBlob(options: ExportDeckOptions): Promise<Blob> {
  const {
    deckName,
    authorName = "Piloto da OZ",
    shareId = "OZ-SPEC",
    mainCards,
    resourceCards = [],
    exCards = [],
    colors = [],
    themePrimaryColor = "#38bdf8",
    includeResourcesAndEx = false,
    includeMetaInfo = true,
    includeOzSeal = true,
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
  const MARGIN = 44;
  const HEADER_H = 140; // Espaço amplo para logo grande da Anaheim
  const SECTION_LABEL_H = 34;
  const SECTION_GAP = 28;
  const FOOTER_H = 120;

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
  contentHeight += FOOTER_H + MARGIN;

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

  // === CABEÇALHO COM LOGO PROEMINENTE DA ANAHEIM HUB ===
  drawAnaheimLogo(ctx, MARGIN, MARGIN);

  // Título do Deck e Autor
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 28px 'Trebuchet MS', sans-serif";
  ctx.fillText((deckName || "NOVO PROJETO DE DECK").toUpperCase(), MARGIN, MARGIN + 82);

  if (includeMetaInfo) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 13px monospace";
    ctx.fillText(`PILOTO: ${authorName.toUpperCase()} · FORMATO CONSTRUÍDO`, MARGIN, MARGIN + 116);
  }

  // Contagem de cartas e esferas no topo direito
  const totalMainCount = mainCards.reduce((acc, c) => acc + (c.quantity || 1), 0);
  const totalResCount = resourceCards.reduce((acc, c) => acc + (c.quantity || 1), 0);

  ctx.textAlign = "right";
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 15px monospace";
  ctx.fillText(
    includeResourcesAndEx
      ? `${totalMainCount} CARTAS · ${totalResCount} RECURSOS`
      : `${totalMainCount} CARTAS (DECK PRINCIPAL)`,
    totalWidth - MARGIN,
    MARGIN + 72
  );

  // Esferas coloridas das 5 cores oficiais
  if (colors.length > 0) {
    let sphereX = totalWidth - MARGIN - 10;
    for (let i = colors.length - 1; i >= 0; i--) {
      const col = colors[i];
      const hex = (GAME_COLOR_HEX as any)[col] || "#64748b";
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.arc(sphereX, MARGIN + 36, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      sphereX -= 28;
    }
  }

  // Linha divisória do cabeçalho
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, MARGIN + HEADER_H);
  ctx.lineTo(totalWidth - MARGIN, MARGIN + HEADER_H);
  ctx.stroke();

  // === RENDERIZADOR DE GRADE DE CARTAS ===
  let cursorY = MARGIN + HEADER_H + 16;

  const renderSection = (
    title: string,
    items: { card: ExportCardEntry; img: HTMLImageElement | null }[],
    badgeCount: number
  ) => {
    if (items.length === 0) return;

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#38bdf8";
    ctx.font = "900 14px 'Trebuchet MS', sans-serif";
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
        const cardColHex = entry.card.color ? (GAME_COLOR_HEX as any)[entry.card.color] : "#334155";
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
      const badgeW = 30;
      const badgeH = 26;
      const bx = x + CARD_W - badgeW - 4;
      const by = y + 4;

      ctx.fillStyle = "rgba(11, 18, 32, 0.94)";
      ctx.fillRect(bx, by, badgeW, badgeH);
      ctx.strokeStyle = themePrimaryColor || "#38bdf8";
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
      footerY + 44
    );
    ctx.fillStyle = "#475569";
    ctx.font = "10px sans-serif";
    ctx.fillText(
      "Este documento constitui especificação técnica e estratégica de Mobile Suit para ambiente competitivo.",
      MARGIN,
      footerY + 64
    );
  }

  // Carimbo Militar Tático da OZ com Logotipo Oficial
  if (includeOzSeal) {
    drawOzMilitarySeal(ctx, totalWidth - MARGIN - 80, footerY + 58, 56, shareId);
  }

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Falha ao sintetizar PNG do deck.");
  return blob;
}

/** GERA IMAGEM 2: O INFOGRÁFICO DEDICADO DE ESTATÍSTICAS E TELEMETRIA TÁTICA */
export async function generateDeckStatsImageBlob(options: ExportDeckOptions): Promise<Blob> {
  const {
    deckName,
    authorName = "Piloto da OZ",
    shareId = "OZ-SPEC",
    mainCards,
    colors = [],
    includeOzSeal = true,
    statsSummary,
  } = options;

  const WIDTH = 1400;
  const HEIGHT = 920;
  const MARGIN = 48;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Falha ao inicializar Canvas para estatísticas.");

  // Fundo Industrial Tático
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, "#080c14");
  bgGrad.addColorStop(0.5, "#0d1524");
  bgGrad.addColorStop(1, "#05080e");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Grade tática wireframe
  ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Borda militar externa
  ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(MARGIN / 2, MARGIN / 2, WIDTH - MARGIN, HEIGHT - MARGIN);

  // === CABEÇALHO ===
  drawAnaheimLogo(ctx, MARGIN, MARGIN);

  ctx.textAlign = "right";
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 13px monospace";
  ctx.fillText("RELATÓRIO DE TELEMETRIA OPERACIONAL VEDA", WIDTH - MARGIN, MARGIN + 12);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 24px 'Trebuchet MS', sans-serif";
  ctx.fillText((deckName || "DECK").toUpperCase(), WIDTH - MARGIN, MARGIN + 36);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px monospace";
  ctx.fillText(`PILOTO: ${authorName.toUpperCase()} · REGISTRO #${shareId}`, WIDTH - MARGIN, MARGIN + 68);

  // Linha divisória
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, MARGIN + 100);
  ctx.lineTo(WIDTH - MARGIN, MARGIN + 100);
  ctx.stroke();

  // === SEÇÃO 1: 4 GAUGES TÁTICOS (KPIS) ===
  const kpiY = MARGIN + 120;
  const kpiWidth = (WIDTH - MARGIN * 2 - 36) / 4;
  const kpiHeight = 100;

  const kpis = [
    {
      label: "CURVA MÉDIA",
      value: `${statsSummary?.avgCost ?? "—"}`,
      sub: "Custo ponderado",
      color: "#38bdf8",
    },
    {
      label: "TAXA DE SINERGIA",
      value: `${statsSummary?.synergyScore ?? 80}%`,
      sub: "Coesão de esquadra",
      color: "#10b981",
    },
    {
      label: "JOGADA TURNO 1",
      value: `${Math.round((statsSummary?.turn1Odds ?? 0) * 100)}%`,
      sub: "Chance Custo 1 (c/ Mulligan)",
      color: "#f59e0b",
    },
    {
      label: "JOGADA TURNO 2",
      value: `${Math.round((statsSummary?.turn2Odds ?? 0.88) * 100)}%`,
      sub: "Chance Custo ≤ 2 (c/ Mulligan)",
      color: "#8b5cf6",
    },
  ];

  kpis.forEach((k, idx) => {
    const kx = MARGIN + idx * (kpiWidth + 12);
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(kx, kpiY, kpiWidth, kpiHeight);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(kx, kpiY, kpiWidth, kpiHeight);

    // Linha de destaque colorida superior
    ctx.fillStyle = k.color;
    ctx.fillRect(kx, kpiY, kpiWidth, 3);

    ctx.textAlign = "left";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 10px monospace";
    ctx.fillText(k.label, kx + 14, kpiY + 16);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 32px 'Trebuchet MS', sans-serif";
    ctx.fillText(k.value, kx + 14, kpiY + 38);

    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.fillText(k.sub, kx + 14, kpiY + 76);
  });

  // === SEÇÃO 2: GRÁFICOS DE BARRAS TÁTICOS ===
  const chartY = kpiY + kpiHeight + 36;
  const colW = (WIDTH - MARGIN * 2 - 24) / 2;

  // Bloco Esquerdo: Curva de Custo (0 a 7+)
  const costBins = statsSummary?.costCurve || [
    { cost: "0", count: 0 },
    { cost: "1", count: 8 },
    { cost: "2", count: 14 },
    { cost: "3", count: 12 },
    { cost: "4", count: 8 },
    { cost: "5", count: 4 },
    { cost: "6+", count: 4 },
  ];
  const maxCostCount = Math.max(...costBins.map((b) => b.count), 1);

  ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
  ctx.fillRect(MARGIN, chartY, colW, 260);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.strokeRect(MARGIN, chartY, colW, 260);

  ctx.textAlign = "left";
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 12px monospace";
  ctx.fillText("HISTOGRAMA DE CURVA DE CUSTO", MARGIN + 16, chartY + 18);

  const barAreaW = colW - 40;
  const barW = (barAreaW - (costBins.length - 1) * 8) / costBins.length;
  const barMaxH = 170;
  const baseChartY = chartY + 220;

  costBins.forEach((bin, idx) => {
    const bx = MARGIN + 20 + idx * (barW + 8);
    const bh = (bin.count / maxCostCount) * barMaxH;
    const by = baseChartY - bh;

    // Barra
    ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
    ctx.fillRect(bx, by, barW, bh);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, barW, bh);

    // Valor acima da barra
    if (bin.count > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${bin.count}`, bx + barW / 2, by - 6);
    }

    // Label do custo abaixo
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${bin.cost}`, bx + barW / 2, baseChartY + 18);
  });

  // Bloco Direito: Distribuição de Tipos e Cores
  const rightX = MARGIN + colW + 24;
  ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
  ctx.fillRect(rightX, chartY, colW, 260);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.strokeRect(rightX, chartY, colW, 260);

  ctx.textAlign = "left";
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 12px monospace";
  ctx.fillText("DISTRIBUIÇÃO POR TIPO & CORES DA ESQUADRA", rightX + 16, chartY + 18);

  // Tipos
  const types = [
    { label: "UNIDADES", count: statsSummary?.units ?? 28, color: "#38bdf8" },
    { label: "PILOTOS", count: statsSummary?.pilots ?? 10, color: "#f59e0b" },
    { label: "COMANDOS", count: statsSummary?.commands ?? 8, color: "#a855f7" },
    { label: "BASES", count: statsSummary?.bases ?? 4, color: "#10b981" },
  ];

  let typeY = chartY + 50;
  types.forEach((t) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 11px monospace";
    ctx.fillText(t.label, rightX + 20, typeY + 12);

    // Barra horizontal
    const barX = rightX + 110;
    const maxBarW = colW - 190;
    const progressW = (t.count / 50) * maxBarW;

    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(barX, typeY + 2, maxBarW, 14);
    ctx.fillStyle = t.color;
    ctx.fillRect(barX, typeY + 2, Math.max(progressW, 4), 14);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${t.count}x`, rightX + colW - 20, typeY + 14);

    typeY += 28;
  });

  // Cores
  const colorCounts = statsSummary?.colorCounts || { Blue: 30, White: 20 };
  let colorX = rightX + 20;
  ctx.textAlign = "left";
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 10px monospace";
  ctx.fillText("CORES UTILIZADAS:", rightX + 20, chartY + 175);

  Object.entries(colorCounts).forEach(([col, count]) => {
    const hex = (GAME_COLOR_HEX as any)[col] || "#64748b";
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.arc(colorX + 8, chartY + 205, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${col}: ${count}`, colorX + 22, chartY + 210);

    colorX += 130;
  });

  // === SEÇÃO 3: CLASSIFICAÇÃO DE METAGAME & RODAPÉ ===
  const metaY = chartY + 280;
  ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
  ctx.fillRect(MARGIN, metaY, WIDTH - MARGIN * 2, 130);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.strokeRect(MARGIN, metaY, WIDTH - MARGIN * 2, 130);

  ctx.textAlign = "left";
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 12px monospace";
  ctx.fillText("CLASSIFICAÇÃO DE METAGAME DO ARSENAL", MARGIN + 16, metaY + 18);

  const metaItems = [
    { label: "STAPLES", count: statsSummary?.staplesCount ?? 16, sub: "Presença ≥ 60% no meta", color: "#38bdf8" },
    { label: "ENGINE / NÚCLEO", count: statsSummary?.engineCount ?? 20, sub: "Peças do arquétipo", color: "#f59e0b" },
    { label: "TECHS & RESPOSTAS", count: statsSummary?.techsCount ?? 8, sub: "Counters específicos", color: "#a855f7" },
    { label: "BASE COMUM", count: statsSummary?.commonCount ?? 6, sub: "Suporte e utilitários", color: "#64748b" },
  ];

  const metaBoxW = (WIDTH - MARGIN * 2 - 40) / 4;
  metaItems.forEach((m, idx) => {
    const mx = MARGIN + 16 + idx * metaBoxW;
    ctx.fillStyle = m.color;
    ctx.font = "900 24px 'Trebuchet MS', sans-serif";
    ctx.fillText(`${m.count} cartas`, mx, metaY + 54);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px monospace";
    ctx.fillText(m.label, mx, metaY + 76);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.fillText(m.sub, mx, metaY + 94);
  });

  // Carimbo OZ no Rodapé
  if (includeOzSeal) {
    drawOzMilitarySeal(ctx, WIDTH - MARGIN - 75, HEIGHT - MARGIN - 48, 56, shareId);
  }

  // Assinatura Rodapé
  ctx.textAlign = "left";
  ctx.fillStyle = "#475569";
  ctx.font = "10px monospace";
  ctx.fillText("ANAHEIM HUB · VEDA TACTICAL ANALYTICS SUITE · EMITIDO PARA AMBIENTE COMPETITIVO", MARGIN, HEIGHT - MARGIN - 20);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Falha ao sintetizar PNG de estatísticas.");
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

