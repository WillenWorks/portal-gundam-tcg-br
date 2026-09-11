import https from "node:https";
import fs from "node:fs";

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

async function run() {
  const allProducts = [];
  for (let p = 1; p <= 4; p++) {
    const url = `https://www.gundam-gcg.com/en/products/list.php?page=${p}`;
    const html = await fetchPage(url);
    const regex = /<a href="([^"]+)" class="card productsDetailInner">[\s\S]*?<img src="([^"]+)" alt=""[\s\S]*?<div class="cardTit">([^<]+)<\/div>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      allProducts.push({
        productPage: match[1],
        image: match[2].startsWith("http") ? match[2] : `https://www.gundam-gcg.com${match[2]}`,
        title: match[3].trim(),
      });
    }
  }
  fs.writeFileSync("./data/official-products.json", JSON.stringify(allProducts, null, 2));
  console.log(`Sucesso! ${allProducts.length} produtos oficiais encontrados.`);
  console.log(JSON.stringify(allProducts, null, 2));
}

run();
