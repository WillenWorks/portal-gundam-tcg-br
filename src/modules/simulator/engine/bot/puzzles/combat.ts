import type { Puzzle } from "./types";
import { act, base, board, put, real, resources, setShields, unit } from "./fixtures";

/** situações de combate: letal, ataque, bloqueio e Action Step */
export const COMBAT_PUZZLES: Puzzle[] = [
  {
    id: "letal-direto",
    title: "Letal: oponente sem escudo e sem Base",
    category: "letal",
    why: "Qualquer dano de batalha no jogador sem escudo e sem Base vence a partida.",
    build: () => {
      const state = board("A");
      setShields(state, "B", 0);
      const attacker = put(state, "A", "battleArea", unit("PZ-ATK", 3, 3));
      put(state, "B", "battleArea", unit("PZ-TIRED", 2, 2), { rested: true });
      return { state, seat: "A", refs: { attacker } };
    },
    accepted: [{ describe: "ataca o jogador", match: (a) => a.kind === "declareAttack" && a.target === "player" }],
  },
  {
    id: "letal-com-dois-atacantes",
    title: "Letal com o atacante certo: 1 escudo, sem Base, dois atacantes",
    category: "letal",
    why: "Dois ataques ao jogador: o 1º quebra o último escudo, o 2º vence. Atacar Unit desperdiça o letal.",
    build: () => {
      const state = board("A");
      setShields(state, "B", 1);
      put(state, "A", "battleArea", unit("PZ-ATK1", 2, 2));
      put(state, "A", "battleArea", unit("PZ-ATK2", 2, 2));
      put(state, "B", "battleArea", unit("PZ-BAIT", 1, 1), { rested: true });
      return { state, seat: "A", refs: {} };
    },
    accepted: [{ describe: "ataca o jogador", match: (a) => a.kind === "declareAttack" && a.target === "player" }],
  },
  {
    id: "troca-favoravel",
    title: "Atacar a Unit que morre sem matar o atacante",
    category: "combate",
    why: "5/5 contra a 3/3 rested: destrói de graça (ela desvira no turno do oponente e deixa de ser alvo). Atacar o jogador só quebra 1 escudo; atacar a 6/6 morre.",
    build: () => {
      const state = board("A");
      put(state, "A", "battleArea", unit("PZ-BIG", 5, 5));
      const weak = put(state, "B", "battleArea", unit("PZ-WEAK", 3, 3), { rested: true });
      put(state, "B", "battleArea", unit("PZ-WALL", 6, 6), { rested: true });
      return { state, seat: "A", refs: { weak } };
    },
    accepted: [
      { describe: "ataca a 3/3", match: (a, r) => a.kind === "declareAttack" && a.target !== "player" && a.target.unitId === r.weak },
    ],
  },
  {
    id: "nao-atacar-suicida",
    title: "Não atacar Unit que destrói o atacante sem morrer",
    category: "combate",
    why: "2/2 contra a 5/5 rested: morre e não causa nada.",
    build: () => {
      const state = board("A");
      put(state, "A", "battleArea", unit("PZ-SMALL", 2, 2));
      const wall = put(state, "B", "battleArea", unit("PZ-WALL", 5, 5), { rested: true });
      return { state, seat: "A", refs: { wall } };
    },
    accepted: [
      { describe: "qualquer jogada menos atacar a 5/5", match: (a, r) => !(a.kind === "declareAttack" && a.target !== "player" && a.target.unitId === r.wall) },
    ],
  },
  {
    id: "bloqueio-salva-base",
    title: "Bloquear quando o ataque destrói a Base",
    category: "bloqueio",
    why: "O ataque de 4 AP destrói a Base de 3 HP; o <Blocker> 3/5 absorve e sobrevive.",
    build: () => {
      let state = board("B");
      put(state, "A", "baseSection", base("PZ-BASE", 3));
      const blocker = put(state, "A", "battleArea", unit("PZ-BLK", 3, 5, { effectKeywords: ["Blocker"] }));
      const attacker = put(state, "B", "battleArea", unit("PZ-ATK", 4, 4));
      state = act(state, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
      return { state, seat: "A", refs: { blocker } };
    },
    accepted: [{ describe: "bloqueia com o <Blocker>", match: (a, r) => a.kind === "activateBlocker" && a.blockerId === r.blocker }],
  },
  {
    id: "bloqueio-salva-unit-valiosa",
    title: "Chump-block pra salvar Unit muito mais valiosa",
    category: "bloqueio",
    why: "A 5/2 atacada morre; o <Blocker> 1/1 vale bem menos que ela.",
    build: () => {
      let state = board("B");
      const star = put(state, "A", "battleArea", unit("PZ-STAR", 5, 2), { rested: true });
      const blocker = put(state, "A", "battleArea", unit("PZ-CHUMP", 1, 1, { effectKeywords: ["Blocker"] }));
      const attacker = put(state, "B", "battleArea", unit("PZ-ATK", 3, 3));
      state = act(state, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: star } });
      return { state, seat: "A", refs: { blocker } };
    },
    accepted: [{ describe: "bloqueia com o 1/1", match: (a, r) => a.kind === "activateBlocker" && a.blockerId === r.blocker }],
  },
  {
    id: "nao-bloquear-a-toa",
    title: "Não entregar Unit bloqueando dano que os escudos absorvem",
    category: "bloqueio",
    why: "Com 6 escudos e sem Base em risco, perder o <Blocker> 1/1 pra poupar 1 escudo é troca ruim.",
    build: () => {
      let state = board("B");
      put(state, "A", "battleArea", unit("PZ-CHUMP", 1, 1, { effectKeywords: ["Blocker"] }));
      const attacker = put(state, "B", "battleArea", unit("PZ-ATK", 5, 5));
      state = act(state, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
      return { state, seat: "A", refs: {} };
    },
    accepted: [{ describe: "não bloqueia", match: (a) => a.kind === "skipBlock" }],
  },
  {
    id: "pump-vira-batalha",
    title: "Action Step: pump que transforma derrota em troca",
    category: "combate",
    why: "ST05-013 dá AP+3 ao atacante 3/3: destrói a 4/4 em vez de só morrer.",
    build: () => {
      let state = board("B");
      resources(state, "B", 3);
      const iron = put(state, "B", "hand", real("ST05-013"));
      const attacker = put(state, "B", "battleArea", unit("PZ-ATK", 3, 3));
      const defender = put(state, "A", "battleArea", unit("PZ-DEF", 4, 4), { rested: true });
      state = act(state, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: defender } });
      if (state.combat?.step === "block") state = act(state, "A", { kind: "skipBlock" });
      if (state.combat?.step === "action" && state.combat.actionPriority === "A") state = act(state, "A", { kind: "passAction" });
      return { state, seat: "B", refs: { iron, attacker } };
    },
    accepted: [
      {
        describe: "joga ST05-013 no atacante",
        match: (a, r) => a.kind === "playCommand" && a.cardInstanceId === r.iron && (a.targets?.target ?? []).includes(r.attacker),
      },
    ],
  },
  {
    id: "defesa-remove-atacante",
    title: "Action Step na defesa: Close Combat destrói o atacante antes do dano",
    category: "combate",
    why: "ST03-013 causa 2 no atacante 3/2 e o destrói: a Base não recebe dano.",
    build: () => {
      let state = board("B");
      resources(state, "A", 2);
      put(state, "A", "baseSection", base("PZ-BASE", 3));
      const close = put(state, "A", "hand", real("ST03-013"));
      const attacker = put(state, "B", "battleArea", unit("PZ-ATK", 3, 2));
      state = act(state, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
      if (state.combat?.step === "block") state = act(state, "A", { kind: "skipBlock" });
      return { state, seat: "A", refs: { close, attacker } };
    },
    accepted: [
      {
        describe: "joga Close Combat no atacante",
        match: (a, r) => a.kind === "playCommand" && a.cardInstanceId === r.close && (a.targets?.target ?? []).includes(r.attacker),
      },
    ],
  },
  {
    id: "ataque-com-quem-tem-breach",
    title: "Com Breach, atacar a Unit que morre (dano extra na Base/escudo)",
    category: "combate",
    why: "O <Breach 2> só ativa destruindo Unit: 4/4 contra a 2/2 rested destrói de graça E quebra 1 escudo — estritamente melhor que só atacar o jogador.",
    build: () => {
      const state = board("A");
      put(state, "A", "battleArea", unit("PZ-BREACH", 4, 4, { effectKeywords: ["Breach"], keywordTags: ["Breach 2"] }));
      const prey = put(state, "B", "battleArea", unit("PZ-PREY", 2, 2), { rested: true });
      return { state, seat: "A", refs: { prey } };
    },
    accepted: [
      { describe: "ataca a 2/2", match: (a, r) => a.kind === "declareAttack" && a.target !== "player" && a.target.unitId === r.prey },
    ],
  },
];
