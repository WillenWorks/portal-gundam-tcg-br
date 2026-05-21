# Patch v0.3.0 — Persistência local alinhada ao Prisma + CRUD admin

## Resumo da atualização

Esta versão evolui o portal de um protótipo navegável para uma base operacional com **persistência local real no navegador**, mantendo aderência à modelagem do Prisma para facilitar a futura troca por backend/API.

## O que entrou

### 1. Persistência local nas páginas atuais
- criação de um store persistente no navegador
- bootstrap por seed inicial
- deck atual salvo e recarregado automaticamente
- métricas do dashboard derivadas do estado persistido

### 2. Estrutura alinhada ao Prisma
- store modelado em cima das mesmas entidades centrais do portal
- script `prisma:seed` adicionado
- seed inicial do Prisma criado em `prisma/seed.js`

### 3. CRUD do admin com formulários
- CRUD de **cartas**
- CRUD de **rulings**
- CRUD de **eventos**
- edição e exclusão diretamente pela interface
- reset da base local para o seed inicial

### 4. Páginas conectadas ao estado persistente
- dashboard
- catálogo de cartas
- regras/rulings
- torneios
- deckbuilder MVP
- admin

### 5. Deckbuilder melhorado
- deck persiste no navegador
- nome do deck editável
- salvar deck manualmente
- estatísticas recalculadas sobre o estado atual

## Limitação importante desta fase

Como o projeto atual está entregue como **website estático**, o Prisma **ainda não executa em runtime dentro do navegador**.

Então a solução desta versão é:

- **Prisma real** para modelagem, migrações e seed local de banco
- **persistência local no front** para o funcionamento imediato das páginas atuais

Na próxima etapa, o ideal é conectar uma API/backend que use Prisma de verdade em runtime.

## Arquivos-chave adicionados/alterados

- `src/lib/portal-db.ts`
- `src/hooks/use-portal-db.ts`
- `src/services/portal-service.ts`
- `src/pages/AdminPage.tsx`
- `src/pages/DeckbuilderPage.tsx`
- `src/pages/DashboardPage.tsx`
- `prisma/seed.js`
- `README.md`

## Comandos úteis desta versão

```bash
pnpm install
pnpm db:up
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm prisma:seed
pnpm dev
```

## Commit sugerido desta atualização

```bash
feat(admin): add persistent local CRUD aligned with prisma models
```

## Próximo passo recomendado

1. criar backend/API para usar Prisma em runtime
2. persistir múltiplos decks por usuário
3. adicionar autenticação e papéis
4. criar páginas de detalhe para carta, ruling e evento
5. preparar importação em lote de cartas e resultados
