import fs from "node:fs/promises";
import path from "node:path";

export interface BugReportDiskData {
  shortCode: string;
  matchId: string;
  reporterId: string;
  seat: string;
  note?: string;
  engineVersion: string;
  gameState?: unknown;
  battleLog?: Array<{ text: string; kind?: string }>;
  cardsInvolved?: string[];
  screenshotBase64?: string;
  clientSnapshot?: {
    isAgainstBot?: boolean;
    botLevel?: string;
    turnNumber?: number;
    phase?: string;
    activePlayer?: string;
    myShieldCount?: number;
    oppShieldCount?: number;
    myResourceCount?: { total: number; active: number; rested: number };
    oppResourceCount?: { total: number; active: number; rested: number };
    browserInfo?: {
      userAgent?: string;
      screenWidth?: number;
      screenHeight?: number;
      viewportWidth?: number;
      viewportHeight?: number;
    };
  };
}

/** Formata data para nome de diretório: AAAA-MM-DD_HH-mm-ss */
export function formatTimestampForDir(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/** Gera o conteúdo do arquivo Markdown do bug report */
export function generateBugReportMarkdown(data: BugReportDiskData, hasScreenshot: boolean): string {
  const now = new Date();
  const dateStr = now.toISOString();
  const localDateStr = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const isBot = data.clientSnapshot?.isAgainstBot ?? false;
  const oppTypeLabel = isBot
    ? `Bot IA (${data.clientSnapshot?.botLevel ?? "Heurístico"})`
    : "Jogador Humano (PvP)";

  const turn = data.clientSnapshot?.turnNumber ?? "N/D";
  const phase = data.clientSnapshot?.phase ?? "N/D";
  const activePlayer = data.clientSnapshot?.activePlayer ?? "N/D";

  const myShields = data.clientSnapshot?.myShieldCount ?? "N/D";
  const oppShields = data.clientSnapshot?.oppShieldCount ?? "N/D";

  const myRes = data.clientSnapshot?.myResourceCount;
  const myResStr = myRes ? `${myRes.active}/${myRes.total} (Rested: ${myRes.rested})` : "N/D";

  const oppRes = data.clientSnapshot?.oppResourceCount;
  const oppResStr = oppRes ? `${oppRes.active}/${oppRes.total} (Rested: ${oppRes.rested})` : "N/D";

  const lines: string[] = [];

  lines.push(`# Relatório de Bug: ${data.shortCode}`);
  lines.push("");
  lines.push(`> **Data/Hora:** ${localDateStr} (${dateStr})  `);
  lines.push(`> **Match ID:** \`${data.matchId}\`  `);
  lines.push(`> **Relator:** Usuário \`${data.reporterId}\` (Assento **${data.seat}**)  `);
  lines.push(`> **Modo:** **${oppTypeLabel}**  `);
  lines.push(`> **Motor:** Versão \`${data.engineVersion}\`  `);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 1. Descrição Fornecida pelo Usuário");
  lines.push("");
  if (data.note && data.note.trim()) {
    lines.push(`> "${data.note.trim()}"`);
  } else {
    lines.push("*O usuário não adicionou comentário textual.*");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 2. Situação do Jogo no Momento do Envio");
  lines.push("");
  lines.push("| Campo | Valor |");
  lines.push("| :--- | :--- |");
  lines.push(`| **Turno** | ${turn} |`);
  lines.push(`| **Fase** | \`${phase}\` |`);
  lines.push(`| **Jogador Ativo** | Assento ${activePlayer} |`);
  lines.push(`| **Shields do Relator (Seat ${data.seat})** | ${myShields} |`);
  lines.push(`| **Shields do Oponente** | ${oppShields} |`);
  lines.push(`| **Recursos do Relator** | ${myResStr} |`);
  lines.push(`| **Recursos do Oponente** | ${oppResStr} |`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 3. Captura Visual da Tela (Screenshot)");
  lines.push("");
  if (hasScreenshot) {
    lines.push("![Screenshot do Jogo](./screenshot.png)");
  } else {
    lines.push("*Nenhum screenshot anexado ou captura indisponível no cliente.*");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 4. Log de Batalha (Eventos Traduzidos)");
  lines.push("");
  if (data.battleLog && data.battleLog.length > 0) {
    lines.push("```text");
    for (const entry of data.battleLog) {
      lines.push(entry.text);
    }
    lines.push("```");
  } else {
    lines.push("*Nenhum evento registrado no log.*");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 5. Cartas em Jogo Envolvidas");
  lines.push("");
  if (data.cardsInvolved && data.cardsInvolved.length > 0) {
    lines.push(data.cardsInvolved.map((c) => `- \`${c}\``).join("\n"));
  } else {
    lines.push("*Nenhuma carta registrada em campo.*");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 6. Ambiente do Navegador");
  lines.push("");
  if (data.clientSnapshot?.browserInfo) {
    const bi = data.clientSnapshot.browserInfo;
    lines.push(`- **User Agent:** \`${bi.userAgent || "N/D"}\``);
    lines.push(`- **Resolução de Tela:** ${bi.screenWidth}x${bi.screenHeight}`);
    lines.push(`- **Viewport:** ${bi.viewportWidth}x${bi.viewportHeight}`);
  } else {
    lines.push("*Metadados do navegador não fornecidos.*");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 7. Instruções para Agentes de Resolução de Bug");
  lines.push("");
  lines.push("Para diagnosticar ou criar teste de unidade com este bug:");
  lines.push("1. O estado de jogo serializado está salvo em [`./gameState.json`](./gameState.json).");
  lines.push("2. Verifique se o erro decorre de uma interação de efeito, cálculo de custo ou ação de bot.");
  lines.push("3. Crie um caso de teste reproduzindo a jogada em `src/modules/simulator/engine/`.");
  lines.push(`4. Depois que a correção entrar em \`dev\`, apague este relato: \`pnpm bug-report:resolve ${data.shortCode}\`.`);
  lines.push("");

  return lines.join("\n");
}

/** Pasta única dos relatos em disco. Cada relato fica nela até o bug ser corrigido; aí é apagado (`removeBugReportFromDisk`). */
export const BUG_REPORTS_DIR_NAME = "bug-reports";

export function defaultBugReportsDir(): string {
  return path.resolve(process.cwd(), BUG_REPORTS_DIR_NAME);
}

// O shortCode vira parte do nome da pasta; só o formato gerado pelo servidor passa (evita path traversal).
const SHORT_CODE_PATTERN = /^BUG-[A-Z0-9]{4,12}$/;

/** Salva o relatório em `bug-reports/<AAAA-MM-DD_HH-mm-ss>_<shortCode>/` (report.md, gameState.json e screenshot.png). */
export async function saveBugReportToDisk(
  data: BugReportDiskData,
  rootDir: string = defaultBugReportsDir(),
): Promise<{ dir: string; mdPath: string; screenshotPath?: string }> {
  if (!SHORT_CODE_PATTERN.test(data.shortCode)) {
    throw new Error(`shortCode inválido para gravar em disco: ${data.shortCode}`);
  }
  const targetDir = path.join(rootDir, `${formatTimestampForDir()}_${data.shortCode}`);

  let screenshotBuffer: Buffer | null = null;
  if (data.screenshotBase64) {
    const buffer = Buffer.from(data.screenshotBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    if (buffer.length > 0) screenshotBuffer = buffer;
  }

  const jsonContent = JSON.stringify(
    {
      shortCode: data.shortCode,
      matchId: data.matchId,
      reporterId: data.reporterId,
      seat: data.seat,
      engineVersion: data.engineVersion,
      note: data.note,
      cardsInvolved: data.cardsInvolved,
      clientSnapshot: data.clientSnapshot,
      gameState: data.gameState,
      battleLog: data.battleLog,
    },
    null,
    2,
  );

  await fs.mkdir(targetDir, { recursive: true });
  const mdPath = path.join(targetDir, "report.md");
  await fs.writeFile(mdPath, generateBugReportMarkdown(data, screenshotBuffer !== null), "utf-8");
  await fs.writeFile(path.join(targetDir, "gameState.json"), jsonContent, "utf-8");

  let screenshotPath: string | undefined;
  if (screenshotBuffer) {
    screenshotPath = path.join(targetDir, "screenshot.png");
    await fs.writeFile(screenshotPath, screenshotBuffer);
  }

  return { dir: targetDir, mdPath, screenshotPath };
}

/** Apaga do disco a(s) pasta(s) do relato `shortCode` (bug corrigido). Devolve quantas pastas removeu. */
export async function removeBugReportFromDisk(
  shortCode: string,
  rootDir: string = defaultBugReportsDir(),
): Promise<number> {
  if (!SHORT_CODE_PATTERN.test(shortCode)) {
    throw new Error(`shortCode inválido: ${shortCode}`);
  }
  let entries: string[];
  try {
    entries = await fs.readdir(rootDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw err;
  }
  const matches = entries.filter((name) => name.endsWith(`_${shortCode}`));
  for (const name of matches) {
    await fs.rm(path.join(rootDir, name), { recursive: true, force: true });
  }
  return matches.length;
}
