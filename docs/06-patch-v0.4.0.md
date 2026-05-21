# Patch v0.4.0 — API Prisma runtime + Auth + Decks por usuário

## Resumo da atualização

Esta versão dá o primeiro passo full-stack real do projeto:

- backend/API usando Prisma em runtime
- autenticação com papéis
- admin operando via API
- múltiplos decks por usuário
- estratégia formalizada para imagens e seed

## O que entrou

### Backend/API
- `server/index.ts`
- endpoints para:
  - health
  - login
  - usuário autenticado
  - cards
  - rulings
  - tournaments
  - decks do usuário

### Autenticação e papéis
- login com JWT
- papéis `USER`, `EDITOR`, `ADMIN`
- admin seed criado via `.env`

### Prisma
- schema evoluído com:
  - `passwordHash` em `User`
  - `isPrimary` em `Deck`
  - `imageSourceUrl` em `Card`
- `prisma/seed.js` atualizado
- suporte a decks múltiplos por usuário

### Frontend conectado à API
- contexto de autenticação
- cliente de API
- admin ligado ao backend
- deckbuilder salvando decks via API

### Estratégia de imagens
- documentação criada com a recomendação de pipeline separado
- suporte de banco preparado para URLs de imagem e origem

## Comandos desta fase

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm prisma:generate
pnpm prisma:migrate --name api-auth-and-multidecks
pnpm prisma:seed
pnpm dev:api
pnpm dev
```

Ou, se preferir subir os dois juntos:

```bash
pnpm dev:full
```

## Credenciais seed padrão

```text
Email: admin@gundambr.local
Senha: admin123
```

## Observação importante

No sandbox atual não foi possível validar Docker porque o binário `docker` não está disponível aqui. Então:

- tipagem do backend foi validada
- geração do Prisma Client foi validada
- build do frontend foi validado
- a migração completa com Postgres deve ser rodada no seu ambiente local

## Commit sugerido desta atualização

```bash
feat(api): add prisma runtime backend auth and user deck persistence
```

## Próximo passo recomendado

1. migrar catálogo e páginas públicas para leitura prioritária da API
2. criar importadores de sets/cartas
3. preparar upload/storage de imagens
4. adicionar cadastro de usuário e sessão mais completa
5. evoluir deckbuilder para deck details e share link
