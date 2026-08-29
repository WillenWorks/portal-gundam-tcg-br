# Simulador — Fase 1: motor de partida + DSL de efeitos (proposta)

## Status

**Em andamento — passos 1 e 2 concluídos; passo 3 (deck de teste real) com
motor de jogo genuíno (jogar carta da mão + dispatcher automático de
trigger) e partida real ST01×ST02 até GAME_OVER validada, cobrindo os 27
EffectSpecs implementados. Link condition (Comprehensive Rules 3-2-6) já
estruturada e validada — ver "Link condition" abaixo. Passo 4 (UI mínima de
sandbox, com sessão real multi-aba, decisão do Willen em 2026-08-28): a
metade servidor está pronta — `PlayerAction`/`applyPlayerAction` (borda
ação→motor com autorização), `viewStateFor` (redação de informação oculta
por jogador) e as rotas HTTP/SSE (`/api/simulator/matches/...`, restritas a
admin/hoster, match store em memória sem persistência) — ver "Servidor do
sandbox" abaixo. Falta a UI React que consome isso (2 abas, 2 contas).**
Este documento nasce da decisão de partir pro simulador em 3 fases — (1)
sandbox solo que entende todas as regras do jogo e das cartas, pra testar
jogadas sozinho; (2) IA simples; (3) PvP — começando pela Fase 1, escolhida
de propósito por ter o menor impacto na arquitetura em produção.

Plano de execução completo (ordem de waves por produto real, dev-only até
segunda ordem, camadas de regra) confirmado com o Willen antes de começar
(ago/2026). Progresso:

- ✅ **Passo 1 — motor de estado puro**: zonas, as 5 fases de turno, a
  sequência de combate de 5 passos, e as 8 keywords/mecânicas oficiais
  (Blocker, First Strike, High-Maneuver, Support N, Repair N, Breach N,
  Suppression, 【Once per Turn】) implementadas e testadas via `pnpm test`
  (ver `src/modules/simulator/engine/*.test.ts`). Zero mudança em
  `prisma/schema.prisma` ou `server/index.ts`, como planejado.
- ✅ Formalização da Camada 3 (Effect Spec) escrita como tipo/executor real
  em `src/modules/simulator/engine/effectSpec.ts` (ver seção própria abaixo)
  — só a tubulação, nenhum efeito de carta real ainda.
- ✅ **Passo 2 — validar contra o deck vanilla**: `fullGame.test.ts` roda
  partidas completas de ponta a ponta (não só por unidade de regra) contra o
  deck vanilla sintético, com 2 seeds diferentes — várias dezenas de ciclos
  de Start/Draw/Resource/Main/End com combate real a cada turno, até bater
  numa condição oficial de derrota (deck-out ou dano de batalha sem shield),
  checando a cada turno que o limite de mão (10) e a contagem de shields
  (0–6) nunca saem da faixa válida. Isso valida integração ao longo de
  dezenas de ciclos — coisa que os testes unitários de fase/combate isolados
  não pegam (acúmulo de descarte por limite de mão repetido, `cloneState`
  chamado centenas de vezes sem vazar referência entre turnos, alternância
  de turno correta por muitas rodadas). 71 testes no total agora
  (`pnpm test`).
- 🔄 **Passo 3 — deck de teste real + EffectSpecs bespoke, em andamento**:
  ST01 "Heroic Beginnings" (✅, 16 EffectSpecs, 10/16 cartas) e ST02
  "Ruination Ablaze" (✅, 11 EffectSpecs, 7/16 cartas) — ordem histórica de
  lançamento (ver "Plano de implementação incremental"). Ver "Cobertura real
  — ST01" e "Cobertura real — ST02" abaixo pras tabelas completas.
  Descobriu e preencheu duas lacunas reais: faltava uma primitiva de "dano
  direto numa Unit" (`damageUnit`, ST01) e `keywordValue()` nunca lia
  `keywordGrants` — uma keyword numérica concedida em tempo de jogo (ex.
  `<Breach 3>` de ST02-012) nunca teria seu valor lido de volta pelo
  combate (ST02, corrigido em `types.ts`, com teste de regressão rodando o
  grant através do combate real). Exatamente o tipo de achado que a ordem
  "motor primeiro, conteúdo depois" do plano queria baratear. 99 testes no
  total naquele ponto (`pnpm test`).
- ✅ **Motor de jogo real + gaps documentados** (decisão com o Willen,
  2026-08-28): faltava a peça que liga "EffectSpec autorado" a "jogo de
  verdade" — até então `st01.test.ts`/`st02.test.ts` montavam
  `EffectContext` na mão, sem nunca de fato jogar uma carta da mão ou
  disparar um trigger automaticamente. Implementado:
  - `deploy.ts` — `deployCard()` (Unit/Pilot/Base: paga custo restando N
    recursos, valida Level contra o total de recursos em campo, respeita o
    limite de 6 Units na Battle Area, pareia Pilot com Unit amiga
    imediatamente — nunca fica Pilot desparelhado em campo — e substitui a
    Base existente, mandando-a pro trash via `MOVE_CARD`, nunca
    `DESTROY_CARD`, porque a regra 11-5-2 explicitamente diz que isso não
    conta como "destruída") e `playCommand()` (Command 【Main】/【Action】:
    resolve o efeito, depois move a carta pro trash, regra 3-4-4).
  - `dispatcher.ts` — `dispatchTrigger()` acha e resolve automaticamente
    todo `EffectSpec` de uma carta pra um trigger dado (Deploy/When
    Paired/Attack/Burst/Main/Action/Activate·Main), respeitando 【Once per
    Turn】 genericamente via `CardDef.oncePerTurn` +
    `usedKeywordsThisTurn`; `dispatchBurstForNewlyTrashedShields()` compara
    o estado antes/depois de um Damage Step, acha shields recém-trashadas
    com `hasBurst` + EffectSpec cadastrado, e oferece a ativação por
    escolha de quem defende.
  - `st01VsSt02Match.test.ts` — uma partida real, do `createGame` a um
    `GAME_OVER` de verdade, jogada só com ações reais do motor
    (`deployCard`/`playCommand`/`declareAttack`/.../`dispatchTrigger`,
    nunca mutação direta de zona pra fingir uma jogada), cobrindo os 27
    EffectSpecs hoje implementados (16 ST01 + 11 ST02) mais `<Repair 2>`,
    `<Blocker>` e a concessão dinâmica de `<Breach 3>` em combate real.
    Regra confirmada contra múltiplas fontes independentes antes de
    implementar (custo/Level/pareamento de Pilot/substituição de Base).
    130 testes no total agora (`pnpm test`), `tsc -b` e `eslint` limpos.
  - Fora de escopo desta wave, como decidido: as 8 lacunas de DSL já
    documentadas abaixo (efeito contínuo/estático, alvo em grupo, custo de
    recurso genérico, criação de token, informação oculta, restrição de
    legalidade de alvo) continuam "Parcial"/documentadas, não fingidas nem
    fechadas.
  - Achado novo (fora das 8 lacunas, registrado por transparência): o
    `moveZone self->baseSection` usado pelos Burst de Base (`WHITE_BASE_BURST`,
    `ASTICASSIA_BURST`, `SAINT_GABRIEL_INSTITUTE_BURST`, `CORSICA_BASE_BURST`)
    é a primitiva genérica de movimento — ela não conhece a regra "máx. 1
    Base" (só a lógica explícita de `deployCard` conhece). Na prática isso só
    importa se um Burst de Base for ativado com uma Base já em campo; o teste
    de partida real isola esse caso por fixture. Não é um dos 27 EffectSpecs
    nem uma das 8 lacunas — é uma refinaria de regra pequena, deixada pra
    quando (se) isso importar de verdade num fluxo de UI real.
- ⏳ Ainda não iniciado: passo 4 (UI mínima de sandbox), passo 5 (critério
  de "Fase 1 pronta").

## Fonte

- Comprehensive Rules v1.8.0 (`gundam-gcg.com/en/pdf/comprehensiverules_en.pdf`), conferida em 2026-08-27.
- Play Guide oficial (`gundam-gcg.com/en/welcome/playguide.php`), conferida em 2026-08-27.
- `docs/14-motor-regras-deck.md` (motor de regras de *deck*, Pacote A, já implementado) — as regras de *partida* (limite de 15 recursos/5 EX, 6 units em campo, mão de 10, validação de link condition) foram deliberadamente deixadas de fora dali, anotadas como "Pacote D — simulador". Este documento é esse Pacote D, fase 1.
- `docs/16-roadmap-ideias-mapeadas.md` — já registrava o simulador como "a peça mais difícil... não é mais uma feature, é um segundo produto", recomendando começar só por um assistente de partida (contador de vida/zona) antes de qualquer automação de regra. A decisão tomada aqui — ir direto pra um motor completo de regras, sem oponente ainda — é mais ambiciosa que essa recomendação original. Ver "Risco aceito" no fim do documento.
- Vale reconferir Comprehensive Rules e Play Guide periodicamente — igual já vale pro motor de regras de deck, a Bandai atualiza sem aviso prévio.

## Escopo da Fase 1

**Entra:**
- Sandbox de partida solo — um jogador testa jogadas sozinho, controlando os
  dois lados do tabuleiro (não existe oponente automatizado ainda). O
  objetivo não é uma tela bonita, é provar que o motor aplica **todas** as
  regras de partida corretamente.
- Motor de estado completo: zonas, as 5 fases de turno, sequência de combate
  passo a passo, todas as keywords oficiais.
- DSL de efeitos com cobertura de 100% das keywords oficiais (são um conjunto
  fechado e já bem definido pelas regras) + cobertura incremental de efeito
  bespoke carta a carta, começando por **um** deck de teste pequeno (proposta:
  o starter deck mais "vanilla" do catálogo — a definir quando a implementação
  começar).

**Fica pra depois (não é escopo deste documento):**
- IA (Fase 2) e PvP (Fase 3) — ver seção final.
- Persistência de partida (histórico, replay, reconexão) — a Fase 1 não grava
  nada no banco, é simulação local descartável.
- Cobertura de 100% do catálogo (hoje ~1060 `CardModel`) — cobertura
  incremental, deck de teste primeiro.

## Decisão de arquitetura: módulo isolado, zero impacto no que já está em produção

- Roda inteiramente no client (React + TS), lendo dados de carta via
  `GET /api/cards` (ou um export estático gerado a partir do banco, se o
  volume de chamada incomodar) — **zero migration nova, zero mudança em
  `server/index.ts`** pra esta fase.
- Pasta proposta: `src/modules/simulator/` (motor puro, sem depender de
  React) + `src/modules/simulator/ui/` (tela, quando existir) — batiza o
  domínio que já estava previsto em `docs/01-arquitetura-roadmap.md`, seção
  "Pastas sugeridas futuramente" (`src/modules/rules`).
- Não precisa de rota nova em produção até a UI de teste existir. Dá pra
  desenvolver e validar o motor inteiro via `pnpm test` (`vitest run`, já é o
  runner do projeto — `server/deck-legality.test.ts` é o precedente de teste
  unitário puro, sem subir servidor) antes de qualquer tela existir.
- Nenhuma tabela nova no Postgres é necessária pra esta fase. Se algum dia a
  Fase 1 quiser salvar um "replay" de sandbox pra compartilhar, isso é uma
  extensão pequena e opcional — não uma dependência do motor em si.

## Modelo de zonas

| Zona | Regra oficial | Observação pro motor |
|---|---|---|
| Deck | baralho principal, 50 cartas | derrotar por deck-out: perde ao precisar comprar sem carta disponível |
| Resource Deck | baralho de recursos, 10 cartas, separado | compra 1 por turno na Resource Phase |
| Shields | 6 cartas do topo do deck, viradas pra baixo, no início da partida | cada shield vale "1 HP"; ao ser destruído, revela e checa Burst antes de ir pro Trash |
| Resource Area | onde ficam os recursos jogados | máx. 15 recursos, máx. 5 EX Resource; 2º jogador começa com 1 EX Resource |
| Battle Area | onde Units são deployadas | máx. 6 Units; 1 Pilot pode parear com 1 Unit |
| Base Section | onde Bases são deployadas | máx. 1 Base por vez; EX Base é deployada no início da partida |
| Trash | descarte | recebe cartas destruídas/descartadas |
| Hand | mão | máx. 10 cartas — excesso é descartado na End Phase |

## Estrutura de turno

As 5 fases oficiais, na ordem:

1. **Start Phase** — todas as cartas rested (horizontais) do jogador ativo
   viram active (verticais).
2. **Draw Phase** — compra 1 carta do Deck.
3. **Resource Phase** — compra 1 carta do Resource Deck pra Resource Area.
4. **Main Phase** — jogar carta da mão, ativar habilidade
   `[Activate·Main]`, ou atacar com uma Unit. É aqui que a sequência de
   combate abaixo acontece, uma vez por ataque declarado.
5. **End Phase** — turno termina, vira turno do oponente. Descarte
   obrigatório até 10 cartas na mão acontece aqui.

**Sequência de combate** (dispara toda vez que uma Unit ataca, dentro da Main Phase):

1. **Attack Step** — jogador ativo escolhe uma Unit active, deixa ela
   rested, declara alvo (oponente ou Unit inimiga rested). Efeitos
   `【Attack】` disparam aqui.
2. **Block Step** — jogador em espera pode ativar `<Blocker>` numa Unit
   active pra mudar o alvo do ataque (1x por ataque, 1 cópia por Unit).
3. **Action Step** — jogadores alternam ativando cartas `【Action】` e
   efeitos `【Activate·Action】`, começando pelo jogador em espera, até os
   dois passarem consecutivamente.
4. **Damage Step** — dano de batalha simultâneo igual ao AP de cada Unit.
   Exceção: `<First Strike>` causa dano primeiro; se destruir o alvo, a
   Unit destruída não causa dano de volta. Se houver Base, ela recebe o
   dano em vez dos Shields.
5. **Battle End Step** — efeitos "durante esta batalha" expiram.

**Importante pro desenho do motor**: o Action Step **também acontece na End
Phase**, não só durante combate ("action steps occur after the block step
and during the end phase") — ou seja, o motor não pode assumir "é meu turno,
então só eu ajo": existem janelas explícitas em que o jogador em espera age.
Isso importa mesmo numa Fase 1 sem oponente real, porque errar esse desenho
agora encarece corrigir depois, na Fase 3 (PvP), quando as regras de combate
já estiverem "cristalizadas" em cima de um desenho errado.

## Keywords oficiais → mapeamento pra DSL

Boa notícia descoberta ao revisar o parser existente
(`src/lib/gundam-card-effects.ts`) e o schema: **as keywords oficiais já são
dado estruturado hoje**, não só texto. Toda carta salva no admin já roda por
`parseCardEffects()` e grava `triggerKeywords`, `effectKeywords`,
`keywordTags` (com valor numérico extraído, ex. "Repair 2"), `hasBurst`,
`hasMain`, `hasAction`, `oncePerTurn` e `textSectionsJson` (as seções do
efeito já separadas por gatilho — Deploy/Attack/Destroyed/etc. — com o texto
bruto de cada uma). Isso significa que a Fase 1 não precisa reparsear nada
disso do zero — só consumir o que já existe em `CardModel`.

| Keyword | Regra oficial (resumo) | Já estruturado hoje? | Primitiva DSL proposta |
|---|---|---|---|
| `<Blocker>` | muda o alvo do ataque, 1x por ataque, 1 cópia por Unit | sim | `redirectAttack(self)` no Block Step |
| `<First Strike>` | causa dano primeiro; sem dano de volta se destruir o alvo | sim | prioridade no Damage Step |
| `<High-Maneuver>` | inimigo não pode ativar `<Blocker>` enquanto esta Unit ataca | sim | `disableOpponentKeyword('Blocker', duration: 'thisAttack')` |
| `<Support N>` | `[Activate·Main]`, rest, +N AP em outra Unit amiga neste turno | sim (valor já extraído) | `activateMain({cost: rest(self)}) → buff(target, {ap: N}, until: 'endOfTurn')` |
| `<Repair N>` | fim do turno, recupera N HP | sim | `onEndPhase(() => heal(self, N))` |
| `<Breach N>` | destruiu Unit inimiga em combate no seu turno → N dano no 1º shield | sim | `onDestroyEnemyInBattle(() => damageShield(1, N))` |
| `<Suppression>` | dano ao shield acerta os 2 primeiros shields simultaneamente | sim | `onShieldDamage(() => alsoDamage(secondShield, sameAmount))` |
| `【Once per Turn】` | limita a ativação a 1x por turno, por instância de carta | sim (`oncePerTurn`) | contador de uso por turno, por instância, no `GameState` |
| Link | Unit vira "Link Unit" se o Pilot pareado satisfaz a link condition dela (nome ou trait); único bônus mecânico é poder atacar no turno em que foi deployada | **sim** — `CardDef.link` estruturado (`kind: "pilotName" \| "trait"`) + `satisfiesLinkCondition()`/`declareAttack` (ver "Link condition" abaixo) | feito |
| `【Burst】` | ao shield ser destruído, revela e pode ativar sem pagar custo, por escolha | sim que o *fato* de ter Burst está marcado (`hasBurst` + `burstEffectPt`) — o **conteúdo** do efeito continua texto livre | precisa de autoria manual em DSL, carta a carta |

## DSL de efeitos — motor de eventos + Effect Spec (Camada 3 formalizada)

**Nível motor** (implementado, `src/modules/simulator/engine/events.ts`):
todo efeito — keyword automática ou bespoke — é expresso como uma lista de
`GameEvent` (`DRAW_CARD`, `MOVE_CARD`, `DAMAGE_UNIT`, `DESTROY_CARD`,
`DAMAGE_SHIELD`, `MODIFY_STAT`, `GRANT_KEYWORD`, etc.) aplicada por um
reducer puro `applyEvent(state, event): GameState` que nunca muta o estado
recebido. Isso facilita testar (comparar eventos gerados, não estado
mutável) e já serve de base pronta pra log/replay quando a Fase 3 precisar
de histórico auditável de partida. As 8 keywords oficiais viram eventos
automaticamente (`combat.ts` pra Blocker/First Strike/High-
Maneuver/Breach/Suppression, `keywords.ts` pra Support/Repair/Once per
Turn) — nunca precisam de autoria manual, porque o dado já vem estruturado
do `CardModel`.

**Camada 3 formalizada** (implementado, `src/modules/simulator/engine/effectSpec.ts`):
em vez de ir direto pra uma closure JS opaca, o texto bespoke de cada carta
vira um `EffectSpec` — uma estrutura declarativa revisável lado a lado com
o `effectEn` oficial, no mesmo espírito "validável e confiável" já usado no
motor de estatísticas:

```ts
interface EffectSpec {
  id: string;          // "<code>-<trigger>", ex.: "GD01-001-Deploy"
  cardCode: string;
  trigger: string;      // rótulo do textSectionsJson: "Deploy" | "Attack" | "Destroyed" | "Burst" | "Activate·Main" | ...
  cost?: PrimitiveCall[];
  condition?: { predicate: string; then: PrimitiveCall[]; else?: PrimitiveCall[] };
  actions: PrimitiveCall[];
  sourceText: string;   // effectEn da seção — nunca effectPt (ver "Cobertura de idioma" abaixo)
}
```

Primitivas disponíveis hoje (`PrimitiveCall`, o vocabulário mínimo que cobre
a maioria dos textos de efeito vistos no jogo): `draw`, `discard`,
`damageShield`, `destroy`, `moveZone`, `modifyStat`, `grantKeyword`, `rest`,
`setActive`, `heal` — cada uma compila pra 0+ `GameEvent` via
`compilePrimitive()`. `resolveEffectSpec(spec, ctx, predicateResolver?)`
roda cost → condition (via um `PredicateResolver` externo, plugável) →
actions, na ordem.

**O que isso NÃO é ainda**: nenhum `EffectSpec` de carta real existe — isso
é só a tubulação testada (`effectSpec.test.ts`, com um exemplo sintético
equivalente a "Deploy: Draw 1 card, then discard 1 card"). Autoria carta a
carta é o passo 3 do plano incremental abaixo, e é ali que o "segundo
produto" mencionado no roadmap de fato começa a ganhar corpo — cada
`EffectSpec` novo é um checkpoint de cobertura por carta/por wave.

## Cobertura real — ST01 "Heroic Beginnings" (passo 3)

16 cartas únicas no deck (confirmado via `gundam-gcg.com/en/products/st01.html`:
"2 Legend Rare + 14 Common"). Stats e texto de efeito conferidos carta a
carta contra `gundam-gcg.com/en/cards/detail.php?detailSearch=<code>` e
`data/gcg-official-cards.json`, em 2026-08-28.

| Carta | Cobertura | Observação |
|---|---|---|
| ST01-001 Gundam | Parcial | `<Repair 2>` automático (keyword de motor); `【During Pair】` AP+1 pra todas as Units **fora de escopo** — é efeito contínuo condicionado a permanecer pareado, e o EffectSpec de hoje só modela gatilho→ações pontuais, não "enquanto X for verdade, aplique Y" |
| ST01-002 Gundam (MA Form) | ✅ EffectSpec | `When Paired` + trait do Piloto pareado, via `condition`/`PredicateResolver` |
| ST01-003 Guncannon | ✅ Nenhum necessário | vanilla (só stats) |
| ST01-004 Guntank | ✅ EffectSpec | `Deploy` |
| ST01-005 GM | ✅ Nenhum necessário | vanilla |
| ST01-006 Gundam Aerial (Score Six) | ✅ EffectSpec | `When Paired` |
| ST01-007 Gundam Aerial (Bit Form) | ✅ Nenhum necessário | vanilla |
| ST01-008 Demi Trainer | ✅ Nenhum necessário | só `<Blocker>`, automático |
| ST01-009 Zowort | Parcial | `<Blocker>` automático; "não pode escolher o jogador inimigo como alvo" **fora de escopo** — é restrição de legalidade da própria declaração de ataque, não um efeito que produz `GameEvent` |
| ST01-010 Amuro Ray | ✅ EffectSpec ×2 | `Burst` + `When Paired` |
| ST01-011 Suletta Mercury | ✅ EffectSpec ×2 | `Burst` + `Attack`/Once per Turn (a trava de Once per Turn em si é responsabilidade de quem despacha) |
| ST01-012 Thoroughly Damaged | Parcial | `Main` autorado (motivou a primitiva `damageUnit`); requisito `【Pilot】[Hayato Kobayashi]` pra jogar a carta **fora de escopo** — legalidade de jogo, não efeito |
| ST01-013 Kai's Resolve | Parcial | `Main` autorado; mesmo requisito de Pilot **fora de escopo** |
| ST01-014 Unforeseen Incident | ✅ EffectSpec ×3 | `Burst`/`Main`/`Action` — as 3 seções compilam pro mesmo evento, confirmado por teste |
| ST01-015 White Base | Parcial | `Burst` + `Deploy` autorados; `【Activate･Main】【Once per Turn】` (deploy de token condicional por contagem de Units) **fora de escopo** — falta primitiva de "criar instância nova" (motor só instancia carta no setup, nunca via evento) e de "pagar custo de recurso genérico" |
| ST01-016 Asticassia | Parcial | `Burst` + `Deploy` autorados; `【Activate･Main】` (buff em todas as Link Units) **fora de escopo** — falta primitiva de aplicar a mesma ação a um **grupo** de alvos (`TargetRef` hoje resolve 1 instanceId só, mesmo pra alvo nomeado) |

**Lacunas de DSL descobertas nesta wave** (achado esperado — "é aqui que se
descobre, cedo e barato, se o desenho da DSL aguenta a complexidade real",
ver plano abaixo):
1. Faltava primitiva de dano direto numa Unit (`damageUnit`) — **preenchida**
   nesta wave (`effectSpec.ts`), com destruição automática se o dano bater o
   HP efetivo (mesma checagem 5-5-2 já usada em `combat.ts`).
2. Efeito contínuo condicional ("enquanto pareado, +1 AP em tudo") não tem
   modelo — EffectSpec só cobre gatilho pontual → ações. Precisaria de um
   conceito de "efeito estático" reavaliado a cada consulta de `effectiveAp`/
   `effectiveHp`, não de eventos aplicados uma vez.
3. Nenhuma primitiva cria instância nova a partir de um `CardDef` (deploy de
   token por efeito) — hoje só `setup.ts` instancia carta, e só no setup.
4. Nenhuma primitiva de "pagar custo de recurso genérico" (só existe `cost`
   como `PrimitiveCall[]` arbitrário, sem noção de gastar recurso).
5. `TargetRef`/`resolveTarget` resolvem sempre 1 `instanceId` só — não tem
   como aplicar a mesma ação a um grupo inteiro de alvos ("all friendly Link
   Units").
6. Restrições de legalidade (quem pode ser alvo de ataque, requisito de
   Pilot pra jogar uma carta) não são modeladas pelo EffectSpec — são regras
   de "o que é permitido fazer", não "o que acontece quando algo é feito";
   provavelmente pertencem a uma camada de validação separada, não à DSL de
   efeito.

Nenhuma dessas lacunas bloqueia o motor puro (passos 1-2, já validados) —
são conhecidas e documentadas aqui pra quando o passo 3 continuar (mais
cartas do ST01/ST02-04/GD01) ou quando o passo 4 (dispatcher de trigger
automático) começar.

## Cobertura real — ST02 "Ruination Ablaze" (passo 3)

16 cartas únicas no deck, mesmo padrão de sourcing do ST01: stats
conferidos carta a carta contra `gundam-gcg.com/en/cards/detail.php?
detailSearch=<code>` e texto/traits de `data/gcg-official-cards.json`, em
2026-08-28.

| Carta | Cobertura | Observação |
|---|---|---|
| ST02-001 Wing Gundam | Parcial | `<Breach 5>` automático (keyword de motor); "pode escolher Unit inimiga *active* Lv.4 ou menor como alvo" **fora de escopo** — relaxamento de legalidade de alvo de ataque, mesma categoria da restrição de ST01-009 Zowort, só que na direção oposta (lacuna #6, estendida) |
| ST02-002 Wing Gundam (Bird Mode) | Parcial | `Deploy` autorado só como gatilho existente; "Place 1 EX Resource" **fora de escopo** — falta a mesma primitiva de "criar instância nova" da lacuna #3 |
| ST02-003 Gundam Heavyarms | Parcial | `【During Pair】` marcado como keyword; o efeito em si (dano em **grupo** — "all enemy Units Lv.3 ou menor") **fora de escopo** — `TargetRef` só resolve 1 alvo (lacuna #5) |
| ST02-004 Gundam Sandrock | ✅ Nenhum necessário | vanilla (só stats) |
| ST02-005 Maganac | ✅ Nenhum necessário | vanilla |
| ST02-006 Tallgeese | Parcial | `【Activate･Main】` autorado (`setActive`); custo "④" (pagar 4 recursos) não é cobrado — falta primitiva de custo de recurso genérico (lacuna #4) |
| ST02-007 Leo | ✅ Nenhum necessário | vanilla |
| ST02-008 Aries | ✅ Nenhum necessário | só `<Blocker>`, automático |
| ST02-009 Tragos | ✅ Nenhum necessário | só `<Blocker>`, automático |
| ST02-010 Heero Yuy | Parcial | `Burst` autorado; `【During Link】` (AP+1/HP+1 enquanto linkado) **fora de escopo** — efeito contínuo condicionado a Link, mesma lacuna #2 (estendida pra cobrir Link, não só Pair) |
| ST02-011 Zechs Merquise | Parcial | `Burst` autorado; `【During Link】` (draw ao destruir em combate) **fora de escopo**, mesma razão de Heero Yuy |
| ST02-012 Simultaneous Fire | ✅ EffectSpec | `Main` — concede `<Breach 3>` via `grantKeyword`; motivou a correção de `keywordValue()` em `types.ts` (ver Status). Requisito `【Pilot】[Trowa Barton]` pra jogar a carta fora de escopo (legalidade de jogo, não efeito) |
| ST02-013 Peaceful Timbre | Parcial | keyword `Action` marcada; o efeito ("shields não podem receber dano de Units Lv.4 ou menor nesta batalha") **fora de escopo** — nenhuma primitiva modela prevenção/substituição de dano condicional (nova lacuna #7) |
| ST02-014 Siege Ploy | ✅ EffectSpec ×3 | `Burst`/`Main`/`Action` — as 3 seções compilam pro mesmo evento (`rest` no alvo), confirmado por teste, mesmo padrão de ST01-014 |
| ST02-015 Saint Gabriel Institute | Parcial | `Burst` + 1ª cláusula do `Deploy` (add 1 shield à mão) autorados; "olhe as 2 cartas do topo, devolva 1 pro topo e 1 pro fundo" **fora de escopo** — informação oculta (nova lacuna #8) |
| ST02-016 Corsica Base | Parcial | `Burst` + 1ª cláusula do `Deploy` autorados; deploy condicional de token (Tallgeese ou 2x Leo, dependendo de carta no trash) **fora de escopo** — lacuna #3 + falta predicado de "carta com nome X no trash" |

**Lacunas de DSL descobertas/estendidas nesta wave:**
- Lacuna #2 (efeito contínuo condicional) confirmada como mais ampla do que
  só `【During Pair】` — `【During Link】` (Heero Yuy, Zechs Merquise) é o
  mesmo problema com outra condição de gatilho.
- Lacuna #6 (restrições de legalidade) confirmada nas duas direções: Zowort
  *restringe* quem pode ser alvo, Wing Gundam *relaxa* (permite atacar uma
  Unit *active*, não só rested). Reforça que isso pertence a uma camada de
  validação de legalidade, separada da DSL de efeito.
- **#7 (nova)**: nenhuma primitiva modela prevenção/substituição de dano sob
  condição (Peaceful Timbre — "shields não podem receber dano de Units
  Lv.4 ou menor durante esta batalha"). Precisaria de um conceito de
  "modificador de regra de dano", não um evento pontual.
- **#8 (nova)**: nenhuma primitiva cobre "olhe as N cartas do topo do deck e
  reordene" (Saint Gabriel Institute). Depende do Risco de "informação
  oculta" já registrado antes do passo 3 começar — reordenar o topo do deck
  exige que o motor tenha noção de visibilidade por jogador, não só mover
  cartas entre zonas.

Achado extra desta wave, fora da tabela de cobertura: `keywordValue()`
(`types.ts`) nunca lia `card.keywordGrants`, só `card.def.keywordTags` — uma
keyword numérica concedida em tempo de jogo (como o `<Breach 3>` de
Simultaneous Fire) tinha `hasKeyword()` retornando `true` mas
`keywordValue()` retornando `0` (ou `null`), o que quebraria silenciosamente
o cálculo de dano de shield em `combat.ts`. Corrigido, com teste de
regressão (`st02.test.ts`) rodando o grant através de uma sequência de
combate real, não só verificando o evento gerado isoladamente — validação
concreta de que a abordagem "motor primeiro, conteúdo real depois" vale a
pena: esse bug só apareceu ao tentar autorar um efeito real contra o texto
oficial de uma carta, não teria aparecido em nenhum teste sintético.

## Plano de implementação incremental (fatia vertical, não big-bang)

1. **Motor de estado puro** (zonas + fases + sequência de combate) com
   testes unitários cobrindo cada regra da tabela acima — sem nenhuma carta
   com efeito bespoke ainda, só stats (AP/HP/custo/level/cor) e as keywords
   automáticas.
2. **Validar contra um "deck sem efeito bespoke"** (todas as cartas usando
   só keywords oficiais, sem texto extra) — prova que turno/zonas/combate
   estão certos antes de gastar tempo com autoria de efeito único.
3. **Escolher 1 deck de teste** e implementar via DSL os efeitos bespoke
   *só* desse deck — é aqui que se descobre, cedo e barato, se o desenho da
   DSL aguenta a complexidade real do texto das cartas (tem efeito bem fora
   do genérico, ex. "olhe as 3 cartas do topo, revele uma [X], adicione à
   mão").
4. **UI mínima de sandbox** (zonas visíveis, arrastar carta, log de
   eventos) — só depois do motor validado, pra não gastar trabalho de
   interface em cima de um motor que ainda pode mudar de desenho.
5. **Critério de "Fase 1 pronta"**: alguém consegue jogar uma partida
   completa sozinho (controlando os dois lados) só com o deck de teste, do
   início ao fim, respeitando todas as regras acima, sem nenhuma trapaça
   manual (nada de "finge que esse efeito aconteceu").

## Link condition (Comprehensive Rules 3-2-6, resolvido)

Decisão com o Willen em 2026-08-28: implementar agora, não adiar. Verificado
contra a fonte oficial (Comprehensive Rules v1.8.0) antes de implementar —
o entendimento inicial (Link condition restringe o pareamento em si) estava
**errado**: pareamento Pilot↔Unit é livre (3-3-1 a 3-3-5, qualquer Pilot
pareia com qualquer Unit amiga). Link condition (3-2-6) só decide se o
pareamento resultante vira "Link Unit" — e o único bônus mecânico disso é
poder atacar no turno em que foi deployada (3-2-6-3), furando a restrição
normal de 3-2-4 (Unit recém-deployada não ataca no turno em que entrou em
campo — restrição que nem existia implementada no motor antes desta wave,
gap descoberto durante a implementação, não um dos 8 já catalogados acima).

Implementado: `CardDef.link?: { kind: "pilotName" | "trait"; values: string[] }`
(dado já limpo em `data/gcg-official-cards.json`, campos `link`/`linkRefs`,
copiado como dado estático pros fixtures ST01/ST02 — nenhum parser novo
precisou ser escrito) + `satisfiesLinkCondition(pilotDef, unitDef)` em
`types.ts` + checagem em `declareAttack` (`combat.ts`) usando o novo campo
`CardInstance.enteredZoneOnTurn`. Testado em `combat.test.ts` (pilotName,
trait, pareamento que não satisfaz, e a restrição-base sem pareamento) e na
partida real ST01×ST02 (`st01VsSt02Match.test.ts`, MA Form + Amuro Ray e
Tallgeese + Zechs Merquise atacando no turno de deploy).

## Servidor do sandbox (passo 4, metade servidor — resolvido)

Decisão do Willen (2026-08-28): testar o passo 4 já com 2 abas de navegador
reais, logadas em 2 contas diferentes, pra provar que a separação de
informação oculta por jogador é de verdade (roda no servidor, não é
"fingida" no cliente). Arquitetura confirmada com o Willen antes de
implementar: **Server-Sent Events** pra sincronização em tempo real,
**acesso restrito a admin/hoster**, match store **em memória, sem
persistência** (reiniciar a API derruba partidas em andamento — aceitável
pro escopo de ferramenta de teste interno, não é o PvP real da Fase 3).

Três peças novas, cada uma pura onde dá:

- **`engine/actions.ts`** — `PlayerAction` (união serializável de toda ação
  de jogador: deployCard, playCommand, declareAttack, activateBlocker,
  skipBlock, passAction, finishTurn) + `applyPlayerAction()`, o reducer que
  traduz cada uma pra função real do motor. Autorização mora aqui: funções
  do motor que não recebem `player` explícito (`declareAttack`,
  `activateBlocker`, `skipBlock`) são checadas contra `actingPlayer` antes
  de chamar — sem isso, a sessão de um jogador poderia agir com cartas do
  outro só sabendo o `instanceId`. Também encadeia automaticamente passos
  que não são decisão de ninguém (Attack Step → Block Step ao declarar
  ataque; Action Step → Damage Step → Battle End assim que os 2 passam),
  do jeito que `runAttack()` já fazia em `st01VsSt02Match.test.ts`.
  Escopo aceito por enquanto (documentado, não fingido): 【Burst】 de shield
  sempre é recusado automaticamente — ativar por escolha real do jogador
  precisa de um ponto de decisão na UI que ainda não existe; gatilhos que
  dependem de alvo escolhido fora de Deploy/When Paired (`<Attack>` da
  Suletta Mercury, `<Activate·Main>` do Tallgeese, Command 【Action】 fora do
  fluxo padrão) não têm `PlayerAction` própria ainda. O núcleo jogável
  (deploy, atacar, bloquear, passar turno) já basta pra validar a
  arquitetura de sessão dupla, que é o objetivo desta wave.
- **`engine/viewState.ts`** — `viewStateFor(state, viewer)`: troca toda
  carta em zona oculta (`deck`/`resourceDeck`/`shields` sempre, dos dois
  lados; `hand` só do adversário) por um `HiddenCard` sem `def` nenhum —
  nada que identifique a carta sai no JSON. `battleArea`/`baseSection`/
  `resourceArea`/`trash` continuam sempre públicas. Testado inclusive
  serializando pra JSON e checando que o nome/código da carta oculta não
  aparece na string (não só checando o tipo em memória).
- **`server/matchStore.ts`** (Node, único módulo com estado de verdade) —
  `Map<matchId, MatchRecord>` em memória; `createMatch`/`joinMatch` (2
  assentos, rejeita o mesmo usuário nos 2 — "use 2 contas diferentes")/
  `applyAction` (resolve `userId` → assento, chama `applyPlayerAction`)/
  `subscribe` (pub/sub pra notificar SSE a cada mudança, já com as 2 visões
  redigidas prontas). O `GameState` real nunca sai deste módulo.
- **Rotas** (`server/index.ts`, bloco "Simulador" no fim do arquivo, todas
  `authRequired + hosterRequired`): `POST /api/simulator/matches` (cria,
  escolhe ST01/ST02 por enquanto — únicos decks reais existentes),
  `POST .../join`, `POST .../actions`, `GET .../:id` (estado atual pra quem
  já entrou), `GET /api/simulator/matches` (lista, pra picker de UI), e
  `GET .../:id/stream` (SSE). Exceção pontual documentada: o stream usa
  `authFromQueryOrHeader` (token por query string) em vez do header
  `Authorization` de todas as outras rotas, porque a API nativa
  `EventSource` do navegador não deixa mandar headers customizados.

Falta só a UI React que consome isso (passo 4, metade cliente) — 2 sessões
reais (2 abas, 2 contas) conectando no mesmo `matchId`, cada uma só
enxergando sua própria visão via `EventSource` no endpoint de stream.

## Riscos / desconhecidos

- **Efeitos de informação oculta** ("olhe as N cartas do topo", "revele",
  "escolha 1 dentre X sem o oponente ver") — a ARQUITETURA de separação já
  existe (`viewStateFor`, acima) e resolve o caso comum (zona oculta nunca
  vaza `def` pra quem não pode ver). O que continua em aberto é o efeito em
  si: nenhum EffectSpec implementado hoje "revela" uma carta oculta pro
  oponente ou deixa o dono espiar o próprio deck — quando uma carta desses
  aparecer, o motor precisa marcar isso no `GameState` (ex.: carta
  "revelada") e `viewStateFor` passa a ler esse dado; não deve precisar
  mudar a forma da redação em si.
- **Tradução comunitária pode ser imprecisa** — cada efeito bespoke
  implementado na DSL deve ser conferido contra `effectEn` (inglês), não só
  `effectPt`, especialmente em cartas mais antigas.
- **Timing da cadeia de resposta (Action Step alternado)** é a parte mais
  sutil das regras de combate. Vale implementar isso com rigor já na Fase 1,
  mesmo sem oponente de verdade — é o pedaço que mais quebra se for
  "consertado" depois de já existir UI e conteúdo em cima dele.

## Risco aceito (decisão consciente, registrada pra referência futura)

O roadmap original (`docs/16-roadmap-ideias-mapeadas.md`) recomendava
começar por algo bem mais simples — um assistente de partida sem automação
de regra nenhuma (só contador de vida/zona, o jogador aplica as regras de
cabeça). A decisão tomada aqui é ir direto pro motor completo de regras. Isso
é deliberado: o objetivo declarado é ter uma base que sirva de fundação pra
IA (Fase 2) depois, e um contador de vida sozinho não serve pra isso — mas
vale deixar registrado que essa é uma aposta maior, exatamente como o
roadmap já alertava ("não é mais uma feature, é um segundo produto").

## Fases seguintes (fora do escopo deste documento, citadas só por contexto)

- **Fase 2 — IA**: heurística de escolha da melhor jogada legal dentre as
  possíveis (não é machine learning nesse estágio) — ainda majoritariamente
  client-side ou um serviço leve. Depende inteiramente do motor da Fase 1
  estar correto; a IA só sabe jogar o que o motor sabe simular.
- **Fase 3 — PvP**: transporte em tempo real (WebSocket), servidor
  autoritativo de estado de jogo, sessão/matchmaking, reconexão. É a
  primeira peça que de fato exige infraestrutura de backend nova — uma
  camada bem diferente do request/response do Express monolítico de hoje.
  Tratada como decisão de arquitetura própria, quando chegar a hora.

## Onde mexer (atualizado com o que já existe)

- `src/modules/simulator/engine/` — motor puro, sem depender de React:
  - `types.ts` — zonas, `CardDef`/`CardInstance`, `GameState`, `GameEvent`.
    `keywordValue()` corrigido no passo 3 (wave ST02) pra checar
    `card.keywordGrants` (concedida em tempo de jogo) antes de
    `card.def.keywordTags` (estático) — ver "Cobertura real — ST02" acima.
  - `rng.ts` — PRNG seedado (mulberry32), nunca `Math.random()`.
  - `events.ts` — reducer `applyEvent`/`applyEvents`, nunca muta o estado
    recebido.
  - `setup.ts` — `createGame()`: setup completo (Comprehensive Rules 6-2)
    determinístico por seed — 5 cartas de mão, mulligan opcional, 6 shields,
    EX Base (0 AP / **3 HP**, confirmado via fonte externa — não estava no
    Comprehensive Rules PDF, só em cobertura de comunidade) pros dois
    jogadores, EX Resource só pro segundo jogador.
  - `phases.ts` — as 5 fases oficiais + `finishTurnAndAdvance()`.
  - `combat.ts` — sequência de combate de 5 passos (Attack/Block/Action/
    Damage/Battle End), incluindo Blocker, First Strike, High-Maneuver,
    Breach, Suppression e a regra de Pilot seguindo a Unit destruída
    (Comprehensive Rules 3-3-6).
  - `keywords.ts` — Support N (ação de Main Phase) e Repair N (gatilho de
    End Phase).
  - `effectSpec.ts` — formalização da Camada 3 (ver seção acima), com a
    primitiva `damageUnit` (dano direto numa Unit/Base) adicionada no passo
    3, descoberta ao autorar as cartas reais do ST01.
  - `deploy.ts` — "jogar carta da mão" real: `deployCard()` (Unit/Pilot/
    Base, custo/Level/limite de zona/pareamento de Pilot/substituição de
    Base) e `playCommand()` (Command 【Main】/【Action】). Ver "Motor de jogo
    real + gaps documentados" em Status.
  - `dispatcher.ts` — dispatcher automático de trigger: `dispatchTrigger()`
    (Deploy/When Paired/Attack/Burst/Main/Action/Activate·Main, com 【Once
    per Turn】 genérico) e `dispatchBurstForNewlyTrashedShields()` (oferece
    Burst pra shield recém-quebrada num Damage Step real).
  - `actions.ts` — passo 4 (servidor): `PlayerAction` + `applyPlayerAction()`,
    a borda ação→motor com autorização. Ver "Servidor do sandbox" acima.
  - `viewState.ts` — passo 4 (servidor): `viewStateFor()`/
    `viewStatesForBothPlayers()`, redação de informação oculta por jogador.
  - `index.ts` — barrel export.
- `src/modules/simulator/content/predicates.ts` — passo 4: `PredicateResolver`
  canônico (`pairedPilotHasTrait:<trait>`), extraído do que antes era
  reimplementado ad-hoc em cada arquivo de teste que precisava dele.
- `src/modules/simulator/content/index.ts` — passo 4: `ALL_EFFECT_SPECS`
  (ST01+ST02 agregados) — usado pelo servidor, que despacha trigger pra
  qualquer carta em jogo sem saber de qual produto ela é.
- `src/modules/simulator/server/matchStore.ts` — passo 4: match store em
  memória (Node, único módulo com estado real desta feature). Ver "Servidor
  do sandbox" acima.
- `server/index.ts` — passo 4: bloco de rotas "Simulador" no fim do arquivo
  (`/api/simulator/matches/...`, `authRequired + hosterRequired`,
  incluindo o endpoint SSE). Ver "Servidor do sandbox" acima.
- `src/modules/simulator/fixtures/vanillaDeck.ts` — deck sintético "vanilla"
  (50+10, dentro do limite de 4 cópias/code) usado pra validar o motor sem
  nenhum efeito bespoke — passo 2 do plano incremental, ✅ concluído.
- `src/modules/simulator/engine/fullGame.test.ts` — passo 2: partida
  completa de ponta a ponta contra o deck vanilla (2 seeds), com checagem de
  invariantes de zona a cada turno até bater numa condição oficial de
  derrota.
- `src/modules/simulator/fixtures/st01Deck.ts` — passo 3: deck real ST01
  "Heroic Beginnings" (stats/efeito conferidos contra a página oficial de
  cada carta e `data/gcg-official-cards.json`; quantidade de cópias por
  carta é composição própria, não confirmada contra o produto físico — ver
  comentário no topo do arquivo).
- `src/modules/simulator/content/st01.ts` — passo 3: 16 `EffectSpec` reais
  autorados contra o `effect` oficial em inglês, cobrindo 10 das 16 cartas
  únicas do ST01. Ver "Cobertura real — ST01" acima pra tabela completa e
  lacunas de DSL descobertas.
- `src/modules/simulator/fixtures/st02Deck.ts` — passo 3: deck real ST02
  "Ruination Ablaze" (mesmo padrão de sourcing do ST01Deck.ts — stats
  conferidos página a página, texto/traits de `data/gcg-official-cards.json`,
  quantidade de cópias por carta é composição própria).
- `src/modules/simulator/content/st02.ts` — passo 3: 11 `EffectSpec` reais
  cobrindo 7 das 16 cartas únicas do ST02. Ver "Cobertura real — ST02" acima
  pra tabela completa e lacunas de DSL descobertas/estendidas.
- `src/modules/simulator/engine/deploy.test.ts` — testes unitários de
  `deployCard`/`playCommand`/`canPayLevel` contra o deck vanilla, mais uma
  integração com EffectSpecs reais do ST01 (Deploy do Guntank; When Paired
  disparando dos dois lados — Pilot e Unit — numa única jogada real de
  pareamento).
- `src/modules/simulator/engine/dispatcher.test.ts` — testes unitários de
  `findTriggerSpecs`/`dispatchTrigger` (incluindo 【Once per Turn】 genérico e
  When Paired pelo lado do Pilot) e `dispatchBurstForNewlyTrashedShields`
  (ativa e realoca, recusa e mantém no trash, ignora carta sem Burst).
- `src/modules/simulator/engine/st01VsSt02Match.test.ts` — a partida real
  ST01×ST02 completa (ver "Motor de jogo real + gaps documentados" em
  Status): `createGame` até `GAME_OVER`, cobrindo os 27 EffectSpecs + as
  keywords automáticas relevantes só com ações reais do motor.
- `src/modules/simulator/ui/` — ainda não existe (metade cliente do passo
  4, ver "Servidor do sandbox" acima — a metade servidor já está pronta).
- Testes: `*.test.ts` colocalizados com o código + `vitest run` (`pnpm
  test`), mesmo padrão de `server/deck-legality.test.ts`. 160 testes no
  total no momento desta atualização, cobrindo setup, fases, combate,
  keywords, a tubulação do EffectSpec, a partida de ponta a ponta contra o
  deck vanilla, os EffectSpecs reais do ST01 e do ST02 (incluindo o teste
  de regressão do `keywordValue()` rodando um grant de Breach através de
  combate real), o motor de jogar-carta-da-mão, o dispatcher automático de
  trigger, a partida real ST01×ST02 até GAME_OVER, a Link condition
  (`combat.test.ts`), e a metade servidor do passo 4 (`actions.test.ts`,
  `viewState.test.ts`, `server/matchStore.test.ts`).
- Reaproveitar `parseCardEffects()` (`src/lib/gundam-card-effects.ts`) e os
  campos já estruturados de `CardModel` (`triggerKeywords`,
  `effectKeywords`, `keywordTags`, `textSectionsJson`, `hasBurst`,
  `hasMain`, `hasAction`, `oncePerTurn`) como fonte de dado — usado no passo
  3 pra derivar os campos estruturados do `CardDef` de cada carta do ST01 e
  do ST02 (rodando o parser sobre o texto oficial e copiando o resultado
  como dado estático em `st01Deck.ts`/`st02Deck.ts`, sem chamar o parser em
  runtime).
- Nenhuma alteração em `prisma/schema.prisma` foi necessária até aqui, como
  planejado. `server/index.ts` ganhou o bloco de rotas do simulador nesta
  wave (passo 4) — a única mudança de servidor até agora em toda a Fase 1,
  e só um bloco de rotas novo no fim do arquivo (nenhuma rota existente foi
  tocada).
