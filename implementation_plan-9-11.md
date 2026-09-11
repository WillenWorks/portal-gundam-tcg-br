# Planejamento: Modernização Visual do Database de Cards e Coleções

Este plano detalha a modernização completa da experiência visual do **Database de Cards** (`/cards`) e da página de **Coleções & Produtos** (`/sets`), incorporando banners cinematográficos de alta fidelidade técnica, efeito de profundidade **parallax**, mesclagem fluida com o fundo da página, alta densidade de cartas focada no colecionismo visual e importação das capas reais de produtos.

---

## 1. Assets Visuais Gerados

Conforme solicitado, geramos duas artes dedicadas em proporção ultrawide (16:9), processadas em **PNG de alta resolução** com **curva de transparência inferior suave (bottom alpha fade)** a partir de 45% da altura até a borda inferior, permitindo que a imagem se funda perfeitamente ao fundo da aplicação (`#0b0f19` / tema escuro) sob efeito parallax.

### A. Banner do Database de Cards: Blueprint Técnico RX-0 Unicorn Gundam
Representa o arquivo universal de blueprints e dados técnicos (Laplace System / Anaheim Electronics UC 0096) com esquemático CAD, vistas ortográficas, detalhes de armadura e psycho-frame:

![Blueprint Técnico RX-0 Unicorn Gundam](C:\Users\uriuj\.gemini\antigravity-ide\brain\e4407eb3-ef38-46ce-8fc8-23243d15a08b\unicorn_blueprint_banner_faded.png)

*Caminhos locais prontos em `public/images/`:*
- `public/images/unicorn_blueprint_banner.png` (com máscara de transparência inferior)
- `public/images/unicorn_blueprint_banner.jpg` (versão base nítida)

---

### B. Banner da Área de Coleções: Hangar de Produção & Deploy
Apresenta múltiplas unidades Gundam icônicas (RX-78-2, Wing Zero, Freedom, Exia, Unicorn) alinhadas lado a lado em baias ativas de manutenção com andaimes industriais, pontes de acesso, braços robóticos e iluminação volumétrica:

![Hangar de Produção e Deploy de Mobile Suits](C:\Users\uriuj\.gemini\antigravity-ide\brain\e4407eb3-ef38-46ce-8fc8-23243d15a08b\gundam_hangar_deploy_banner_faded.png)

*Caminhos locais prontos em `public/images/`:*
- `public/images/gundam_hangar_deploy_banner.png` (com máscara de transparência inferior)
- `public/images/gundam_hangar_deploy_banner.jpg` (versão base nítida)

---

## 2. Visão Geral das Mudanças por Módulo

### 2.1. Banner do Database de Cards (`CardsPage.tsx`)
- **Limpeza de Textos**: Remoção completa de:
  - `"Núcleo público"`
  - `"Arquivo Central Anaheim"`
  - `"Registro técnico de blueprints, dados de Mobile Suits e catálogo completo de cartas com filtros avançados de busca."`
- **Novo Título Limpo**: Apenas **"Database de Cards"** com tipografia imersiva e badge discreto de contagem de telemetria (`{total} cartas indexadas`).
- **Efeito Parallax**: 
  - Criação do componente `ParallaxHeroBanner.tsx` com `translateY` calculado via scroll (`transform: translateY(${offsetY * 0.28}px)`), aceleração por GPU (`will-change: transform`) e suporte a acessibilidade (`prefers-reduced-motion`).
  - Camada de gradiente duplo (PNG com fade no canal alfa + gradiente CSS `bg-gradient-to-b from-transparent via-slate-950/20 to-[#0b0f19]`) garantindo transição 100% invisível para a rolagem da página.

---

### 2.2. Nova Disposição e Design dos Filtros
Mantém **todos** os filtros existentes (`q`, cores, tipos, séries, traits, keywords, coleções, raridades, ordenação e itens por página), porém reorganizados em uma interface de comando técnico mais compacta e visualmente organizada:

1. **Linha de Comando Principal (Busca Rápida & Ações)**:
   - Campo de busca textual ampliado (`Nome, código, trait, efeito ou série`) com atalho visual.
   - Botão **"Copiar busca"** e **"Limpar filtros"** com feedback tátil.
   - Indicador de filtros ativos e totalizador de cartas encontradas.
2. **Barra de Parâmetros Principais**:
   - `Cores`: MultiSelect aprimorado com badges de cores oficiais da franquia.
   - `Tipo de Carta`: Dropdown estilizado (Unit, Pilot, Command, Base, Resource, etc.).
   - `Coleção / Set`: Seleção de expansão (`GD01`, `ST01`, etc.).
   - `Raridade`: Filtro com rótulos canônicos (Common, Uncommon, Rare, Super Rare, Secret Rare, Legend Rare...).
3. **Barra de Parâmetros de Lore & Ordenação**:
   - `Série / Obra de Origem`: Dropdown com as obras cadastradas.
   - `Traits`: MultiSelect de traits.
   - `Keywords`: Habilidades e gatilhos de regras.
   - `Ordenar por`: Código, Nome, Custo, Data de cadastro.
   - `Itens por Página`: Seletor (10, 20, 50, 100, Todas).

---

### 2.3. Anatomia Simplificada e Alta Densidade dos Cards
Atualmente os cards ocupam muito espaço vertical exibindo caixa de custo, AP, HP, parágrafos extensos de efeito e botões extras, permitindo apenas 3 a 4 colunas largas.

**Nova proposta de alta densidade visual (Scryfall / Limitless style)**:
- **Grid Responsivo Otimizado**: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6` (carrega e exibe mais que o dobro de cartas na mesma área útil da tela).
- **Remoções Conforme Pedido**:
  - ❌ Texto de efeito removido da visualização em grid.
  - ❌ Caixas de Custo, AP e HP removidas da visualização em grid.
  - ❌ Botão textual "Abrir detalhe" removido (o card inteiro e a imagem são clicáveis diretamente para abrir a tela de detalhe).
- **Elementos Mantidos e Destaques**:
  - **Imagem da Carta Significativamente Maior**: Arte vertical em destaque com proporção `aspect-[63/88]`, borda cibernética com brilho sutil ao hover (`hover:scale-[1.03] hover:border-primary/60 transition-transform duration-200`).
  - **Badges sobrepostos ou em topo**:
    - Tag de **Cor** (Azul, Verde, Vermelho, Amarelo, Branco, Roxo, Preto).
    - Tag de **Raridade** (com cores distintas por categoria).
    - Tag de **Contagem de Artes** (`X artes` quando houver mais de uma versão/reprint).
  - **Rodapé Técnico Compacto**:
    - **Código da Carta** (ex: `ST01-001`, `GD01-024`) em mono/uppercase com alto contraste.
    - **Nome da Carta** em 1 a 2 linhas, tipografia nítida.
    - **Trait / Série** em texto reduzido e discreto, clicável para aplicar filtro instantâneo.

---

### 2.4. Banner e Imagens dos Produtos na Área de Coleções (`CollectionsPage.tsx`)
1. **Banner Parallax**:
   - Aplicação do banner do hangar de produção (`gundam_hangar_deploy_banner.png`) no topo de `/sets`.
   - Título limpo: **"Coleções & Produtos"**, com o mesmo efeito parallax e fundo mesclado.
2. **Integração das Imagens Oficiais dos Produtos**:
   - Identificamos que a base da API TCG (`data/apitcg-gundam.json`) já possui packshots oficiais de alta qualidade para todos os produtos (Booster Boxes, Booster Packs, Starter Decks e Collaboration Packs).
   - Faremos o script de vinculação direta no banco (`prisma.cardSet.update`) para atribuir `coverImage` a cada set:
     - `GD01` (Newtype Rising) -> Booster Box oficial
     - `GD02` (Dual Impact) -> Booster Box oficial
     - `GD03` (Steel Requiem) -> Booster Box oficial
     - `GD04` (Phantom Aria) -> Booster Box oficial
     - `GD05` (Freedom Ascension) -> Booster Box oficial
     - `GD01_b` (Edition Beta) -> Beta Box oficial
     - `EB01` (Eternal Nexus) -> Booster Box oficial
     - `ST01` a `ST10` -> Caixas dos respectivos Starter Decks
     - `GCG-PR` -> Collaboration Pack oficial
   - As imagens passam a ser exibidas automaticamente em:
     - Catálogo de Coleções (`/sets`)
     - Detalhe de Coleção (`/sets/:code`)
     - Seção de Últimas Coleções na Home (`LatestCollectionsSection.tsx`)

---

## 3. Arquivos Propostos para Alteração

### Componentes de UI
- **[NEW]** [`src/components/catalog/ParallaxHeroBanner.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/components/catalog/ParallaxHeroBanner.tsx): Componente reutilizável para banners com paralaxe leve no scroll, suporte a títulos customizados, contadores de telemetria e mesclagem de gradiente.
- **[MODIFY]** [`src/components/layout/public/PublicShell.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/components/layout/public/PublicShell.tsx): Permitir supressão do header padrão `"Núcleo público"` quando uma página optar por fornecer seu próprio Hero Banner integrado.

### Páginas
- **[MODIFY]** [`src/pages/CardsPage.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/CardsPage.tsx):
  - Integrar o banner do Unicorn com parallax e título exclusivo "Database de Cards".
  - Reorganizar a barra de filtros em painel ergonômico.
  - Substituir o grid atual de 2-4 colunas pelo grid compacto de alta densidade (4-6 colunas), com imagem de carta aumentada, badges essenciais e remoção de custos/efeitos/botão "Abrir detalhe".
- **[MODIFY]** [`src/pages/CollectionsPage.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/CollectionsPage.tsx):
  - Integrar o banner do hangar de produção com parallax e título limpo.
  - Aprimorar a renderização das capas de produtos.

### Banco de Dados / Scripts
- **[NEW]** [`scripts/link-product-covers.mjs`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/link-product-covers.mjs): Script simples que extrai as URLs oficiais de capas de produtos de `data/apitcg-gundam.json` e atualiza `cardSet.coverImage` no Prisma.

---

## 4. Plano de Verificação

### Visual & Interatividade
1. **Navegação no Database (`/cards`)**:
   - Abrir no navegador via subagente ou dev server `http://localhost:5173/#/cards`.
   - Verificar se o banner do Unicorn Gundam aparece nítido, com fade inferior perfeito no background da página e rolagem suave com parallax.
   - Confirmar que o texto foi limpo, exibindo apenas "Database de Cards".
   - Testar o comportamento dos filtros (busca, cor, raridade, tipo, set, série, trait) garantindo que nenhum filtro foi perdido ou quebrado.
   - Verificar a nova densidade do grid: cartas maiores, foco visual, sem caixas desnecessárias de custo/efeito, e clique na carta abrindo o detalhe `/cards/:id`.
2. **Navegação nas Coleções (`/sets`)**:
   - Acessar `http://localhost:5173/#/sets`.
   - Conferir o banner do hangar de deploy com andaimes e mobile suits em manutenção.
   - Conferir se todos os sets (GD01 a GD05, ST01 a ST10, etc.) agora exibem suas caixas e boosters oficiais em vez do fallback "Sem capa local".
3. **Responsividade**:
   - Testar em resoluções mobile (375px), tablet (768px) e desktop widescreen (1440px+).
