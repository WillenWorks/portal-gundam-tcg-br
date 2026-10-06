import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  saveBugReportToDisk,
  generateBugReportMarkdown,
  formatTimestampForDir,
  type BugReportDiskData,
} from "./bugReportDiskService";

describe("bugReportDiskService", () => {
  let tempDirs: string[] = [];

  afterEach(async () => {
    for (const d of tempDirs) {
      try {
        await fs.rm(d, { recursive: true, force: true });
      } catch {}
    }
    tempDirs = [];
  });

  it("formata timestamp corretamente", () => {
    const fixedDate = new Date(2026, 9, 6, 18, 30, 45); // 06 de outubro de 2026
    const formatted = formatTimestampForDir(fixedDate);
    expect(formatted).toBe("2026-10-06_18-30-45");
  });

  it("gera markdown estruturado com dados do usuário, bot e jogo", () => {
    const data: BugReportDiskData = {
      shortCode: "BUG-TEST01",
      matchId: "match-123",
      reporterId: "user-abc",
      seat: "A",
      note: "Bot travou no Action Step",
      engineVersion: "1.3.0",
      cardsInvolved: ["ST01-001", "ST01-002"],
      battleLog: [
        { text: "Turno 1 iniciado", kind: "turn" },
        { text: "Jogador A baixou Gundam", kind: "play" },
      ],
      clientSnapshot: {
        isAgainstBot: true,
        botLevel: "Heurístico",
        turnNumber: 3,
        phase: "main",
        activePlayer: "A",
        myShieldCount: 5,
        oppShieldCount: 4,
        myResourceCount: { total: 3, active: 2, rested: 1 },
        oppResourceCount: { total: 3, active: 3, rested: 0 },
        browserInfo: {
          userAgent: "Mozilla/5.0 Test",
          screenWidth: 1920,
          screenHeight: 1080,
          viewportWidth: 1920,
          viewportHeight: 950,
        },
      },
    };

    const md = generateBugReportMarkdown(data, true);
    expect(md).toContain("# Relatório de Bug: BUG-TEST01");
    expect(md).toContain("Bot IA (Heurístico)");
    expect(md).toContain("Bot travou no Action Step");
    expect(md).toContain("![Screenshot do Jogo](./screenshot.png)");
    expect(md).toContain("Jogador A baixou Gundam");
    expect(md).toContain("`ST01-001`");
    expect(md).toContain("1920x1080");
  });

  it("salva arquivos de bug report (report.md, gameState.json e screenshot.png) no disco", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bug-report-test-"));
    tempDirs.push(tempDir);

    // 1x1 transparente PNG em base64
    const samplePngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const data: BugReportDiskData = {
      shortCode: "BUG-SAVE01",
      matchId: "match-456",
      reporterId: "user-def",
      seat: "B",
      note: "Teste de gravação em disco",
      engineVersion: "1.3.0",
      screenshotBase64: samplePngBase64,
      cardsInvolved: ["ST02-001"],
      battleLog: [{ text: "Evento teste", kind: "system" }],
    };

    const res = await saveBugReportToDisk(data, [tempDir]);
    expect(res.primaryDir).toBeDefined();
    expect(res.mdPath).toBeDefined();

    const mdContent = await fs.readFile(res.mdPath, "utf-8");
    expect(mdContent).toContain("Teste de gravação em disco");

    const jsonPath = path.join(res.primaryDir, "gameState.json");
    const jsonExists = await fs.stat(jsonPath);
    expect(jsonExists.isFile()).toBe(true);

    const screenshotPath = path.join(res.primaryDir, "screenshot.png");
    const ssExists = await fs.stat(screenshotPath);
    expect(ssExists.isFile()).toBe(true);
    expect(ssExists.size).toBeGreaterThan(0);
  });
});
