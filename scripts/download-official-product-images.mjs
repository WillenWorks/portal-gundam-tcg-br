import https from "node:https";
import fs from "node:fs";
import path from "node:path";

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchBuffer(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Status ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(res.headers.location));
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

// Map database set codes to official Bandai URLs
const officialSetMap = {
  GD01: {
    code: "GD01",
    name: "Newtype Rising",
    page: "https://www.gundam-gcg.com/en/products/gd01.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/06/26/n6aFmLUGN7Rqmea6/list_thumbnail_en.webp",
  },
  GD02: {
    code: "GD02",
    name: "Dual Impact",
    page: "https://www.gundam-gcg.com/en/products/gd02.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/08/01/dIACPCZRPSpmQEaI/GD02_thumbnail_en.webp",
  },
  GD03: {
    code: "GD03",
    name: "Steel Requiem",
    page: "https://www.gundam-gcg.com/en/products/gd03.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/11/05/AGeluwLGOZ1O9SVY/gd03_thumbnail_en.webp",
  },
  GD04: {
    code: "GD04",
    name: "Phantom Aria",
    page: "https://www.gundam-gcg.com/en/products/gd04.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2026/01/28/AQy8uWNZkkPKuEHr/GD04_thumbnail_en.webp",
  },
  GD05: {
    code: "GD05",
    name: "Freedom Ascension",
    page: "https://www.gundam-gcg.com/en/products/gd05.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2026/04/30/rx2iVMb1gZkF1QUf/GD05_thumbnail_en.webp",
  },
  GD01_b: {
    code: "GD01_b",
    name: "Edition Beta",
    page: "https://www.gundam-gcg.com/en/products/limitedbox-beta.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/06/26/pAYkW8MF3901YRLe/list_thumbnail_en.webp",
  },
  EB01: {
    code: "EB01",
    name: "Eternal Nexus",
    page: "https://www.gundam-gcg.com/en/products/eb01.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2026/03/17/Vbc6ZoFwJ9BoKBEl/EB01_list_thumbnail_en.webp",
  },
  "DBB-FA": {
    code: "DBB-FA",
    name: "Deck Build Box Freedom Ascension",
    page: "https://www.gundam-gcg.com/en/products/deck-build-box.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2026/06/24/RlBVUpigZ6e8oBko/list_thumbnail_en.webp",
  },
  ST01: {
    code: "ST01",
    name: "Starter Deck 01: Heroic Beginnings",
    page: "https://www.gundam-gcg.com/en/products/st01.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/05/02/wwrR5b2tHZf6TtQ0/thumbnail_all_en.webp",
  },
  ST02: {
    code: "ST02",
    name: "Starter Deck 02: Wings of Advance",
    page: "https://www.gundam-gcg.com/en/products/st02.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/05/02/XFAzUEMjeoRVh8CJ/thumbnail_all_en.webp",
  },
  ST03: {
    code: "ST03",
    name: "Starter Deck 03: Zeon's Rush",
    page: "https://www.gundam-gcg.com/en/products/st03.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/05/02/cF1oA6KrAkAwZJ8n/thumbnail_all_en.webp",
  },
  ST04: {
    code: "ST04",
    name: "Starter Deck 04: SEED Strike",
    page: "https://www.gundam-gcg.com/en/products/st04.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/05/02/QFuC8we7GigAGp7A/thumbnail_all_en.webp",
  },
  ST05: {
    code: "ST05",
    name: "Starter Deck 05: Iron Bloom",
    page: "https://www.gundam-gcg.com/en/products/st05.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/08/01/IfqISkNibd2hZBgQ/ST05_thumbnail_en.webp",
  },
  ST06: {
    code: "ST06",
    name: "Starter Deck 06: Clan Unity",
    page: "https://www.gundam-gcg.com/en/products/st06.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/08/01/u8QYORbaolTG4XTI/ST06_thumbnail_en.webp",
  },
  ST07: {
    code: "ST07",
    name: "Starter Deck 07: Celestial Drive",
    page: "https://www.gundam-gcg.com/en/products/st07.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/11/05/kibyx4Caf6LYqO3U/st07_thumbnail_en.webp",
  },
  ST08: {
    code: "ST08",
    name: "Starter Deck 08: Flash of Radiance",
    page: "https://www.gundam-gcg.com/en/products/st08.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/11/05/vzh6LzoLKlbFYT7X/st08_thumbnail_en.webp",
  },
  ST09: {
    code: "ST09",
    name: "Starter Deck 09: Destiny Ignition",
    page: "https://www.gundam-gcg.com/en/products/st09.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2026/01/28/glMtMxEIW23YV9uG/ST09_thumbnail_en.webp",
  },
  ST10: {
    code: "ST10",
    name: "Starter Deck 10: Generation Pulse",
    page: "https://www.gundam-gcg.com/en/products/st10.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2026/03/17/3SvJj8k2zHYTAM8x/ST10_list_thumbnail_en.webp",
  },
  "GCG-PR": {
    code: "GCG-PR",
    name: "Gundam Promotional Cards",
    page: "https://www.gundam-gcg.com/en/products/evx05.html",
    fallbackUrl: "https://www.gundam-gcg.com/gcg/bccard/en/news/2025/10/07/8cxSAWauJZg3XGdh/list_thumbnail_en.webp",
  },
};

async function inspectProductPage(pageUrl) {
  try {
    const html = await fetchText(pageUrl);
    // Find big hero / main packshot image in product page
    // Patterns: images/products/detail/..., mvIllust, mainVisual, or large webp
    const matches = Array.from(html.matchAll(/(?:src|srcset)="([^"]*(?:pack|box|item|thumb|main|pc|mv)[^"]*\.(?:webp|jpg|png))"/gi));
    if (matches.length) {
      for (const m of matches) {
        let u = m[1].split(" ")[0].trim();
        if (!u.startsWith("http")) {
          if (u.startsWith("/")) u = "https://www.gundam-gcg.com" + u;
          else u = "https://www.gundam-gcg.com/en/products/" + u;
        }
        if (!u.includes("logo") && !u.includes("icon") && !u.includes("arrow")) {
          return u;
        }
      }
    }
  } catch (e) {
    console.warn(`Could not inspect page ${pageUrl}:`, e.message);
  }
  return null;
}

async function main() {
  const targetDir = path.resolve("public/images/sets");
  fs.mkdirSync(targetDir, { recursive: true });

  const results = [];

  for (const [code, item] of Object.entries(officialSetMap)) {
    console.log(`Buscando imagem HD para ${code} (${item.name})...`);
    let imageUrl = await inspectProductPage(item.page);
    if (!imageUrl) {
      imageUrl = item.fallbackUrl;
    }
    console.log(`  -> URL escolhida: ${imageUrl}`);

    try {
      const buffer = await fetchBuffer(imageUrl);
      const ext = path.extname(new URL(imageUrl).pathname) || ".webp";
      const filename = `${code.toLowerCase()}${ext}`;
      const filePath = path.join(targetDir, filename);
      fs.writeFileSync(filePath, buffer);
      const localPath = `/images/sets/${filename}`;
      console.log(`  -> Salvo localmente: ${localPath} (${buffer.length} bytes)`);
      results.push({
        code,
        name: item.name,
        officialUrl: item.page,
        remoteImageUrl: imageUrl,
        localImageUrl: localPath,
        sizeBytes: buffer.length,
      });
    } catch (err) {
      console.error(`  -> Erro ao baixar para ${code}:`, err.message);
      // Try fallback
      if (imageUrl !== item.fallbackUrl) {
        try {
          const buffer = await fetchBuffer(item.fallbackUrl);
          const ext = path.extname(new URL(item.fallbackUrl).pathname) || ".webp";
          const filename = `${code.toLowerCase()}${ext}`;
          const filePath = path.join(targetDir, filename);
          fs.writeFileSync(filePath, buffer);
          const localPath = `/images/sets/${filename}`;
          console.log(`  -> Fallback salvo localmente: ${localPath} (${buffer.length} bytes)`);
          results.push({
            code,
            name: item.name,
            officialUrl: item.page,
            remoteImageUrl: item.fallbackUrl,
            localImageUrl: localPath,
            sizeBytes: buffer.length,
          });
        } catch (err2) {
          console.error(`  -> Falha no fallback para ${code}:`, err2.message);
        }
      }
    }
  }

  fs.writeFileSync("data/verified-set-covers.json", JSON.stringify(results, null, 2));
  console.log(`\nConcluído! ${results.length} imagens oficiais salvas em public/images/sets/`);
}

main().catch(console.error);
