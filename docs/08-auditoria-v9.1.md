# Auditoria v9.1 — cadastro de cartas/coleções

## Gaps atuais identificados

### Modelagem de coleção/produto
- `CardSet` hoje só cobre `code`, nomes, data, URL, capa, descrição e `setType`.
- Falta separar melhor produto físico x coleção jogável.
- Falta suportar categorias oficiais como:
  - booster pack
  - starter deck
  - accessories
  - premium bandai
  - other
- Falta guardar MSRP, conteúdo da caixa, variante assemble (`ST01A`, etc.), notas de produto e série/linha principal.
- Falta update/delete para coleções na API.

### Modelagem de carta
- `Card` hoje é genérico demais.
- Falta estrutura explícita para:
  - tipo principal (`UNIT`, `PILOT`, `COMMAND`, `BASE`, `RESOURCE`, `EX_BASE`, `EX_RESOURCE`, `UNIT_TOKEN`)
  - subtipo / classificadores derivados
  - traits múltiplas
  - source title / obra
  - zone
  - link requirements
  - keywords de gatilho (`Deploy`, `Destroyed`, `When Paired`, etc.)
  - keywords globais (`Blocker`, `High Maneuver`, `Suppression`, etc.)
  - flags booleanas (`burst`, `main`, `action`, `oncePerTurn`, etc.)
  - textos por bloco/slot, não só um `effectPt/effectEn` chapado
- Falta edição melhor e exclusão mais clara no admin.

### Admin atual
- Cadastro é estático e engessado.
- Não há modal guiada por tipo de carta.
- A listagem de cartas/coleções é fraca para operação real.
- Melhor caminho v9.1:
  - tabela/binder de listagem
  - filtros rápidos
  - ações inline: editar / remover
  - botão fixo “Nova carta” / “Nova coleção”
  - modal adaptativa por tipo de carta/produto

## Pesquisa oficial — produtos iniciais

### GD01
- Nome: Newtype Rising
- Código: GD01
- Categoria oficial: Booster Pack
- Lançamento: 2025-07-25
- MSRP: USD 4.99
- Conteúdo: 1 pack com 12+1 cartas
- Total de tipos: 130+6
- Observação: produtos e imagens sujeitos a alteração

### ST01
- Nome: Heroic Beginnings
- Código: ST01
- Variante assemble: ST01A
- Categoria oficial: Starter Deck
- Lançamento: 2025-07-11
- MSRP:
  - ST01: USD 11.99
  - ST01A: USD 34.99
- Conteúdo regular:
  - deck pré-construído 50 cartas
  - 10 resource cards
  - 8 token cards
  - 1 damage counter paper
  - 1 rules / playsheet
  - 1 bonus pack
- Conteúdo assemble:
  - tudo acima
  - 3 miniaturas GUNDAM ASSEMBLE
  - 2 rules / playsheets

### ST02
- Nome: Wings of Advance
- Código: ST02
- Variante assemble: ST02A
- Categoria oficial: Starter Deck
- Lançamento: 2025-07-11
- MSRP:
  - ST02: USD 11.99
  - ST02A: USD 34.99
- Conteúdo regular:
  - deck 50 cartas
  - 10 resource cards
  - 8 token cards
  - 1 damage counter paper
  - 1 rules / playsheet
  - 1 bonus pack
- Conteúdo assemble:
  - tudo acima
  - 3 miniaturas GUNDAM ASSEMBLE
  - 2 rules / playsheets

### ST03
- Nome: Zeon's Rush
- Código: ST03
- Variante assemble: ST03A
- Categoria oficial: Starter Deck
- Lançamento: 2025-07-11
- MSRP:
  - ST03: USD 11.99
  - ST03A: USD 34.99
- Conteúdo regular:
  - deck 50 cartas
  - 10 resource cards
  - 8 token cards
  - 1 damage counter paper
  - 1 rules / playsheet
  - 1 bonus pack
- Conteúdo assemble:
  - tudo acima
  - 3 miniaturas GUNDAM ASSEMBLE
  - 2 rules / playsheets

### ST04
- Nome: SEED Strike
- Código: ST04
- Variante assemble: ST04A
- Categoria oficial: Starter Deck
- Lançamento: 2025-07-11
- MSRP:
  - ST04: USD 11.99
  - ST04A: USD 34.99
- Conteúdo regular:
  - deck 50 cartas
  - 10 resource cards
  - 8 token cards
  - 1 damage counter paper
  - 1 rules / playsheet
  - 1 bonus pack
- Conteúdo assemble:
  - tudo acima
  - 3 miniaturas GUNDAM ASSEMBLE
  - 2 rules / playsheets

## Pesquisa oficial — taxonomias úteis do card search

### Tipos oficiais observados
- UNIT
- PILOT
- COMMAND
- BASE
- RESOURCE
- EX BASE
- EX RESOURCE
- UNIT TOKEN

### Filtros oficiais observados
- Included In
- Rarity
- Alternate Art
- Lv.
- Cost
- Color
- Type
- Source Title
- Trait
- Link Conditions
- Pilot

## Extração parcial útil para seed inicial
- A página oficial da GD01 carrega 179 itens no DOM.
- Foi possível extrair a lista bruta de códigos + nomes sem imagens.
- Isso é suficiente para um seed inicial textual da coleção GD01.
- Ainda falta enriquecer cada card com tipo/atributos detalhados; isso pode ser feito por importador incremental a partir de `detail.php?detailSearch=CODE`.

## Decisão recomendada para v9.1
1. Expandir `CardSet` para produto real.
2. Expandir `Card` com enums + arrays + flags + blocos de texto.
3. Criar catálogo fixo editável para keywords/gatilhos.
4. Redesenhar admin com tabela/binder + modal de edição.
5. Entregar seed mínimo com produtos oficiais GD01/ST01-ST04 e lista textual inicial da GD01.
