# Roadmap — ideias mapeadas (ago/2026)

Registro das próximas frentes discutidas, com avaliação de viabilidade/dificuldade.
Isso é mapa, não compromisso de ordem — a ordem real se decide sessão a sessão.
Nada aqui foi implementado ainda, exceto onde indicado.

## Rápidas / boa relação esforço×retorno

- **Template por facção (Federação/Zeon/etc)** — `User.preferredTheme` já é texto
  livre no banco, sem migration necessária. Só falta definir paletas de CSS por
  facção + seletor nas configurações. A mais simples de tudo essa lista.
- **Notícias/spoilers/artigos** — o modelo `Post` já existe no schema (título, slug,
  resumo, conteúdo markdown, capa, galeria, YouTube, rascunho/publicado), bem
  desenhado, mas **sem nenhuma UI** (nem admin, nem página pública). Falta construir
  o CRUD e as páginas — dado já modelado corretamente.
- **Estatísticas do deckbuilder (parte singular)** — a aba já existe (curva, cor,
  tipo). Falta conferir/corrigir cor dos gráficos pra usar `GAME_COLOR_HEX` (já
  criado pras estatísticas do site, replicar aqui) e expandir sinergia por
  arquétipo/cor (motor de recomendação já calcula trait/cor dominante, é questão de
  expor isso como estatística visível).
- **Estatísticas competitivas SEM depender de torneio** — presença de carta (quantos
  decks públicos usam X), popularidade de combinação de cor, agrupamento aproximado
  por "assinatura" (cor+trait dominante, mesma lógica do motor de recomendação) já
  dá pra fazer só com os decks cadastrados. **Importante**: só contar deck
  **público** nessa agregação — deck privado não deve vazar informação indireta.
  Isso inclusive já está prometido no texto da própria Home ("Analytics: presença
  por carta, uso por carta, top cut e curva") e ainda não entrega.

## Médias — precisam de mais peça nova, mas alcançáveis

- **Página por série / por personagem** — base já existe (`series`/`sourceTitle`,
  relação piloto↔unidade). Fase 1 (listagem de cartas por série/personagem) é
  rápida com o que já tem. Fase 2 (ficha rica com sinopse/ano/estúdio) precisa de
  uma tabela nova de metadado de mídia — dado não existe ainda, precisa de fonte
  (curadoria manual ou externa).
- **Rulings com explicação visual por mecânica** — mais trabalho de conteúdo
  (desenhar diagrama por keyword) que engenharia. Cada mecânica precisa ser
  validada com o Willen antes de virar diagrama definitivo.
- **Hub de eventos, fase 1** — decklist registrada por jogador num torneio,
  estatística de arquétipo por evento, usando a estrutura de Tournament/
  TournamentEntry que já existe.

## Grandes — merecem sessão dedicada própria

- **Hub de eventos, fase 2 e 3** — papel de organizador/lojista com permissão
  própria, convite de jogador, controle de partida em tempo real (pareamento,
  cronômetro, vitória/derrota ao vivo). Comparável em escopo a sistemas tipo
  Melee.gg. Fatiar em fases, não tentar de uma vez.
- **Taxa de vitória / aproveitamento de carta real** — precisa de volume real de
  resultado de torneio registrado. Não é feature pra construir agora, é feature que
  "acorda" quando o hub de eventos tiver uso de verdade.
- **Tradução completa das regras** — infraestrutura já existe (`Rule`/`Ruling` com
  campo pt-BR). Gargalo é tradução de conteúdo extenso mantendo terminologia
  técnica consistente (Deploy/Breach/Link — traduz ou mantém em inglês?), não
  código. Precisa do texto oficial em inglês como fonte pra eu ajudar a rascunhar.

## O grande — simulador

Confirmado pelos dois como a parte mais difícil, sem ressalva. Não é "mais uma
feature", é um segundo produto — motor de regras completo (fase, prioridade,
gatilho, stack), modo online (WebSocket, sincronização de estado — por isso a
escolha de Render como backend já considerou isso), e IA de oponente. Recomendação:
não tentar a versão completa de primeira — começar por um "assistente de partida"
simples (contador de vida/zona, sem regra automática) antes de qualquer automação
de regra de verdade.

## Por último, de propósito

- **Preço via TCGPlayer** — o Willen já tem um scraper próprio, mas está ciente do
  risco de Termos de Serviço (acesso automatizado não autorizado normalmente viola
  ToS de plataforma assim). Combinado explicitamente: fica pra depois de tudo o
  resto, considerar a API oficial do TCGPlayer (cadastro como parceiro/developer)
  em vez do scraping quando chegar a vez.
