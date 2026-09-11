import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(fs.readFileSync("data/verified-set-covers.json", "utf8"));
  console.log(`Atualizando ${data.length} coleções com as capas oficiais locais...`);

  let updated = 0;
  for (const item of data) {
    try {
      const set = await prisma.cardSet.findUnique({ where: { code: item.code } });
      if (set) {
        await prisma.cardSet.update({
          where: { code: item.code },
          data: {
            coverImage: item.localImageUrl,
            officialUrl: item.officialUrl,
          },
        });
        console.log(`  ✓ ${item.code} (${item.name}) -> ${item.localImageUrl}`);
        updated++;
      } else {
        console.warn(`  ⚠ Coleção com código ${item.code} não encontrada no banco.`);
      }
    } catch (err) {
      console.error(`  ✗ Erro em ${item.code}:`, err.message);
    }
  }

  console.log(`\nConcluído com sucesso: ${updated} coleções atualizadas no banco.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
