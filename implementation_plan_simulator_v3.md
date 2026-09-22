# Plano Mestre — Simulador Gundam TCG BR (v3): Ritmo, Fluxo de Fases e Travamento Pós-Combate

## Contexto

Vídeo demonstrando 3 classes de problema no simulador: (1) o fluxo de partida (shuffle/draw/mulligan/fases) não respeita a cadência visual esperada, (2) uma mensagem de habilidade (Mikazuki) cobriu o tabuleiro no mobile, e (3) o jogo travou depois que o bot destruiu uma unidade do jogador em combate. Fluxo ideal de partida descrito por extenso pelo dono do produto, junto com pedido de verificação da regra oficial de prioridade de resolução simultânea.

Continuação de dois planos já mesclados no `dev` (`implementation_plan_simulator.md` e `implementation_plan_simulator_v2.md`, commits `93e7c51`, `31da1b7`, `3263817`), que já cobriram: tamanho de carta no mulligan, retrofit de velocidade de animação, fila de reprodução serializada (ritmo do bot), e glow inline de alvo. Este plano (v3) trata da demanda nova.

**Processo seguido**: auditoria de código própria (file:line confirmados) → debate estruturado com Gemini via `mcp__ia-debate__debate_run` (Claude propositor, Gemini auditor crítico, 92% de concordância em 2 turnos, transcrição completa salva em `docs/debates/2026-09-22-contexto-simulador-de-gundam-card-game-r.md`) → verificação da regra oficial via 3 fontes independentes (Comprehensive Rules oficiais + FAQ) → re-checagem pontual do código real pós-debate. O plano abaixo já incorpora as correções que o debate revelou (2 achados iniciais estavam sub-escopados) e a checagem de regra oficial que resolve um item que ia ficar bloqueado esperando o dono do produto.

---

## Validação da demanda, item a item

| # | Pedido | Estado confirmado no código | Veredito |
|---|---|---|---|
| 1 | Shuffle animado **dentro** da área do deck (não em destaque central) | `DeckDealAnimation.tsx:187` — `isCenteredStage` inclui `mode === "shuffle"` sempre. Nunca ancora na área do deck. | **Pendente — não implementado.** Vira Agente B. |
| 1b | Draw com cartas já no tamanho final da mão | `DeckDealAnimation` já mede `board.rectOf` (não CSS var) — já correto desde antes do v2. | **Já correto.** |
| 1c | Sequência por jogador (P1 completa setup, depois P2) | Não encontrado em `phases.ts` (mulligan/shuffle não estão lá — ficam noutro módulo não lido nesta auditoria). | **Não verificado.** Vira sub-tarefa read-only do Agente C. |
| 2 | Comando: mão → centro → trash → só depois resolve efeito | `CommandCastAnimation.tsx` já implementa isso, e `runAction` (`SimulatorMatchPage.tsx:855-887`) já aguarda a animação **quando o jogador humano local é quem joga**. Mas `processIncomingView` (699-741), o caminho que reage a jogadas do bot/oponente, **não detecta "oponente jogou Comando"** — não é só um `await` faltando, é uma feature de diff de estado que não existe. | **Gap real, maior que o previsto.** Vira Agente A (re-escopado). |
| 3 | Mensagem de habilidade (Mikazuki) no topo, não no meio da tela | `PhaseAnnouncementBanner.tsx:50` = centralizado (`items-center`, cobre tudo). `AbilityResolutionModal.tsx:229` = **já ancorado no topo** (`pt-3 sm:pt-5`, sem `items-center`) — provável correção pelo commit `31da1b7`, gravado depois do vídeo. | **Provavelmente já resolvido — reteste antes de qualquer código.** |
| 3b | (achado extra, não pedido) | `PhaseAnnouncementBanner` e `AbilityResolutionModal` usam o mesmo `z-[60]` sem ordem de empilhamento — colisão visual latente se os dois renderizarem juntos. | Fix de 1 linha, incluído na Onda 0. |
| 4 | Bug crítico: jogo trava após bot destruir unidade | Engine (server-side) tem guard anti-loop e fila FIFO explícita para 2 gatilhos `Destroyed` simultâneos (`abilityDispatch.ts:460-483,601-627`) — parece robusto. No cliente, `drainViewQueue` (`SimulatorMatchPage.tsx:743-760`) roda `await processIncomingView(next)` num `while` **sem try/catch**; qualquer exceção síncrona aborta o loop e a rejeição some em silêncio (`void drainViewQueue()`). **Correção importante pós-debate**: os dois pontos de espera assíncrona dentro de `processIncomingView` (`executeAttackStrike` via `Promise.race`, `waitForBurstReveal`) **já têm timeout de segurança de 5s** (`VIEW_QUEUE_ITEM_TIMEOUT_MS`, confirmado nas linhas 561 e 723) — não é um "trava pra sempre" por promise pendente. O gap real é a ausência de captura de exceção; não localizado o throw exato (os candidatos óbvios, `executeAttackStrike` e `detectDepartures`, têm guards defensivos contra `undefined`) — é uma **hipótese estrutural forte, não uma confirmação de runtime**. | **Bug real e crítico. Vira Onda 0, sozinha, com critério de aceite exigindo reprodução guiada.** |
| 5 | Prioridade de resolução simultânea = **oponente primeiro** | **Verificado contra a fonte oficial** (3 buscas independentes convergindo: Comprehensive Rules v1.9.0 §10-1-6 e FAQ oficial Q108 — gundam-gcg.com): *"O jogador ativo resolve todos os seus efeitos primeiro. Depois, o jogador em espera resolve os dele."* Isso é o **oposto** da premissa original — e é exatamente o que `abilityDispatch.ts:534-538,556-557` já implementa hoje (comentário explícito: "Ordem: Units do jogador ativo primeiro"). | **Premissa original estava invertida — o código já está correto pela regra oficial. Nenhuma mudança de código aqui.** |
| 6 | Defensor tem prioridade na janela de ações do combate | `events.ts:376,402` — `ATTACK_DECLARED` e a entrada no step `"action"` setam `actionPriority` para o **defensor**. | **Já correto, confirmado.** Nenhuma ação necessária. |
| 7 | Toda movimentação de carta entre zonas é animada (nunca "teleporte") | `detectDepartures` (626-677) já cobre saída pra trash/exílio com "ghost" autocontido. Cobertura de burst/shield/reshuffle não foi auditada a fundo nesta rodada. | **Parcialmente confirmado.** Fora do escopo de código desta rodada — nenhum sintoma reportado aqui. |
| 8 | Fase de Ações só anuncia se houver jogada legal para qualquer lado; senão "Fim de Turno" direto | `phases.ts:126-184` já tem o Action Step real no motor (prioridade pro `standbyPlayer`). Mas o banner visual bloqueante **não existe** — a fila de banners (`phaseBannerQueue`, `SimulatorMatchPage.tsx:1211-1229`) é fixa (`TURNO`→`COMPRA`→`RECUPERAÇÃO`→`PRINCIPAL`), sem entrada para o Action Step. Hoje só existe um rótulo pequeno no `ActionDock` (não bloqueante) e um auto-pass silencioso (1254-1264, sem anúncio). | **Feature de UI nova, motor já pronto.** Vira investigação+desenho do Agente C, não implementação direta ainda. |
| 9 | Velocidade/animação afeta só visual, nunca lógica | Arquitetura já separa isso estruturalmente: resolução de estado é server-authoritative (`phases.ts`/`abilityDispatch.ts`), duração de animação é 100% client-side (`getScaledDuration`, CSS vars). Não encontrado um toggle "sem animação" explícito (só velocidade 0.75x-2x) — se for desejado um "desligar animação por completo", é escopo adicional não coberto aqui. | **Já satisfeito por design.** Confirmar se o toggle on/off adicional é desejado. |

---

## Plano de execução

```
Onda 0 (sozinha, primeiro — SimulatorMatchPage.tsx):
  try/catch no drainViewQueue + fix de z-index
       ↓ merge em dev + sessão de reprodução com DevTools aberto
Onda 1 (paralela, após Onda 0 mesclada):
  Agente A — Comando do oponente (SimulatorMatchPage.tsx)
  Agente B — Shuffle inline (DeckDealAnimation.tsx)
  Agente C — Investigação read-only (End Phase banner + sequência de setup por jogador)
       ↓ relatório do Agente C vira input de uma Onda 2 futura (feature nova de UI)

Fora de onda / não codar:
  Prioridade de gatilhos simultâneos — RESOLVIDO por verificação de regra oficial, código já correto.
  Modal do Mikazuki — reteste no HEAD atual antes de alocar qualquer agente.
```

**Por que a Onda 0 roda sozinha**: é a única correção de pura estabilidade, no mesmo arquivo que a Onda 1/Agente A vai tocar depois. Misturar um fix de estabilidade com feature nova no mesmo `while` dificulta saber, se algo der errado, se foi o try/catch ou a lógica nova. Rodar sozinha primeiro também estabelece um baseline: depois do merge, reproduzir o cenário do vídeo (bot destrói unidade do jogador) e confirmar que ou (a) não trava mais, ou (b) o console agora mostra a exceção real — que aí vira um item de correção pontual imediato, não mais um mistério.

**Por que Agente A não é paralelo à Onda 0**: mesmo arquivo (`SimulatorMatchPage.tsx`), risco de conflito de merge.

**Por que Agente C entrega investigação, não código**: dois dos subitens (banner da End Phase, sequência de setup por jogador) não têm confirmação suficiente no código pra escrever um prompt de implementação preciso sem risco de o agente inventar a arquitetura errada. Prefere-se pagar uma rodada de investigação a arriscar retrabalho.

---

## Prompts de execução

### Onda 0 — Estabilidade da fila de views + z-index

```
Você é engenheiro sênior de React/TypeScript no simulador Gundam TCG BR (src/pages/SimulatorMatchPage.tsx).

CONTEXTO: o jogo trava silenciosamente (tabuleiro congela, sem erro visível) em pelo menos um cenário reproduzido em vídeo pelo dono do produto: bot destrói uma unidade do jogador em combate. Investigação confirmou a causa estrutural: `drainViewQueue` (linhas ~743-760) roda `while (viewQueueRef.current.length > 0) { ... await processIncomingView(next); ... }` DENTRO de um try/finally que só reseta a flag `isDrainingViewQueueRef` — não há nenhum `catch`. Qualquer exceção síncrona lançada dentro de `processIncomingView` (699-741) — que chama `detectDepartures`, `executeAttackStrike`, `waitForBurstReveal` — aborta o loop ANTES de aplicar aquele item via `setMatchView`, e a promise rejeitada é descartada em silêncio porque `applyIncomingView` chama `void drainViewQueue()` (linha 777) sem tratamento de erro.

IMPORTANTE — não é um problema de promise que nunca resolve: `executeAttackStrike` já é chamado dentro de um `Promise.race` com timeout de 5s (`VIEW_QUEUE_ITEM_TIMEOUT_MS`, linha 723) e `waitForBurstReveal` (linha 550-563) já tem seu próprio timeout de segurança de 5s embutido. O problema real é uma EXCEÇÃO (não um timeout) que pode ser lançada em algum ponto ainda não identificado — por isso o critério de aceite abaixo exige reprodução com console aberto, não apenas "compilou".

TAREFA:
1. Em `drainViewQueue`, envolva `await processIncomingView(next)` num try/catch:
   - No `catch (err)`: log detalhado (`console.error("[ViewQueue] processIncomingView falhou", err, next)`), e aplique `setMatchView` com o `next` cru como fallback (garantindo que o item pelo menos aplique o estado final, mesmo sem a coreografia de animação completa) — não deixe o item "sumir" sem nunca ter sido aplicado.
   - Não pare o loop: depois do catch, continue para o próximo item da fila normalmente.
   - Mantenha o `finally` existente que reseta `isDrainingViewQueueRef`.
2. Em `PhaseAnnouncementBanner.tsx` e `AbilityResolutionModal.tsx`: ambos usam `z-[60]`. Dê ao `AbilityResolutionModal` `z-[61]` (ele deve sempre aparecer por cima de um anúncio de fase, se os dois colidirem).
3. NÃO mexa em nenhuma outra lógica do view-queue, do `executeAttackStrike`, do `detectDepartures` ou do `waitForBurstReveal` — este PR é estritamente sobre blindagem de erro e o fix de z-index, nada mais.
4. Rode `pnpm test src/pages/SimulatorMatchPage.test.tsx` (ou o teste equivalente que cobrir esse arquivo) e `npx tsc -b`. Garanta que passam.
5. Documente no corpo do PR/commit: "critério de aceite pendente de validação humana — reproduzir o cenário de bot destruindo unidade do jogador com DevTools aberto; se travar de novo, o console deve mostrar exceção com stack trace legível, não silêncio".
6. Commit local no branch do worktree, sem push, sem mexer em dev/main.
```

### Agente A — Animação de Comando do oponente/bot (rodar após Onda 0 mesclada)

```
Você é especialista em React/TS, sincronização de estado e animação, no simulador Gundam TCG BR.

CONTEXTO: quando o jogador humano local joga um Comando, `runAction` (SimulatorMatchPage.tsx:855-887) já aguarda `CommandCastAnimation` terminar (via uma Promise resolvida no `commandCastResolveRef`) antes de despachar a ação — mão → carta centralizada e ampliada pra ambos os jogadores → trash → só então o efeito resolve. Isso é o padrão de UX correto, JÁ IMPLEMENTADO, mas só no caminho do jogador local.

O GAP: quando o OPONENTE (bot ou jogador remoto) joga um Comando, a atualização chega via `match:view_update` e passa por `processIncomingView` (linhas 699-741) — que HOJE não tem nenhuma detecção de "o oponente acabou de jogar um Comando". Não existe um `await` faltando de um padrão já pronto — a detecção precisa ser construída do zero.

TAREFA:
1. Em `processIncomingView`, implemente detecção de diff de estado: compare a view anterior (seguir o padrão já usado em `detectDepartures`, que compara `prevView` vs `incoming.view` por jogador) para identificar quando uma carta saiu da MÃO do oponente e foi parar no TRASH dele com tipo/tag de Comando (conferir o campo de tipo de carta usado em outros pontos do código, ex. `cardType`, usado em `detectDepartures` linha 667).
2. Quando detectar isso, calcular origin (posição da mão do oponente — usar `board.rectOf` com a chave equivalente à usada pro jogador local em `runAction`, adaptada pro lado do oponente) e dest (trash do oponente). Usar fallback seguro pro centro da tela (`window.innerWidth/2`, `window.innerHeight/2`) se `rectOf` retornar `null`/`undefined`/zero — não deixar a animação nascer em `(0,0)`.
3. Renderizar `CommandCastAnimation` com esses dados, e AGUARDAR o `onDone` dela dentro de `processIncomingView`, no mesmo padrão de espera já usado para `executeAttackStrike`/`waitForBurstReveal` (ou seja: a resolução visual do efeito do Comando só deve aparecer depois — confirmar com o comentário da linha 732-734 sobre ordem de `setMatchView` vs espera, e manter a mesma disciplina).
4. CUIDADO: está se mexendo no mesmo `processIncomingView`/`drainViewQueue` que a Onda 0 acabou de blindar com try/catch — não remova nem contorne esse try/catch. Se a nova lógica de detecção lançar exceção, ela deve ser capturada pelo mecanismo já existente, não silenciada de outra forma.
5. Escrever teste cobrindo: view chega com Comando do oponente jogado → animação dispara com origin/dest corretos → efeito só aparece resolvido na view após o `onDone`.
6. `pnpm test src/pages/SimulatorMatchPage.test.tsx`, `npx tsc -b`, `npx eslint` limpos nos arquivos tocados.
7. Commit local no branch do worktree, sem push, sem mexer em dev/main.
```

### Agente B — Shuffle inline na área do deck

```
Você é desenvolvedor frontend sênior, React/Tailwind, no simulador Gundam TCG BR (src/modules/simulator/ui/DeckDealAnimation.tsx).

CONTEXTO: hoje a animação de shuffle SEMPRE roda num "palco central" — `isCenteredStage` (linha 187) inclui `mode === "shuffle"` incondicionalmente, então o embaralhamento aparece em destaque no meio da tela. O pedido é que o shuffle aconteça DENTRO da área visual real do deck de cada jogador (não em destaque central) — mudando de "cinemática" pra "ancorada no tabuleiro".

RISCO CRÍTICO CONFIRMADO EM AUDITORIA (não pular isto): o palco central existe hoje, entre outros motivos, porque NÃO depende de nenhum retângulo do DOM da área do deck — hoje ele já cai em `window.innerWidth/2` como fallback central por padrão. Mover para inline exige medir o retângulo real da área do deck (ex. `board.rectOf("deck:self")` ou chave equivalente) no momento em que a animação de shuffle monta — e isso acontece logo na ABERTURA da partida (mulligan/deal inicial), quando o layout pode ainda não ter feito o primeiro paint completo do React. Se isso não for tratado, a animação pode nascer em `(0,0)` ou quebrar no primeiro shuffle da partida (funcionando OK só nos shuffles subsequentes de re-mulligan, quando o board já está montado há mais tempo).

TAREFA:
1. Alterar a lógica de posicionamento do estágio de shuffle em `DeckDealAnimation.tsx` para renderizar ancorado na área física do deck do jogador, em vez do centro fixo da tela.
2. OBRIGATÓRIO: implementar fallback explícito e robusto para o centro da tela se o retângulo do deck vier `null`/`undefined`/zero — seguir o mesmo padrão defensivo já usado em outros componentes deste plano (ex. `origin?.x ?? window.innerWidth / 2`).
3. Confirmar que a duração/ritmo do shuffle continua respeitando `getScaledDuration`/`--sim-anim-speed-mult` (já deveria, já que é só mudança de posicionamento, não timing — não regredir isso).
4. Testar manualmente (ou pedir QA) especificamente o PRIMEIRO shuffle da partida (abertura, antes de qualquer mulligan) — não só o shuffle de re-mulligan, que já roda com o board montado há mais tempo e pode mascarar o bug de `rectOf` não medido a tempo.
5. `pnpm test src/modules/simulator/ui/DeckDealAnimation.test.tsx`, `npx tsc -b`, `npx eslint` limpos.
6. Commit local no branch do worktree, sem push, sem mexer em dev/main.
```

### Agente C — Investigação read-only (End Phase banner + sequência de setup por jogador)

```
Você é arquiteto de software sênior no simulador Gundam TCG BR. Esta tarefa é SÓ INVESTIGAÇÃO E DESENHO — não escreva código de produção.

PARTE 1 — Banner condicional "Fase de Ações" / "Fim de Turno":
O motor (phases.ts:126-184) já implementa um Action Step real na End Phase (beginEndPhaseActionStep/passEndPhaseAction/finishEndPhaseAndAdvance), com prioridade pro standbyPlayer (linha 139) — isso já é o backend correto. MAS não existe nenhum banner visual bloqueante hoje: a fila de banners (`phaseBannerQueue`, SimulatorMatchPage.tsx:1211-1229) é fixa (TURNO→COMPRA→RECUPERAÇÃO→PRINCIPAL) e não tem entrada pro Action Step; o que existe é só um rótulo pequeno não-bloqueante no ActionDock (2911-2917) e um auto-pass silencioso (1254-1264) sem nenhum anúncio.
Pedido do dono do produto: um banner "Fase de Ações" deve aparecer (bloqueando avanço) SE E SOMENTE SE qualquer um dos dois lados tiver jogada legal disponível (prioridade de exibição pro oponente do jogador da vez); caso contrário, mostrar "Fim de Turno" direto e prosseguir automaticamente pra próxima sequência completa (compra→recuperação→principal) do turno seguinte.

Tarefa:
1. Confirmar como/onde `playerHasActionStepPlay` (ou equivalente) é hoje avaliado — hoje parece ser chamado só pro jogador com prioridade atual; confirmar se dá pra reaproveitar pra checar "qualquer um dos dois lados tem jogada legal" sem duplicar lógica.
2. Desenhar (sem codar) onde a nova entrada de banner entraria na fila `phaseBannerQueue` existente sem duplicar ou conflitar com o auto-pass silencioso já implementado, e como bloquear o avanço de turno até a decisão do jogador prioritário ou o disparo do auto-pass/timeout.
3. Entregar um relatório com os arquivos exatos a modificar e uma proposta de contrato de dados (que estado novo, se algum, precisa existir) para uma futura Onda 2 de implementação.

PARTE 2 — Sequência de setup por jogador:
O dono do produto pediu que, na abertura da partida, o Jogador 1 complete toda a sequência (shuffle → draw → decisão de mulligan → shields) ANTES do Jogador 2 começar a dele — não simultâneo. Isto não foi localizado em `phases.ts` nesta auditoria (a lógica de mulligan/shuffle parece estar em outro módulo, não lido ainda).

Tarefa:
1. Localizar onde a sequência de setup/mulligan/shields é orquestrada no código atual (procurar por "mulligan", "shuffle", "dealShields" fora de `phases.ts` — provavelmente em outro arquivo do diretório `engine/` ou em `SimulatorMatchPage.tsx`).
2. Confirmar se a sequência hoje já é por jogador (P1 completo, depois P2) ou simultânea/intercalada.
3. Se já for sequencial como pedido, apenas confirmar e citar file:line. Se não for, descrever o desenho da mudança (sem codar) e o nível de risco.

Entregar os dois relatórios (Parte 1 e Parte 2) como texto — nenhum código de produção nesta rodada.
```

---

## Plano de verificação

**Automatizado** (rodar após cada onda mesclada):
```bash
pnpm test src/pages/SimulatorMatchPage.test.tsx
pnpm test src/modules/simulator/ui/DeckDealAnimation.test.tsx
npx tsc -b
npx eslint src/pages/SimulatorMatchPage.tsx src/modules/simulator/ui/
```

**Manual (dono do produto)**:
1. **Onda 0**: jogar até reproduzir o cenário do vídeo (bot ataca e destrói unidade) com o DevTools/console aberto. Confirmar que o tabuleiro não congela mais; se algo falhar, o console deve mostrar uma exceção legível com stack trace — isso vira o próximo item de correção pontual, já com causa raiz concreta em vez de hipótese.
2. **Mikazuki**: antes de qualquer trabalho novo no item 3, retestar no HEAD atual do `dev` — provavelmente já está corrigido pelo commit `31da1b7`.
3. **Agente A**: fazer o bot jogar um Comando e confirmar a coreografia completa (mão do oponente → centro → trash → efeito) sem teleporte.
4. **Agente B**: abrir uma partida nova do zero (não continuar uma existente) e observar o PRIMEIRO shuffle — deve nascer ancorado na área do deck, não no centro, e não deve aparecer em `(0,0)`.
5. **Regra de prioridade**: nenhuma ação necessária — já verificado contra a fonte oficial (Comprehensive Rules §10-1-6 / FAQ Q108, gundam-gcg.com). Se houver uma citação específica de uma seção diferente que contradiga isso, reabrir a investigação.

---

## Referências

- Debate completo (transcrição bruta dos 2 turnos, Claude propositor / Gemini auditor): `docs/debates/2026-09-22-contexto-simulador-de-gundam-card-game-r.md`
- Planos anteriores mesclados: `implementation_plan_simulator.md`, `implementation_plan_simulator_v2.md`
- Fonte da regra oficial: Comprehensive Rules v1.9.0 (gundam-gcg.com/en/pdf/comprehensiverules_en.pdf), §10-1-6; FAQ oficial Q108 (gundam-gcg.com/en/rules/faqs)
