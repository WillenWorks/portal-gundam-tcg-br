# Portal Gundam TCG BR

Portal brasileiro completo focado no **Gundam Card Game**, integrando catálogo oficial, base de regras e rulings em pt-BR, deckbuilder avançado e um **Simulador de Partidas em Tempo Real com Modo Solo (Treino contra Bot)**.

---

## 🚀 O que a plataforma oferece hoje

### 🎴 Catálogo & Regras Oficiais em pt-BR
- Catálogo completo com todas as cartas dos Starter Sets (**ST01 a ST04**), Boosters e Promos.
- **Tradução de textos de efeitos** em português, preservando termos técnicos e keywords oficiais (`[Deploy]`, `[Burst]`, `<Blocker>`).
- Rulings e FAQ oficiais indexados com busca rápida.
- Curadoria automatizada de vínculos Unidade ↔ Piloto a partir dos dados oficiais.

### 🛠️ Deckbuilder Tático
- Criação, edição e validação de decks de acordo com as regras de construção do GCG.
- **Análise Estatística Completa**: curva de custos, distribuição de níveis (Lv.1 a Lv.6+), equilíbrio de tipos (Unit, Pilot, Command, Base) e cores.
- **Cálculo Hipergeométrico de Probabilidade**: chances matemáticas de abrir a mão inicial com unidades jogáveis de custo e nível baixo.
- Capas customizadas, exportação e compartilhamento público.

### 🎮 Simulador de Partidas em Tempo Real
- **Motor Autoritativo Server-Side**: partidas executadas com regras estritas, determinismo e validação de legalidade de cada ação.
- Suporte a partidas remotas com WebSocket / Socket.IO.
- **Modo Solo — Treino contra o Bot (`/simulador/treino`)**:
  - Permite aos jogadores logados treinarem contra a IA a qualquer momento sem depender de oponente online.
  - Níveis de dificuldade: Fácil, Normal (Heurística determinística completa) e Difícil (MCTS - Monte Carlo Tree Search).
  - Tempo de resposta natural e interface imersiva com inspeção de cartas e animações de setup.
- **Telemetria e Histórico de Partidas (`SimulatorMatchLog`)**:
  - Armazenamento em banco de turnos, ações, decks e resultados de todas as partidas (amistosas, rankeadas e treino).
  - Base para estatísticas de taxa de vitória (winrate) e análise de metagame.

### 🧠 Pipeline de Machine Learning (em Desenvolvimento)
- Módulo de extração de dados e dataset estruturado a partir de logs reais (`scripts/train/dataset-from-logs.mjs`).
- Treinamento contínuo por aprendizado supervisionado/reforço (`pnpm sim:train`) com TensorFlow.js.
- **Salvaguarda de Produção**: Em ambiente de produção (`NODE_ENV=production`), o bot opera **estritamente via Heurística Determinística testada e estável**. O bot de Machine Learning permanece ativo exclusivamente na branch `dev` e sob a flag `SIM_BOT_ENABLE_ML=true` para validações e testes práticos antes de qualquer promoção para a branch `main`.

---

## 🏗️ Arquitetura & Stack Tecnológica

| Camada | Tecnologia | Hospedagem / Infraestrutura |
|---|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, wouter | **Vercel** (`main`) |
| **Backend & API** | Node.js (v20), Express, Socket.IO, Prisma ORM | **Render** (`render.yaml` - Web Service) |
| **Banco de Dados** | PostgreSQL 16 | **Supabase** (com Session Pooler porta 5432) |
| **Storage de Imagens** | Supabase Storage (bucket `card-images`) | **Supabase** |
| **Autenticação** | JWT nativo + Google OAuth (GIS / One Tap) | — |

> **Nota sobre o Render**: O web server no Render executa o runner assíncrono embutido para os turnos do bot no modo solo, sem custo ou dependência de containers extras. O `render.yaml` também já conta com modelo opcional para Background Worker caso a plataforma escale para alta concorrência.

---

## 🛠️ Como rodar localmente

### 1. Pré-requisitos
- Node.js 20+
- pnpm (`npm i -g pnpm`)
- Docker (para Postgres local, opcional se usar banco local próprio)

### 2. Configuração e Inicialização

```bash
# Clone o repositório
git clone https://github.com/WillenWorks/portal-gundam-tcg-br.git
cd portal-gundam-tcg-br

# Instale as dependências
pnpm install

# Configure o ambiente
cp .env.example .env

# Suba o banco local via Docker (se aplicável)
pnpm db:up

# Inicie a API e o Frontend juntos
pnpm dev:full
```

Acesse no navegador:
- **Frontend**: `http://localhost:5173`
- **API**: `http://localhost:8787` (Healthcheck: `http://localhost:8787/api/health`)
- **Simulador Solo**: `http://localhost:5173/#/simulador/treino`

### 3. Credenciais Padrão de Seed Local

```text
Admin:
Email: admin@gundambr.local
Senha: admin123

Jogador / Pilot:
Email: pilot@gundambr.local
Senha: pilot123
```

---

## 📜 Scripts Úteis

```bash
# Testes e Qualidade
pnpm check:types          # Validação estrita do TypeScript (tsc -b)
pnpm test                 # Execução de testes unitários com Vitest
pnpm lint                 # Verificação com ESLint

# Banco de Dados & Prisma
pnpm prisma:generate      # Gera os tipos do Prisma Client
pnpm prisma:migrate       # Aplica migrations pendentes
pnpm prisma:studio        # Interface visual do banco de dados

# Pipeline de Treinamento e Logs do Bot (Dev)
pnpm train:dataset-from-logs   # Extrai histórico de SimulatorMatchLog para dataset
pnpm sim:train                 # Roda treino do modelo neural do bot (TensorFlow.js)
```

---

## 🔮 O que está no radar / Desenvolvimento Futuro

1. **Validação Prática dos Modelos Neurais**:
   - Analisar o desempenho prático do bot heurístico no modo solo em produção.
   - Avaliar os datasets de partidas coletados na tabela `SimulatorMatchLog`.
   - Promover os pesos neurais para produção apenas após superarem consistentemente a heurística em taxa de vitória (> 55%) e estabilidade.
2. **Sistema de Ranking e Matchmaking**:
   - Partidas ranqueadas competitivas com pontuação ELO e temporadas.
3. **Expansão de Coleções no Simulador**:
   - Implementação de efeitos e condicionais específicas dos sets de expansão (GD01, EB01).
4. **Social & Comunidade**:
   - Perfis públicos de jogadores, decks em destaque da comunidade e exportação para formatos de impressão.

---

## 📄 Licença & Aviso Legal

Este é um projeto da comunidade, sem fins comerciais diretos, desenvolvido de fãs para fãs. Gundam, Mobile Suit Gundam e Gundam Card Game são marcas registradas da BANDAI NAMCO Entertainment Inc. / SOTSU・SUNRISE.
