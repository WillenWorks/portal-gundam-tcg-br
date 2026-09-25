/* Fim de partida contra o Zero System (spec bot-zero-system-forte): a lista do
 * counter que o bot usou, pra estudar o confronto. Só existe com a partida
 * encerrada — o servidor não manda a lista antes. */
import type { ZeroCounterSummary } from "@/modules/simulator/engine/bot/zeroCounter";

export interface BotDeckEntryView {
  code: string;
  name: string;
  cardType: string;
  count: number;
}

const TYPE_ORDER = ["UNIT", "PILOT", "COMMAND", "BASE"] as const;
const TYPE_LABEL: Record<string, string> = { UNIT: "Units", PILOT: "Pilots", COMMAND: "Comandos", BASE: "Bases" };

interface ZeroCounterDeckSummaryProps {
  counter: Pick<ZeroCounterSummary, "counterDeckId" | "fallback">;
  entries: BotDeckEntryView[];
}

export function ZeroCounterDeckSummary({ counter, entries }: ZeroCounterDeckSummaryProps) {
  const groups = TYPE_ORDER.map((type) => ({
    type,
    cards: entries.filter((e) => e.cardType === type).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  })).filter((g) => g.cards.length > 0);
  const others = entries.filter((e) => !TYPE_ORDER.includes(e.cardType as (typeof TYPE_ORDER)[number]));
  if (others.length) groups.push({ type: "OTHER" as never, cards: others });

  return (
    <section aria-label="Deck do Zero System" className="w-full max-w-md rounded-arena border border-border/60 bg-slate-900/80 p-4 text-left">
      <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Deck do Zero System</h2>
      <p className="mb-3 text-xs text-muted-portal">
        {counter.counterDeckId}
        {counter.fallback ? " — deck meta (nenhum counter superou)" : " — counter do seu deck"}
      </p>
      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {groups.map((g) => (
          <div key={g.type}>
            <h3 className="text-xs font-semibold text-muted-portal">
              {TYPE_LABEL[g.type] ?? "Outras"} ({g.cards.reduce((s, c) => s + c.count, 0)})
            </h3>
            <ul className="mt-1 space-y-0.5 text-sm text-foreground">
              {g.cards.map((c) => (
                <li key={c.code}>
                  <span className="tabular-nums text-muted-portal">{c.count}×</span> {c.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
