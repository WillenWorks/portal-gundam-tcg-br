# Estratégia de imagens, seed e ingestão de cartas

## Decisão recomendada

**Não** é ideal embutir manualmente todas as imagens no repositório nem depender de scraping bruto em tempo real no frontend.

A abordagem mais profissional para este portal é separar em 3 camadas:

### 1. Metadados oficiais e catalogação
Fonte principal para:
- sets
- códigos
- nomes
- traits
- keywords
- efeitos
- estrutura de filtros

Origem preferida:
- site oficial do Gundam Card Game

### 2. Pipeline de ingestão controlada
Usar scripts/admin/importadores para:
- pré-cadastrar coleções
- pré-cadastrar cartas e efeitos
- normalizar campos
- baixar e armazenar imagens de forma controlada
- registrar a origem da imagem

### 3. Entrega otimizada no produto
No portal/simulador/deckbuilder:
- servir miniaturas otimizadas
- lazy loading
- cache agressivo
- versão leve para listas
- versão maior só quando necessário

---

## Recomendação objetiva para este projeto

### Fase atual
A melhor decisão é:

1. **seedar metadados e textos primeiro**
2. adicionar suporte de banco para `imageUrl` e `imageSourceUrl`
3. preparar pipeline/importador separado para imagens
4. fazer o upload/espelhamento das imagens em storage próprio depois

Isso evita:
- peso desnecessário do repositório
- scraping em runtime
- dependência frágil de site de terceiros
- gargalo no deckbuilder e no simulador

---

## O que eu recomendo usar como padrão

### Para o banco
Salvar em cada carta:
- `imageUrl` → URL final servida pelo seu sistema/CDN/storage
- `imageSourceUrl` → origem rastreável da imagem

### Para o frontend
Ter pelo menos 2 resoluções:
- `thumb` para catálogo, deckbuilder e listas
- `full` para detalhe da carta, zoom e simulador

### Para o importador
O fluxo ideal é:

1. importar set e metadados
2. localizar a imagem da carta
3. baixar localmente
4. otimizar/comprimir
5. subir para storage
6. gravar a URL final no banco

---

## Sobre usar APIs externas como JustTCG

Pelo que foi verificado:
- serve mais para metadados e preços
- não parece ser a melhor fonte principal de imagens para o Gundam TCG
- pode ser útil depois para valor de mercado, não como base visual principal

---

## Sobre scraping tipo MarketZeon

Como benchmark, ele é útil para entender:
- organização por coleções
- catálogo com imagens
- monitoramento de preços
- consolidação de fontes

Mas para o seu sistema, o ideal não é depender dele como backend de produção.

O melhor uso aqui é:
- benchmark de modelagem
- referência de campos e estrutura
- eventualmente apoio manual para conferência

---

## Melhor estratégia para deckbuilder e simulador

Como você quer pensar no futuro com animação de cartas:

### Deckbuilder
- usar miniaturas leves
- carregar versão maior só em hover/modal/detalhe
- nunca puxar imagem gigante para toda lista

### Simulador
- usar atlas/variante leve quando possível
- pré-carregamento por deck da partida
- cache em memória para cartas já vistas
- evitar download redundante de assets por turno

---

## Seed recomendado agora

**Sim:** vale a pena fazer seed com o que já existe até agora.

Melhor composição do seed:
- coleções/starter decks
- cartas básicas mais usadas
- textos oficiais já revisados
- rulings essenciais
- alguns eventos base
- usuário admin seed
- deck seed inicial

### E depois
- próxima coleção pode entrar por cadastro manual ou importador dedicado
- isso reduz risco e mantém controle de qualidade

---

## Caminho mais profissional daqui pra frente

### Curto prazo
- backend/API com Prisma
- admin via API
- seed de metadados e textos
- campos de imagem preparados

### Médio prazo
- importador de sets/cartas
- pipeline de imagens
- storage dedicado
- compressão e cache

### Longo prazo
- CDN própria
- variantes de asset para deckbuilder e simulador
- enriquecimento automático com revisão humana

---

## Conclusão prática

A melhor decisão é:

- **não tentar resolver todas as imagens agora dentro do repositório**
- **sim preparar o banco, o backend e o seed para suportá-las corretamente**
- **sim planejar um importador/ingestão separado e controlado**

Isso deixa o sistema:
- mais leve
- mais profissional
- mais escalável
- mais preparado para deckbuilder e simulador
