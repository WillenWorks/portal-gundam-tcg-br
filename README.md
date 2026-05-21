# Portal Gundam TCG BR

Base inicial do portal brasileiro focado no **Gundam Card Game**, com direção para evoluir em:

- portal de conteúdo
- base de regras, FAQ e rulings em pt-BR
- deckbuilder com estatísticas
- cadastro e análise de torneios
- integração com canal de YouTube
- monetização futura
- simulador em etapas posteriores

## Stack inicial

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui
- wouter
- pnpm
- Prisma
- PostgreSQL local via Docker

## Status atual

- landing page inicial criada com identidade **Hangar Tático Neo-Militar**
- projeto web inicializado
- repositório Git local iniciado
- documentação-base criada
- schema inicial do Prisma criado
- configuração de Postgres local via Docker criada
- banco remoto ainda não conectado no sandbox atual

## Documentos

- `docs/00-visao-produto.md`
- `docs/01-arquitetura-roadmap.md`
- `docs/02-setup-local.md`

## Como rodar localmente

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm dev
```

## Build

```bash
pnpm build
```

## Scripts úteis

```bash
pnpm db:up
pnpm db:down
pnpm db:logs
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm prisma:studio
```

## Direção visual adotada

**Hangar Tático Neo-Militar**

Princípios:

- visual tecnológico e militar sci-fi
- leitura clara para conteúdo e analytics
- painéis angulares e clima de terminal tático
- identidade forte sem perder simplicidade operacional

## Estratégia de IA no produto

- tradução assistida de regras e cartas com revisão humana
- busca e FAQ semântica em pt-BR
- apoio editorial para notícias, previews e reviews
- enriquecimento de analytics e contexto competitivo
- geração de peças visuais com AnyGen

## Próximos passos sugeridos

1. estruturar rotas internas do portal
2. modelar os tipos e serviços iniciais de cartas, decks, FAQ e torneios
3. ligar a camada Prisma ao backend/API escolhida
4. iniciar admin de cartas e regras
5. construir deckbuilder MVP

## Observação importante

Este projeto deve manter posicionamento de **portal de comunidade / não oficial**, salvo eventual parceria futura com os detentores da marca.
