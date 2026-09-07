/* Fase 4 §6.1 (docs/44) — RAG de autoria de EffectSpec do simulador.
 *
 * Cole o texto EN do efeito de uma carta nova e a tela rankeia (100% no browser,
 * via `similarSpecsClient`) os EffectSpec já autorados por semelhança de
 * mecânica, pra autorar reaproveitando o padrão da DSL em vez de inventar.
 * Mesmo ranking do tool MCP `gundam_similar_specs` (docs/46) e do
 * `scripts/mcp-gundam/similar-specs.mjs` — a paridade é travada em teste.
 *
 * Fluxo completo: docs/48 (protocolo de auditoria de carta) → esta tela →
 * autorar o spec em `src/modules/simulator/content/stXX.ts`. */
import { useMemo, useState } from "react";

import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { similarSpecsClient, type SpecSignature } from "@/lib/similar-specs-client";
import signaturesJson from "@/modules/simulator/content/_index/specs-signatures.json";

const signatures = signaturesJson as SpecSignature[];

const EXAMPLES = [
  "Choose 1 enemy Unit. Deal 2 damage to it.",
  "Look at the top 3 cards of your deck. Reveal 1 Unit card and add it to your hand. Return the rest to the bottom of your deck.",
  "Choose 1 enemy Unit with 2 or less HP. Rest it.",
];

export default function SimulatorAuthoringPage() {
  const { user } = useAuth();
  const [effectEn, setEffectEn] = useState("");

  const ranking = useMemo(() => {
    const text = effectEn.trim();
    if (text.length < 4) return null;
    return similarSpecsClient(text, signatures, 3);
  }, [effectEn]);

  if (user?.role !== "ADMIN") {
    return (
      <PortalShell breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "RAG de autoria" }]}>
        <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
          <CardContent className="p-6">Essa área é exclusiva para administradores.</CardContent>
        </Card>
      </PortalShell>
    );
  }

  return (
    <PortalShell breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "RAG de autoria" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-4 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">
              Simulador · autoria de EffectSpec
            </p>
            <h2 className="font-heading text-5xl uppercase leading-none">RAG de autoria</h2>
            <p className="max-w-4xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
              Cole o texto EN do efeito de uma carta nova. A tela rankeia os EffectSpec já autorados por semelhança de
              mecânica (n-gramas + trigramas literais, sem embeddings, sem backend) para você autorar reaproveitando o
              padrão da DSL. É a alternativa via UI ao tool MCP{" "}
              <code className="rounded-none bg-white/10 px-1.5 py-0.5 text-xs">gundam_similar_specs</code> — mesmo
              ranking. Protocolo completo de carta nova: docs/48 → esta tela → autorar em{" "}
              <code className="rounded-none bg-white/10 px-1.5 py-0.5 text-xs">content/stXX.ts</code>.
            </p>
          </CardContent>
        </Card>

        <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
          <CardContent className="space-y-4 p-5">
            <label htmlFor="authoring-effect" className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Texto EN do efeito
            </label>
            <Textarea
              id="authoring-effect"
              value={effectEn}
              onChange={(event) => setEffectEn(event.target.value)}
              rows={4}
              placeholder="【Deploy】Choose 1 enemy Unit with 3 or less HP. Rest it."
              className="rounded-none font-mono text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Exemplos:</span>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setEffectEn(example)}
                  className="border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
                >
                  {example.length > 44 ? `${example.slice(0, 44)}…` : example}
                </button>
              ))}
              {effectEn ? (
                <Button type="button" variant="outline" className="ml-auto h-7 rounded-none text-xs" onClick={() => setEffectEn("")}>
                  Limpar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {ranking === null ? (
          <p className="border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
            Digite ao menos algumas palavras do efeito para ver os EffectSpec mais próximos.
          </p>
        ) : ranking.results.length === 0 ? (
          <p className="border border-amber-400/20 bg-amber-400/[0.04] p-4 text-sm text-amber-200/80">
            Nenhum EffectSpec com mecânica reconhecível em comum. Ou é um padrão novo (autore do zero, documentando em
            docs/48), ou o texto ainda está curto/atípico demais para o ranking.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              {ranking.count} EffectSpec mais próximos
              {ranking.queryTokens.length ? (
                <>
                  {" "}· mecânicas detectadas:{" "}
                  {ranking.queryTokens.map((token) => (
                    <Badge key={token} className="mx-0.5 rounded-none border border-white/20 bg-white/5 text-[10px] text-slate-300">
                      {token}
                    </Badge>
                  ))}
                </>
              ) : null}
            </p>
            {ranking.results.map((result) => (
              <Card key={result.id} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{result.cardCode}</Badge>
                    <span className="font-mono text-xs text-slate-400">{result.id}</span>
                    <Badge className="rounded-none border border-white/20 bg-white/5 text-slate-300">
                      trigger: {result.trigger || "—"}
                    </Badge>
                    <span className="ml-auto text-xs uppercase tracking-[0.16em] text-slate-400">
                      score <span className="font-heading text-lg text-primary">{result.score}</span>
                      {result.sharedTrigrams ? ` · ${result.sharedTrigrams} trigrama(s)` : ""}
                    </span>
                  </div>
                  <p className="border border-white/10 bg-white/[0.03] p-3 font-mono text-[13px] leading-6 text-slate-200">
                    {result.sourceText}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">ops:</span>
                    {result.ops.length === 0 ? (
                      <span className="text-xs text-slate-600">nenhum</span>
                    ) : (
                      result.ops.map((op, index) => (
                        <Badge key={`${op}-${index}`} className="rounded-none border border-sky-400/30 bg-sky-400/10 text-[11px] text-sky-200">
                          {op}
                        </Badge>
                      ))
                    )}
                  </div>
                  {result.matchedTokens.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">mecânicas em comum:</span>
                      {result.matchedTokens.map((token) => (
                        <span key={token} className="border border-emerald-400/25 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[10px] text-emerald-200/90">
                          {token}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
