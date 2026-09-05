# Plano Detalhado: WebSocket & Multiplayer em Tempo Real (Doc 39)

> **Frente 4**  
> **Branch**: `feature/simulator-websocket`  
> **Tecnologia Principal**: `socket.io` (servidor Express e cliente React)

---

## 1. Justificativa da Migração (SSE + Polling vs WebSocket)

O simulador atual opera com **Server-Sent Events (SSE)** para envio de estado do servidor para o cliente (`/api/simulator/matches/:id/events`) e requisições **HTTP POST** para ações do jogador (`/api/simulator/matches/:id/actions`).
Embora funcional na fase de testes solo, essa abordagem apresenta limitações para PvP competitivo:
1. **Latência Assimétrica**: Ações exigem handshake HTTP completo a cada jogada.
2. **Reconexão Complexa**: Quedas momentâneas em conexões móveis exigem novo EventSource e polling de fallback.
3. **Escalabilidade de Matchmaking**: O pareamento FIFO via polling HTTP sobrecarrega a API e impede fluxos ricos de convite direto, salas privadas e partidas ranqueadas.

A adoção de **WebSockets nativos com `socket.io`** unifica a comunicação bidirecional em tempo real em um único canal persistente de baixa latência.

---

## 2. Arquitetura de Rede e Servidor Autoritativo

```
[Cliente React / socketClient.ts]
      │
      ▼  (WebSocket WSS / Fallback Polling)
[Express Server / server/index.ts] ──► [Socket.io Adapter & Auth JWT]
      │
      ├──► Sala de Lobby Geral: lobby:global (Presença, Fila FIFO, Desafios)
      └──► Salas de Partida: match:{matchId} (Isolamento completo entre jogos)
            │
            ▼
   [matchStore.ts (Motor de Regras Autoritativo)]
```

### 2.1 Autenticação e Handshake
- O handshake do socket valida o token JWT de autenticação (`auth.token`).
- Jogadores anônimos/convidados recebem um `guestId` efêmero assinado para permitir partidas casuais sem cadastro obrigatório.

### 2.2 Contrato de Eventos Socket

#### Eventos Cliente ➔ Servidor
- `match:join { matchId }`: Entra na sala da partida e solicita o snapshot atual.
- `match:action { matchId, action, actionSeq }`: Envia uma ação do jogador (deploy, ataque, passar turno).
- `match:ping { matchId }`: Heartbeat de presença para prevenção de abandono (W.O.).
- `queue:join { deckId, mode: "casual" | "ranked" }`: Entra na fila de matchmaking.
- `queue:leave`: Sai da fila.
- `challenge:create { deckId }`: Cria sala de desafio direto e devolve código/link de convite.
- `challenge:accept { challengeCode, deckId }`: Aceita o convite e inicia a partida.

#### Eventos Servidor ➔ Cliente
- `match:view_update { view: MatchView, lastActionSeq }`: Broadcast da visão redigida para o jogador específico.
- `match:error { message, code }`: Notificação de ação ilegal ou rejeição de comando.
- `match:opponent_status { online: boolean, lastSeenMs }`: Status de presença do oponente.
- `queue:status { inQueue: boolean, position, waitTimeSec }`: Atualização de posição na fila.
- `challenge:ready { matchId }`: Notifica ambos os jogadores de que a partida foi criada.

---

## 3. Resiliência de Conexão e Fallback

1. **Reconexão Automática com Backoff Exponencial**:
   - Tentativas imediatas (500ms, 1s, 2s, 4s até o teto de 10s).
   - Ao reconectar, o cliente emite `match:join` e recebe o snapshot atualizado instantaneamente.
2. **Fila de Ações com Sequence Number (`actionSeq`)**:
   - Previne execução duplicada de ações em caso de instabilidade de rede transitória.
3. **Temporizadores Autoritativos no Servidor**:
   - Turn timer (90s) e timer de abandono (180s) continuam sob controle absoluto do servidor em `matchStore.ts`. A UI apenas renderiza a contagem visual baseada no timestamp do servidor.

---

## 4. Sistema de Desafios Diretos e Links de Convite

1. **Geração de Link Compartilhável**:
   - Na página de Lobby, o jogador clica em "Jogar com Amigo" e gera uma URL do tipo:
     `https://portal-gundam.com.br/simulator?challenge=GC-7842`
2. **Entrada do Desafiado**:
   - O segundo jogador clica no link, escolhe seu deck e confirma. O servidor emparelha ambos na hora em uma nova `matchId` e redireciona os dois para a partida.

---

## 5. Roteiro de Implementação

- [ ] Instalar dependências: `socket.io` no servidor e `socket.io-client` no cliente.
- [ ] Implementar inicialização do `io` em `server/index.ts` compartilhando a mesma porta HTTP.
- [ ] Adaptar `src/modules/simulator/server/matchStore.ts` para emitir eventos de socket.
- [ ] Criar cliente frontend singleton `src/modules/simulator/network/socketClient.ts`.
- [ ] Atualizar `src/pages/SimulatorMatchPage.tsx` e `src/pages/SimulatorSandboxPage.tsx`.
- [ ] Executar testes de concorrência com `vitest`.
