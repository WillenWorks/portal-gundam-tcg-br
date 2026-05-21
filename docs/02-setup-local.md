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

### 5. Gerar o client do Prisma

```bash
pnpm prisma:generate
```

### 6. Criar a primeira migration

```bash
pnpm prisma:migrate --name init
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
