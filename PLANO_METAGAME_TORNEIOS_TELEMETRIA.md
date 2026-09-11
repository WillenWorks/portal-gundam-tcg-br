# Plano de Metagame, Torneios e Telemetria Competitiva (Anaheim HUB / VEDA)

> **Documento Canônico de Arquitetura, Pesquisa e Roadmap**  
> Última atualização: 2026-09-10 | Arquiteto & Engenharia: Willen & Antigravity  
> Identidade Visual: **Anaheim Electronics / OZ Military HUD** (Dark Sci-Fi Militar)  
> Diretriz Estrita: **Não realizar cópia fiel/cega; adotar os padrões e termos consagrados da comunidade brasileira (PT-BR).**

---

## 1. Contexto e Histórico de Atualizações Anteriores

Nas sprints anteriores, foram identificadas assimetrias analíticas e comportamentais entre o **Deckbuilder do Perfil do Usuário** (`DeckbuilderPage.tsx`) e a **Área Pública de Estatísticas e Decks Compartilhados** (`SharedDeckPage.tsx`). As inconsistências foram auditadas, padronizadas e consolidadas através das seguintes entregas fundamentais:

### 1.1 Motor Analítico Unificado (`src/lib/deck-analytics-engine.ts`)
- **Unificação Lógica**: Criação de uma única fonte da verdade matemática para métricas, probabilidades hipergeométricas, curvas de custo/nível e telemetria de mão inicial tanto para decks salvos quanto para decks públicos.
- **Suíte de Testes Automatizados (`src/lib/deck-analytics-engine.test.ts`)**: Cobertura de testes unitários validando cálculos de probabilidade de compra na mão inicial (amostra de 5 cartas sem reposição), consistência de traços (*traits*), distribuição de cores e contagem de tipos (Unit, Pilot, Command, Base).

### 1.2 Resiliência Estatística com Base Reduzida (Baseline Cálculos)
- **Problema Anterior**: Quando a base de dados possuía poucas listas cadastradas (ou apenas 1 deck de determinado arquétipo), as métricas zeravam ou quebravam divisões por zero, impedindo a diferenciação entre *staples* e *techs*.
- **Solução Implementada**:
  - **Frequência de Inclusão ($IR = D_c / D_{arch}$)**: Se uma carta aparece em 1 de 1 deck cadastrado, sua presença é de $100\%$, e a média de cópias reflete com exatidão o número utilizado (ex: 4 cópias).
  - **Rigidez de Slot ($SR = 1 - \sigma / \mu$)**: Mede o consenso do número de cópias entre as listas. Em amostras unitárias, adota rigidez nominal garantindo estabilidade analítica.
  - **Classificação em Quatro Quadrantes VEDA / ATMI**:
    1. **Núcleo Indispensável (Core)**: $IR \ge 60\%$ e $SR \ge 70\%$ (peças inegociáveis do arquétipo).
    2. **Grampo Estrutural (Staples)**: $IR \ge 60\%$ e $SR < 70\%$ (alta presença com número adaptável de cópias).
    3. **Slots de Ajuste Fino (Flex)**: $30\% \le IR < 60\%$ (espaços de customização e sintonia do piloto).
    4. **Ferramentas Táticas (Techs)**: $IR < 30\%$ com alta afinidade relativa ($Affinity > 1.2$), servindo como resposta específica a certos confrontos.

### 1.3 Componentes Modais e Preditivos Entregues
- **`BuildCoreDeckModal.tsx`**: Gerador preditivo automático de decklists ("Iniciar Build Básica"). Lê o núcleo matemático do arquétipo selecionado e monta a base estrutural preliminar com as quantidades consagradas, permitindo ao jogador salvar e refinar no deckbuilder.
- **`SourceDecksModal.tsx`**: Exibição transparente das fontes de dados (decks da comunidade e listas de torneio) que compõem as métricas de determinado arquétipo.
- **`StatDetailModal.tsx`**: Inspeção profunda de telemetria carta a carta (presença percentual, média de cópias, rigidez de slot e afinidade relativa).
- **Backend (`server/metaAnalyticsService.ts` e `server/index.ts`)**: Endpoint `/api/meta/eligible-decks` conectando com dados persistidos reais de torneios e decks públicos aprovados.

---

## 2. Dissecação da Arquitetura de Referência (Egman Events / Mobile Suit Arena)

A partir da análise detalhada do link de referência (`https://deckbuilder.egmanevents.com/gundam/tournaments?format=GD05&tab=all`) e dos bundles descompilados (`839.db3f75fe`, `63.3f0704db`, `884.995bd7e1`, `229.0a6e4cff`), foi mapeado o ecossistema completo de torneios e metagame:

### 2.1 Mapeamento Completo de Abas do Sistema de Torneios (`?tab=`)

| Chave (`tab=`) | Rótulo Original | Tradução Recomendada PT-BR | Descrição e Funcionalidade |
| :--- | :--- | :--- | :--- |
| **`all`** | **All** | **Todas as Listas** | Tabela consolidada com todas as decklists premiadas de todos os torneios do formato. Exibe: Piloto, Arquétipo/Unidade-chave, Cores (badges), Posição (1º, 2º, Top 4, Top 8), Evento, Data, Registro de vitórias/derrotas e link direto para ver ou carregar a decklist. |
| **`tournaments`** | **Tournaments** | **Eventos & Torneios** | Grade de cards com visão geral dos torneios registrados. Cada card exibe: Nome, Formato (`GD05`), Data, Quantidade de Participantes (`512 players`), Rodadas (`9 rounds`), Tipo de evento, miniatura gráfica do field e botão para abrir a telemetria detalhada. |
| **`large_official`** | **Large Official** | **Grandes Oficiais (Majors & Regionais)** | Filtro dedicado a eventos oficiais sancionados de grande porte (Regionais, Store Championships com premiação oficial e 100+ jogadores). |
| **`small_official`** | **Small Official** | **Oficiais de Loja (Locais)** | Filtro de torneios sancionados locais organizados por lojas credenciadas (*Store Tournaments* / *Locals*). |
| **`unofficial`** | **Unofficial** | **Comunitários / Não-Oficiais** | Filtro de eventos independentes, ligas organizadas pela comunidade, torneios online e campeonatos de criadores de conteúdo. |
| **`ranked`** | **Ranked** | **Classificatório / Power Rankings** | Decklists associadas a ladders competitivas e tabelas de classificação semanal. |
| **`team`** | **Team** | **Batalhas de Equipe (Trios 3v3)** | Torneios e resultados disputados em formato cooperativo de trios. |

#### Controles Globais da Barra de Ferramentas de Torneios:
- **Seletor de Formato (`format`)**: Filtra eventos por coleção/temporada ativa (`GD05`, `GD04`, `EB01`, etc.).
- **Campo de Busca Tática (`q`)**: Filtra simultaneamente por nome do piloto, código ou nome de carta, nome do arquétipo ou nome do evento.
- **Seletor de Cores (`colors`)**: Filtro com chips coloridos (Azul, Verde, Vermelho, Roxo, Branco) permitindo isolar listas mono ou bicolores.

### 2.2 Visão Detalhada do Torneio (*Tournament Detail View*)
Ao selecionar um evento específico, o sistema carrega uma visão aprofundada contendo:
1. **Toolbar de Navegação Sequencial**: Botões `← Anterior` e `Próximo →` para navegar cronologicamente entre os eventos.
2. **Central de Transmissão / Vídeos (VOD)**: Embed responsivo do YouTube com suporte a múltiplas partes (`Part 1`, `Part 2`...) para torneios com muitas horas de cobertura.
3. **Distribuição do Field (*Leader / Field Breakdown*)**: Gráfico de pizza e relação percentual da presença de cada combinação de cores/líderes no início do evento.
4. **Conversão de Top Cut (*Top Cut Breakdown*)**: Gráfico e lista de arquétipos que avançaram para a fase eliminatória (Top 8 / Top 16), evidenciando a taxa real de conversão.
5. **Tabela de Resultados Oficiais**: Colocação exata, Piloto, Unidade-chave, Cores, Registro (V-D-E) e visualizador da decklist completa com cópias de cada carta.

### 2.3 Power Rankings Semanal & Métricas de Performance
Conforme analisado na imagem de referência **"Power Rankings! GD05 Meta Week 3"**:
- **Tabela Top 10**:
  - `Ranking`: Posição ordinal (#1 ao #10).
  - `Cores`: Indicadores visuais circulares com as cores da lista (mono ou bicolor).
  - `Arquétipo`: Banner horizontal estilizado contendo as ilustrações das unidades e pilotos mais emblemáticos do deck.
  - `Presença no Metagame (Meta Share %)`: Proporção do arquétipo em relação ao total de listas registradas.
  - `Taxa de Vitória (Winrate %)`: Percentual de jogos vencidos pelo arquétipo no recorte temporal.
  - `Classificação de Poder (Power Ranking)`: Escore composto normalizado (0 a 10) que equilibra taxa de vitória e volume de representação:
    $$\text{Power Ranking} = w_1 \cdot \text{Winrate Normalizado} + w_2 \cdot \text{Meta Share}$$
    Essa formulação evita distorções estatísticas (um deck com apenas 1 vitória isolada não assume o #1, e um deck ultra popular com taxa de vitória negativa perde posições).

### 2.4 Matriz de Confrontos & Telemetria Avançada (*Advanced Stats & Matchups*)
Descoberto no módulo `884.995bd7e1`:
- **Taxa de Vitória Geral (*Win Rate*)**: Desempenho geral contra cada arquétipo adversário.
- **Taxa Indo em 1º (*WR 1st*)**: Desempenho do arquétipo quando inicia a partida no Turno 1.
- **Taxa Indo em 2º (*WR 2nd*)**: Desempenho do arquétipo quando joga como segundo jogador.
- **Taxa de Vitória no Dado de Iniciativa (*Dice WR*)**: Correlação estatística entre vencer a rolagem de iniciativa/dado e a vitória final na partida.
- **Filtros Temporais**: Últimos 30 dias, Últimos 90 dias e Histórico Geral (*All Time*).

---

## 3. Dicionário Terminológico para a Comunidade Brasileira (PT-BR)

| Termo em Inglês | Termo Canônico PT-BR no Portal | Contexto de Uso |
| :--- | :--- | :--- |
| **Power Ranking** | **Classificação de Poder / Ranking de Poder** | Tabela semanal de força composta dos arquétipos. |
| **Meta Share** | **Presença no Metagame (% do Field)** | Proporção de representação de um arquétipo. |
| **Winrate** | **Taxa de Vitória** | Percentual de vitórias registrado. |
| **Top Cut Breakdown** | **Distribuição do Top Cut (Fase Eliminatória)** | Representatividade de arquétipos na fase final. |
| **Leader Breakdown** | **Composição do Field / Distribuição de Arquétipos** | Representatividade de arquétipos no início do torneio. |
| **WR 1st** | **Vitórias no Turno 1 (1º a Jogar)** | Taxa de vitória ao começar jogando. |
| **WR 2nd** | **Vitórias no Turno 2 (2º a Jogar)** | Taxa de vitória ao jogar como segundo. |
| **Dice WR** | **Taxa de Iniciativa (Dado)** | Desempenho condicionado à vitória na rolagem inicial. |
| **Large Official** | **Grandes Oficiais (Regionais / Majors)** | Torneios de grande porte sancionados pela Bandai. |
| **Small Official** | **Oficiais de Loja (Locais)** | Torneios regulares de lojas parceiras (*Locals*). |
| **Unofficial** | **Comunitários / Não-Oficiais** | Eventos independentes e ligas online da comunidade. |
| **Core** | **Núcleo Indispensável** | Cartas de inclusão obrigatória e alta rigidez. |
| **Staple** | **Grampo Estrutural** | Cartas fundamentais com quantidade ajustável. |
| **Flex** | **Slot de Ajuste Fino** | Cartas situacionais adaptadas pelo piloto. |
| **Tech** | **Ferramenta Tática** | Respostas de nicho para confrontos específicos. |

---

## 4. Diretrizes de Identidade Visual (Anaheim HUB / Hangar OZ)

O Portal Gundam TCG Brasil não deve realizar uma cópia visual cega de plataformas externas. Toda a interface segue rigorosamente a identidade estética já consolidada no projeto:
1. **Paleta Dark Sci-Fi Militar**: Fundos em `slate-950`, painéis cortados táticos (`panel-cut`), bordas sutis com acentos em `teal`/`primary` e brilhos controlados.
2. **Tipografia de Painel de Operações**:
   - Títulos em caixa alta com espaçamento largo (`font-heading`, tracking militar `[0.2em]`).
   - Dados numéricos, fórmulas e códigos de cartas em fonte monoespaçada (`font-mono`).
3. **Banners Visuais dos Arquétipos**:
   - Em vez de um recorte genérico, utilizar o visual de Mobile Suits e Pilotos em faixas horizontais com chanfros angulares militares, badges de cores com hexadecimais oficiais do jogo e badges de tier VEDA.
4. **Microinterações Táticas**:
   - Efeitos de hover com elevação e acentuação de borda (`border-primary/80`).
   - Indicadores de pulso para dados em tempo real ou processamento da Engine VEDA.

---

## 5. Roadmap de Implementação

### Fase 1: Overhaul da Página de Torneios (`TournamentsPage.tsx`)
- [ ] Implementar sistema de abas táticas:
  - `all` (Todas as Listas Premiadas)
  - `tournaments` (Grade de Eventos Cadastrados)
  - `large_official` (Grandes Oficiais / Regionais)
  - `small_official` (Oficiais de Loja / Locais)
  - `unofficial` (Comunitários & Ligas Online)
- [ ] Integrar barra de busca militar (`q`) com filtros simultâneos de formato e chips coloridos de atributos do Gundam TCG.
- [ ] Adicionar modal / visão detalhada de torneio com:
  - Painel de navegação rápida entre torneios.
  - Suporte a embed de VOD do YouTube (com abas de partes).
  - Gráficos de distribuição do Field e conversão de Top Cut.
  - Tabela de classificação com decklists completas acessíveis e botão "Carregar no Deckbuilder".

### Fase 2: Power Rankings Semanal na Página de Estatísticas (`StatsPage.tsx`)
- [ ] Construir a tabela de **Power Rankings (#1 ao #10)** inspirada no modelo do Mobile Suit Arena / Egman Events:
  - Coluna de Ranking com badges estilizados de colocação.
  - Badges das cores do arquétipo.
  - Banners horizontais estilizados com as unidades/pilotos principais.
  - Indicadores de Meta Share % e Winrate %.
  - Cálculo e exibição do índice de Power Ranking (0 a 10).
- [ ] Integrar cada linha do Power Ranking ao botão de ação rápida:
  - **"Iniciar Build Básica"** (`BuildCoreDeckModal`): gera o deck estrutural diretamente a partir do arquétipo do ranking.
  - **"Explorar Núcleos"**: abre a telemetria VEDA / ATMI detalhada daquele arquétipo.

### Fase 3: Matriz de Confrontos e Telemetria Avançada
- [ ] Desenvolver a **Matriz de Matchups**:
  - Confrontos diretos entre arquétipos com matriz colorida (vantagem/desvantagem).
  - Telemetria de iniciativa: **Taxa de Vitória no Turno 1 (WR 1st)** vs **Turno 2 (WR 2nd)**.
  - Correlação com vitória no dado (**Dice WR**).
  - Filtros temporais: Últimos 30 dias, Últimos 90 dias e Geral.

---

## 6. Critérios de Aceitação e Validação
1. **Navegação Fluida**: Parâmetro `?tab=` sincronizado com a URL permitindo compartilhamento direto de abas específicas.
2. **Resiliência a Dados Parciais**: Se um torneio não tiver dados de VOD ou rodadas, o layout se adapta sem quebras ou espaços vazios.
3. **Consistência Visual**: 100% dos novos componentes alinhados aos tokens de design do Anaheim HUB (`panel-cut`, `surface-panel`, `border-primary/40`).
4. **Testes Automatizados**: Nenhuma regressão na suíte de testes de análise de decks (`pnpm run test` aprovado com 100% de sucesso).
