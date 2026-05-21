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
- store persistente local no navegador para operação do front atual

## Status atual

- landing page inicial criada com identidade **Hangar Tático Neo-Militar**
- portal interno com rotas modulares
- páginas de catálogo, regras, torneios, deckbuilder e admin
- persistência local nas páginas atuais, alinhada à modelagem Prisma
- CRUD administrativo com formulários para cartas, rulings e eventos
- schema inicial do Prisma criado
- seed inicial do Prisma criado
- configuração de Postgres local via Docker criada
- banco remoto ainda não conectado
- backend/API ainda não implementado

## Documentos

- `docs/00-visao-produto.md`
- `docs/01-arquitetura-roadmap.md`
- `docs/02-setup-local.md`
- `docs/03-git-workflow.md`
- `docs/04-patch-v0.3.0.md`

## Como rodar localmente

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm prisma:seed
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
pnpm prisma:seed
pnpm prisma:studio
```

## Arquitetura desta fase

Nesta etapa, o projeto usa duas camadas complementares:

### 1. Prisma + PostgreSQL local
Responsável por:
- modelagem
- migrações
- seed
- base para futura API/backend

### 2. Persistência local no navegador
Responsável por:
- manter o front atual funcional sem backend
- salvar estado das páginas atuais
- permitir CRUD no admin
- testar navegação e regras de interface antes da conexão com API real

## Importante

Como o projeto atual ainda é entregue como **website estático**, o Prisma **não roda diretamente em runtime no navegador**.

Ou seja:
- o Prisma já está pronto para banco local
- o front atual usa persistência local real no navegador
- a próxima etapa ideal é conectar uma API/backend usando Prisma em runtime

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
- apoio futuro ao admin e à curadoria de dados

## Próximos passos sugeridos

1. criar backend/API para uso real do Prisma em runtime
2. persistir múltiplos decks por usuário
3. adicionar autenticação e papéis
4. criar páginas de detalhe para carta, ruling e evento
5. preparar importação em lote de cartas e resultados

## Observação importante

Este projeto deve manter posicionamento de **portal de comunidade / não oficial**, salvo eventual parceria futura com os detentores da marca.
