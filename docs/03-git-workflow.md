# Workflow de Git e GitHub — Portal Gundam TCG BR

## Objetivo

Manter um histórico coeso, profissional e fácil de entender.

A ideia é que cada commit responda a uma pergunta simples:

- o que mudou?
- por que mudou?
- esse bloco de mudança é independente?

---

## Convenção recomendada

Use o padrão:

```bash
<tipo>(<escopo>): <resumo curto>
```

### Tipos principais

- `feat`: nova funcionalidade
- `fix`: correção de bug
- `refactor`: reorganização sem mudar comportamento esperado
- `style`: ajuste visual/markup sem impacto lógico relevante
- `docs`: documentação
- `chore`: manutenção, configuração, scripts, dependências
- `test`: testes

### Escopos sugeridos para este projeto

- `portal`
- `landing`
- `routing`
- `cards`
- `rules`
- `tournaments`
- `deckbuilder`
- `admin`
- `prisma`
- `docker`
- `docs`
- `git`

---

## Exemplos bons para este projeto

```bash
feat(routing): create internal portal routes and shell layout
feat(deckbuilder): add initial deck assembly flow and stats panel
feat(admin): add operational admin tabs for cards rules and events
feat(prisma): add initial schema for cards decks rulings and tournaments
fix(deckbuilder): correct card quantity updates in deck list
refactor(cards): isolate catalog types and service layer
docs(git): document commit strategy and github workflow
chore(docker): add local postgres compose setup
style(landing): refine tactical hero and CTA hierarchy
```

---

## Quando fazer commit

Faça commit quando fechar um bloco lógico e testável.

### Ordem ideal no dia a dia

1. terminou uma parte funcional pequena
2. validou no navegador ou build
3. conferiu `git diff`
4. fez commit

### Não espere mudar “tudo” para commitar

Errado:

- mexer em rotas + admin + deckbuilder + docs + prisma + visual e só depois fazer um commit gigante genérico

Certo:

- commit 1: rotas e shell
- commit 2: tipos e serviços
- commit 3: admin
- commit 4: deckbuilder MVP
- commit 5: docs/setup

---

## Sequência recomendada para novas entregas

### Exemplo: quando for evoluir o deckbuilder

```bash
git checkout -b feat/deckbuilder-save
```

Trabalhou, validou, então:

```bash
git add src/pages/DeckbuilderPage.tsx src/services/portal-service.ts src/modules/core/types.ts
git commit -m "feat(deckbuilder): add local deck editing and initial stats"
```

Se encontrou um bug depois:

```bash
git add src/pages/DeckbuilderPage.tsx
git commit -m "fix(deckbuilder): prevent invalid quantity transitions"
```

Se depois atualizou documentação:

```bash
git add docs/02-setup-local.md docs/03-git-workflow.md README.md
git commit -m "docs(portal): update setup and versioning guide"
```

---

## Fluxo prático que recomendo usar

### 1. Ver o que mudou

```bash
git status
git diff
```

### 2. Adicionar só o que pertence ao commit

```bash
git add <arquivos>
```

ou por partes:

```bash
git add -p
```

### 3. Commitar com mensagem objetiva

```bash
git commit -m "feat(admin): add first operational dashboard tabs"
```

### 4. Conferir o histórico

```bash
git log --oneline --decorate --graph -10
```

---

## Branches

Sugestão simples e profissional:

- `main` → branch estável
- `feat/...` → novas features
- `fix/...` → correções
- `refactor/...` → reorganizações maiores

### Exemplos

```bash
feat/portal-routing
feat/admin-base
feat/deckbuilder-mvp
fix/deckbuilder-quantity
refactor/service-layer
```

---

## Subindo para GitHub

## Caso já tenha um repositório criado

```bash
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

## Caso queira criar com GitHub CLI

Primeiro autentique:

```bash
gh auth login
```

Depois crie e suba:

```bash
gh repo create portal-gundam-tcg-br --private --source=. --remote=origin --push
```

### Se quiser usar a organização

```bash
gh repo create WillenWorks/portal-gundam-tcg-br --private --source=. --remote=origin --push
```

---

## Estratégia de push

Push sempre depois de um conjunto coeso de commits.

### Exemplo saudável

```bash
git push origin feat/admin-base
```

ou na `main` quando já estiver estável:

```bash
git push origin main
```

---

## Regra prática para manter log bonito

Antes de commitar, pergunte:

1. esse commit faz uma coisa principal?
2. o resumo cabe em uma linha clara?
3. se eu ler esse log daqui a 3 meses, vou entender a intenção?

Se a resposta for “não”, quebre em commits menores.

---

## Modelo recomendado para este projeto daqui pra frente

### Etapa atual

- `feat(portal): add internal routes and modular shell`
- `feat(deckbuilder): add first MVP editing flow and stats`
- `feat(admin): add initial operations workspace`
- `docs(git): add versioning and github workflow guide`

### Próximas etapas prováveis

- `feat(cards): add card detail and catalog filters`
- `feat(rules): add searchable ruling knowledge base`
- `feat(prisma): connect real persistence to portal modules`
- `feat(admin): add forms for cards rules and tournaments`
- `feat(deckbuilder): persist deck lists and share links`
- `fix(portal): adjust navigation and breadcrumbs on mobile`

---

## Resumo curto

### Faça commit quando:

- fechou um bloco lógico
- validou a mudança
- consegue explicar em uma linha

### Evite:

- commit genérico tipo `update`, `ajustes`, `mudanças`
- commit gigante misturando 5 assuntos
- push direto sem revisar `git diff`
