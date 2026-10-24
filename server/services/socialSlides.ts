/* Slides 1080x1350 (4:5) dos posts do Instagram: moldura comum (marca, selo, aviso de fã, endereço) e o desenho de
 * cada tipo de slide. Todo dado que vem do banco passa por escapeHtml. A renderização em JPEG abre um navegador só
 * para todos os slides do post. */
import fs from "node:fs";
import path from "node:path";

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

/** Paleta de cores oficial de Gundam Card Game */
export const COLOR_HEX: Record<string, string> = {
  blue: "#38bdf8",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  black: "#94a3b8",
  white: "#f8fafc",
  purple: "#c084fc",
};

export const accentFor = (color: string | null | undefined) => COLOR_HEX[String(color ?? "").toLowerCase()] || "#38bdf8";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Só imagem em https entra no slide (o resto vira placeholder). */
export const safeImageUrl = (url: string | null | undefined) => (url && /^https:\/\//i.test(url) ? url : "");

type FrameInput = {
  badge: string;
  accent?: string;
  body: string;
  css?: string;
  /** chamada do rodapé (padrão: simulador) */
  cta?: string;
  /** posição no carrossel, ex.: "2/5" */
  pager?: string;
};

/** Documento completo de um slide: cabeçalho com marca e selo, conteúdo, rodapé com aviso de fã e endereço. */
export function slideDocument({ badge, accent = "#38bdf8", body, css = "", cta = "Monte seu deck e jogue online no simulador", pager }: FrameInput): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  body { width: ${SLIDE_WIDTH}px; height: ${SLIDE_HEIGHT}px; background: radial-gradient(circle at 50% 20%, #0f172a 0%, #020617 100%); color: #f8fafc; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 60px; position: relative; }
  body::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px); background-size: 40px 40px; pointer-events: none; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(255, 255, 255, 0.1); padding-bottom: 24px; z-index: 10; gap: 24px; }
  .brand { font-size: 32px; font-weight: 900; letter-spacing: 0.15em; text-transform: uppercase; color: #38bdf8; }
  .badge { background: rgba(56, 189, 248, 0.15); border: 1px solid ${accent}; color: ${accent}; padding: 8px 18px; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; border-radius: 4px; white-space: nowrap; }
  .main { flex: 1; display: flex; flex-direction: column; z-index: 10; margin: 36px 0; min-height: 0; }
  .footer { border-top: 2px solid rgba(255, 255, 255, 0.1); padding-top: 24px; display: flex; justify-content: space-between; align-items: center; gap: 24px; z-index: 10; }
  .cta-text { font-size: 20px; font-weight: 700; color: #cbd5e1; }
  .fan-note { font-size: 13px; color: #64748b; margin-top: 6px; }
  .url-badge { background: #38bdf8; color: #020617; font-size: 18px; font-weight: 800; padding: 10px 22px; border-radius: 6px; letter-spacing: 0.05em; white-space: nowrap; }
  .pager { font-size: 16px; font-weight: 800; color: #64748b; letter-spacing: 0.1em; }
  ${css}
</style>
</head>
<body>
  <div class="header">
    <div class="brand">ANAHEIM HUB</div>
    <div style="display:flex;align-items:center;gap:18px;">${pager ? `<div class="pager">${escapeHtml(pager)}</div>` : ""}<div class="badge">${escapeHtml(badge)}</div></div>
  </div>
  <div class="main">${body}</div>
  <div class="footer">
    <div>
      <div class="cta-text">${escapeHtml(cta)}</div>
      <div class="fan-note">Projeto de fãs, sem vínculo com a Bandai. Gundam Card Game © Bandai / Sotsu · Sunrise.</div>
    </div>
    <div class="url-badge">anaheimhub.com</div>
  </div>
</body>
</html>`;
}

export type AltArt = { code: string; name: string; rarity: string | null; setCode: string | null; imageUrl: string };

/** Slide de arte alternativa: a imagem da carta grande, com raridade e coleção. */
export function altArtSlideHtml(art: AltArt, accent: string, pager?: string): string {
  const imageUrl = safeImageUrl(art.imageUrl);
  const detail = [art.rarity, art.setCode].filter(Boolean).join(" · ");
  return slideDocument({
    badge: "ARTE ALTERNATIVA",
    accent,
    pager,
    css: `
      .art-wrap { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
      .art { height: 900px; aspect-ratio: 63 / 88; border-radius: 22px; overflow: hidden; border: 2px solid rgba(255,255,255,0.18); box-shadow: 0 30px 60px -12px rgba(0,0,0,0.85), 0 0 46px ${accent}40; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; }
      .art img { width: 100%; height: 100%; object-fit: cover; }
      .caption { text-align: center; margin-top: 22px; }
      .caption .name { font-size: 34px; font-weight: 900; text-transform: uppercase; }
      .caption .meta { font-size: 20px; font-weight: 800; color: ${accent}; letter-spacing: 0.12em; margin-top: 6px; font-family: monospace; }`,
    body: `
      <div class="art-wrap"><div class="art">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(art.name)}" />` : `<div style="font-size:28px;font-weight:800;color:${accent};">${escapeHtml(art.code)}</div>`}</div></div>
      <div class="caption"><div class="name">${escapeHtml(art.name)}</div><div class="meta">${escapeHtml(art.code)}${detail ? ` · ${escapeHtml(detail)}` : ""}</div></div>`,
  });
}

/**
 * Renderiza cada HTML no JPEG correspondente (o único formato de imagem que a API do Instagram aceita), num navegador
 * só. Devolve, para cada slide, se o arquivo foi gerado; um slide que falha não derruba os outros.
 */
export async function renderSlides(htmls: string[], outputPaths: string[]): Promise<boolean[]> {
  if (!htmls.length) return [];
  for (const out of outputPaths) fs.mkdirSync(path.dirname(out), { recursive: true });
  // carregado só aqui: o navegador pesa e só é usado ao gerar um post
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    // SOCIAL_CHROMIUM_PATH: usa um Chromium já instalado no servidor em vez do baixado pelo Playwright
    executablePath: process.env.SOCIAL_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
    const done: boolean[] = [];
    for (let i = 0; i < htmls.length; i += 1) {
      try {
        await page.setContent(htmls[i], { waitUntil: "load", timeout: 20000 });
        await page.screenshot({ path: outputPaths[i], type: "jpeg", quality: 90 });
        done.push(true);
      } catch (err) {
        console.warn(`[socialSlides] slide ${i + 1} não renderizou:`, err instanceof Error ? err.message : err);
        done.push(false);
      }
    }
    return done;
  } finally {
    await browser.close();
  }
}
