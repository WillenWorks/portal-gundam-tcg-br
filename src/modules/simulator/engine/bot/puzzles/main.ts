import type { Puzzle } from "./types";
import { base, board, put, real, resources, setShields, unit } from "./fixtures";

/** situações de Main Phase: remoção, efeitos, custo de oportunidade e sequência no turno */
export const MAIN_PUZZLES: Puzzle[] = [
  {
    id: "remocao-maior-ameaca",
    title: "Bounce na maior ameaça",
    category: "remocao",
    why: "ST04-013 devolve Unit com HP ≤ 3: a 5/3 vale muito mais que a 1/1.",
    build: () => {
      const state = board("A");
      resources(state, "A", 2);
      const bounce = put(state, "A", "hand", real("ST04-013"));
      const threat = put(state, "B", "battleArea", unit("PZ-THREAT", 5, 3));
      put(state, "B", "battleArea", unit("PZ-SMALL", 1, 1));
      return { state, seat: "A", refs: { bounce, threat } };
    },
    accepted: [
      {
        describe: "joga ST04-013 na 5/3",
        match: (a, r) => a.kind === "playCommand" && a.cardInstanceId === r.bounce && (a.targets?.target ?? []).includes(r.threat),
      },
    ],
  },
  {
    id: "remocao-que-mata",
    title: "Dano no alvo que morre",
    category: "remocao",
    why: "ST03-013 causa 2: destrói a 3/2; na 6/6 não faz nada relevante.",
    build: () => {
      const state = board("A");
      resources(state, "A", 2);
      const close = put(state, "A", "hand", real("ST03-013"));
      const dies = put(state, "B", "battleArea", unit("PZ-DIES", 3, 2));
      put(state, "B", "battleArea", unit("PZ-TANK", 6, 6));
      return { state, seat: "A", refs: { close, dies } };
    },
    accepted: [
      {
        describe: "joga Close Combat na 3/2",
        match: (a, r) => a.kind === "playCommand" && a.cardInstanceId === r.close && (a.targets?.target ?? []).includes(r.dies),
      },
    ],
  },
  {
    id: "cura-sem-alvo-danificado",
    title: "Não dar rest na Base pra curar quem não tem dano",
    category: "efeito-inutil",
    why: "GD01-124 recupera HP, mas nenhuma Unit amiga tem dano: só gasta a ativação da Base.",
    build: () => {
      const state = board("A");
      const side7 = put(state, "A", "baseSection", real("GD01-124"));
      put(state, "A", "battleArea", unit("PZ-HEALTHY", 2, 4), { rested: true });
      return { state, seat: "A", refs: { side7 } };
    },
    accepted: [{ describe: "não ativa GD01-124", match: (a, r) => !(a.kind === "activateAbility" && a.sourceInstanceId === r.side7) }],
  },
  {
    id: "compra-recurso-sobrando",
    title: "Comprar com recurso que sobraria",
    category: "efeito-util",
    why: "GD01-100 'Draw 2' e nada mais pra fazer com os recursos no turno.",
    build: () => {
      const state = board("A");
      resources(state, "A", 4);
      const draw = put(state, "A", "hand", real("GD01-100"));
      return { state, seat: "A", refs: { draw } };
    },
    accepted: [{ describe: "joga GD01-100", match: (a, r) => a.kind === "playCommand" && a.cardInstanceId === r.draw }],
  },
  {
    id: "token-em-campo",
    title: "Pôr token em campo",
    category: "efeito-util",
    why: "ST04-012 cria um token Unit sem custo extra de carta — presença de campo.",
    build: () => {
      const state = board("A");
      resources(state, "A", 4);
      const pack = put(state, "A", "hand", real("ST04-012"));
      return { state, seat: "A", refs: { pack } };
    },
    accepted: [{ describe: "joga ST04-012", match: (a, r) => a.kind === "playCommand" && a.cardInstanceId === r.pack }],
  },
  {
    id: "cura-com-base",
    title: "Curar Unit danificada com a Base",
    category: "efeito-util",
    why: "GD01-124 (Rest esta Base) recupera 1 HP de Unit amiga: ganho de graça.",
    build: () => {
      const state = board("A");
      const side7 = put(state, "A", "baseSection", real("GD01-124"));
      put(state, "A", "battleArea", unit("PZ-HURT", 2, 4), { damage: 2, rested: true });
      return { state, seat: "A", refs: { side7 } };
    },
    accepted: [{ describe: "ativa GD01-124", match: (a, r) => a.kind === "activateAbility" && a.sourceInstanceId === r.side7 }],
  },
  {
    id: "pump-sem-atacante",
    title: "Não dar pump sem quem ataque",
    category: "efeito-inutil",
    why: "ST05-013 (1 de dano + AP+3 no turno) numa Unit já rested: só perde HP e a carta.",
    build: () => {
      const state = board("A");
      resources(state, "A", 2);
      const iron = put(state, "A", "hand", real("ST05-013"));
      put(state, "A", "battleArea", unit("PZ-TIRED", 3, 3), { rested: true });
      return { state, seat: "A", refs: { iron } };
    },
    accepted: [{ describe: "não joga ST05-013", match: (a, r) => !(a.kind === "playCommand" && a.cardInstanceId === r.iron) }],
  },
  {
    id: "deploy-antes-de-comprar",
    title: "Recurso pra uma jogada só: Unit forte antes de comprar",
    category: "custo-oportunidade",
    why: "Com 4 recursos, a 5/5 (custo 3) muda o campo; Draw 2 (custo 3) pode esperar.",
    build: () => {
      const state = board("A");
      resources(state, "A", 4);
      put(state, "A", "hand", real("GD01-100"));
      const strong = put(state, "A", "hand", unit("PZ-STRONG", 5, 5, { cost: 3 }));
      return { state, seat: "A", refs: { strong } };
    },
    accepted: [{ describe: "deploya a 5/5", match: (a, r) => a.kind === "deployCard" && a.cardInstanceId === r.strong }],
  },
  {
    id: "pilot-antes-de-atacar",
    title: "Parear o Pilot antes de atacar",
    category: "sequencia",
    why: "O Pilot soma AP/HP à Unit: parear primeiro faz o ataque do turno render mais.",
    build: () => {
      const state = board("A");
      resources(state, "A", 3);
      const attacker = put(state, "A", "battleArea", unit("PZ-FRAME", 3, 3));
      const pilot = put(state, "A", "hand", { code: "PZ-PILOT", nameEn: "PZ Pilot", cardType: "PILOT", color: "blue", level: 1, cost: 1, ap: 2, hp: 1 });
      return { state, seat: "A", refs: { attacker, pilot } };
    },
    accepted: [
      { describe: "pareia o Pilot com a Unit", match: (a, r) => a.kind === "deployCard" && a.cardInstanceId === r.pilot && a.pairWithUnitId === r.attacker },
    ],
  },
  {
    id: "rest-e-ataque",
    title: "Sequência: dar rest na Unit inimiga e depois atacá-la",
    category: "sequencia",
    why: "Unit active não pode ser atacada. ST02-014 dá rest na 3/3 e o 5/5 a destrói no mesmo turno.",
    build: () => {
      const state = board("A");
      resources(state, "A", 3);
      const siege = put(state, "A", "hand", real("ST02-014"));
      put(state, "A", "battleArea", unit("PZ-ATK", 5, 5));
      const target = put(state, "B", "battleArea", unit("PZ-TARGET", 3, 3));
      return { state, seat: "A", refs: { siege, target } };
    },
    accepted: [
      {
        describe: "joga ST02-014 na 3/3 (antes de atacar)",
        match: (a, r) => a.kind === "playCommand" && a.cardInstanceId === r.siege && (a.targets?.target ?? []).includes(r.target),
      },
    ],
  },
  {
    id: "remove-bloqueador-e-letal",
    title: "Sequência letal: remover o <Blocker> e atacar o jogador",
    category: "sequencia",
    why: "Oponente sem escudo e sem Base; o único <Blocker> 2/2 impede o letal. Close Combat o destrói antes do ataque.",
    build: () => {
      const state = board("A");
      setShields(state, "B", 0);
      resources(state, "A", 2);
      const close = put(state, "A", "hand", real("ST03-013"));
      put(state, "A", "battleArea", unit("PZ-ATK", 3, 3));
      const blocker = put(state, "B", "battleArea", unit("PZ-BLK", 2, 2, { effectKeywords: ["Blocker"] }));
      return { state, seat: "A", refs: { close, blocker } };
    },
    accepted: [
      {
        describe: "joga Close Combat no <Blocker> antes de atacar",
        match: (a, r) => a.kind === "playCommand" && a.cardInstanceId === r.close && (a.targets?.target ?? []).includes(r.blocker),
      },
    ],
  },
  {
    id: "nao-atacar-base-com-blocker-segurando",
    title: "Não abrir a guarda: manter o <Blocker> que segura a Base",
    category: "combate",
    why: "A 4/4 do oponente destrói a Base (4 HP) se o <Blocker> 5/7 estiver rested; em pé, ele bloqueia e destrói a 4/4 sobrevivendo. Atacar com ele só quebra 1 escudo e entrega a Base de graça.",
    build: () => {
      const state = board("A");
      put(state, "A", "baseSection", base("PZ-BASE", 4));
      // a versão anterior (2/5 contra 6/6) era ambígua: o bloqueio custava a Unit (ou 6 de dano, que persiste) pra salvar a Base
      const blocker = put(state, "A", "battleArea", unit("PZ-BLK", 5, 7, { effectKeywords: ["Blocker"] }));
      put(state, "B", "battleArea", unit("PZ-THREAT", 4, 4));
      setShields(state, "A", 5);
      return { state, seat: "A", refs: { blocker } };
    },
    accepted: [{ describe: "não ataca com o <Blocker>", match: (a, r) => !(a.kind === "declareAttack" && a.attackerId === r.blocker) }],
  },
];
