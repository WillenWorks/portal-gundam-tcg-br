# Setup local — Portal Gundam TCG BR

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

### 5. Subir a API com bootstrap automático do Prisma

```bash
pnpm dev:api
```

Esse comando já executa o bootstrap do Prisma antes de iniciar a API local:

- `prisma generate`
- `prisma db push`

Assim, o banco local acompanha o schema atual e evita erros como coluna ausente durante o desenvolvimento.

### 6. Popular dados iniciais (opcional, mas recomendado)

```bash
pnpm prisma:seed
```

Isso cria um usuário admin e alguns registros de exemplo — suficiente pra navegar
no admin, mas **não** é o catálogo real. Pra subir o catálogo completo (1.812 cartas,
22 sets, série e relações oficiais), veja `INSTRUCOES_APITCG.md` na raiz do projeto —
o comando único é:

```bash
pnpm run catalog:bootstrap
```

### 7. Rodar o front

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
