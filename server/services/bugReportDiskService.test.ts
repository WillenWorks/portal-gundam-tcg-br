import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  saveBugReportToDisk,
  removeBugReportFromDisk,
  generateBugReportMarkdown,
  formatTimestampForDir,
  type BugReportDiskData,
} from "./bugReportDiskService";

describe("bugReportDiskService", () => {
  let tempDirs: string[] = [];

  afterEach(async () => {
    for (const d of tempDirs) {
      await fs.rm(d, { recursive: true, force: true });
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

    const md = generateBugReportMarkdown(data, "screenshot.png");
    expect(md).toContain("# Relatório de Bug: BUG-TEST01");
    expect(md).toContain("Bot IA (Heurístico)");
    expect(md).toContain("Bot travou no Action Step");
    expect(md).toContain("![Screenshot do Jogo](./screenshot.png)");
    expect(md).toContain("Jogador A baixou Gundam");
    expect(md).toContain("`ST01-001`");
    expect(md).toContain("1920x1080");
    expect(md).toContain("pnpm bug-report:resolve BUG-TEST01");
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

    const res = await saveBugReportToDisk(data, tempDir);
    expect(path.dirname(res.dir)).toBe(tempDir);
    expect(path.basename(res.dir)).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_BUG-SAVE01$/);
    expect((await fs.readdir(tempDir)).length).toBe(1);
    expect((await fs.readdir(res.dir)).sort()).toEqual(["gameState.json", "report.md", "screenshot.png"]);

    const mdContent = await fs.readFile(res.mdPath, "utf-8");
    expect(mdContent).toContain("Teste de gravação em disco");

    const jsonPath = path.join(res.dir, "gameState.json");
    const jsonExists = await fs.stat(jsonPath);
    expect(jsonExists.isFile()).toBe(true);

    const screenshotPath = path.join(res.dir, "screenshot.png");
    const ssExists = await fs.stat(screenshotPath);
    expect(ssExists.isFile()).toBe(true);
    expect(ssExists.size).toBeGreaterThan(0);
  });

  it("print em JPEG (o cliente manda image/jpeg) é gravado como screenshot.jpg e referenciado no report", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bug-report-test-"));
    tempDirs.push(tempDir);
    const res = await saveBugReportToDisk(
      { shortCode: "BUG-JPEG01", matchId: "m", reporterId: "u", seat: "A", engineVersion: "dev", screenshotBase64: "data:image/jpeg;base64,/9j/4AAQSkZJRg==" },
      tempDir,
    );
    expect(res.screenshotPath && path.basename(res.screenshotPath)).toBe("screenshot.jpg");
    expect(await fs.readFile(res.mdPath, "utf-8")).toContain("![Screenshot do Jogo](./screenshot.jpg)");
  });

  it("apaga do disco o relato corrigido e mantém os outros", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bug-report-test-"));
    tempDirs.push(tempDir);
    const base = { matchId: "m", reporterId: "u", seat: "A", engineVersion: "dev" };
    await saveBugReportToDisk({ ...base, shortCode: "BUG-AAAAA1" }, tempDir);
    await saveBugReportToDisk({ ...base, shortCode: "BUG-BBBBB2" }, tempDir);

    expect(await removeBugReportFromDisk("BUG-AAAAA1", tempDir)).toBe(1);
    const left = await fs.readdir(tempDir);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatch(/_BUG-BBBBB2$/);
    expect(await removeBugReportFromDisk("BUG-AAAAA1", tempDir)).toBe(0);
  });

  it("devolve 0 quando a pasta de relatos ainda não existe", async () => {
    expect(await removeBugReportFromDisk("BUG-CCCCC3", path.join(os.tmpdir(), "nao-existe-bug-reports-xyz"))).toBe(0);
  });

  it("recusa shortCode fora do formato (evita sair da pasta)", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bug-report-test-"));
    tempDirs.push(tempDir);
    await expect(removeBugReportFromDisk("../etc", tempDir)).rejects.toThrow("shortCode inválido");
    await expect(
      saveBugReportToDisk({ shortCode: "BUG-../x", matchId: "m", reporterId: "u", seat: "A", engineVersion: "dev" }, tempDir),
    ).rejects.toThrow("shortCode inválido");
  });
});
