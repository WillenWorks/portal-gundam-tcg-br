# Planejamento — Pós-v1.0 (Versão Expandida e Consolidada)

> **Documento Canônico de Planejamento e Roadmap**  
> Última atualização: 2026-09-05 | Arquiteto & Engenharia: Willen & Antigravity / Claude Code  
> Guia operacional para IAs e desenvolvedores: consulte [AI_GUIDE.md](AI_GUIDE.md) na raiz.

---

## 1. Visão Geral e Contexto

O Portal Gundam TCG BR atingiu estabilidade em sua versão 1.0 com catálogo, deckbuilder, rulings e a primeira versão do simulador já em testes reais com jogadores (cobrindo os Starter Decks ST01 e ST02).

A fase **Pós-v1.0** endereça quatro frentes estratégicas simultâneas, integrando a expansão de conteúdo, a evolução técnica de rede, o redesenho ergonômico do simulador e as melhorias solicitadas no relatório `Feedback.pdf`:

1. **Frente 1 (Traduções PT-BR)**: Automação da tradução dos efeitos livres das cartas (`effectPt`), preservando estritamente termos e keywords oficiais em inglês (`docs/17`).
2. **Frente 2 (Waves de Cartas ST03 & ST04)**: Expansão do motor de jogo para cobrir 100% das regras e efeitos dos decks ST03 e ST04, estabelecendo a base para futuras coleções.
3. **Frente 3 (Layout & UX do Simulador)**: Overhaul do tabuleiro com visual de playmat oficial, viewport adaptativo sem scroll (desktop e mobile landscape), microinterações táteis e correção de todas as dores apontadas pela comunidade no `Feedback.pdf`.
4. **Frente 4 (WebSocket & Multiplayer Avançado)**: Substituição do modelo SSE/polling por WebSockets bidirecionais (`socket.io`), permitindo partidas ranqueadas, convites por link direto e estabilidade de conexão.
5. **Melhorias de Plataforma (Deckbuilder)**: Curva de nível de Units, estatísticas de nível na mão inicial e reposicionamento da escolha de estilo visual/capa do deck.

---

## 2. Critérios de Sucesso

- [ ] Textos de efeito traduzidos para pt-BR em ST01, ST02, ST03 e ST04 exibidos no simulador e catálogo, com keywords originais intactas.
- [ ] ST03 e ST04 jogáveis ponta a ponta no simulador (`npx vitest run src/modules/simulator` 100% aprovado).
- [ ] Tabuleiro do simulador adaptado a qualquer resolução (1080p, Ultrawide, Notebook, Mobile Landscape) com cartas legíveis, sem barra de rolagem, com recursos empilhados e mira tática correta para Base/Escudos à esquerda.
- [ ] Motor WebSocket em produção com suporte a salas de partida, reconexão automática e convite direto por link.
- [ ] Deckbuilder exibindo gráfico de curva de nível e cálculo de nível na mão inicial.

---

## 3. Matriz de Frentes, Branches e Prioridades

| # | Frente | Branch | Agente / Lead | Documento Detalhado |
|---|---|---|---|---|
| **F1** | Feedback Pontual Deckbuilder | `dev` | `ai-designer` | [docs/38-plano-detalhado-layout-e-ux.md](docs/38-plano-detalhado-layout-e-ux.md) |
| **F2** | Pipeline de Tradução PT-BR (RAG) | `dev` | `solution-architect-cto` | [docs/40-plano-detalhado-traducao-rag-mcp.md](docs/40-plano-detalhado-traducao-rag-mcp.md) |
| **F3** | Waves ST03 / ST04 & Novas Primitivas | `dev` | `phase-reviewer` | [docs/41-plano-detalhado-waves-st03-st04.md](docs/41-plano-detalhado-waves-st03-st04.md) |
| **F4** | Redesign do Layout & Microinterações | `feature/simulator-layout` | `ai-designer` | [docs/38-plano-detalhado-layout-e-ux.md](docs/38-plano-detalhado-layout-e-ux.md) |
| **F5** | WebSocket & Multiplayer Avançado | `feature/simulator-websocket` | `solution-architect-cto` | [docs/39-plano-detalhado-websocket-multiplayer.md](docs/39-plano-detalhado-websocket-multiplayer.md) |

---

## 4. Estratégia de Branches Git e Sincronização

```mermaid
gitGraph
   commit id: "v1.0 (dev atual)"
   branch "feature/simulator-layout"
   branch "feature/simulator-websocket"
   checkout dev
   commit id: "F1: Deckbuilder Stats & Capa"
   commit id: "F2: Tradução ST01-ST04"
   commit id: "F3: Motor ST03/ST04"
   checkout "feature/simulator-layout"
   merge dev id: "Sync dev -> layout"
   commit id: "F4: Playmat, Recursos, Seta, HUD"
   checkout "feature/simulator-websocket"
   merge dev id: "Sync dev -> websocket"
   commit id: "F5: Socket.io Engine & Lobby"
   checkout dev
   merge "feature/simulator-layout" id: "Merge Layout Estável"
   merge "feature/simulator-websocket" id: "Merge WebSocket Estável"
   commit id: "Release v1.1"
```

1. **`dev`**: Base estável. Recebe primeiro F1, F2 e F3.
2. **`feature/simulator-layout`**: Desenvolve a nova UI do tabuleiro sem bloquear quem testa regras na `dev`.
3. **`feature/simulator-websocket`**: Desenvolve a camada de rede Socket.io sem instabilizar as partidas em produção.
4. **Sincronização**: `dev` é mergeada regularmente nas branches filhas.
5. **Merge Final**: Somente após aprovação de testes automatizados e validação pelo Willen.

---

## 5. RAG e MCPs para Desenvolvimento Contínuo

- **RAG para Tradução**: Indexação de `docs/17` e Comprehensive Rules para fornecer grounding terminológico ao script de tradução, prevenindo alucinações e garantindo que termos de jogo permaneçam inalterados.
- **RAG para Motor de Jogo**: Recuperação de `EffectSpecs` similares para apoiar a escrita de novos cards de ST03/ST04.
- **Servidor MCP Customizado (`scripts/mcp-gundam-engine.mjs`)**: Fornece aos agentes de IA ferramentas atômicas (`get_card_details`, `search_rules`, `run_card_suite`) para acelerar ciclos de feedback e economizar tokens.

---

## 6. Documentos de Referência Técnica

- [AI_GUIDE.md](AI_GUIDE.md) — Guia de execução atômica, prompts e regras para IAs.
- [docs/17-glossario-traducao.md](docs/17-glossario-traducao.md) — Glossário oficial de termos e keywords.
- [docs/20-estado-do-projeto-e-avaliacao-rag-mcp.md](docs/20-estado-do-projeto-e-avaliacao-rag-mcp.md) — Avaliação inicial de arquitetura.
- [docs/29-simulador-vv-sprint-v4-processo-carta-nova.md](docs/29-simulador-vv-sprint-v4-processo-carta-nova.md) — Protocolo obrigatório para adição de cartas novas.
- [docs/38-plano-detalhado-layout-e-ux.md](docs/38-plano-detalhado-layout-e-ux.md) — Especificação técnica do novo layout.
- [docs/39-plano-detalhado-websocket-multiplayer.md](docs/39-plano-detalhado-websocket-multiplayer.md) — Arquitetura de sockets e multiplayer.
- [docs/40-plano-detalhado-traducao-rag-mcp.md](docs/40-plano-detalhado-traducao-rag-mcp.md) — Arquitetura de tradução e MCPs.
- [docs/41-plano-detalhado-waves-st03-st04.md](docs/41-plano-detalhado-waves-st03-st04.md) — Auditoria carta a carta e novas primitivas.
