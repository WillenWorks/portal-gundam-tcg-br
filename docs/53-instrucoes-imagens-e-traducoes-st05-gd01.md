# docs/53: Instruções de Execução — Imagens e Traduções PT-BR de ST05 e GD01

Este documento contém a especificação técnica e os **prompts de execução modular** para o agente desenvolvedor sênior (backend, frontend e game design). O objetivo é garantir que 100% das cartas das coleções **ST05** e **GD01** possuam imagens corretas, traduções em português (pt-BR) completas e dados dinâmicos perfeitamente carregados no inspetor de campo do simulador.

---

## Estrutura das Sessões de Execução

| Sessão | Escopo | Arquivos Principais |
|---|---|---|
| **Sessão 1** | Banco de Dados: Promoção de Prints Primários e Limpeza de Fantasmas | `prisma/cleanup-phantom-prints.mjs`, PostgreSQL via Prisma |
| **Sessão 2** | Pipeline de Tradução pt-BR de GD01 (108 cartas) | `data/translations-gd01.json`, `scripts/translate-card-effects.mjs` |
| **Sessão 3** | Integração no Simulador: Resolução de Arte, Efeitos e Aliases | `src/pages/SimulatorMatchPage.tsx` |
| **Sessão 4** | Inspetor de Campo: Telemetria, Links de Piloto e Validação Visual | `CardInspectorModal.tsx`, `CardInspectorPanel.tsx`, `BattleSlot.tsx` |
| **Sessão 5** | Testes Automatizados e Auditoria de Regressão | `gundam-audit-catalog.mjs`, `tsc -b`, Vitest |

---

## SESSÃO 1 — Promoção de Prints Primários e Limpeza de Fantasmas

### Contexto de Engenharia
No banco de dados PostgreSQL, a coleção **ST05** já possui 100% das 15 cartas com imagens registradas no TCGPlayer CDN.
Entretanto, na coleção **GD01**, 4 cartas (`GD01-001`, `GD01-090`, `GD01-099`, `GD01-129`) e 2 utilitárias (`R-002`, `T-011`) possuem registros de impressão "fantasma" legados (criados por um script de importação antigo) marcados como `isPrimaryPrint: true` com `imageUrl: null`.
As impressões reais com URLs de imagem do CDN TCGPlayer já existem no banco para essas mesmas cartas, porém com `isPrimaryPrint: false`. Como o endpoint `GET /api/cards` prioriza `isPrimaryPrint: desc`, a API retorna `imageUrl: null` para essas 4 cartas de GD01.

### Tarefas
1. Atualizar ou estender o script [`prisma/cleanup-phantom-prints.mjs`](file:///c:/WillenWorks/portal-gundam-tcg-br/prisma/cleanup-phantom-prints.mjs) para:
   - Para as cartas que possuem referências em `DeckItem` (como `GD01-001` e `GD01-090`), migrar a referência de `cardId` para o ID da impressão real (com imagem).
   - Promover a impressão real com imagem para `isPrimaryPrint: true`.
   - Remover as impressões fantasmas com `imageUrl: null`.
2. Executar o script com `--apply`.
3. Validar via query ou script rápido que `GET /api/cards?setCode=GD01` retorna 100% das 130 cartas com `imageUrl` preenchido.

```markdown
### PROMPT DE EXECUÇÃO — SESSÃO 1

Você é o desenvolvedor sênior de backend e banco de dados. Sua tarefa é corrigir as imagens de GD01 no banco PostgreSQL, eliminando os prints fantasmas sem imagem e promovendo os prints reais para primários.

1. Inspecione o script `prisma/cleanup-phantom-prints.mjs`. Ele já identifica os 6 prints sem imagem:
   - GD01-001 (Gundam)
   - GD01-090 (Duo Maxwell)
   - GD01-099 (Intercept Orders)
   - GD01-129 (Kusanagi)
   - R-002 (Resource)
   - T-011 (Fatum-00)
2. Note que GD01-001 e GD01-090 possuem vínculos em `DeckItem`. Para esses casos:
   - Encontre a impressão real da mesma carta (`code`) que possui `imageUrl` válido no banco.
   - Atualize os `DeckItem` vinculados ao print fantasma para apontar para o ID do print real.
   - Defina `isPrimaryPrint: true` no print real.
   - Delete o print fantasma.
3. Para GD01-099, GD01-129, R-002 e T-011 (sem vínculos):
   - Defina `isPrimaryPrint: true` no print real correspondente que possui `imageUrl`.
   - Delete o print fantasma.
4. Execute o script com `--apply`.
5. Valide que todos os 130 CardModels de GD01 agora possuem um print primário ativo com `imageUrl` válido (apontando para o CDN do TCGPlayer).
```

---

## SESSÃO 2 — Pipeline de Tradução pt-BR de GD01 (108 cartas)

### Contexto de Engenharia
- **ST05**: Já está 100% concluído em [`data/translations-st05.json`](file:///c:/WillenWorks/portal-gundam-tcg-br/data/translations-st05.json) e aplicado no Postgres (`CardModel.effectPt` e `Card.effectPt`).
- **GD01**: O arquivo [`data/translations-gd01.json`](file:///c:/WillenWorks/portal-gundam-tcg-br/data/translations-gd01.json) contém 130 entradas: 22 estão com `status: "OK"` (2 traduzidas com efeito + 20 vanilla sem texto). As outras 108 cartas estão com `status: "REJEITADO"` porque foram abortadas por limite de cota 429 na sessão anterior (`docs/51`).
- O script [`scripts/translate-card-effects.mjs`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/translate-card-effects.mjs) já possui suporte a `--sets=GD01`, `--resume`, `--revalidate` e `--push`, utilizando o modelo `gemini-3.6-flash`.
- Regras de estilo oficiais (`docs/17` e `docs/51`):
  - `"Rest it."` $\rightarrow$ `"Coloque-a em Rest."`
  - `"Rest this Unit:"` $\rightarrow$ `"Coloque esta Unidade em Rest："`
  - `"Rest this Base:"` $\rightarrow$ `"Coloque esta Base em Rest："`
  - `"Deploy this card."` $\rightarrow$ `"Faça o Deploy desta carta."`
  - Todos os marcadores `§N§` de tokens protegidos (`【...】`, `<...>`, `[Nome]`, `(Traits)`, `AP`, `HP`, `Lv.X`) devem permanecer idênticos.

### Tarefas
1. Executar a tradução incremental:
   ```bash
   node --env-file=.env scripts/translate-card-effects.mjs --sets=GD01 --resume
   ```
2. Caso alguma chamada produza as variações rejeitadas de "Rest" ou "Deploy", normalize para o padrão oficial estabelecido em ST01-04 e ST05.
3. Executar validação de multiset de tokens:
   ```bash
   node scripts/translate-card-effects.mjs --sets=GD01 --revalidate
   ```
   Garantir `130 OK, 0 REJEITADAS`.
4. Persistir no PostgreSQL (sem problemas de encoding no Windows):
   ```bash
   node --env-file=.env scripts/translate-card-effects.mjs --sets=GD01 --push
   ```
5. Confirmar que os 130 modelos de GD01 e seus respectivos prints possuem `effectPt` gravado no banco.

```markdown
### PROMPT DE EXECUÇÃO — SESSÃO 2

Você é o desenvolvedor sênior responsável pelo pipeline de internacionalização e dados do catálogo.

1. Execute a continuação da tradução de GD01 via `scripts/translate-card-effects.mjs`:
   `node --env-file=.env scripts/translate-card-effects.mjs --sets=GD01 --resume`
2. Caso haja cartas rejeitadas ou divergências de estilo reportadas pelo script, faça a revisão manual em `data/translations-gd01.json`:
   - "Rest it." -> "Coloque-a em Rest."
   - "Rest this Unit:" -> "Coloque esta Unidade em Rest："
   - "Deploy this card." -> "Faça o Deploy desta carta."
   - Nunca traduza palavras-chave congeladas (Deploy, Burst, When Paired, During Pair, During Link, Once per Turn, Blocker, Breach, Repair, First Strike, High-Maneuver, Suppression, AP, HP, Lv.X, Rest, Active, Cost, Shield).
3. Rode `node scripts/translate-card-effects.mjs --sets=GD01 --revalidate` e confirme que todas as 130 cartas de GD01 estão com `status: "OK"` e 0 rejeitadas.
4. Aplique no banco com `node --env-file=.env scripts/translate-card-effects.mjs --sets=GD01 --push`.
5. Verifique no Postgres que `CardModel.effectPt` e `Card.effectPt` foram devidamente preenchidos para ST05 e GD01.
```

---

## SESSÃO 3 — Integração no Frontend do Simulador (`SimulatorMatchPage.tsx`)

### Contexto de Engenharia
No arquivo [`src/pages/SimulatorMatchPage.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorMatchPage.tsx):
- Linha 164: `const ART_SET_CODES = ["ST01", "ST02", "ST03", "ST04"];`
- Linha 168: `const GENERIC_ART_SET_CODES = ["GD01"];`
- Linha 170:
  ```ts
  const ART_CODE_ALIASES: Record<string, string> = {
    "ST01-RESOURCE": "R-001",
    "ST02-RESOURCE": "R-001",
    "TOKEN-EX-BASE": "EXB-001",
    "TOKEN-EX-RESOURCE": "EXR-001",
  };
  ```
Como `ST05` não está em `ART_SET_CODES`, a função `useCardArtLookup()` não requisita `/api/cards?setCode=ST05`. Consequentemente:
- O dicionário `art` não tem as artes de ST05.
- O dicionário `cardText` não tem os textos `{ pt, en }` de ST05.
- O dicionário `cardByName` não tem os pilotos de ST05 (Mikazuki Augus `ST05-010`, Akihiro Altland `ST05-011`, McGillis Fareed `ST05-012`).
- Os recursos de ST03, ST04, ST05 e GD01 (`ST03-RESOURCE`, `ST04-RESOURCE`, `ST05-RESOURCE`, `RESOURCE-01`) não mapeavam para `R-001`.

### Tarefas
1. Atualizar `ART_SET_CODES` para incluir `"ST05"` e `"GD01"`:
   ```ts
   const ART_SET_CODES = ["ST01", "ST02", "ST03", "ST04", "ST05", "GD01"];
   ```
2. Atualizar `ART_CODE_ALIASES`:
   ```ts
   const ART_CODE_ALIASES: Record<string, string> = {
     "ST01-RESOURCE": "R-001",
     "ST02-RESOURCE": "R-001",
     "ST03-RESOURCE": "R-001",
     "ST04-RESOURCE": "R-001",
     "ST05-RESOURCE": "R-001",
     "RESOURCE-01": "R-001",
     "TOKEN-EX-BASE": "EXB-001",
     "TOKEN-EX-RESOURCE": "EXR-001",
   };
   ```
3. Verificar que `useCardArtLookup()` indexa corretamente:
   - `art[code]`: URL da imagem média e pequena para cada carta.
   - `cardText[code]`: `{ pt, en }` para cada carta com efeito.
   - `cardByName[nameEn]`: mapeamento de nomes de pilotos para vincular retratos em `resolveLinkedPilots()`.

```markdown
### PROMPT DE EXECUÇÃO — SESSÃO 3

Você é o desenvolvedor frontend sênior. Sua tarefa é integrar ST05 e GD01 ao sistema de lookup de arte e efeitos do simulador.

1. No arquivo `src/pages/SimulatorMatchPage.tsx`:
   - Atualize `ART_SET_CODES` para incluir "ST05" e "GD01":
     `const ART_SET_CODES = ["ST01", "ST02", "ST03", "ST04", "ST05", "GD01"];`
   - Atualize `ART_CODE_ALIASES` adicionando:
     `"ST03-RESOURCE": "R-001"`,
     `"ST04-RESOURCE": "R-001"`,
     `"ST05-RESOURCE": "R-001"`,
     `"RESOURCE-01": "R-001"`.
2. Certifique-se de que a query `Promise.all` em `useCardArtLookup()` busca todas as cartas desses sets.
3. Valide a compilação com `pnpm exec tsc -b`.
```

---

## SESSÃO 4 — Verificação e Refinamento do Inspetor de Campo

### Contexto de Engenharia
Ao clicar numa unidade em campo (`BattleSlot.tsx`), o evento dispara `onInspect(unit)` e abre o `CardInspectorModal.tsx`.
O modal consome:
- `art={art}`: imagem grande da carta (~78vh).
- `effectPt={cardText[inspect.def.code]?.pt}`: texto traduzido em pt-BR.
- `effectEn={cardText[inspect.def.code]?.en}`: texto original em inglês.
- `linkedPilots={resolveLinkedPilots(inspect.def)}`: pilotos que atendem à link condition com retratos obtidos via `cardByName`.
- `state={boardForStats}` e `inPlay={true}`: AP e HP efetivos em jogo (calculando dano recebido, bônus de piloto pareado e modificadores contínuos como `<Repair 1>`, `<High-Maneuver>` e buffs de turno).

### Tarefas
1. Auditar `CardInspectorModal.tsx` e `CardInspectorPanel.tsx` para garantir que:
   - Cartas de ST05 (ex.: *Gundam Barbatos*, *Mikazuki Augus*, *Graze*, *Gundam Gusion Rebake*) exibem imagem oficial nítida e texto em português por padrão.
   - O botão toggle `[ PT | EN ]` está visível e funcional quando ambos os textos existem.
   - Cartas de GD01 (ex.: *Gundam* GD01-001, *Unicorn Gundam* GD01-002, *Freedom Gundam* GD01-065) exibem a arte e o texto traduzido sem cortes.
   - Se uma carta tiver `pilotName` linkado (ex.: *Barbatos* linka com *Mikazuki Augus*), o chip do piloto renderiza o retrato de Mikazuki e indica se a carta está na mão ou no campo.
2. Garantir que cartas vanillas (sem efeito, ex.: ST05-004, GD01-011) exibam o painel de estatísticas limpo, sem bloco de efeito vazio ou quebrado.

```markdown
### PROMPT DE EXECUÇÃO — SESSÃO 4

Você é o desenvolvedor especialista em UX e Game Design do simulador.

1. Revise `src/modules/simulator/ui/CardInspectorModal.tsx` e `src/modules/simulator/ui/CardInspectorPanel.tsx`.
2. Verifique o comportamento da inspeção de carta no campo (`inPlay={true}`):
   - A arte grande carrega via CDN oficial do TCGPlayer para todas as cartas de ST01 a ST05 e GD01.
   - O efeito exibe a tradução pt-BR por padrão.
   - O botão alternador `PT | EN` alterna perfeitamente entre o texto em português e inglês.
   - O hover/popover de pilotos linkados exibe o retrato do piloto via `resolveLinkedPilots`.
   - AP e HP mostram os valores efetivos em jogo (considerando dano acumulado e piloto pareado).
3. Teste o comportamento do inspetor para cartas de ST05 e GD01 no ambiente local.
```

---

## SESSÃO 5 — Testes Automatizados e Auditoria de Regressão

### Tarefas
1. Executar a auditoria de consistência do catálogo:
   ```bash
   node scripts/gundam-audit-catalog.mjs
   ```
2. Executar checagem de tipos estática:
   ```bash
   pnpm exec tsc -b
   ```
3. Executar toda a suíte de testes unitários do simulador:
   ```bash
   pnpm vitest run src/modules/simulator/ui
   ```
4. Garantir 100% de testes passando e zero erros de tipos.

```markdown
### PROMPT DE EXECUÇÃO — SESSÃO 5

Você é o engenheiro de QA e DevOps. Sua missão é validar a integridade de todo o sistema após as alterações de banco, traduções e frontend.

1. Execute a checagem de tipos estática do TypeScript:
   `pnpm exec tsc -b`
2. Execute os testes unitários do simulador:
   `pnpm vitest run src/modules/simulator/ui`
3. Execute a auditoria do catálogo:
   `node scripts/gundam-audit-catalog.mjs`
4. Documente os resultados no arquivo `CHECKLIST-DOC-53.md`.
```
