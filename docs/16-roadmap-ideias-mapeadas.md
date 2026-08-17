# Roadmap — ideias mapeadas (ago/2026)

Registro das próximas frentes discutidas, com avaliação de viabilidade/dificuldade.
Isso é mapa, não compromisso de ordem — a ordem real se decide sessão a sessão.

**Atualizado após a rodada de teste com amigos + feedback real** — vários itens
"rápidos" e parte dos "médios" já saíram do papel. Marcado ✅ onde já foi feito.

## Rápidas / boa relação esforço×retorno

- ✅ **Template por facção** — Feito. Hangar (padrão) + Zeon (identidade militar/
  imperial completa: cor, corte de painel, selo geométrico original, tipografia),
  como dimensão independente de dark/light. Seletor em Configurações.
- **Notícias/spoilers/artigos** — ainda não feito. O modelo `Post` já existe no
  schema (título, slug, resumo, conteúdo markdown, capa, galeria, YouTube,
  rascunho/publicado), bem desenhado, mas **sem nenhuma UI** (nem admin, nem
  página pública). Falta construir o CRUD e as páginas — dado já modelado
  corretamente.
- ✅ **Estatísticas do deckbuilder** — Feito, e foi além do que estava mapeado
  aqui: gráficos com `GAME_COLOR_HEX`, sinergia por cor/trait/série/tipo com %
  completo (não só o dominante), cobertura de keyword (efeito + gatilho, absoluto
  e detalhado por valor), e drill-down clicável em toda estatística (mostra as
  cartas envolvidas, lista ou imagem).
- **Estatísticas competitivas SEM depender de torneio** — ainda não feito. Presença
  de carta (quantos decks públicos usam X), popularidade de combinação de cor,
  agrupamento por "assinatura" (cor+trait dominante). Isso é o mesmo pedido que
  apareceu de novo durante a auditoria de estatísticas ("cartas usadas em outros
  decks" no gráfico) — mesma feature, duas menções.

## Médias — precisam de mais peça nova, mas alcançáveis

- **Página por série / por personagem** — ainda não feito.
- **Rulings com explicação visual por mecânica** — ainda não feito (a seção de
  Rulings em si já foi bem recebida no feedback de teste, isso aqui seria ir além:
  diagrama visual por mecânica).
- **Hub de eventos, fase 1** — ainda não feito.

## Grandes — merecem sessão dedicada própria

- Hub de eventos fase 2 e 3, taxa de vitória real, tradução completa das regras —
  sem mudança, continuam mapeados como antes, nenhum foi iniciado.

## O grande — simulador

Sem mudança — confirmado como a peça mais difícil, não é "mais uma feature", é um
segundo produto. Recomendação de começar por um assistente de partida simples
(contador de vida/zona) antes de qualquer automação de regra continua valendo.

## Por último, de propósito

- **Preço via TCGPlayer** — sem mudança, combinado que fica por último.

## Itens novos, fora do mapa original (surgiram na rodada de teste real)

- **Tema dinâmico com movimento/ícones personalizados** — Willen perguntou se é
  viável (é — `framer-motion` já está instalado, infraestrutura de tema já suporta
  CSS escopado por facção). Ofereci uma prova de conceito pequena antes de
  escalar pro resto do site, ainda não construída.
- **Chance de carta de custo baixo na mão inicial** (cálculo hipergeométrico) —
  deferido da rodada de estatísticas ricas, ainda não feito.
- **Legenda clicável nos gráficos** (esconder/mostrar série ao clicar) — deferido
  da mesma rodada.
- **Tooltip explicando cada métrica** — parcialmente feito (botão "?" nos blocos
  de estatística do deckbuilder), mas não cobre 100% dos números da tela.
