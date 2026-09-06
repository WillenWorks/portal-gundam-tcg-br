/* Fase C (docs/19) — contador compacto.
 *  - `variant="chip"` (padrão): número grande em mono, cor carrega o estado
 *    (âmbar = aviso, vermelho = crítico). Vira <button> com alvo >= 44px quando
 *    recebe `onClick`. Reusado pelo PileTray como gatilho da bandeja.
 *  - `variant="stack"` (Sprint 5): pilha visual (verso de carta / última carta)
 *    com o número num badge de canto — SEM texto "DECK 38". `hideCount` esconde
 *    o número (deck do oponente = segredo de jogo). `title`/`aria-label`
 *    carregam a leitura como tooltip. */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { cardBackUrl } from "./cardArt";

type CounterChipTone = "normal" | "warn" | "crit";

interface CounterChipProps {
  label: string;
  count: number;
  tone?: CounterChipTone;
  icon?: LucideIcon;
  onClick?: () => void;
  variant?: "chip" | "stack";
  /** só `variant="stack"`: conteúdo da pilha (verso / última carta). Default: verso genérico. */
  face?: ReactNode;
  /** só `variant="stack"`: esconde o número (ex.: deck do oponente). */
  hideCount?: boolean;
}

const TONE_CLASS: Record<CounterChipTone, string> = {
  normal: "border-white/10 text-slate-200",
  warn: "border-amber-400/70 text-amber-300",
  crit: "border-red-500/70 text-red-400",
};
const TONE_BADGE: Record<CounterChipTone, string> = {
  normal: "border-white/20 text-slate-100",
  warn: "border-amber-400/70 text-amber-200",
  crit: "border-red-500/70 text-red-300",
};

// V6.3 (docs/34): `--card-w-std` (tamanho-padrão único), não mais `*0.62` à mão.
const STACK_WIDTH = "w-[var(--card-w-std,2.17rem)]";

export function CounterChip({
  label,
  count,
  tone = "normal",
  icon: Icon,
  onClick,
  variant = "chip",
  face,
  hideCount,
}: CounterChipProps) {
  const readout = hideCount ? label : `${label}: ${count}`;

  if (variant === "stack") {
    const inner = (
      <>
        {/* camadas de profundidade */}
        <span className="absolute inset-0 translate-x-[3px] translate-y-[3px] border border-white/5 bg-slate-950" aria-hidden />
        <span className="absolute inset-0 translate-x-[1.5px] translate-y-[1.5px] border border-white/10 bg-slate-950" aria-hidden />
        {/* V6.3 (docs/34): `rounded-arena` vai AQUI (já tem `overflow-hidden` — é
            quem de fato recorta a arte), não no wrapper externo (que tinha
            `rounded-arena` sem `overflow-hidden` — não recortava nada, achado
            do Willen) — colocar lá cortaria as camadas de profundidade acima,
            que de propósito vazam um pouco pra criar o efeito de pilha. */}
        <span className="relative block aspect-[63/88] w-full overflow-hidden rounded-arena border border-white/10 bg-gradient-to-br from-slate-800 via-slate-900 to-black">
          {face ?? <img src={cardBackUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
        </span>
        {!hideCount ? (
          <span
            className={cn(
              // V6 (docs/31): 10px → 11px. Frente 4 (feedback Willen 4ª rodada):
              // escala com `--card-w-std` como o resto da arena (o `11px` fixo
              // ficava minúsculo em Full HD) E ancora no canto de DENTRO da
              // pilha (`right-0 top-0`) pra nunca vazar a coluna de estação /
              // o `overflow-hidden` do canvas (deck desalinhado da zona de
              // shields, print do Willen).
              "absolute right-0 top-0 rounded-bl-arena border bg-slate-950/95 px-1 font-mono text-[clamp(0.8125rem,calc(var(--card-w-std,2.17rem)*0.26),1.375rem)] font-black leading-tight tabular-nums",
              TONE_BADGE[tone],
            )}
          >
            {count}
          </span>
        ) : null}
      </>
    );
    // V6.4 (docs/35) — bug real (print de mobile do Willen): `min-h-11
    // min-w-11` (44px) FORÇAVA a pilha (Deck/Trash/Exílio) a ficar maior que
    // `--card-w-std` sempre que a arena encolhia abaixo desse piso — a pilha
    // "descolava" do tamanho de todo o resto (Battle Area, Shields, Base),
    // que encolhe livre. Removido: a pilha agora acompanha `--card-w-std`
    // como qualquer outra peça — o piso de toque já vem de
    // `useArenaScale.DEFAULT_MIN_PX`, não precisa de outro aqui em cima.
    return onClick ? (
      <button
        type="button"
        onClick={onClick}
        title={readout}
        aria-label={readout}
        className={cn("relative block rounded-arena transition-[filter] duration-100 hover:brightness-125 motion-reduce:transition-none", STACK_WIDTH)}
      >
        {inner}
      </button>
    ) : (
      <span title={readout} aria-label={readout} className={cn("relative block", STACK_WIDTH)}>
        {inner}
      </span>
    );
  }

  const body = (
    <>
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="text-[8px] font-semibold uppercase tracking-[0.16em]">{label}</span>
      <span className="font-mono text-base font-black leading-none tabular-nums">{count}</span>
    </>
  );

  const base = cn("inline-flex items-center gap-1.5 rounded-arena border bg-black/40 px-2 py-1", TONE_CLASS[tone]);

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${label}: ${count}`}
        className={cn(
          base,
          "min-h-11 min-w-11 justify-center transition-colors duration-100 hover:border-primary/70 motion-reduce:transition-none",
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={base} aria-label={`${label}: ${count}`}>
      {body}
    </div>
  );
}
