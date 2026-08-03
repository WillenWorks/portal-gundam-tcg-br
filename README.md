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
- topo global padronizado para páginas públicas e privadas
- sidebar isolada para dashboard do usuário e admin
- modo **escuro/claro** com persistência local
- loading global técnico entre módulos lazy
- páginas públicas de decks, coleções, cartas e regras conectadas à API
- deckbuilder em módulo separado com paginação de pool e cache de API
- dashboard do usuário com decks, configurações e binders compartilháveis
- binders de **Lista de Desejos** e **Cartas Possuídas** com links públicos
- admin focado em cartas, usuários, coleções e regras
- autenticação com papéis (`USER`, `EDITOR`, `ADMIN`) e bloqueio lógico de usuário
- schema Prisma evoluído para preferências de usuário, binders e coleções mais ricas
- seed com dois logins padrão (admin + usuário regular)
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
pnpm dev:api
pnpm prisma:seed
pnpm dev
```

> `pnpm dev:api` agora faz o bootstrap do Prisma automaticamente (`prisma generate` + `prisma db push`) antes de subir a API, evitando erro de schema desatualizado no banco local.

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

## Curadoria oficial (série + relações Piloto → Unidade)

`data/gcg-official-cards.json` é um espelho enxuto do site oficial `gundam-gcg.com`
(via [gcg-api](https://github.com/yzRobo/gcg-api), scrape semanal). Ele traz o `Source Title`
oficial de cada carta e o `Link Condition` das unidades, o que permite curar série e relações
Piloto → Unidade sem depender de curadoria manual ou inferência.

```bash
pnpm run curation:gcg:dry-run   # não grava nada, mostra o que seria feito (roda sem banco)
pnpm run curation:gcg:apply     # aplica de verdade via Prisma (idempotente, pode rodar de novo)
```

Só cria `CardRelation` para vínculo **direto por nome**: Unidades com `Link Condition`
= `[Nome do Piloto]` (→ `PILOT_OF`) e Commands que citam um Piloto/Unidade específico entre
colchetes no texto do efeito (→ `SUPPORTS`). Vínculo por trait (`(Trait) Trait`, qualquer
piloto daquele trait pode linkar) é deixado para a descoberta automática que a página de
detalhe da carta já calcula, para não misturar curadoria confirmada com sugestão automática.
Os Commands sem referência nomeada no efeito (a maioria, 135 de 145) ficam de fora — precisam
de curadoria manual/híbrida, não têm padrão estrutural extraível com segurança.

> Em ambiente local, prefira iniciar a API com `pnpm dev:api`, porque esse comando sincroniza o schema Prisma automaticamente antes de subir o servidor.

## Credenciais seed padrão

```text
Admin
Email: admin@gundambr.local
Senha: admin123

Usuário regular
Email: pilot@gundambr.local
Senha: pilot123
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

1. tratar imagens reais de coleções, decks e cartas
2. conectar e validar fluxo completo com Postgres local do usuário
3. evoluir social/perfis públicos e links de binders/decks
4. esconder definitivamente estatísticas/campeonatos até a próxima fase pública
5. preparar importadores mais completos de sets/cartas/rulings e assets

## Patch v8

- menu superior padronizado em todo o portal
- botão de sair ao lado da área do usuário/admin
- sidebar somente em páginas do dashboard
- tema claro/escuro mantendo a linguagem visual do hangar
- loading global entre módulos lazy
- cards de decks públicos mais compactos
- coleções com data e leitura para lançamento futuro
- regras preparadas para PT-BR + EN + fonte original
- configurações com idioma preferido das cartas e troca de senha
- wishlists e cartas possuídas em formato de pasta compartilhável
- admin com usuários, cartas, coleções e regras como foco do MVP de testes

## Observação importante

Este projeto deve manter posicionamento de **portal de comunidade / não oficial**, salvo eventual parceria futura com os detentores da marca.
