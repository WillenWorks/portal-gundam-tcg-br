# Changelog

Novidades, correções e o que vem por aí no **Portal Gundam TCG BR** — pra você
acompanhar sem precisar ler código. Atualizado a cada versão relevante.

Versionamento [semver](https://semver.org/lang/pt-BR/) (`MAJOR.MINOR.PATCH`).
Enquanto estivermos na faixa `0.x`, o projeto ainda está fechando o escopo do
primeiro grande lançamento (`v1.0.0`) — esperem ajustes e coisa nova toda semana.

---

## [Não lançado]

### No radar (Fase 3 — Ciclo v2.1)
- **Wave GD03 + ST07 + ST08**: Ingestão no motor de regras com suporte a mecânicas avançadas de Tokens e Custos Alternativos de Deploy.
- **Zero Pilot N4 (Counter-Decks Dinâmicos)**: As 4 Personas (Heero, Char, Amuro, Treize) montam dinamicamente arquétipos específicos para punir fraquezas do deck do jogador.
- **Universe Hub Wave 2**: Expansão de Lore para *Mobile Suit Gundam 00* (Anno Domini) e *Mobile Suit Gundam: The Witch from Mercury* (Ad Stella).
- **Arena Multiplayer 4P Real**: Transição da tela de mock para engine Socket.io com 4 assentos para 2v2 Tag Team e 4P Battle Royale (Free-for-All).
- **Resiliência de Estado na Arena 4P**: timer de reconexão de 45s por assento — socket caído demais tempo resolve sozinho a decisão pendente da lane (bloqueio/alvo/etc.), fechando a janela de conluio em 2v2. Transporte de duelo agora é Socket.io exclusivo (fallback SSE removido).
- **Zero Foresight & Metagame Regional**: Simulação Monte Carlo (10.000 partidas) para projeção preditiva de Tier Shift e painel geográfico de torneios por Estado, Cidade e LGS.

---

## [2.0.0] — 2026-09-17

**Anaheim Hub v2.0 & Operação Zero System** — A maior atualização da história do Portal Gundam TCG BR! Uma virada de chave competitiva, estética e arquitetural: catálogo massivo expandido para 245 cartas autoritativas, formato Bo3 oficial com Sideboard, Motor Suíço para Lojas Físicas e a suíte completa de Inteligência Tática do **Zero System**.

### 🤖 Operação Zero System — Inteligência Tática & Copilot
- **Terminal Zero Central** (`/#/zero`): Console central de IA militar com telemetria tática, estatísticas globais e acesso ao RAG e análises.
- **Zero Coach In-Game HUD** (`ZeroCoachHud.tsx`): HUD colapsável em tempo real dentro do simulador exibindo:
  - *Threat Matrix*: cálculo exato de probabilidade (%) do próximo escudo do oponente conter um efeito Burst ativo.
  - *Sequencing Advisor*: recomendações de ordem tática de ativação de comandos antes de declarar ataque.
  - *Alerta Letal*: detecção matemática garantida de letal ofensivo e defensivo no turno corrente.
- **Zero Copilot no Deckbuilder** (`ZeroCopilotDrawer.tsx`):
  - *Análise Hipergeométrica*: cálculo de consistência de turnos 1 a 3 (probabilidade de abrir Unit Lv.1-2 e Piloto compatível), score tático 0-100 e curva de energia ideal.
- **RAG de Regras & 4 Personas Táticas**:
  - Consulta instantânea de regras oficiais com respostas orientadas por IA adaptadas ao estilo de 4 lendas: **Heero Yuy** (Frio/Objetivo), **Char Aznable** (Agressivo/Audacioso), **Amuro Ray** (Analítico/Sinergia) e **Treize Khushrenada** (Honra/Cavalheirismo).

### ⚔️ Simulador — Wave GD02, ST05, ST06 & Formato Bo3 com Sideboard
- **Ingestão Completa de Metadados**: 245 especificações autoritativas de efeitos indexadas no motor (`src/modules/simulator/content/_index/specs-signatures.json`), cobrindo GD01, ST01-ST04 e agora GD02, ST05 e ST06.
- **Formato Oficial Melhor de 3 (Bo3)**:
  - Suporte completo a partidas Bo3 competitivas no simulador.
  - **Interface Tática de Sideboard** (`SideboardModal.tsx`): Transição automática entre jogos com timer regressivo de 180 segundos, suporte a até 10 cartas no Sideboard e validação estrita de legalidade (50 cartas principais, máx. 2 cores, máx. 4 cópias).

### 🏆 Módulo de Torneios Avançado & Suíço LGS
- **Motor de Pareamento Suíço Automático** (`server/services/swissEngine.ts`):
  - Emparelhamento determinístico baseado em vitórias (3/1/0 pts).
  - Prevenção rigorosa de rematches e resolução inteligente de BYE para número ímpar.
  - Cálculo oficial de Tie-Breakers: **OMW%** (Opponent Match Win %) e **OGW%** (Opponent Game Win %).
  - Suporte a corte para Top Cut (Top 4 / Top 8 / Top 16).
- **LGS TV Display** (`LgsTvDisplayPage.tsx` na rota `/#/admin/lgs-tv/:tournamentId`):
  - Modo fullscreen de alto contraste projetado para TVs e telões em lojas físicas e eventos.
  - Exibição de mesas, confrontos, classificação e cronômetro de rodada oficial de 50 minutos.

### 🌌 Universe Hub & Módulo Editorial
- **Universe Hub** (`/#/series`): Imersão profunda no lore de Gundam com fichas técnicas, cronologia e cards relacionados da Wave 1 (*Mobile Suit Zeta Gundam* e *Mobile Suit Gundam SEED*).
- **Content Hub & CMS Editorial** (`/#/artigos` e `/#/admin/artigos`):
  - Sistema de publicação de artigos com suporte a cards interativos (`[[GD01-001]]`) e decks embutidos.
  - Gerador de capas com IA (estética Nano Banana / Blueprint Militar).
- **Pastas de Coleção (3D Binders)** (`/#/fichario/:id`): Exibição e compartilhamento visual de binders com tags de troca e desejo.
- **Apoio Comunitário via Pix** (`DonateModal.tsx`): Suporte direto da comunidade para sustentabilidade dos servidores, com chave Pix de cópia rápida e mural de patronos.

---

---

## [1.3.0] — 2026-09-14

Wave **GD01 "Mobile Suit Gundam Unicorn"** chega jogável em todas as modalidades do simulador, com suporte ao deck do próprio jogador em qualquer uma delas — e 2 bugs reais de motor corrigidos na wave.

### 🎮 Simulador — GD01 liberado + deck próprio em toda modalidade
- **ST01, ST02, ST03, ST04 e os 4 decks de teste de GD01** (Federation Vanguard,
  Zeon Legion, Newtype Corps, Sleeves Uprising) agora aparecem no seletor de
  deck da Fila Online, Convite Direto, Treino Solo e Arena Multiplayer.
- **Deck do seu próprio Hangar** pode ser usado em qualquer modalidade — a
  linha do deck aparece verde (jogável) ou vermelha (tem carta sem cobertura
  no motor) na lista; se você insistir num deck vermelho, a tela mostra a
  mensagem com o motivo exato (quais cartas faltam) em vez de deixar a
  partida travar.
- Removido o kill-switch que mantinha GD01 restrito ao Treino Solo — o gate
  de cobertura (`validateDeckPayload`) continua sendo a única defesa real
  contra carta sem regra implementada, tanto pra deck fixo quanto pra deck
  próprio.

### 🐛 Correções — Burst de 8 cartas de GD01 (incluindo Banagher Links)
- `hasBurst: true` sozinho não bastava: sem um `EffectSpec` de gatilho
  "Burst" cadastrado pra carta, ela nunca virava elegível pra decisão de
  Burst — quebrava como Shield e ficava presa no trash pra sempre, mesmo
  tendo Burst impresso. Corrigido em **Banagher Links, Marida Cruz, Dearka
  Elthman, Guel Jeturk, Elan Ceres, Citizens Take a Stand!, Midair
  Modifications e Kusanagi**.

### 🧹 Organização interna
- Documentação de desenvolvimento consolidada num manual único
  (`docs/MANUAL_DESENVOLVIMENTO.md`) — histórico completo do projeto,
  arquitetura do motor, processos e pendências conhecidas num só lugar.
- Arquivos de processo/sessão (transcrições de debate entre IAs, planos de
  sessão avulsos) saíram do controle de versão — continuam no ambiente local
  de quem os gerou, sem poluir o repositório.

---

## [1.2.0] — 2026-09-09

Grande reformulação da identidade temática e experiência do portal: **Anaheim Hub** (Laboratório Tático & Engenharia de Combate · Gundam Card Game BR).

### 🛰️ Anaheim Hub — Identidade Temática & Visual
- **Novo Posicionamento**: O portal agora adota a identidade temática do **Anaheim Hub**, o centro de excelência em engenharia e tática Mobile Suit.
- **Hangar da OZ (Deckbuilder)**: Linha de montagem e calibração de decks com telemetria tática, curvas de recursos, análise de sinergias e verificação de conformidade em tempo real.
- **Arsenal Aberto da OZ (Decks da Comunidade)**: Projetos de combate compartilhados pelos pilotos da comunidade para estudo, benchmarking e calibração de metagame.
- **Sistema VEDA (Estatísticas & Metagame)**: Terminal quântico de inteligência tática que processa a telemetria das cores, expansões e resultados consolidados de campeonatos oficiais.
- **Arena Asticassia (Simulador de Combate)**: Centro de duelos com **Duelo Oficial Asticassia** (matchmaking online), **Duelo com Amigo** (convite direto) e **Simulação de Treinamento Asticassia** (solo contra IA com heurística completa e MCTS).
- **Arquivo Central Anaheim (Catálogo)**: Registro técnico de blueprints, especificações de Mobile Suits, Pilotos, Comandos e Bases com filtros avançados.
- **Navegação & UI**: Menu superior e lateral modernizados, acesso a Novidades via ícone tático e rodapé institucional padronizado.

---

## [1.1.0] — 2026-09-08

Grande atualização trazendo o **Modo Solo (Treino contra o Bot)**, telemetria completa de partidas e infraestrutura otimizada no **Render**.

### 🤖 Modo Solo — Treino contra o Bot
- **Treino Individual no Simulador** (`/#/simulador/treino` ou pelo menu lateral "Treino Solo") — agora você pode praticar suas estratégias a qualquer hora sem depender de outro jogador online.
- Escolha entre os Starters **ST01 a ST04** e encare o bot com tempos de resposta naturais e interface imersiva.
- **Múltiplos Níveis de Dificuldade**:
  - **Fácil**: Ideal para aprender as regras básicas do jogo.
  - **Normal**: Executa a política heurística determinística completa com avaliação tática de campo.
  - **Difícil**: Executa busca em árvore de Monte Carlo (MCTS) antecipando turnos e respostas de combate.

### 📊 Telemetria de Partidas e Histórico
- **Auditoria de Partidas (`SimulatorMatchLog`)**: Cada turno, ação, tempo de jogada, deck e resultado (amistoso, rankeado ou treino) agora é registrado com segurança no banco de dados.
- Base essencial para geração de estatísticas reais de metagame e análise de balanceamento de cartas.

### 🧠 Pipeline de Machine Learning (em Dev)
- **Extração Automatizada de Datasets** (`pnpm train:dataset-from-logs`): Script para anonimizar e formatar as partidas disputadas em tensores de treinamento.
- **Proteção e Estabilidade em Produção**: O modo de treino em produção utiliza exclusivamente a política heurística segura. A inferência de rede neural fica restrita ao ambiente de desenvolvimento (`dev`) para treinos e baterias de testes práticos antes de qualquer promoção.

### ☁️ Infraestrutura & Conformidade com o Render
- Otimização do backend da API no **Render** (`render.yaml`), integrando um runner assíncrono nativo para o bot de modo solo sem exigir workers adicionais.


### 🛠️ Ajustes
- **Preview de layout do simulador** (`/#/simulador/preview-layout`) agora abre
  também em produção. É uma ferramenta interna de visualização — só dados de
  exemplo, sem login — usada pra iterar o visual do tabuleiro e ilustrar os
  tutoriais de Regras. Fica liberada no navegador ao abrir o link uma vez com
  `?preview=1` no fim.
- **Simulador no mobile** — o tabuleiro não corta mais as laterais em telas de
  celular (retrato e paisagem): a escala deixa de forçar um tamanho "confortável"
  que estourava a tela e passa a caber por inteiro, e a proporção fixa 16:9 do
  canvas é solta abaixo de 1024px pra usar toda a altura disponível.
- **Animações de setup** (embaralhar / comprar mão / mulligan / montar escudos)
  passam a usar o tamanho real das cartas do tabuleiro, em vez de um tamanho fixo
  pequeno que quase não aparecia.

---

## [1.0.0] — 2026-09-06

Primeiro lançamento numerado como **1.0**. Catálogo, deckbuilder, rulings e
simulador (ST01–ST04) fechados; rede em tempo real e overhaul visual do
simulador entregues.

### 🎴 Deckbuilder
- **Curva de nível das Units** — gráfico novo na aba Estatísticas (Lv.1–5 e "6+"),
  clicável pra ver as cartas de cada nível.
- **Mão inicial** ganhou a chance de abrir com pelo menos 1 Unit de nível baixo
  (Lv.1–3) — cálculo hipergeométrico, junto com a de custo baixo.
- Seleção de **capa/estilo visual do deck** subiu pra logo abaixo do nome/Salvar.

### 🌐 Cartas em português
- **Texto de efeito das cartas dos Starters ST01–ST04 traduzido pra pt-BR** —
  keywords (`[Deploy]`, `[Burst]`, `<Blocker>`…) e nomes/atributos ficam em
  inglês, só a explicação é traduzida. Aparece no catálogo e no inspetor do
  simulador (com alternância PT/EN quando os dois textos existem).

### 🎮 Simulador — Waves ST03 e ST04 jogáveis
- **ST03 "Zeon's Fangs"** (Sinanju / Unicorn / Full Frontal) e **ST04
  "Aile of Justice"** (Strike Gundam / SEED / Kira & Athrun) — as 32 cartas
  únicas jogáveis no motor, com efeitos, tokens e habilidades.
- Novos padrões de efeito cobertos: revelar cartas do topo do deck, deploy
  gratuito de Unidade da mão, gatilho **【Destroyed】** (dentro e fora de combate),
  concessão temporária de alvo, proibição de ataque no turno, prevenção de dano
  condicional.

### ✨ Simulador — visual e ergonomia (Feedback da comunidade)
- Tabuleiro **sem barra de rolagem** em qualquer resolução (Full HD, ultrawide,
  notebook, mobile landscape), câmera mais inclinada estilo Master Duel, cartas
  e números maiores.
- **Fim do botão de "olho"** — clicar no corpo da carta abre o inspetor.
- Dano da Base no canto, **recursos idênticos empilhados** (`x3`, `x5`) sem
  scroll horizontal, seta de ataque mirando a Base/Escudos no lado certo,
  banner de fase/ação sem cortar texto.
- Bandejas de Exílio/Descarte com largura controlada, fecham clicando fora.
- **Microinterações**: compra de carta, embaralhamento, mulligan, revelação de
  escudo, deploy (leve/pesado por custo), avanço de ataque.

### 🔌 Simulador — rede em tempo real
- Servidor **Socket.io** rodando ao lado do SSE, com salas por partida,
  reconexão com backoff e telemetria de ping.
- **Convite direto por link** ("Jogar com um amigo" → código `GC-####`).
- Cliente do simulador migrado pro Socket.io com fallback automático pro SSE.

### 🛠️ Bastidores
- Pipeline de tradução automatizada com validação de tokens
  (`scripts/translate-card-effects.mjs`).
- Ferramentas de desenvolvimento: enumerador de ações legais, self-play,
  fuzzing de regressão, servidor MCP do motor, CI.

### ⚠️ Limitações conhecidas (próxima etapa)
- O transporte **Socket.io** ainda não foi promovido a produção — o SSE segue
  como caminho padrão até a validação de rede com 2 jogadores reais em
  máquinas/redes diferentes.
- Matchmaking **ranqueado** aceito no protocolo, sem fila própria ainda.
- 【Destroyed】 direcionado que pausa e efeitos de dano a múltiplos alvos
  (coleções GD/EB) — no backlog.

---

## [0.9.0] — 2026-09-04

Primeira versão numerada do projeto. A partir daqui, toda atualização relevante
entra aqui. Esta entrada também documenta, de uma vez, tudo que já estava de pé.

### 🎮 Simulador — agora dá pra jogar uma partida completa
- **Mulligan interativo**: cada jogador compra 5, decide manter ou trocar a mão
  (uma vez, na ordem oficial), com revelação de quem joga primeiro.
- **Jogo remoto entre 2 jogadores**: fila de pareamento, motor 100% server-side,
  timer de turno, W.O. por abandono, reconexão automática com aviso na tela e
  **persistência real** — a partida sobrevive a queda de conexão, restart do
  servidor ou deploy no meio do jogo.
- **Motor de regras** cobrindo o ST01 e o ST02 ponta a ponta: as 5 fases de
  turno, as 5 etapas de combate, todas as 8 keywords oficiais (Blocker, First
  Strike, High-Maneuver, Breach, Suppression, Support, Repair, Once per Turn),
  pareamento de Piloto, Burst, efeitos 【Deploy】/【Attack】/【When Paired】/
  【During Pair】/【Activate】, dano em Base/Shield, deck-out.
- **Visual "Nível Arena"**: tabuleiro 3D com o campo do oponente espelhado,
  cartas com borda suave e identidade visual própria, ações de atacar/ativar/
  bloquear direto no canto da carta, inspetor de carta lateral, log de batalha.

### 📚 Catálogo de cartas
- Mais de 1.800 cartas cadastradas (1.000+ modelos únicos) em 22 coleções,
  com arte oficial, filtros por cor/custo/tipo/trait/keyword e busca.
- 90 rulings oficiais traduzidas pra pt-BR, organizadas por fase/keyword.

### 🛠️ Deckbuilder
- Montagem de deck com validação das regras oficiais em tempo real (50+10,
  limite de 2 cores, 4 cópias por carta).
- Estatísticas automáticas: curva de custo, distribuição de cor/tipo,
  histogramas de AP/HP das Unidades.
- Chance de abrir mão inicial boa (cálculo hipergeométrico), com prévia visual
  de mão simulada.
- Importar/exportar decklist em texto e gerar imagem da lista pra compartilhar.

### 📁 Coleção pessoal
- Pastas (binders) pra organizar sua coleção física/digital, com arrastar-soltar
  e preview em galeria.

### 🏆 Torneios e eventos
- Cadastro de torneios e eventos hospedados, com rodadas, confrontos e
  participantes.

### 🔐 Conta e administração
- Login por email/senha ou Google.
- Painel admin completo: cartas, coleções, rulings, traits, temporadas,
  eventos — tudo editável sem mexer em banco.

### Histórico anterior ao versionamento formal
Antes desta versão o projeto não tinha número oficial — essas são as marcas
registradas nos docs internos ao longo do caminho:
- **v0.4.1** — correção do seed do Prisma em ambiente ESM.
- **v0.4.0** — primeira API real (Prisma em runtime), autenticação com papéis,
  múltiplos decks por usuário.
- **v0.3.0** — persistência local alinhada ao Prisma, CRUD do admin pra
  cartas/rulings/eventos.
- Antes disso: protótipo navegável inicial do portal.

---

## Como ler este arquivo

- **🎮 Simulador** / **📚 Catálogo** / **🛠️ Deckbuilder** / **📁 Coleção** /
  **🏆 Torneios** / **🔐 Conta** — a área do produto que mudou.
- **Em validação** — já está no ar, mas ainda sendo testado antes de chamar de
  "pronto".
- **No radar** — ainda não começou, é a direção planejada.
