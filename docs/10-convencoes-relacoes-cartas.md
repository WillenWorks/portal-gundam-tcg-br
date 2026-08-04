# Convenções de relações editoriais entre cartas

Este documento define como usar os 5 tipos de `CardRelationType` do schema Prisma
(`PILOT_OF`, `SUPPORTS`, `UPGRADE_OF`, `SAME_ARCHETYPE`, `STORY_RELATED`), pra que
diferentes curadores (humanos ou scripts) apliquem o mesmo critério.

## Por que isso existe

Antes desse documento, o admin tinha os 5 tipos disponíveis no formulário de cadastro,
mas nenhuma definição de quando usar cada um — a escolha ficava a critério de quem
preenchia, sem consistência entre curadores. Isso também vale para os scripts de
importação: um script que "confirma" uma relação está fazendo o mesmo trabalho de
curadoria que um humano faria manualmente, e deve seguir a mesma convenção.

## Princípio geral: curadoria confirmada ≠ descoberta automática

`CardRelation` representa uma relação **confirmada** — alguém (humano ou um processo
determinístico baseado em dado oficial) verificou que ela é verdadeira. Isso é
diferente da **descoberta automática** que a página de detalhe da carta já calcula
sozinha a partir de trait/série compartilhada.

Regra prática: se a única evidência de uma relação é "essas cartas compartilham um
trait", ela **não** deve virar `CardRelation` — isso já é coberto pela descoberta
automática. `CardRelation` é reservado para vínculos específicos entre duas cartas
identificadas, não entre grupos inteiros de cartas por categoria.

## Os 5 tipos

Convenção de direção: **origem** é a carta de onde a relação parte (o `source_card_id`);
**destino** é a carta apontada (`target_card_id`). No admin, origem é sempre a carta que
você está editando no momento.

### PILOT_OF

**Origem = Piloto → Destino = Unidade que ele pilota.**

Use quando: a Unidade tem `Link Condition` = `[Nome do Piloto]` (dado oficial, ver
`prisma/apply-gcg-official-curation.mjs`), ou quando há confirmação editorial de que
aquele piloto específico pilota aquela unidade específica na continuidade do anime/mangá.

Não use quando: o vínculo é só "esse piloto tem o trait que essa unidade aceita pra
linkar" — isso é um vínculo *por trait* (amplo, qualquer piloto daquele trait serve),
não um vínculo *por piloto* (específico). Vínculo por trait fica de fora do
`CardRelation` de propósito — é coberto pela descoberta automática.

Exemplo real: `Char Aznable → PILOT_OF → Char's Zaku II` (confirmado pelo nome do
card oficial). `Char Aznable → PILOT_OF → Sinanju` **não** seria confirmado sem
evidência específica, mesmo sendo um palpite razoável — teria que vir de curadoria
manual com fonte, não de inferência.

### SUPPORTS

**Origem = carta que dá suporte → Destino = carta apoiada.**

Uso mais comum: Command cujo efeito cita uma Unidade ou Piloto específico pelo nome
(ex.: `Overcoming Hardships` cita `[Guel Jeturk]` no texto do efeito — `SUPPORTS` de
Guel Jeturk). Também serve pra Command que reforça mecanicamente uma unidade
específica sem citá-la pelo nome, desde que a curadoria confirme o vínculo.

Não use quando: é sinergia genérica de arquétipo/facção sem um alvo específico — isso
é `SAME_ARCHETYPE`.

### UPGRADE_OF

**Origem = Upgrade/equipamento → Destino = Unidade/carta base que ele modifica.**

Use quando o efeito da origem altera diretamente as estatísticas ou capacidades da
carta de destino (ex.: um Striker Pack que se equipa a um Strike Gundam específico).

Diferença de `SUPPORTS`: upgrade modifica a carta base diretamente (ela "vira" outra
coisa ou ganha um bônus permanente atrelado); suporte ajuda sem modificar a carta em si
(ex.: cura HP, acrescenta efeito pontual).

### SAME_ARCHETYPE

**Sem direção fixa** (relação simétrica).

Use pra cartas do mesmo grupo temático ou mecânico — mesma facção, mesmo time, mesma
sinergia de trait — quando **não** há vínculo de piloto, upgrade ou suporte direto
entre as duas cartas específicas. É o tipo mais "aberto" dos 5; por isso, se outro tipo
mais específico se aplicar, prefira o mais específico.

### STORY_RELATED

**Sem direção fixa** (relação simétrica).

Última opção da lista, deliberadamente. Use só quando o vínculo é puramente narrativo
(rivais, aliados, família, mestre/aprendiz no anime) e **nenhuma** mecânica de jogo em
comum sustenta os outros 4 tipos. Se há qualquer vínculo mecânico (piloto, upgrade,
suporte, arquétipo), prefira esse tipo.

## Árvore de decisão rápida

1. A origem é uma carta Pilot e a evidência é `Link Condition` oficial ou continuidade
   confirmada com a Unidade de destino? → `PILOT_OF`
2. A origem é um Command/equipamento que cita ou modifica diretamente a carta de
   destino? → `SUPPORTS` (ajuda pontual) ou `UPGRADE_OF` (modifica a carta base)
3. Mesmo grupo temático/mecânico, sem vínculo específico de piloto/upgrade/suporte?
   → `SAME_ARCHETYPE`
4. Só vínculo de história, sem nenhuma mecânica em comum? → `STORY_RELATED`
5. Se a única evidência é trait/série compartilhada e nada mais → **não crie
   `CardRelation`**, deixe pra descoberta automática.

## Onde isso está refletido no código

- `src/pages/AdminPage.tsx`: o dropdown "Tipo de relação" no formulário de cadastro
  mostra essa mesma convenção como texto de ajuda (`RELATION_TYPE_HINTS`), atualizado
  conforme o tipo selecionado.
- `prisma/apply-gcg-official-curation.mjs`: aplica exatamente essa convenção ao decidir
  o que vira `PILOT_OF`/`SUPPORTS` confirmado versus o que fica de fora (vínculo por
  trait, Commands sem referência nomeada no efeito).
