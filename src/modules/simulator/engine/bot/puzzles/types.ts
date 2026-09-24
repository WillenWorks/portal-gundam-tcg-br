import type { GameState, PlayerId } from "../../types";
import type { LegalAction } from "../../legalActions";

/**
 * Situação do banco de avaliação do bot (spec bot-avaliacao-forca): um estado de
 * jogo montado, o assento que decide e o CONJUNTO de jogadas aceitas como
 * corretas. Mede qualidade de jogo (acertar a jogada certa), não sorte.
 */
export type PuzzleCategory =
  | "letal"
  | "bloqueio"
  | "combate"
  | "remocao"
  | "efeito-util"
  | "efeito-inutil"
  | "sequencia"
  | "custo-oportunidade";

export interface PuzzleSetup {
  state: GameState;
  seat: PlayerId;
  /** ids das cartas montadas, pros matchers referenciarem sem depender de instanceId gerado */
  refs: Record<string, string>;
}

export interface ActionMatcher {
  /** texto pro relatório: "ataca o jogador com a Unit de 5 AP" */
  describe: string;
  match: (action: LegalAction, refs: Record<string, string>) => boolean;
}

export interface Puzzle {
  id: string;
  title: string;
  category: PuzzleCategory;
  /** por que a(s) jogada(s) aceita(s) é(são) a certa — vai no relatório de erro */
  why: string;
  build: () => PuzzleSetup;
  accepted: ActionMatcher[];
}
