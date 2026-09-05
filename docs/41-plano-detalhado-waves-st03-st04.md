# Plano Detalhado: Waves de Cartas ST03 e ST04 no Motor (Doc 41)

> **Frente 3**  
> **Branch**: `dev`  
> **Produtos**: ST03 (Mobile Suit Gundam Unicorn / Sinanju) & ST04 (Mobile Suit Gundam SEED / Strike Gundam)  
> **Processo Obrigatório**: [docs/29-simulador-vv-sprint-v4-processo-carta-nova.md](docs/29-simulador-vv-sprint-v4-processo-carta-nova.md)

---

## 1. Escopo das Waves

- **ST03 (32 cartas no produto, 16 cartas únicas)**:
  - Tema: Sinanju, Kshatriya, Unicorn Gundam (Destroy Mode), Full Frontal, Marida Cruz.
  - Cor principal: Vermelho / Zeon / Neo Zeon / Vist Foundation.
- **ST04 (32 cartas no produto, 16 cartas únicas)**:
  - Tema: Strike Gundam, Aegis Gundam, Kira Yamato, Athrun Zala.
  - Cor principal: Azul / O.M.N.I. Enforcer / Z.A.F.T.

---

## 2. Auditoria Preliminar de Mecânicas e Primitivas

Seguindo o protocolo `docs/29`:
1. **Campos Estruturados Primeiro (`CardDef`)**:
   - Cartas com `<Blocker>`, `<Breach>`, `<Support>`, `<High-Maneuver>` ou bônus de combate utilizam os campos nativos (`staticAbilities`, `combatTriggers`, `attackTargetRules`, `pilotMode`). Não necessitam de EffectSpec bespoke.
2. **Novas Primitivas Identificadas no Motor (`engine/effectSpec.ts`)**:
   - **ST03-006 Char's Zaku Ⅱ**:
     *Texto*: *"【Destroyed】Look at top 3 cards of your deck, may reveal 1 [Zeon]/[Neo Zeon] Unit card among them and add to your hand. Return the remaining cards randomly to the bottom of your deck."*
     *Necessidade*: Primitiva `lookAtTopFilterReveal` (olhar N do topo, filtrar por trait/tipo, adicionar à mão e enviar o resto ao fundo).
   - **ST03-010 Full Frontal**:
     *Texto*: *"【When Paired】You may deploy 1 Unit card Lv.4 or lower from your hand."*
     *Necessidade*: Primitiva `deployFromHandTriggered` (disparar deploy sem pagar custo de ação da fase principal, validando limites normais).
   - **Demais Cartas de ST03 e ST04**:
     A maioria se enquadra nas primitivas já existentes (`spawnToken`, `moveZone` para bounce, `damageTargetUnit`, `modifyApHpTemp`).

---

## 3. Estrutura de Arquivos a Criar

### 3.1 Fixtures de Deck
- `src/modules/simulator/fixtures/st03Deck.ts`:
  - Lista das 16 cartas únicas com seus `CardDef` completos (AP, HP, Custo, Level, Traits, Colors, staticAbilities).
  - Constante de decklist completa: 50 cartas de Main Deck + 10 cartas de Resource Deck.
- `src/modules/simulator/fixtures/st04Deck.ts`:
  - Mesma estrutura para ST04.

### 3.2 Implementação de Efeitos e Regras
- `src/modules/simulator/content/st03.ts`: Registro dos `EffectSpec` específicos e gatilhos de ST03.
- `src/modules/simulator/content/st04.ts`: Registro dos `EffectSpec` específicos e gatilhos de ST04.
- Integração em `src/modules/simulator/content/index.ts`.

### 3.3 Suíte de Testes Automatizados (TDD)
- `src/modules/simulator/content/st03.test.ts`: Teste de cada uma das 16 cartas e interações de combate.
- `src/modules/simulator/content/st04.test.ts`: Teste de cada uma das 16 cartas e interações de combate.
- Teste de partida mista: ST03 vs ST04 e ST01 vs ST03 para garantir ausência de regressão.

### 3.4 Habilitação na UI do Simulador
- `src/pages/SimulatorSandboxPage.tsx`:
  - Adicionar ST03 e ST04 ao array `DECK_OPTIONS`.
  - Configurar códigos de conjunto em `ART_SET_CODES` para renderizar as artes oficiais de alta resolução.

---

## 4. Critérios de Aceite

1. `npx vitest run src/modules/simulator/content` executando ST01, ST02, ST03 e ST04 com 100% de aprovação.
2. Iniciar partida no sandbox escolhendo ST03 contra ST04, realizando mulligan, deploy, ataque e resolução de habilidades sem nenhum erro no console.
