# Como Iniciar a Execução Contínua e Paralela no Claude Code

Este documento contém os comandos e prompts prontos para copiar e colar no Claude Code para disparar a execução contínua e autônoma, pausando apenas para revisões humanas essenciais.

---

## Opção 1: Comando Rápido (Se você já está com o Claude aberto)

Basta digitar no terminal do Claude Code:

```text
/iniciar-execucao
```

*(Esse comando lê a branch atual, consulta o `AI_GUIDE.md`, entra em modo contínuo `auto on` e executa a esteira de tarefas daquela branch sem parar para perguntas triviais).*

---

## Opção 2: O Super Prompt de Execução Contínua (Para colar no início do Claude)

Copie e cole o bloco abaixo diretamente na janela do Claude Code:

```text
auto on
Você é o Engenheiro Sênior Líder e Arquiteto de Software do Portal Gundam TCG BR.
Inicie imediatamente a execução contínua e autônoma do projeto seguindo estritamente as diretrizes de 'AI_GUIDE.md', 'PLANEJAMENTO.md' e dos documentos técnicos em 'docs/'.

Regras Operacionais:
1. Verifique a branch ativa com 'git branch --show-current'.
2. Siga rigorosamente os checklists de execução correspondentes à sua branch definidos na Seção 6 de 'AI_GUIDE.md'.
3. Trabalhe em ciclo contínuo de TDD (Red -> Green -> Refactor), garantindo que 'npx vitest run src/modules/simulator' permaneça 100% aprovado.
4. Ao concluir cada item funcional, atualize o 'AI_GUIDE.md' marcando a caixa de [ ] para [x] e realize um commit semântico na branch.
5. Não pare para perguntas triviais. Continue avançando autonomamente através das tarefas.
6. PAUSE E CHAME O USUÁRIO (WILLEN) APENAS NOS SEGUINTES CASOS:
   - Para apresentar o lote gerado de traduções pt-BR para revisão antes do '--apply'.
   - Se houver conflito de regras ou ambiguidade que exija decisão humana.
   - Ao finalizar todas as tarefas da branch para solicitar aprovação do merge.

Comece agora: verifique a branch e inicie a primeira tarefa pendente do checklist.
```

---

## Opção 3: Execução Paralela em 3 Terminais (Recomendado para Máxima Velocidade)

Para rodar as 3 frentes de trabalho ao mesmo tempo de forma totalmente isolada:

Abra o **PowerShell** na raiz do projeto e execute o script automatizado:
```powershell
.\scripts\iniciar-paralelo.ps1
```

Ou abra manualmente 3 abas no seu terminal:

### Aba 1: Core, Tradução e Waves ST03/ST04
```powershell
git checkout dev
claude
```
> Cole:
> ```text
> auto on
> Atue na branch 'dev'. Seu foco são as Frentes 1 (Feedback Deckbuilder), 2 (Tradução PT-BR) e 3 (Waves ST03/ST04). Leia o AI_GUIDE.md e inicie imediatamente pelo checklist da branch dev em ciclo contínuo com TDD e commits atômicos.
> ```

### Aba 2: Layout do Simulador, HUD e Ergonomia
```powershell
git checkout feature/simulator-layout
claude
```
> Cole:
> ```text
> auto on
> Atue na branch 'feature/simulator-layout'. Seu foco é a Frente 4 (Layout, Playmat, eliminação do botão de olho, dano da Base no canto inferior direito, empilhamento de recursos com badges e seta para a esquerda no CombatLane) conforme docs/38-plano-detalhado-layout-e-ux.md. Leia o AI_GUIDE.md e inicie imediatamente em ciclo contínuo.
> ```

### Aba 3: WebSocket & Multiplayer em Tempo Real
```powershell
git checkout feature/simulator-websocket
claude
```
> Cole:
> ```text
> auto on
> Atue na branch 'feature/simulator-websocket'. Seu foco é a Frente 5 (Migração de SSE/polling para Socket.io, lobby, convites diretos por link e reconexão) conforme docs/39-plano-detalhado-websocket-multiplayer.md. Leia o AI_GUIDE.md e inicie imediatamente em ciclo contínuo com TDD.
> ```
