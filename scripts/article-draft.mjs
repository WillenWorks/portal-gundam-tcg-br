// Grava um artigo de content/articles/ como RASCUNHO (DRAFT) no banco, com a capa, para revisar e aprovar no
// /admin/articles. Roda na VPS pela tarefa "artigo-rascunho" do workflow "Manutenção da VPS".
//
//   cd /root/portal-gundam-tcg-br && node <caminho>/scripts/article-draft.mjs <caminho>/content/articles/<nome>.md
//
// - O .md tem front matter (title, slug, postType, excerpt, cover); `cover` é o arquivo de imagem ao lado do .md.
// - A capa vai para o mesmo storage do upload do admin (STORAGE_DRIVER local ou supabase, do .env).
// - Rodar de novo com o mesmo slug atualiza o rascunho; um artigo já publicado ou em revisão nunca é alterado.
// - Dependências (@prisma/client, dotenv) vêm do diretório atual, então o script pode estar fora do app.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const POST_TYPES = new Set(["NEWS", "PREVIEW", "REVIEW", "GUIDE"]);
const IMAGE_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** Separa o front matter (`chave: valor`, aspas opcionais) do corpo em Markdown. */
export function parseArticle(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error("O arquivo precisa começar com o front matter entre linhas '---'.");
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`Linha inválida no front matter: ${line}`);
    let value = kv[2].trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
    meta[kv[1]] = value;
  }
  for (const key of ["title", "slug"]) if (!meta[key]) throw new Error(`Falta "${key}" no front matter.`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.slug)) throw new Error(`Slug inválido: ${meta.slug}`);
  const postType = meta.postType || "NEWS";
  if (!POST_TYPES.has(postType)) throw new Error(`postType inválido: ${postType}`);
  const contentMd = match[2].trim();
  if (!contentMd) throw new Error("O artigo está sem texto.");
  return { title: meta.title, slug: meta.slug, postType, excerpt: meta.excerpt || null, cover: meta.cover || null, contentMd };
}

async function saveCover(file, objectKey, env) {
  const contentType = IMAGE_TYPES[path.extname(file).toLowerCase()];
  if (!contentType) throw new Error(`Formato de capa não aceito: ${path.basename(file)}`);
  const buffer = fs.readFileSync(file);
  const driver = (env.STORAGE_DRIVER || "local").toLowerCase();
  if (driver === "local") {
    const root = path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR || "public/uploads");
    const target = path.join(root, objectKey);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
    return `/uploads/${objectKey}`;
  }
  if (driver !== "supabase") throw new Error(`STORAGE_DRIVER inválido: ${driver}`);
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  const bucket = env.SUPABASE_STORAGE_BUCKET || "card-images";
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Storage Supabase sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.");
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!response.ok) throw new Error(`Upload da capa no Supabase falhou: HTTP ${response.status}`);
  return env.SUPABASE_STORAGE_PUBLIC_BASE_URL
    ? `${env.SUPABASE_STORAGE_PUBLIC_BASE_URL}/${objectKey}`
    : `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectKey}`;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Uso: node scripts/article-draft.mjs <arquivo.md>");
  const article = parseArticle(fs.readFileSync(file, "utf8"));

  const require = createRequire(path.join(process.cwd(), "package.json"));
  require("dotenv").config({ path: path.join(process.cwd(), ".env") });
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.post.findUnique({ where: { slug: article.slug } });
    if (existing && existing.status !== "DRAFT") {
      throw new Error(`Já existe o artigo "${article.slug}" com status ${existing.status}; nada foi alterado.`);
    }

    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const author =
      (adminEmail && (await prisma.user.findUnique({ where: { email: adminEmail } }))) ||
      (await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } }));
    if (!author) throw new Error("Nenhum usuário ADMIN para assinar o artigo.");

    let coverImage = existing?.coverImage ?? null;
    if (article.cover) {
      const now = new Date();
      const objectKey = `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/articles/${article.slug}${path.extname(article.cover).toLowerCase()}`;
      coverImage = await saveCover(path.join(path.dirname(file), article.cover), objectKey, process.env);
    }

    const data = {
      title: article.title,
      excerpt: article.excerpt,
      contentMd: article.contentMd,
      coverImage,
      postType: article.postType,
      status: "DRAFT",
    };
    const post = existing
      ? await prisma.post.update({ where: { id: existing.id }, data })
      : await prisma.post.create({ data: { ...data, slug: article.slug, authorId: author.id } });
    console.log(`${existing ? "rascunho atualizado" : "rascunho criado"}: ${post.id}`);
    console.log(`slug: ${post.slug} · tipo: ${post.postType} · status: ${post.status}`);
    console.log(`capa: ${post.coverImage ?? "(sem capa)"}`);
    console.log(`texto: ${post.contentMd.length} caracteres`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((err) => {
    console.error(`❌ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
}
