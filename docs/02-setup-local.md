# Setup local — Portal Gundam TCG BR

## Resumo rápido (ambiente novo, do zero)

```bash
git clone <url-do-repo>
cd portal-gundam-tcg-br
pnpm install
cp .env.example .env
pnpm run db:up
pnpm run setup:fresh-env
pnpm dev:full
```

`setup:fresh-env` encadeia `prisma generate` + `prisma migrate deploy` +
`catalog:bootstrap` (usuário admin + registros de exemplo, catálogo completo
de 1.812 cartas, sincroniza o `CardModel` de cada carta, roda a curadoria
oficial de série + relações). `dev:full` sobe API e frontend juntos.
Se algo travar em algum passo, os detalhes de cada um estão nas seções abaixo.

## Objetivo

Rodar o projeto localmente com:

- frontend em React/Vite
- PostgreSQL local via Docker
- Prisma para modelagem e migrações
- espaço pronto para futuras integrações de IA (LLM / AnyGen)

## Requisitos

- Node.js 22+ ou 24+
- pnpm 10+
- Docker Desktop ou Docker Engine + Compose
- Git

## Ferramentas principais

- `pnpm` para dependências e scripts
- `docker compose` para subir o PostgreSQL local
- `Prisma` para schema, client e migrações
- `Vite` para desenvolvimento do frontend

## Instalação

### 1. Entrar na pasta do projeto

```bash
cd portal-gundam-tcg-br
```

### 2. Copiar variáveis de ambiente

```bash
cp .env.example .env
```

### 3. Instalar dependências

```bash
pnpm install
```

### 4. Subir o PostgreSQL local

```bash
pnpm db:up
```

### 5. Aplicar as migrations (só na primeira vez, em ambiente novo)

```bash
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

`migrate deploy` aplica as migrations de `prisma/migrations/` direto, sem precisar
de banco sombra — diferente de `migrate dev`, que só serve pro dia a dia de
desenvolvimento (cria migration nova comparando com um banco temporário) e é mais
sensível a problema de conexão. Rodar `migrate deploy` uma vez, logo depois do
clone, garante que o histórico de migrations e o banco ficam alinhados desde o
início — evita o problema de *drift* documentado em `docs/11-checklist-migration.md`.

### 6. Subir a API com bootstrap automático do Prisma

```bash
pnpm dev:api
```

Esse comando já executa antes de iniciar a API local:

- `prisma generate`
- `prisma db push`

No dia a dia, isso é o suficiente pra manter o banco sincronizado com pequenas
mudanças de schema. Mas a *primeira* sincronização de um ambiente novo deve vir
do `migrate deploy` do passo 5 — `db push` sozinho não usa nem atualiza o
histórico de migrations, só sincroniza a estrutura.

### 7. Popular dados iniciais (opcional, mas recomendado)

```bash
pnpm prisma:seed
```

Isso cria um usuário admin e alguns registros de exemplo — suficiente pra navegar
no admin, mas **não** é o catálogo real. Pra subir o catálogo completo (1.812 cartas,
22 sets, série e relações oficiais, e o CardModel de cada carta — ver
`docs/13-migracao-cardmodel.md`), o comando único é:

```bash
pnpm run catalog:bootstrap
```

### 8. Rodar o front

```bash
pnpm dev
```

## Comandos úteis

### Frontend

```bash
pnpm dev
pnpm build
pnpm preview
```

### Banco local

```bash
pnpm db:up
pnpm db:logs
pnpm db:down
```

### Prisma

```bash
pnpm prisma:generate
pnpm prisma:migrate --name nome-da-migration
pnpm prisma:studio
```

> No dia a dia, `pnpm dev:api` já cobre a sincronização básica do schema local via `db push`. Use migrations quando quiser versionar mudanças de estrutura de forma explícita.

Antes de mudar o schema, veja o checklist de segurança em `docs/11-checklist-migration.md`
— cobre o risco de drift entre `db push` e `migrate`, casos que perdem dado (rename,
drop, mudança de tipo) e o que fazer se uma migration precisar ser revertida.

## Estratégia de IA recomendada

### LLM / AnyGen no produto

1. **Regras e cartas**
   - tradução assistida com revisão humana
   - resumo de mudanças em rules/FAQ oficiais
   - explicação de termos complexos em pt-BR

2. **Deckbuilder**
   - leitura de curva e densidade
   - explicação de possíveis gargalos do deck
   - sugestão contextual de cartas por função

3. **Editorial**
   - apoio para rascunho de notícias, tags, resumos e organização de temas
   - geração de artes e peças visuais com AnyGen para posts e thumbnails

4. **Administração**
   - apoio semântico para relacionar cartas, keywords, rulings e arquétipos
   - automação de descrição inicial e classificação de conteúdo

## Observações

- enquanto o banco remoto não estiver ativo, o **PostgreSQL local + Prisma** é a melhor base para desenvolver com segurança e estrutura profissional
- o frontend já foi organizado para crescer por módulos
- o schema inicial do Prisma é ponto de partida e pode ser refinado conforme o deckbuilder e o módulo competitivo evoluírem
