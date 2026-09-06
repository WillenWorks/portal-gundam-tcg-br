/* Fase C (docs/19) — trilha de Shields.
 *
 * Sprint 5 (refinamento Arena 3D) — SEM textos redundantes ("6 SHIELDS", o
 * número grande, os avisos de lethal): a contagem se lia pelas próprias
 * peças. `title` carrega a informação como tooltip.
 *  - vertical: 6 versos de carta em CASCATA sobreposta, de cima pra baixo
 *    (topologia Mobile Suit Arena). Peça viva = moldura ciano; quebrada =
 *    fantasma tracejado; `count <= 2` tinge as vivas de vermelho.
 *  - horizontal: glifos de escudo em linha (mantém o formato antigo pros
 *    callers que não pedem orientação).
 *
 * V6 (docs/31) — pedido do Willen: o `vertical` (o único usado em produção,
 * via `ArenaPlaymat`) ganhou um BADGE numérico (mesma linguagem visual do
 * `CounterChip` do Deck/Trash), porque no mobile a pilha compacta sozinha
 * não deixava clara a quantidade. Número e cascata visual sempre andam
 * juntos — nenhum substitui o outro.
 *
 * V6.2 (docs/33) — `compact` (prop, não mais breakpoint de viewport): quando
 * true, achata a cascata quase por completo ("fica igual o Deck"). Antes
 * isso era decidido por `max-sm:`/`max-lg:` direto no CSS — trocado porque
 * essas rodadas repetidamente bateram limiares DIFERENTES em arquivos
 * diferentes pro MESMO dispositivo (docs/32, "achado de raiz"). Agora quem
 * decide é o `ArenaPlaymat` — a partir do `--card-w` que ele mesmo mediu de
 * verdade (`useArenaScale`), não de um pixel de viewport chutado.
 *
 * `selectable` (efeito que mira uma shield): cada peça VIVA vira <button> com
 * hit-area >= 44px. */
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardBackUrl } from "./cardArt";

interface ShieldRailProps {
  count: number;
  max?: number;
  selectable?: boolean;
  selectedIndexes?: number[];
  onSelectIndex?: (index: number) => void;
  /** realce transitório de dano recém-tomado (o pai controla por quanto tempo). */
  justBroken?: boolean;
  /** Frente 4 (docs/38 §3.4) — a trilha está sob mira direta de um ataque
   *  "no jogador": pulso sutil na borda. */
  underAim?: boolean;
  /** "vertical" = cascata na coluna lateral; "horizontal" (padrão) = linha de glifos. */
  orientation?: "horizontal" | "vertical";
  /** V6.2 (docs/33) — achata a cascata (só `vertical`), ver docstring do arquivo. */
  compact?: boolean;
}

export function ShieldRail({
  count,
  max = 6,
  selectable,
  selectedIndexes = [],
  onSelectIndex,
  justBroken,
  underAim,
  orientation = "horizontal",
  compact,
}: ShieldRailProps) {
  const total = Math.max(max, count);
  const low = count <= 2;
  const vertical = orientation === "vertical";
  const label = `${count} de ${total} shields${count <= 1 ? " — lethal a 1 golpe" : ""}`;

  return (
    <div
      role="list"
      aria-label={label}
      title={label}
      className={cn(
        "rounded-arena",
        vertical ? "relative flex flex-col items-center" : "flex items-center gap-0.5",
        justBroken && "ring-1 ring-red-500/60",
        underAim && "ring-2 ring-red-400/70 animate-pulse motion-reduce:animate-none",
      )}
    >
      {/* V6 (docs/31): número fixo no canto, não se move conforme shields
          saem — só o valor muda. Mesma linguagem visual do badge de pilha
          do CounterChip (Deck/Trash). */}
      {vertical ? (
        <span
          className={cn(
            "absolute -right-1 -top-1 z-10 rounded-arena border bg-slate-950 px-1 font-mono text-[11px] font-black leading-tight tabular-nums",
            low ? "border-red-500/70 text-red-300" : "border-white/20 text-slate-100",
          )}
        >
          {count}
        </span>
      ) : null}
      {Array.from({ length: total }, (_, i) => {
        const full = i < count;
        const selected = selectedIndexes.includes(i);
        const pickable = Boolean(selectable && full && onSelectIndex);
        // V6.1/V6.2 (docs/32, docs/33) — pedido do Willen: quando `compact`,
        // SEM cascata nenhuma, "fica igual o deck" (pilha achatada, só a de
        // cima visível + o número já cuida da contagem). `*0.87` ≈ a altura
        // inteira do verso da carta (aspect 63/88 → altura ≈ largura*1,397;
        // largura já é `card-w*0,62`, então altura ≈ `card-w*0,866` —
        // arredondado pra cima, sem sobra de sub-pixel) — sobrepõe quase
        // tudo, ao contrário do `*0,62` do modo normal (que subtrai só a
        // LARGURA, de propósito, pra sobrar uma tira visível = a cascata).
        // Ressalva: com `selectable`, o botão da peça de cima cobre o clique
        // das de baixo nessa faixa — aceitável pro caso comum (exibição
        // passiva), mas um fluxo real de "escolher a shield de baixo" com
        // `compact` ligado ficaria difícil de acertar; não há esse fluxo
        // ativo em ST01/ST02 hoje.
        // V6.3 (docs/34): `--card-w-std` (tamanho-padrão único) em vez de
        // `--card-w*0.62` escrito à mão aqui — a peça já usa `--card-w-std`
        // como largura (linha abaixo), então "subtrair a LARGURA" (cascata
        // normal) é exatamente `1 × --card-w-std`; "subtrair quase a ALTURA
        // inteira" (achatado) é `card-w-std × 88/63` (a mesma proporção
        // 63:88 de sempre). 2 strings ESTÁTICAS completas, nunca
        // interpolação dentro do valor arbitrário — o scanner do Tailwind
        // precisa achar a classe inteira como texto literal no código-fonte
        // pra gerar o CSS; um template literal montando só o número em
        // runtime não seria escaneado.
        // Frente 4 (feedback Willen 3ª rodada): cascata MAIS JUNTA — antes
        // subtraía só a LARGURA (`1 × --card-w-std`), deixando uma tira alta por
        // shield; a coluna toda invadia o centro. Agora subtrai `1.3 ×` (fica
        // só uma fresta visível, lê como bloco só). `compact` segue quase full.
        const cascade =
          !vertical || i === 0
            ? undefined
            : compact
              ? "-mt-[calc(var(--card-w-std,2.17rem)*88/63)]"
              : "-mt-[calc(var(--card-w-std,2.17rem)*1.3)]";

        const piece = vertical ? (
          <span
            className={cn(
              "relative block aspect-[63/88] w-[var(--card-w-std,2.17rem)] overflow-hidden rounded-arena border transition-colors duration-100 motion-reduce:transition-none",
              full
                ? selected
                  ? "border-emerald-400"
                  : low
                    ? "border-red-500/70"
                    : "border-primary/60"
                : "border-dashed border-white/10",
            )}
          >
            {full ? (
              <>
                <img src={cardBackUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                {selected ? <span className="absolute inset-0 bg-emerald-500/40" /> : null}
                {low && !selected ? <span className="absolute inset-0 bg-red-500/25" /> : null}
              </>
            ) : null}
          </span>
        ) : (
          <span
            className={cn(
              "flex size-3.5 items-center justify-center border transition-colors duration-100 motion-reduce:transition-none",
              full
                ? selected
                  ? "border-emerald-400 bg-emerald-500/30 text-emerald-300"
                  : low
                    ? "border-red-500/70 text-red-400"
                    : "border-primary/50 text-primary"
                : "border-dashed border-white/10 text-transparent",
            )}
          >
            <Shield className="size-2.5" aria-hidden fill={full ? "currentColor" : "none"} />
          </span>
        );

        return pickable ? (
          <button
            key={i}
            type="button"
            onClick={() => onSelectIndex?.(i)}
            aria-pressed={selected}
            aria-label={`Shield ${i + 1}`}
            className={cn(
              "relative flex items-center justify-center rounded-arena hover:brightness-125",
              vertical ? "min-h-11 w-full" : "size-11",
              cascade,
            )}
          >
            {piece}
          </button>
        ) : (
          <span key={i} role="listitem" className={cn(vertical && "flex w-full justify-center", cascade)}>
            {piece}
          </span>
        );
      })}
    </div>
  );
}
