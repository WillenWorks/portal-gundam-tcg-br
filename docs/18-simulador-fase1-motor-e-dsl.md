# Simulador — Fase 1: motor de partida + DSL de efeitos (proposta)

## Status

**Proposta, ainda não iniciada.** Este documento nasce da decisão de partir pro
simulador em 3 fases — (1) sandbox solo que entende todas as regras do jogo e
das cartas, pra testar jogadas sozinho; (2) IA simples; (3) PvP — começando
pela Fase 1, escolhida de propósito por ter o menor impacto na arquitetura em
produção. Nada aqui foi implementado ainda; é o desenho antes de começar.

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
| Link | condição de pareamento piloto→unit; Unit pareada ataca imediatamente ao ser deployada | **parcial** — `linkText` existe como texto livre; a condição em si (ex. "Pilot com trait X") não é estruturada | precisa de parser adicional antes de simular Link de verdade (ver Riscos) |
| `【Burst】` | ao shield ser destruído, revela e pode ativar sem pagar custo, por escolha | sim que o *fato* de ter Burst está marcado (`hasBurst` + `burstEffectPt`) — o **conteúdo** do efeito continua texto livre | precisa de autoria manual em DSL, carta a carta |

## DSL de efeitos — desenho proposto

- Um efeito é `{ trigger, cost?, condition?, resolve }`, onde `resolve` é uma
  função pura que recebe o `GameState` atual e devolve uma lista de
  `GameEvent` a aplicar — nunca muta o estado direto. Isso facilita testar
  (comparar eventos gerados, não estado mutável), desfazer/depurar durante o
  desenvolvimento, e serve de base pronta pra log/replay quando a Fase 3
  precisar de histórico auditável de partida.
- Primitivas de baixo nível propostas (o vocabulário mínimo que cobre a
  maioria dos textos de efeito vistos no jogo): `draw(n)`, `discard(n,
  selector)`, `damageShield(count, n)`, `destroy(target)`, `moveZone(card,
  from, to)`, `modifyStat(target, {ap?, hp?}, duration)`, `grantKeyword(target,
  keyword, duration)`, `searchDeck(predicate, count)`, `rest(target)`,
  `setActive(target)`, `heal(target, n)`.
- Toda keyword oficial vira uma primitiva **automática** — nunca precisa de
  autoria manual, porque o dado já vem estruturado do `CardModel` (ver tabela
  acima). O trabalho manual concentra-se só no texto bespoke dentro de cada
  seção (`textSectionsJson[].text`), carta a carta — é aí que mora o "segundo
  produto" mencionado no roadmap.

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

## Riscos / desconhecidos

- **Link condition não estruturada** — hoje é texto livre (`linkText`).
  Sem extrair isso pra algo comparável programaticamente, o motor não
  consegue validar sozinho se um Pilot satisfaz a condição de link de uma
  Unit. Redução de escopo aceitável pro dia 1: simular sem Link (toda Unit
  ataca só depois de esperar o turno normal, ninguém pareia piloto ainda) e
  tratar o parser de link condition como um passo separado, quando o deck de
  teste escolhido de fato depender disso.
- **Efeitos de informação oculta** ("olhe as N cartas do topo", "revele",
  "escolha 1 dentre X sem o oponente ver") exigem que o motor tenha noção de
  "o que é visível pra quem" desde o desenho — mesmo numa Fase 1 sem
  oponente real, porque isso é exatamente o que barateia a Fase 3 (PvP)
  depois: se o `GameState` já separa informação pública de privada por
  jogador desde o início, sincronizar estado entre dois clientes reais fica
  muito mais simples do que se essa separação for adicionada depois, em cima
  de um motor que assumia "estado único visível pra todo mundo".
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

## Onde mexer (quando a implementação começar)

- Pasta nova: `src/modules/simulator/` (engine puro, sem depender de React)
  + `src/modules/simulator/ui/` (tela, quando existir).
- Reaproveitar `parseCardEffects()` (`src/lib/gundam-card-effects.ts`) e os
  campos já estruturados de `CardModel` (`triggerKeywords`,
  `effectKeywords`, `keywordTags`, `textSectionsJson`, `hasBurst`,
  `hasMain`, `hasAction`, `oncePerTurn`) como fonte de dado — não recriar
  esse parsing.
- Testes: seguir o padrão `*.test.ts` + `vitest run` (`pnpm test`), já usado
  em `server/deck-legality.test.ts`.
- Nenhuma alteração em `prisma/schema.prisma` ou `server/index.ts` é
  necessária pra esta fase.
