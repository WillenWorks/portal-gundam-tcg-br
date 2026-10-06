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
  lines.push("");

  return lines.join("\n");
}

/**
 * Salva o relatório de bug no disco em uma pasta organizada por data e hora.
 * Grava na pasta "bug report" e "bug-reports" na raiz do projeto.
 */
export async function saveBugReportToDisk(
  data: BugReportDiskData,
  customRootDirs?: string[],
): Promise<{ primaryDir: string; mdPath: string; screenshotPath?: string }> {
  const timestampPart = formatTimestampForDir();
  const folderName = `${timestampPart}_${data.shortCode}`;

  // Se não passar diretórios customizados (ex: testes), salva nas duas pastas solicitadas
  const rootDirs = customRootDirs && customRootDirs.length > 0
    ? customRootDirs
    : [
        path.resolve(process.cwd(), "bug report"),
        path.resolve(process.cwd(), "bug-reports"),
      ];

  let primaryDir = "";
  let primaryMdPath = "";
  let primaryScreenshotPath: string | undefined;

  let hasScreenshot = false;
  let screenshotBuffer: Buffer | null = null;

  if (data.screenshotBase64) {
    try {
      const base64Data = data.screenshotBase64.replace(/^data:image\/\w+;base64,/, "");
      screenshotBuffer = Buffer.from(base64Data, "base64");
      hasScreenshot = screenshotBuffer.length > 0;
    } catch (err) {
      console.warn(`[BugReportDisk] Erro ao decodificar screenshot do bug ${data.shortCode}:`, err);
    }
  }

  const markdownContent = generateBugReportMarkdown(data, hasScreenshot);
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

  for (let i = 0; i < rootDirs.length; i++) {
    const rootDir = rootDirs[i];
    const targetDir = path.join(rootDir, folderName);

    try {
      await fs.mkdir(targetDir, { recursive: true });

      const mdPath = path.join(targetDir, "report.md");
      const readmePath = path.join(targetDir, "README.md");
      const jsonPath = path.join(targetDir, "gameState.json");

      await fs.writeFile(mdPath, markdownContent, "utf-8");
      await fs.writeFile(readmePath, markdownContent, "utf-8");
      await fs.writeFile(jsonPath, jsonContent, "utf-8");

      let screenshotPath: string | undefined;
      if (screenshotBuffer) {
        screenshotPath = path.join(targetDir, "screenshot.png");
        await fs.writeFile(screenshotPath, screenshotBuffer);
      }

      if (i === 0) {
        primaryDir = targetDir;
        primaryMdPath = mdPath;
        primaryScreenshotPath = screenshotPath;
      }
    } catch (err) {
      console.error(`[BugReportDisk] Falha ao gravar bug report em ${targetDir}:`, err);
    }
  }

  return {
    primaryDir,
    mdPath: primaryMdPath,
    screenshotPath: primaryScreenshotPath,
  };
}
