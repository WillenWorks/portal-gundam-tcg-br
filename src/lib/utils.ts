import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** O texto de efeito das cartas vem com tags <br> literais (dado bruto do jogo oficial),
 *  não quebras de linha reais. Troca por \n pra funcionar com whitespace-pre-line. */
export function formatCardText(text?: string | null): string {
  if (!text) return "";
  return text.replace(/<br\s*\/?>/gi, "\n").trim();
}
