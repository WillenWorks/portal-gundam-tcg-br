# Atualização — catálogo administrativo

## Escopo aplicado

O catálogo em `/admin/cards` passou a usar filtros e paginação **no servidor**, sem depender de uma amostra carregada no navegador.

### Filtros disponíveis

- Nome ou código
- Tipo, cor, coleção e raridade
- AP, HP, custo e level
- Trait e mídia/série
- Link/piloto: com vínculo ou sem vínculo
- Status de legalidade

### Ordenação

- Código A–Z / Z–A
- Nome A–Z / Z–A
- AP, HP, custo e level (menor/maior)
- Raridade A–Z / Z–A
- Atualização (recente/antiga)

### Paginação e URL

- Tamanhos: 25, 50, 80 ou 100 cartas por página.
- O painel exibe faixa atual, total de resultados e total de páginas.
- Todos os filtros, a ordenação, a página e o tamanho de página ficam na URL, por exemplo:

```text
/admin/cards?q=gundam&cardType=UNIT&trait=Earth%20Federation&sort=ap_desc&page=2&pageSize=50
```

Assim, atualizar a página, compartilhar o link ou voltar pelo navegador preserva a consulta.

## Arquivos para substituir

Mantenha a estrutura de pastas ao extrair:

- `server/index.ts`
- `src/lib/api.ts`
- `src/pages/AdminPage.tsx`

Não há alteração de schema Prisma nem necessidade de reset, migration ou nova carga do catálogo.

## Validação depois de aplicar

```powershell
pnpm install
pnpm prisma:generate
pnpm run build
pnpm dev:api
```

Em outro terminal:

```powershell
pnpm dev
```

Acesse `/admin/cards` autenticado como administrador e teste uma combinação de filtros, mudança de página, atualização do navegador e abertura da URL em uma nova aba.
