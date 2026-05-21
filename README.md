# Portal Gundam TCG BR

Base inicial do portal brasileiro focado no **Gundam Card Game**, com direção para evoluir em:

- portal de conteúdo
- base de regras, FAQ e rulings em pt-BR
- deckbuilder com estatísticas
- cadastro e análise de torneios
- integração com canal de YouTube
- monetização futura
- simulador em etapas posteriores

## Stack atual

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui
- wouter
- pnpm
- Prisma
- PostgreSQL local via Docker
- Express para API/backend local
- JWT para autenticação inicial

## Status atual

- landing page inicial criada com identidade **Hangar Tático Neo-Militar**
- portal interno com rotas modulares
- páginas de catálogo, regras, torneios, deckbuilder e admin
- backend/API local criado para uso do Prisma em runtime
- autenticação inicial com papéis (`USER`, `EDITOR`, `ADMIN`)
- admin conectado à API
- persistência de múltiplos decks por usuário
- schema Prisma evoluído
- seed inicial do Prisma criado
- estratégia de imagens documentada
- banco remoto ainda não conectado

## Documentos

- `docs/00-visao-produto.md`
- `docs/01-arquitetura-roadmap.md`
- `docs/02-setup-local.md`
- `docs/03-git-workflow.md`
- `docs/04-patch-v0.3.0.md`
- `docs/05-image-strategy.md`
- `docs/06-patch-v0.4.0.md`

## Como rodar localmente

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

## Rodar frontend e API juntos

```bash
pnpm dev:full
```

## Build do frontend

```bash
pnpm build
```

## Scripts úteis

```bash
pnpm db:up
pnpm db:down
pnpm db:logs
pnpm prisma:generate
pnpm prisma:migrate --name api-auth-and-multidecks
pnpm prisma:seed
pnpm prisma:studio
pnpm dev:api
pnpm dev
pnpm dev:full
```

## Credenciais seed padrão

```text
Email: admin@gundambr.local
Senha: admin123
```

## Arquitetura desta fase

Nesta etapa, o projeto passa a ter duas camadas reais:

### 1. Frontend
Responsável por:
- landing
- portal interno
- admin UI
- deckbuilder UI
- consumo da API local

### 2. Backend/API local
Responsável por:
- autenticação inicial
- papéis de acesso
- CRUD de cards, rulings e tournaments
- persistência de decks por usuário
- uso do Prisma em runtime

## Estratégia de imagens

A decisão atual é **não embutir todas as imagens no repositório**.

A abordagem recomendada nesta fase é:
- preparar o banco para `imageUrl` e `imageSourceUrl`
- manter seed de metadados/textos
- criar pipeline/importador separado para imagens e assets depois
- otimizar miniaturas e versões maiores para deckbuilder e simulador

Veja o documento:

- `docs/05-image-strategy.md`

## Importante

No ambiente local do usuário, o fluxo completo deve funcionar com Postgres local.

No sandbox desta tarefa:
- a tipagem do backend foi validada
- o Prisma Client foi gerado com sucesso
- o build do frontend foi validado
- a migration com Docker/Postgres não pôde ser rodada aqui porque o binário `docker` não está disponível no sandbox

## Estratégia de IA no produto

- tradução assistida de regras e cartas com revisão humana
- busca e FAQ semântica em pt-BR
- apoio editorial para notícias, previews e reviews
- enriquecimento de analytics e contexto competitivo
- geração de peças visuais com AnyGen
- apoio futuro ao admin, curadoria e importação de dados

## Próximos passos sugeridos

1. migrar páginas públicas para leitura prioritária da API
2. criar importadores de sets/cartas/rulings
3. preparar upload/storage de imagens
4. adicionar cadastro completo de usuários
5. evoluir deckbuilder para share link e detalhes por deck

## Observação importante

Este projeto deve manter posicionamento de **portal de comunidade / não oficial**, salvo eventual parceria futura com os detentores da marca.
