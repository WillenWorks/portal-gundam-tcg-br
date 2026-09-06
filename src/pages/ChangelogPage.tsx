/* Página pública "Novidades" — renderiza `CHANGELOG.md` (raiz do repo) direto no
 * portal, pra quem mantém o arquivo não precisar duplicar conteúdo em dois lugares.
 * Parser de markdown minimalista e proposital: só cobre a sintaxe que o próprio
 * CHANGELOG usa (##/### como cabeçalho de versão/seção, listas `- `, `**bold**`,
 * `` `code` ``, `[texto](link)`, `---` como separador) — não é uma lib genérica,
 * é o suficiente pra este arquivo específico, sem puxar dependência nova. */
import type { ReactNode } from "react";
import { Rocket, Sparkles } from "lucide-react";

import changelogSource from "../../CHANGELOG.md?raw";
import { PublicShell } from "@/components/layout/public/PublicShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Block = { kind: "h3"; text: string } | { kind: "p"; text: string } | { kind: "ul"; items: string[] };
type Section = { heading: string; blocks: Block[] };

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
      i += 1;
      continue;
    }
    if (line.trim().startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        let item = lines[i].trim().slice(2);
        i += 1;
        // continuação de linha (bullet dobrado no markdown-fonte, sem marcador novo)
        while (i < lines.length && lines[i].trim() !== "" && !lines[i].trim().startsWith("- ") && !lines[i].startsWith("#") && lines[i].trim() !== "---") {
          item += ` ${lines[i].trim()}`;
          i += 1;
        }
        items.push(item);
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (line.trim() === "" || line.trim() === "---" || line.startsWith("# ")) {
      i += 1;
      continue;
    }
    const paraLines = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && lines[i].trim() !== "---" && !lines[i].trim().startsWith("- ")) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: "p", text: paraLines.join(" ") });
  }
  return blocks;
}

/** Agrupa o arquivo inteiro em seções por `##` (cada versão vira 1 seção); o texto
 * antes da 1ª `##` é a intro (mostrada solta, sem card). */
function parseChangelog(source: string): { intro: Block[]; sections: Section[] } {
  const lines = source.split("\n");
  const introLines: string[] = [];
  const rawSections: Array<{ heading: string; lines: string[] }> = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      current = { heading: line.slice(3).trim(), lines: [] };
      rawSections.push(current);
      continue;
    }
    (current ? current.lines : introLines).push(line);
  }
  return {
    intro: parseBlocks(introLines),
    sections: rawSections.map((s) => ({ heading: s.heading, blocks: parseBlocks(s.lines) })),
  };
}

/** `**bold**`, `` `code` `` e `[texto](url)` inline, na ordem em que aparecem. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-${n++}`} className="font-semibold text-soft">
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-${n++}`} className="border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[0.85em] text-primary">
          {match[2]}
        </code>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-${n++}`}
          href={match[4]}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {match[3]}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function BlockList({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const key = `b-${i}`;
        if (block.kind === "h3") {
          return (
            <p key={key} className="pt-2 text-sm font-bold text-soft first:pt-0">
              {renderInline(block.text, key)}
            </p>
          );
        }
        if (block.kind === "ul") {
          return (
            <ul key={key} className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={`${key}-${j}`} className="flex gap-2 text-sm leading-6 text-slate-300 dark:text-slate-300 light:text-slate-600">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/70" aria-hidden />
                  <span>{renderInline(item, `${key}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={key} className="text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
            {renderInline(block.text, key)}
          </p>
        );
      })}
    </div>
  );
}

/** `[0.9.0] — 2026-09-04` -> versão + data. `[Não lançado] — rumo ao v1.0.0` -> badge de "em desenvolvimento". */
function VersionCard({ section }: { section: Section }) {
  const match = section.heading.match(/^\[(.+?)\]\s*(?:—\s*(.+))?$/);
  const label = match ? match[1] : section.heading;
  const meta = match ? match[2] : undefined;
  const unreleased = label.toLowerCase().includes("não lançado");
  const isVersionCard = Boolean(match);

  return (
    <section
      className={cn(
        "panel-cut border bg-slate-950/70 p-5 dark:bg-slate-950/70 light:bg-white/88 light:shadow-[0_18px_50px_rgba(15,23,42,0.08)]",
        unreleased ? "border-amber-400/40" : "border-white/10 light:border-slate-300/80",
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 light:border-slate-300/70">
        <div className="flex items-center gap-3">
          {unreleased ? <Sparkles className="size-5 text-amber-400" aria-hidden /> : isVersionCard ? <Rocket className="size-5 text-primary" aria-hidden /> : null}
          <h2 className="font-heading text-2xl uppercase leading-none dark:text-white light:text-slate-900">
            {isVersionCard ? `v${label}` : label}
          </h2>
        </div>
        {meta ? (
          <Badge
            className={cn(
              "rounded-none border px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em]",
              unreleased ? "border-amber-400/50 bg-amber-400/10 text-amber-300" : "border-primary/40 bg-primary/10 text-primary",
            )}
          >
            {unreleased ? "Em desenvolvimento" : meta}
          </Badge>
        ) : null}
      </div>
      <BlockList blocks={section.blocks} />
    </section>
  );
}

export default function ChangelogPage() {
  const { intro, sections } = parseChangelog(changelogSource);

  return (
    <PublicShell
      title="Novidades"
      description="O que mudou no portal, o que está sendo testado agora e o que vem a seguir — atualizado a cada lançamento."
      breadcrumbs={[{ label: "Novidades" }]}
    >
      <div className="space-y-8">
        {intro.length ? <BlockList blocks={intro} /> : null}
        <div className="space-y-6">
          {sections.map((section) => (
            <VersionCard key={section.heading} section={section} />
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
