# Migração: CardModel (carta) separado de Card/impressão

> **Status: Fase 1 concluída e validada em dado real** (checklist completo
> rodado com sucesso: `cardmodel:validate` — 1.818 impressões, 1.066 `CardModel`,
> zero divergência). A migration de schema acabou sendo aplicada via `prisma db
> push` em vez de `migrate dev` (problema de conexão com o banco sombra
> específico do ambiente Windows/Docker Desktop usado) — depois consolidada
> num único arquivo de migration real (`0_init`) via `prisma migrate diff
> --from-empty`, pra que um clone novo do repositório consiga recriar tudo com
> `prisma migrate deploy` normalmente. Fase 2 (back-end `/api/cards` + galeria
> de arte na `CardDetailPage`) também concluída — ver commits de
> "Fase 2 (back-end)"/"Fase 2 (front-end)". Falta só o redesign do admin
> (editar por impressão vs por modelo), que fica pra quando for retomado.

Por que: hoje cada impressão (reprint/promo/variante) é uma linha `Card` totalmente
independente, com os dados de identidade de jogo (nome, efeito, stats, traits)
**duplicados** em cada uma. Isso já causava os sintomas relatados: mostrar a mesma
carta 3 vezes com artes diferentes numa listagem, relações precisando de broadcast
por impressão (262 pares viraram 1.926 linhas de `CardRelation`), e nenhum jeito de
saber qual impressão é "a" versão regular pra usar como capa numa listagem.

## O modelo novo

- **`CardModel`** — a carta em si: nome, tipo, custo/level/ap/hp, cor, traits,
  série, efeito/texto, keywords. Uma linha por `code` único.
- **`Card`** (continua com esse nome por enquanto, na prática vira "impressão"):
  raridade, imagens, coleção/set, `isPrimaryPrint` (marca qual impressão é a
  capa/padrão do grupo), `printLabel` (nome de exibição da variante, ex: "LR+",
  "Championship Winner Card 01").

**Pra onde cada referência aponta:**

| Referência | Aponta pra | Por quê |
|---|---|---|
| `CardRelation` | `CardModel` (via `sourceModelId`/`targetModelId`, **novo**) | Relação é fato sobre os modelos, não sobre pares de impressão específicos |
| `Ruling` | `CardModel` (via `cardModelId`, **novo**, `cardId` antigo mantido em paralelo) | Ruling é sobre a mecânica/texto, que não muda entre impressões |
| `DeckItem.cardId` | `Card`/impressão (**sem mudança**) | Decisão do usuário: deck pode ter uma arte específica escolhida |
| `CardBinderItem.cardId` | `Card`/impressão (**sem mudança**) | Colecionador liga pra qual arte/raridade específica tem |

A regra de "máximo 4 cópias por nome" (que hoje não é validada em lugar nenhum)
deve, quando implementada, agrupar `DeckItem` por `card.cardModelId` — mistura de
arte do mesmo `CardModel` conta pro mesmo limite.

## Estratégia: expand → contract (não big-bang)

Não tenho como testar uma migration de SQL bruto contra banco real neste ambiente,
e essa é a mudança de maior risco desta sessão inteira. Por isso, em vez de uma
migration única que renomeia/transforma tudo de uma vez, o plano é em fases
independentes e reversíveis:

### Fase 1 — Expand (feita nesta sessão, aditiva, sem remover nada)

1. Schema: adiciona `CardModel`, e em `Card` adiciona `cardModelId` (opcional),
   `isPrimaryPrint`, `printLabel` — os campos antigos de identidade de jogo
   **continuam em `Card`**, redundantes mas inofensivos por enquanto.
2. `CardRelation` passa a exigir `sourceModelId`/`targetModelId` (não existiam
   antes) — como é dado 100% derivado do dataset oficial, a tabela fica vazia
   após a migration de schema. **Isso é esperado.** Repopula rodando
   `pnpm run curation:gcg:apply` de novo, mas só depois que o back-end (fase 2)
   for atualizado pra escrever nas colunas novas.
3. `pnpm run cardmodel:migrate:dry-run` / `cardmodel:migrate:apply` — script que
   agrupa `Card` por `code`, cria um `CardModel` por grupo (usando os dados da
   impressão "regular" como fonte — raridade sem `+`/`++`/Promo/Winner/Judge/SP;
   se nenhuma for regular, usa a mais antiga), marca essa impressão como
   `isPrimaryPrint`, preenche `cardModelId` em toda impressão do grupo, e migra
   `Ruling.cardId` existente pra `Ruling.cardModelId`.
4. `pnpm run cardmodel:validate` — confere integridade (toda impressão tem
   `cardModelId`, contagem de `CardModel` bate com codes distintos, exatamente 1
   impressão primária por code, amostra de 3 `CardModel` com suas impressões).
5. O script de migração de dados **avisa mas não falha** se encontrar campos que
   divergem entre impressões do mesmo code (ex: efeito diferente entre reprints,
   o que seria bug de dado) — fica registrado no output pra revisão manual, não
   silenciosamente resolvido.

**Antes de rodar isso no banco real: `pnpm run db:backup` primeiro** (ver
`docs/12-backup-restaurar-banco.md`), seguindo o checklist de
`docs/11-checklist-migration.md`.

### Fase 2 — Ainda não feita: back-end e front-end

Depois que a Fase 1 estiver validada com dado real:

- Reescrever as ~20 rotas de `/api/cards/*` em `server/index.ts` pra consultar
  `CardModel` (listagem, filtro, detalhe) e `Card` como impressões dentro dele.
- `CardsPage`, `CardDetailPage`, `SetDetailPage`, `CollectionsPage`, admin de
  cartas — cada um precisa decidir se lista `CardModel` (com galeria de
  impressões) ou continua listando impressão dependendo do contexto.
- Atualizar `prisma/apply-gcg-official-curation.mjs` e os scripts de seed pra
  escrever em `CardModel`/`sourceModelId`/`targetModelId`.
- Deckbuilder: `DeckItem` continua em `Card`, mas a UI de escolher carta deveria
  deixar escolher "qual impressão" dentro do `CardModel` selecionado.
- Admin: formulário de cadastro passa a ser "editar o modelo" + "adicionar/editar
  impressões dentro dele", em vez de um formulário monolítico por linha.

### Fase 3 — Ainda não feita: contract (remover redundância)

Só depois da Fase 2 validada em produção: remover os campos de identidade de
jogo duplicados em `Card` (nome, efeito, stats, traits — que passam a viver só
em `CardModel`), remover `Ruling.cardId` antigo (fica só `cardModelId`).

## Comandos

```bash
pnpm run db:backup                     # sempre antes, ver docs/12
pnpm exec prisma migrate dev --name add_cardmodel   # aplica o schema novo (fase 1, aditivo)
pnpm run cardmodel:migrate:dry-run     # confere o que seria feito
pnpm run cardmodel:migrate:apply       # aplica de verdade
pnpm run cardmodel:validate            # confirma integridade
```
