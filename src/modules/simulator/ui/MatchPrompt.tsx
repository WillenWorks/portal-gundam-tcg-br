/* TopTacticalHUD (docs/52): painel fino no TOPO-centro que resume "o que
 * fazer agora" — "escolha o alvo", "pague o custo", "defenda ou passe" — e,
 * desde o redesenho que tirou os modais centrais bloqueantes, também carrega
 * os botões de ação contextual da jogada em andamento: confirmar/cancelar
 * seleção de alvo/recurso, não bloquear, passar o Passo de Ação. `Esc` aciona
 * `onCancel` sem precisar mirar no botão.
 *
 * Ajuste 2026-09-03: antes era texto 2xl no MEIO da tela e, mesmo com
 * `pointer-events-none`, tapava visualmente as Units que você precisa clicar pra
 * parear/mirar. Agora é um painel compacto no TOPO-centro, FORA do caminho do
 * tabuleiro: o wrapper segue `pointer-events-none` (nunca intercepta clique
 * nem hover fora do próprio painel) — só o painel interno vira
 * `pointer-events-auto` pros botões contextuais responderem a clique.
 *
 * BUG-5AB7HM (27/10) — fica no topo porque é a escolha que pede clicar no campo (pagar custo, alvo, bloqueio), mas num
 * tamanho que acompanha a tela: numa tela de 3440px o "Pague o custo: 0/1" estava minúsculo. */
import { useEffect } from "react";
import { Check, Info, Swords, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteLanguage } from "@/i18n/siteLanguage";

interface MatchPromptProps {
  /** mensagem atual (ou `null` pra esconder). */
  message: string | null;
  /** tom — `info` (padrão) ciano, `warn` âmbar (combate/decisão urgente). */
  tone?: "info" | "warn";
  /** trava os botões contextuais enquanto uma ação de rede está em voo. */
  busy?: boolean;
  /** confirma a jogada pendente (alvo/recurso já escolhidos). */
  onConfirm?: () => void;
  /** `false` trava o botão Confirmar (ex.: custo ainda não pago). Padrão `true`. */
  canConfirm?: boolean;
  /** desfaz a seleção/jogada em andamento (carta pendente ou ataque declarado). Também aciona no `Esc`. */
  onCancel?: () => void;
  /** passa a defesa sem ativar um Blocker. */
  onSkipBlock?: () => void;
  /** passa o Passo de Ação (combate ou fim de turno). */
  onPassAction?: () => void;
}

export function MatchPrompt({
  message,
  tone = "info",
  busy,
  onConfirm,
  canConfirm = true,
  onCancel,
  onSkipBlock,
  onPassAction,
}: MatchPromptProps) {
  const { tr } = useSiteLanguage();
  useEffect(() => {
    if (!onCancel && !onPassAction && !onSkipBlock) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (onCancel) onCancel();
        else if (onPassAction) onPassAction();
        else if (onSkipBlock) onSkipBlock();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, onPassAction, onSkipBlock]);

  if (!message) return null;
  const Icon = tone === "warn" ? Swords : Info;
  const hasActions = Boolean(onConfirm || onCancel || onSkipBlock || onPassAction);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-40 flex justify-center px-3 sm:top-3" data-placement="top">
      <div
        key={message}
        role="status"
        className={cn(
          // Frente 4 (feedback Willen 3ª rodada): `rounded-arena` (não
          // `panel-cut` — o chanfro cortava o fim do texto); `w-fit`/`max-w`
          // pra caber sem truncar. docs/52: painel virou `pointer-events-auto`
          // (só ele, não o wrapper) pra hospedar os botões contextuais.
          "pointer-events-auto flex w-fit max-w-[min(60rem,calc(100vw-1.5rem))] flex-wrap items-center gap-x-3 gap-y-2 rounded-arena border-2 bg-slate-950/95 px-[clamp(0.875rem,0.5rem+0.6vw,1.75rem)] py-[clamp(0.5rem,0.3rem+0.35vw,1rem)] shadow-2xl backdrop-blur-sm",
          tone === "warn"
            ? "border-amber-400/80 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.35)]"
            : "border-primary/70 text-primary shadow-[0_0_24px_rgba(56,189,248,0.3)]",
        )}
      >
        <Icon className="size-[clamp(1rem,0.7rem+0.45vw,1.75rem)] shrink-0" aria-hidden />
        <p className="text-[clamp(0.875rem,0.6rem+0.5vw,1.6rem)] font-black uppercase leading-snug tracking-[0.04em]">{message}</p>
        {hasActions ? (
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
            {onConfirm ? (
              <button
                type="button"
                disabled={busy || !canConfirm}
                onClick={onConfirm}
                className="flex items-center gap-1 rounded-arena border border-current/60 bg-black/20 px-[clamp(0.625rem,0.4rem+0.4vw,1.25rem)] py-[clamp(0.375rem,0.25rem+0.25vw,0.75rem)] text-[clamp(0.75rem,0.55rem+0.35vw,1.2rem)] font-bold uppercase tracking-wide hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="size-[1.1em]" aria-hidden /> Confirmar
              </button>
            ) : null}
            {onSkipBlock ? (
              <button
                type="button"
                disabled={busy}
                onClick={onSkipBlock}
                className="rounded-arena border border-current/60 bg-black/20 px-[clamp(0.625rem,0.4rem+0.4vw,1.25rem)] py-[clamp(0.375rem,0.25rem+0.25vw,0.75rem)] text-[clamp(0.75rem,0.55rem+0.35vw,1.2rem)] font-bold uppercase tracking-wide hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Não Bloquear <span className="opacity-60">(Esc)</span>
              </button>
            ) : null}
            {onPassAction ? (
              <button
                type="button"
                disabled={busy}
                onClick={onPassAction}
                className="rounded-arena border border-current/60 bg-black/20 px-[clamp(0.625rem,0.4rem+0.4vw,1.25rem)] py-[clamp(0.375rem,0.25rem+0.25vw,0.75rem)] text-[clamp(0.75rem,0.55rem+0.35vw,1.2rem)] font-bold uppercase tracking-wide hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Passar Ação <span className="opacity-60">(Esc)</span>
              </button>
            ) : null}
            {onCancel ? (
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="flex items-center gap-1 rounded-arena border border-current/60 bg-black/20 px-[clamp(0.625rem,0.4rem+0.4vw,1.25rem)] py-[clamp(0.375rem,0.25rem+0.25vw,0.75rem)] text-[clamp(0.75rem,0.55rem+0.35vw,1.2rem)] font-bold uppercase tracking-wide hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="size-[1.1em]" aria-hidden /> {tr("Cancelar Jogada", "Cancel Play")} <span className="opacity-60">(Esc)</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
