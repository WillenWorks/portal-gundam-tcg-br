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

## Comando único (recomendado)

Depois do primeiro `pnpm install` + `pnpm prisma:generate` + schema sincronizado
(`prisma db push` ou `prisma migrate`), o fluxo completo — usuário admin, catálogo
real e curadoria oficial (série + relações) — roda em um comando só:

```bash
pnpm run catalog:bootstrap
```

Equivale a, em ordem: `prisma:seed` (usuário admin + binders padrão) →
`prisma:seed:apitcg` (catálogo completo) → `curation:gcg:apply` (série e relações
via dataset oficial, ver `docs/10-convencoes-relacoes-cartas.md`) →
`catalog:apitcg:check` (validação). Todo o fluxo é idempotente — pode rodar de novo
sem duplicar nada.

Pra recomeçar absolutamente do zero (apaga tudo, inclusive usuários):

```bash
pnpm run catalog:bootstrap:fresh
```

## Atualização local recomendada

Use este fluxo para aplicar a migration, limpar apenas o catálogo atual e recadastrar os dados completos:

```bash
pnpm install
pnpm prisma:generate
pnpm exec prisma migrate dev
pnpm run catalog:apitcg:check
pnpm run prisma:rebuild:apitcg
pnpm run curation:gcg:apply
pnpm run build
```

O comando `prisma:rebuild:apitcg` equivale a:

```bash
pnpm run prisma:clear:catalog
pnpm run prisma:seed:apitcg
```

> `prisma:rebuild:apitcg` limpa e recadastra só o catálogo — não roda a curadoria oficial
> sozinho. Depois dele, sempre rode `pnpm run curation:gcg:apply` pra série e relações
> voltarem a ficar preenchidas (ou use `pnpm run catalog:bootstrap`, que já inclui os dois).

## Reset total do banco local

Se quiser zerar absolutamente toda a base local, inclusive usuários e demais dados, use:

```bash
pnpm install
pnpm prisma:generate
pnpm run prisma:reset:seed:apitcg
pnpm run curation:gcg:apply
pnpm run catalog:apitcg:check
pnpm run build
```

Ou, equivalente e mais direto: `pnpm run catalog:bootstrap:fresh`.

> O reset total é mais destrutivo. Para o pedido de limpar cards, sets, decks e box, prefira `pnpm run prisma:rebuild:apitcg`.

## Ambiente compartilhado ou produção

Faça backup antes da alteração. Depois execute:

```bash
pnpm install
pnpm prisma:generate
pnpm exec prisma migrate deploy
pnpm run catalog:apitcg:check
pnpm run prisma:rebuild:apitcg
pnpm run curation:gcg:dry-run
pnpm run curation:gcg:apply
pnpm run build
```

> Em ambiente compartilhado, rode sempre `curation:gcg:dry-run` antes do `--apply` pra
> conferir os números esperados (veja `docs/10-convencoes-relacoes-cartas.md` pro
> critério do que cada tipo de relação representa) antes de gravar de verdade.

## Validações disponíveis

```bash
pnpm run catalog:apitcg:check
npx prisma validate
pnpm run build
```

A checagem confirma IDs externos únicos, vínculo com set existente e as três URLs de imagem. O seed usa `externalId` como identificador único, por isso reprints, promos e versões especiais que compartilham o mesmo `code` são preservados como impressões distintas.
