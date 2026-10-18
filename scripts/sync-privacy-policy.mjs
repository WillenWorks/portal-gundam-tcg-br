#!/usr/bin/env node
/* Copia src/legal/privacy-policy.html (fonte única da Política de Privacidade) para dentro da
 * página estática public/privacidade/index.html, entre os marcadores POLICY:START/END.
 * A página do app (src/pages/LegalPages.tsx) importa o mesmo arquivo. Rode depois de editar:
 *   node scripts/sync-privacy-policy.mjs
 * O teste src/legal/privacyPolicy.test.ts falha se as duas versões divergirem. */
import { readFileSync, writeFileSync } from "node:fs";

const fragment = readFileSync("src/legal/privacy-policy.html", "utf8").trimEnd();
const page = "public/privacidade/index.html";
const html = readFileSync(page, "utf8");
const start = html.indexOf("<!-- POLICY:START");
const end = html.indexOf("<!-- POLICY:END -->");
if (start < 0 || end < 0) throw new Error(`marcadores POLICY:START/END não encontrados em ${page}`);
const startLineEnd = html.indexOf("\n", start) + 1;
const indent = " ".repeat(8);
const body = fragment.split("\n").map((l) => (l.trim() ? indent + l : "")).join("\n");
writeFileSync(page, html.slice(0, startLineEnd) + body + "\n" + indent + html.slice(end));
console.log(`${page} atualizado a partir de src/legal/privacy-policy.html`);
