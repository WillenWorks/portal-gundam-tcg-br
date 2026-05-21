# Portal Gundam TCG BR — Arquitetura, Gestão e Roadmap

## 1. Decisão de arquitetura inicial

### Princípio

Começar com arquitetura **modular, profissional e evolutiva**, mas sem overengineering no primeiro ciclo.

### Recomendação objetiva

- **Frontend web:** React + TypeScript + Vite + pnpm
- **UI:** Tailwind v4 + componentes reutilizáveis
- **Organização:** feature-first com separação por domínio
- **Persistência inicial no protótipo:** mocks/local state quando necessário
- **Banco real planejado:** Postgres/Supabase ou backend equivalente
- **Upload de imagens:** storage separado
- **Analytics:** pipeline de agregação por evento/deck/carta
- **Autenticação:** email/senha + papéis (`admin`, `editor`, `user`)
- **Observabilidade:** logs estruturados, eventos analíticos, checklist operacional

> Observação do ambiente atual: a tentativa de validar o servidor Supabase via MCP retornou **401 Unauthorized** neste sandbox. Então o projeto foi iniciado preparado para banco, mas o setup de banco real ficará para a próxima etapa, usando frontend modular e camadas desacopladas.

## 2. Brainstorm visual do site

### Abordagem A — **Hangar Tático Neo-Militar**
**Probabilidade:** 0.63

**Movimento de design:** militar sci-fi industrial com HUD limpo

**Princípios centrais:**
- contraste alto e leitura agressivamente clara
- blocos diagonais lembrando painéis de hangar
- sensação de terminal tático, não de blog genérico
- densidade controlada: muito dado, pouca confusão

**Filosofia de cor:**
- base em grafite, aço azulado e off-white técnico
- acentos em vermelho alerta, amarelo cautela e ciano radar
- intenção emocional: parecer operacional, confiável e competitivo

**Paradigma de layout:**
- hero assimétrico com painel lateral de status
- seções em cortes diagonais e divisórias técnicas
- áreas de dados em painéis modulares lembrando cockpit

**Elementos assinatura:**
- linhas de varredura e grids sutis
- badges de setor/arquivo/tournament report
- painéis com bordas angulares e barras de status

**Filosofia de interação:**
- feedback claro, seco e satisfatório
- hover com acendimento de borda e varredura horizontal
- foco em sensação de “console operacional”

**Animação:**
- entradas com stagger vertical curto
- barras e contadores subindo como telemetria
- títulos revelados por máscara lateral
- transições rápidas, com impacto, sem excesso de ruído

### Abordagem B — **Broadcast de Guerra Universal Century**
**Probabilidade:** 0.27

**Movimento de design:** telejornal militar / propaganda futurista / painéis de transmissão

**Princípios centrais:**
- hierarquia editorial muito forte
- estética de transmissão ao vivo de conflito espacial
- composição fragmentada com blocos editoriais grandes
- mistura de notícia, inteligência e cobertura de torneio

**Filosofia de cor:**
- preto espacial, branco cru, vermelho transmissão, azul emissor
- intenção emocional: urgência, cobertura, presença contínua

**Paradigma de layout:**
- manchetes largas quebradas por faixas laterais
- múltiplas colunas não simétricas
- cards com visual de boletim, interceptação e relatório

**Elementos assinatura:**
- ticker de notícias
- molduras de transmissão com labels “LIVE / REPORT / META”
- fundos com mapas estelares e ruído analógico

**Filosofia de interação:**
- sensação de newsroom viva
- filtros e navegação como mesa de controle editorial

**Animação:**
- wipes laterais fortes
- glitch leve e controlado
- faixas correndo horizontalmente

### Abordagem C — **Arquivo de Combate Minimalista Premium**
**Probabilidade:** 0.18

**Movimento de design:** brutalismo editorial técnico com luxo contido

**Princípios centrais:**
- poucos elementos, peso tipográfico alto
- rigor visual e respirabilidade
- dados tratados como artefatos de arquivo
- elegância seca, sem excesso ornamental

**Filosofia de cor:**
- marfim técnico, carvão, azul profundo, vermelho restrito
- intenção emocional: credibilidade, curadoria e precisão

**Paradigma de layout:**
- colunas deslocadas e recortes amplos
- muito espaço negativo combinado com blocos maciços
- páginas de conteúdo com ritmo editorial

**Elementos assinatura:**
- numeração de seções grande
- linhas de indexação e coordenadas
- cards como fichas de arquivo

**Filosofia de interação:**
- discreta, precisa e firme
- poucos efeitos, mas sempre intencionais

**Animação:**
- fade/slide mais cinematográfico
- foco em ritmo de leitura e revelação por blocos

## 3. Escolha visual adotada

### Escolha: **Abordagem A — Hangar Tático Neo-Militar**

Motivo:

- conversa melhor com Gundam sem copiar o site oficial
- funciona para conteúdo editorial **e** dashboards **e** deckbuilder
- sustenta expansão futura para simulador
- permite layout simples, mas ainda com personalidade forte

## 4. Estrutura macro do produto

### Domínios principais

1. **Identidade e acesso**
2. **Cartas e catálogo**
3. **Deckbuilder e decks**
4. **Regras, FAQ e rulings**
5. **Torneios, eventos e decklists competitivas**
6. **Analytics e metagame**
7. **Conteúdo editorial e mídia**
8. **Administração**
9. **Monetização**
10. **Simulador futuro**

## 5. Mapa de módulos

### 5.1 Identidade e acesso

Funções:
- cadastro
- login
- perfil
- permissões
- papéis

Papéis sugeridos:
- `guest`
- `user`
- `editor`
- `admin`

### 5.2 Catálogo de cartas

Funções:
- importar e cadastrar cartas
- armazenar imagem, atributos e efeitos
- vincular carta a produto/série/set
- mapear keywords, tipos, traits, raridade e idioma

### 5.3 Regras, FAQ e rulings

Funções:
- armazenar texto original
- armazenar tradução pt-BR
- vincular FAQ a carta, keyword, fase ou regra
- exibir exemplos práticos
- manter histórico de revisão

### 5.4 Deckbuilder

Funções:
- montar deck válido
- validar regras estruturais
- filtrar cartas
- calcular estatísticas
- gerar imagem/listagem compartilhável
- salvar versões do deck

### 5.5 Torneios

Funções:
- cadastrar evento
- rounds / standings / top cut
- vincular decklists aos jogadores
- registrar formato e temporada
- guardar observações e links externos

### 5.6 Analytics

Funções:
- presença por cor/líder/arquetipo
- taxa de corte para top
- uso por carta
- distribuição de curva/custo
- recorte por período ou torneio

### 5.7 Conteúdo

Funções:
- posts de notícia
- previews
- reviews
- artigo com embeds de YouTube
- galeria de imagens
- tagueamento por tema/set/carta

### 5.8 Admin

Funções:
- CRUD de cartas
- CRUD de regras e FAQ
- CRUD de posts
- CRUD de torneios
- revisão editorial
- fila de publicação

## 6. Entidades principais de dados

## 6.1 Cartas

Campos sugeridos:
- `id`
- `code`
- `name_en`
- `name_pt`
- `card_type`
- `series`
- `color`
- `level`
- `cost`
- `ap`
- `hp`
- `trait`
- `rarity`
- `effect_en`
- `effect_pt`
- `keyword_tags`
- `image_url`
- `set_code`
- `is_resource`
- `is_token`
- `legality_status`

## 6.2 Decks

- `id`
- `user_id`
- `name`
- `format`
- `visibility`
- `leader_card_id`
- `notes`
- `cover_image_generated`
- `created_at`
- `updated_at`

### DeckItems
- `deck_id`
- `card_id`
- `quantity`
- `section` (`main`, `resource`, `token_reference`)

## 6.3 FAQ / Rulings

- `id`
- `source_type` (`official_faq`, `official_rules`, `community_explainer`)
- `title`
- `question_en`
- `answer_en`
- `question_pt`
- `answer_pt`
- `example_play_pt`
- `related_card_id`
- `related_keyword`
- `related_phase`
- `set_code`
- `official_updated_at`
- `translation_status`

## 6.4 Torneios

- `id`
- `name`
- `organizer`
- `country`
- `city`
- `format`
- `season`
- `date_start`
- `date_end`
- `participant_count`
- `round_count`
- `top_cut_size`
- `source_url`

### TournamentEntries
- `id`
- `tournament_id`
- `player_name`
- `placement`
- `wins`
- `losses`
- `draws`
- `deck_id`
- `archetype_label`

## 6.5 Posts

- `id`
- `title`
- `slug`
- `excerpt`
- `content_md`
- `cover_image_url`
- `gallery_json`
- `youtube_url`
- `post_type`
- `status`
- `published_at`

## 7. Estatísticas recomendadas no deckbuilder

### Essenciais
- total de cartas por tipo
- distribuição por custo
- distribuição por cor
- curva média
- quantidade de cartas de baixo custo
- porcentagem de compra inicial relevante
- consistência de engine/core package

### Evolução útil
- chance de abrir certas linhas no mulligan
- densidade de remoções
- densidade de units por faixa de custo
- peso de keywords estratégicas
- comparação entre versões do deck

## 8. Estatísticas recomendadas para torneios

### Núcleo
- taxa de presença por cor
- taxa de presença por líder/arquetipo
- conversão em top cut
- winrate por arquétipo
- uso por carta
- cartas mais presentes no top
- distribuição por custo média dos decks colocados

### Avançadas
- coocorrência de cartas
- tech cards por match-up
- evolução do meta por set
- presença regional

## 9. Diretrizes de engenharia

Como você quer usar o projeto também como treino de analista sênior, a base deve nascer com disciplina:

### Stack/processo recomendado
- `pnpm` como padrão
- código em TypeScript
- organização por domínio
- contratos claros entre camadas
- componentes reutilizáveis
- lint/format/checks desde cedo
- Docker para dev padronizado depois da base inicial

### Pastas sugeridas futuramente
- `src/modules/cards`
- `src/modules/decks`
- `src/modules/rules`
- `src/modules/tournaments`
- `src/modules/posts`
- `src/modules/admin`
- `src/shared`
- `src/app`

### Convenções
- regra de negócio fora de componentes visuais
- schemas de validação explícitos
- services separados de adapters
- componentes pequenos e previsíveis
- dados agregados via seletores/utilitários

## 10. Monetização futura

### Modelo possível

**Free**
- leitura de regras
- consulta básica
- uso do deckbuilder
- notícias

**Premium**
- analytics avançados
- histórico expandido de meta
- comparação de decks
- exportações premium
- insights personalizados
- simulador/IA ou limite ampliado de uso

**Alternativas**
- donate / apoio recorrente
- área de apoiador
- patrocínio de loja/comunidade

## 11. Roadmap sugerido

### Etapa 0 — Fundação
- setup web
- git
- README
- design system inicial
- landing/portal base

### Etapa 1 — Conteúdo estruturado
- catálogo de cartas
- regras e FAQ
- pipeline de tradução/revisão
- admin simples

### Etapa 2 — Deckbuilder MVP
- filtros
- montagem válida
- estatísticas principais
- salvar deck
- compartilhamento visual

### Etapa 3 — Competitivo
- torneios
- decklists
- standings
- dashboards meta

### Etapa 4 — Produto e receita
- contas premium
- doações
- conteúdo exclusivo
- painéis avançados

### Etapa 5 — Simulador
- motor básico
- estados de jogo
- IA simples
- multiplayer posterior

## 12. Riscos e mitigação

### Risco 1 — Escopo gigante
Mitigação: atacar em módulos e marcos mensais.

### Risco 2 — Base de dados difícil de alimentar
Mitigação: admin eficiente + importadores + revisão incremental.

### Risco 3 — Tradução ambígua de regras
Mitigação: sempre mostrar original + tradução + nota explicativa.

### Risco 4 — Analytics inconsistentes
Mitigação: modelar evento, decklist e carta corretamente desde o início.

### Risco 5 — Setup técnico complexo cedo demais
Mitigação: começar limpo e modular antes de multiplicar serviços.

## 13. Decisão recomendada para o próximo ciclo

Próxima entrega concreta ideal:

1. landing page/portal base
2. arquitetura de navegação
3. tema visual Gundam
4. modelos de dados iniciais
5. README operacional
6. preparação para banco real e autenticação

Essa ordem te dá uma vitrine inicial do projeto **sem perder a disciplina de produto sério**.
