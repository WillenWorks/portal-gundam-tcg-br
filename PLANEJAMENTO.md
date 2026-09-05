# Planejamento — Pós-v1.0

> Cópia portátil (pra abrir de qualquer ambiente/máquina sem navegar pasta
> por pasta) do épico canônico em
> [`.planning/epics/pos-v1-traducao-e-st03-st04.md`](.planning/epics/pos-v1-traducao-e-st03-st04.md).
> Atualize os dois juntos — este arquivo existe só por conveniência de acesso.

# Epic: Pós-v1.0 — Tradução de textos de carta + ST03/ST04 no Simulador

**Created**: 2026-09-04
**Status**: planning
**Owner**: Willen

---

## Why

A v1.0 está pronta e em teste com jogadores reais. As duas próximas frentes,
apontadas pelo Willen, atacam as duas maiores lacunas de conteúdo do
catálogo/simulador: (1) hoje toda carta cai no fallback em inglês porque
`effectPt` nunca foi populado pelo pipeline principal de import — e (2) o
simulador só roda 2 dos vários starter decks do jogo real (ST01/ST02),
limitando a variedade de partidas que os testers conseguem jogar.

---

## Success Criteria

- [ ] O texto de efeito (não as keywords) de pelo menos ST01+ST02+ST03+ST04
      aparece em português em TODOS os lugares que hoje mostram `effectEn`
      (database, detalhe de carta, deckbuilder, inspetor do simulador) —
      com um plano claro pra continuar traduzindo o resto do catálogo depois.
- [ ] ST03 e ST04 são jogáveis ponta a ponta no Simulador (deploy, combate,
      todas as habilidades das 32 cartas únicas), com a mesma cobertura de
      teste que ST01/ST02 têm hoje (`pnpm test` verde, zero regressão).
- [ ] Lobby do Simulador (`SimulatorSandboxPage`) oferece ST03/ST04 como
      opção de deck, qualquer combinação entre os 4 decks é válida.

---

## Features

| # | Feature | Status | Spec | Plan | Depends On |
|---|---------|--------|------|------|------------|
| 1 | Medir escopo real (tradução: IA + revisão, decidido) | todo | — | — | — |
| 2 | Pipeline/ferramenta de tradução de `effectPt` | todo | — | — | #1 |
| 3 | Traduzir ST01+ST02 (prioridade — já jogáveis) | todo | — | — | #2 |
| 4 | Auditoria carta-a-carta ST03+ST04 (tipo docs/26 V1) | todo | — | — | — |
| 5 | `CardDef` + `EffectSpec` + testes — ST03 | todo | — | — | #4 |
| 6 | `CardDef` + `EffectSpec` + testes — ST04 | todo | — | — | #4 |
| 7 | Habilitar ST03/ST04 no lobby do Simulador | todo | — | — | #5, #6 |
| 8 | Traduzir o restante do catálogo (demais coleções) | todo | — | — | #2, #3 |
| 9 | Organizar feedback dos testers reais | blocked | — | — | — |

Frentes 1-3/8 (tradução) e 4-7 (ST03/ST04) são independentes entre si —
podem correr em paralelo. #9 está bloqueada até o Willen trazer o feedback.

---

## Feature Briefs

### Feature 1: Medir escopo real
Rodar uma query real no banco (`SELECT COUNT(*) FROM "CardModel" WHERE
"effectEn" IS NOT NULL`) pra saber quantos textos únicos existem de
verdade (tradução é por `CardModel` — identidade de jogo deduplicada,
docs/13 — não por `Card`/print, que infla o número à toa).

**Decidido (Willen, 2026-09-04): tradução assistida por IA + revisão
humana.** Lote traduzido preservando o vocabulário oficial (keywords
【Deploy】/<Blocker>/etc. NUNCA traduzidas, mesma convenção de `/rules`);
Willen revisa os termos técnicos antes de publicar. Decidir ainda se cabe
expor edição de `effectPt` direto no AdminPage (hoje só rulings têm form
de edição visível ali) ou se o lote revisado entra direto via script/seed.

### Feature 2: Pipeline/ferramenta de tradução de `effectPt`
Construir o que a Feature 1 decidir: um script batch (lote de traduções
revisadas → `UPDATE CardModel SET effectPt = ...`), uma extensão do
`scripts/catalog-import.mjs` (já tem suporte a `textSectionsJson` com
`textPt`/`textEn` por seção — pode já ser o caminho certo), e/ou um campo
de edição no AdminPage. Zero mudança de schema necessária (`effectPt` já
existe em `CardModel` e `Card`); zero mudança de UI de leitura necessária
(`effectPt ?? effectEn` já está em todo consumidor).

### Feature 3: Traduzir ST01+ST02
Prioridade alta — essas 32 cartas (16+16) já são jogadas de verdade no
Simulador todo dia pelos testers. Primeiro lote real usando o pipeline da
Feature 2, sem esperar o catálogo inteiro.

### Feature 4: Auditoria carta-a-carta ST03+ST04
Antes de escrever qualquer `CardDef`/`EffectSpec`, repetir o processo que
`docs/26` já fez pra ST01/ST02: ler `data/gcg-official-cards.json` (32
cartas, ST03 = Mobile Suit Gundam Unicorn/Sinanju, ST04 = Mobile Suit
Gundam SEED/Strike Gundam) carta a carta contra `docs/29` (checklist de
carta nova + vocabulário disponível hoje) e marcar qual mecânica de cada
carta já é coberta vs. precisa de primitiva nova no motor. Já achei pelo
menos 2 candidatas a primitiva nova numa leitura rápida (não substitui a
auditoria de verdade):
- **ST03-006 Char's Zaku Ⅱ**: "Look at top 3 cards of your deck, may
  reveal 1 matching card and add to hand, return the rest" — não existe
  hoje uma primitiva de "olhar N do topo + filtrar + revelar
  condicionalmente" (`moveWithinDeck` só reordena 1 carta JÁ revelada).
- **ST03-010 Full Frontal**: "【When Paired】may deploy 1 Unit card Lv.4 or
  lower FROM A MÃO" como efeito DISPARADO — diferente da ação normal de
  Main Phase (`deployCard`), pode precisar de um novo `PrimitiveCall.op`
  ou reaproveitar o fluxo de deploy de um jeito que hoje não existe.

A maioria das outras 30 cartas parece caber no vocabulário já existente
(Support/Blocker/Breach/High-Maneuver já são keywords genéricas;
`spawnToken` já aceita `rested: true`; `moveZone` pra "hand" deve cobrir
bounce; `targetFilter` "hp<=N"/"level<=N" já existem) — mas isso precisa
ser confirmado carta a carta, não só por amostragem.

### Feature 5: `CardDef` + `EffectSpec` + testes — ST03
Seguindo `docs/29` à risca: `fixtures/st03Deck.ts` (CardDef das 16 cartas,
campos estruturados primeiro — `staticAbilities`/`combatTriggers`/
`attackTargetRules`/`pilotMode` antes de qualquer EffectSpec) +
`content/st03.ts` (EffectSpec só pro que sobrar, gatilho pontual → ação) +
`content/st03.test.ts` (mesmo padrão de `st01.test.ts`/`st02.test.ts`).
Qualquer primitiva nova encontrada na Feature 4 é implementada aqui, no
motor genérico (`engine/effectSpec.ts`), nunca como caso especial só de
ST03.

### Feature 6: `CardDef` + `EffectSpec` + testes — ST04
Mesma estrutura da Feature 5, pras 16 cartas de ST04. Independente de #5
(podem rodar em paralelo), mas ambas dependem da auditoria conjunta (#4).

### Feature 7: Habilitar ST03/ST04 no lobby do Simulador
`SimulatorSandboxPage.tsx` (`DECK_OPTIONS`) + a fixture de decklist real
(50 cartas principais + 10 de recurso, não só as 16 únicas — mesmo padrão
de `st01Deck.ts`/`st02Deck.ts` provavelmente já tem essa distinção) +
`ART_SET_CODES` em `SimulatorMatchPage.tsx` pra arte real aparecer.
Trabalho pequeno, é só ligar o que já foi construído nas Features 5/6.

### Feature 8: Traduzir o restante do catálogo
As outras ~18 coleções (fora ST01-04) — menor prioridade que #3 porque
não afetam o Simulador ainda, só a Database/Deckbuilder pública. Pode ser
incremental (uma coleção por vez) usando o mesmo pipeline da Feature 2.

### Feature 9: Organizar feedback dos testers reais
Bloqueada — o Willen ainda não trouxe o feedback pra esta conversa. Quando
chegar: triar por severidade/área (bug vs. sugestão, simulador vs.
catálogo), decidir o que vira hotfix imediato vs. o que entra nesta epic
ou numa nova.

---

## Risks

- **Escopo de tradução desconhecido de verdade** — não consegui rodar uma
  query no banco nesta sessão (Docker não estava de pé). O número real de
  `CardModel` com `effectEn` preenchido pode ser bem maior ou menor do que
  "1.812" (esse número é de `Card`, prints, não de modelos únicos).
- **ST03/ST04 podem esconder mais mecânica nova do que as 2 cartas que já
  achei numa leitura rápida** — só a auditoria completa (Feature 4) sabe
  de verdade; o processo (docs/29) foi desenhado pra isso, mas "a maioria
  do vocabulário já existe" é uma hipótese, não uma garantia.
- ~~Confirmar se "ST03"/"ST04" é literal~~ — **confirmado (Willen,
  2026-09-04): sim, exatamente ST03 (Mobile Suit Gundam Unicorn/Sinanju) e
  ST04 (Mobile Suit Gundam SEED/Strike Gundam)**, os dados já importados
  em `data/gcg-official-cards.json`.

---

## Notes

- As 2 frentes (tradução e ST03/ST04) são independentes — não precisam
  ser feitas em ordem uma da outra, só internamente cada uma tem
  dependência sequencial.
- `docs/29` já é o "spec" de como fazer carta nova — as specs das
  Features 5/6 devem referenciar esse doc em vez de reescrever o processo.
