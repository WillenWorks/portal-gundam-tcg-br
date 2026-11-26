/* Gera o sitemap.xml da versão nova no deploy, depois do `vite build` (as regras ficam em server/sitemap.ts, as
 * mesmas que o servidor usa para regravá-lo quando um artigo é publicado).
 *
 * Best-effort: sem DATABASE_URL ou com o banco fora do ar, mantém o sitemap estático (public/sitemap.xml, já
 * copiado para a pasta do build) e sai 0 — o deploy nunca falha por causa do sitemap.
 *
 *   pnpm exec tsx scripts/generate-sitemap.ts [--out=dist/sitemap.xml] */
import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outArg = process.argv.find((a) => a.startsWith("--out="));
const OUT = resolve(outArg ? outArg.slice(6) : "dist/sitemap.xml");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("sitemap: sem DATABASE_URL — mantido o sitemap estático.");
    return;
  }
  if (!existsSync(dirname(OUT))) {
    console.log(`sitemap: pasta de saída não existe (${OUT}) — rode depois do build.`);
    return;
  }
  const [{ PrismaClient }, { renderSitemap, sitemapEntries, writeSitemapFile, SITEMAP_MAX_URLS }, { getVedaIndex }] = await Promise.all([
    import("@prisma/client"),
    import("../server/sitemap.ts"),
    import("../server/vedaService.ts"),
  ]);
  const prisma = new PrismaClient();
  try {
    const entries = await sitemapEntries(prisma, () => getVedaIndex(prisma));
    writeSitemapFile(OUT, renderSitemap(entries));
    const count = (prefix: string) => entries.filter((e) => e.path.startsWith(prefix)).length;
    console.log(
      `sitemap: ${Math.min(entries.length, SITEMAP_MAX_URLS)} URLs gravadas em ${OUT} (artigos ${count("/articles/")}, jogadores ${count("/jogadores/")}, ` +
        `torneios ${count("/torneios/")}, cartas ${count("/cards/")}, decks ${count("/deck/")}).`,
    );
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.warn(`sitemap: falhou (${err?.message || err}) — mantido o sitemap estático.`);
});
