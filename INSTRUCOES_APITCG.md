# Carga completa da API TCG

## Conteúdo consolidado

O novo arquivo de cartas contém **31 respostas JSON concatenadas**. O conversor reúne todas as páginas e elimina duplicidade apenas pelo ID externo da API.

| Categoria | Quantidade |
|---|---:|
| Sets | 22 |
| Cartas jogáveis cadastradas em `Card` | 1.812 |
| Produtos comerciais vinculados aos sets | 100 |
| URLs `small`, `medium` e `large` disponíveis | 1.912 de 1.912 itens |

Os 100 itens sem `CardType` são produtos como *booster box*, *booster pack*, *case* e bundles. Eles não são cartas jogáveis e, por isso, não entram em `Card`. O seed os preserva em `CardSet.metadataJson.apiProducts`, vinculados ao set correto, com imagens e mercado da origem.

## Regras de imagens

| Campo | Destino de uso |
|---|---|
| `imageSmallUrl` | Tabelas, grids, miniaturas e listas |
| `imageMediumUrl` | Renderização padrão da carta |
| `imageLargeUrl` | Tela de detalhe, zoom e visualização ampliada |

Para compatibilidade, `thumbUrl` recebe a URL pequena e `imageUrl` recebe a média.

## O que a reconstrução limpa

O comando de reconstrução do catálogo remove, nesta ordem:

1. Entradas de torneio vinculadas a decks;
2. Itens e registros de decks;
3. Itens e registros de binders — o “box”/coleção do usuário;
4. Rulings vinculadas às cartas;
5. Cartas e sets.

Ele **preserva** usuários, posts, taxonomias e os registros principais de torneio. Os binders padrão são recriados automaticamente quando o usuário acessar a área autenticada novamente.

## Atualização local recomendada

Use este fluxo para aplicar a migration, limpar apenas o catálogo atual e recadastrar os dados completos:

```bash
pnpm install
pnpm prisma:generate
pnpm exec prisma migrate dev
pnpm run catalog:apitcg:check
pnpm run prisma:rebuild:apitcg
pnpm run build
```

O comando `prisma:rebuild:apitcg` equivale a:

```bash
pnpm run prisma:clear:catalog
pnpm run prisma:seed:apitcg
```

## Reset total do banco local

Se quiser zerar absolutamente toda a base local, inclusive usuários e demais dados, use:

```bash
pnpm install
pnpm prisma:generate
pnpm run prisma:reset:seed:apitcg
pnpm run catalog:apitcg:check
pnpm run build
```

> O reset total é mais destrutivo. Para o pedido de limpar cards, sets, decks e box, prefira `pnpm run prisma:rebuild:apitcg`.

## Ambiente compartilhado ou produção

Faça backup antes da alteração. Depois execute:

```bash
pnpm install
pnpm prisma:generate
pnpm exec prisma migrate deploy
pnpm run catalog:apitcg:check
pnpm run prisma:rebuild:apitcg
pnpm run build
```

## Validações disponíveis

```bash
pnpm run catalog:apitcg:check
npx prisma validate
pnpm run build
```

A checagem confirma IDs externos únicos, vínculo com set existente e as três URLs de imagem. O seed usa `externalId` como identificador único, por isso reprints, promos e versões especiais que compartilham o mesmo `code` são preservados como impressões distintas.
