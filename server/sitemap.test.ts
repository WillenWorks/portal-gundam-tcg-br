import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createSitemapRefresher, indexablePlayerEntries, renderSitemap } from "./sitemap.ts";

const tournament = (id: string, date: string | null) => ({ id, date, updatedAt: "2026-01-01T00:00:00.000Z" });
const entry = (playerName: string, tournamentId: string, deckSnapshotId: string | null) => ({ playerName, tournamentId, deckSnapshotId });

function index(tournaments: ReturnType<typeof tournament>[], entries: ReturnType<typeof entry>[]) {
  return { data: { entries }, byId: new Map(tournaments.map((t) => [t.id, t])) } as never;
}

describe("indexablePlayerEntries", () => {
  it("só jogador com lista publicada entra, com a data do torneio mais recente", () => {
    const ix = index(
      [tournament("t1", "2026-08-23T00:00:00.000Z"), tournament("t2", "2026-10-01T00:00:00.000Z")],
      [
        entry("Nyann", "t1", "snap-1"), entry("Nyann", "t2", null),
        entry("Hemogoblin Josh", "t1", null), entry("Hemogoblin Josh", "t2", null),
        entry("Órfão", "sumiu", "snap-2"), // torneio fora do índice: a página não mostra esse resultado
      ],
    );
    const entries = indexablePlayerEntries(ix);
    expect(entries.map((e) => e.path)).toEqual(["/jogadores/nyann"]);
    expect(entries[0].lastmod).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("renderSitemap", () => {
  it("escapa o endereço e grava lastmod só com data válida", () => {
    const xml = renderSitemap([{ path: "/articles/a&b", lastmod: new Date("2026-11-20T15:00:00Z"), priority: "0.6" }, { path: "/x", lastmod: "não é data" }]);
    expect(xml).toContain("<loc>https://anaheimhub.com/articles/a&amp;b</loc>");
    expect(xml).toContain("<lastmod>2026-11-20</lastmod>");
    expect(xml.match(/<lastmod>/g)).toHaveLength(1);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});

describe("createSitemapRefresher", () => {
  it("grava em dist/sitemap.xml só com build presente e agrupa pedidos seguidos", async () => {
    vi.useFakeTimers();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sitemap-"));
    try {
      const build = vi.fn(async () => "<urlset/>");
      const refresher = createSitemapRefresher({ distDir: dir, build, debounceMs: 1000, log: { info() {}, warn() {} } });
      await refresher.run();
      expect(fs.existsSync(path.join(dir, "sitemap.xml"))).toBe(false); // sem index.html (dev sem build)
      fs.writeFileSync(path.join(dir, "index.html"), "<html></html>");
      refresher.request();
      refresher.request();
      refresher.request();
      await vi.advanceTimersByTimeAsync(1000);
      expect(build).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync(path.join(dir, "sitemap.xml"), "utf8")).toBe("<urlset/>");
      expect(fs.readdirSync(dir).filter((f) => f.startsWith(".sitemap-"))).toEqual([]);
    } finally {
      vi.useRealTimers();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
