# Simulador — Fase 1: motor de partida + DSL de efeitos (proposta)

## Status

**Em andamento — passos 1 e 2 concluídos; passo 3 (deck de teste real) com
motor de jogo genuíno (jogar carta da mão + dispatcher automático de
trigger) e partida real ST01×ST02 até GAME_OVER validada, cobrindo os 27
EffectSpecs implementados. Link condition (Comprehensive Rules 3-2-6) já
estruturada e validada — ver "Link condition" abaixo. Passo 4 (UI mínima de
sandbox, com sessão real multi-aba, decisão do Willen em 2026-08-28)
**concluído nas 2 metades**: servidor — `PlayerAction`/`applyPlayerAction`
(borda ação→motor com autorização), `viewStateFor` (redação de informação
oculta por jogador) e as rotas HTTP/SSE (`/api/simulator/matches/...`) — e
cliente — lobby de partidas + tabuleiro que conecta por `EventSource` e joga
por clique (deploy/pareamento/ataque/bloqueio/passar turno).

**Expansão "Simulador Beta" (2026-08-30, decisão do Willen)**: depois do
teste manual do passo 4, o Willen apontou que o fluxo de "escolher assento A
ou B manualmente" estava errado pra validar o produto de verdade — o fluxo
real é 1 botão só ("Simulador Beta"), fila de matchmaking automática (o
servidor pareia os 2 primeiros jogadores diferentes da fila sozinho, sem
escolha manual de assento/adversário), escolha de deck (ST01/ST02, qualquer
combinação) antes de entrar na fila, timer de turno e detecção de presença —
adiantando conscientemente parte do que "Fases seguintes" (abaixo) tinha
arquivado pra Fase 3/PvP. Decisões confirmadas com o Willen: timer de **90s
por decisão** (não por turno inteiro — estourou, o servidor age sozinho:
`skipBlock`/`passAction`/`finishTurn` conforme o passo atual), W.O. por
abandono depois de **3min sem nenhum sinal de vida do oponente** (nunca
automático — só destrava um botão pro lado presente clicar), e a rota
`/simulador` **aberta a qualquer usuário logado** (deixou de ser
admin/hoster-only; as rotas de depuração/criação manual de partida
continuam `hosterRequired`, só não fazem mais parte do fluxo normal). Ver
"Simulador Beta — matchmaking, timer de turno e W.O. por abandono" abaixo
pro detalhe completo. `tsc -b`, `eslint` e `pnpm test` (169/169, 13 testes
novos com `vi.useFakeTimers()` — primeiro uso de fake timers no repo) estão
limpos, e `vite build` produz o chunk da página normalmente.

**Pendência real, não escondida** (herdada do passo 4, ainda vale pra esta
expansão): o teste manual com 2 abas reais (2 contas logadas separadamente)
ainda não rodou de fato — o sandbox onde estas waves foram implementadas não
consegue subir a API (`tsx server/index.ts` falha ao importar
`@prisma/client`, e `prisma generate` não baixa o engine binário nessa rede
restrita; ver "Riscos" abaixo). A verificação estática (tipos/lint/testes/
build) está limpa, mas não substitui o teste de ponta a ponta com 2 sessões
reais — inclusive o pareamento automático da fila, o timer contando de
verdade em tempo real, e o W.O. por abandono fechando uma janela/aba de
propósito — que só pode rodar no ambiente do Willen, onde o Prisma client
gera de verdade.
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
- ✅ **Passo 4 — UI mínima de sandbox**: servidor (match store em memória,
  redação de informação por jogador, rotas HTTP/SSE) e cliente
  (lobby + tabuleiro) — ver "Sandbox de partida" abaixo.
- ✅ **Simulador Beta (2026-08-30)** — fila de matchmaking automática, timer
  de 90s por decisão, W.O. por abandono após 3min, aberto a qualquer usuário
  logado; `SimulatorSandboxPage.tsx` reescrita (fila → aguardando oponente →
  tabuleiro, sem seleção manual de assento). Ver seção própria abaixo. Falta
  validar com 2 abas/2 contas reais (bloqueado pelo sandbox de implementação,
  não pela arquitetura — ver nota acima).
- ⏳ Ainda não iniciado: passo 5 (critério de "Fase 1 pronta").

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
- Motor de estado completo: zonas, as 5 fases de turn