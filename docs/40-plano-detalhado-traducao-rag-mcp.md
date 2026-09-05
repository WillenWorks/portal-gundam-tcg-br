# Plano Detalhado: Pipeline de Tradução, RAG & MCPs para Agentes (Doc 40)

> **Frente 2 & Arquitetura de IA**  
> **Branch**: `dev`  
> **Foco**: Automação da tradução de cartas, recuperação semântica (RAG) e ferramentas MCP para desenvolvimento ágil.

---

## 1. Política e Filosofia de Tradução (`docs/17-glossario-traducao.md`)

O objetivo do Portal Gundam TCG BR é democratizar o aprendizado e a leitura do jogo no Brasil, **sem fraturar a linguagem dos jogadores em torneios**:

1. **Keywords e Termos de Mecânica NUNCA Traduzidos**:
   - Gatilhos: `【Deploy】`, `【Burst】`, `【Once per Turn】`, `【During Link】`, `【During Pair】`, `【When Paired】`, `【Activate】`.
   - Efeitos: `<Blocker>`, `<Breach X>`, `<Repair X>`, `<Support X>`, `<First Strike>`, `<High-Maneuver>`, `<Suppression>`.
   - Estatísticas & Atributos: `AP`, `HP`, `Lv.X`, `Rest`, `Active`, `Cost`, `Shield`.
2. **Apenas o Texto Livre é Traduzido**:
   - A explicação do que a carta faz, condições de ativação e frases de ação são traduzidas para português claro e gramaticalmente consistente.
3. **Persistência Sem Mudança de Schema**:
   - O campo `effectPt` já existe nos modelos Prisma `CardModel` e `Card`. Nenhum `prisma migrate` é necessário.

---

## 2. Pipeline de Tradução Automatizada com Grounding RAG

### 2.1 Arquitetura do Script (`scripts/translate-card-effects.mjs`)

```
[CardModel: effectEn]
         │
         ▼
[Lexical Tokenizer: Isola tokens 【...】 e <...>]
         │
         ▼
[RAG Retriever: Busca termos correlatos no Glossário (docs/17) e Rulings]
         │
         ▼
[LLM Translation Engine (com Prompt Guard)]
         │
         ▼
[Validador de Integridade de Tokens]
         │
         ├──► Lote de Inspeção JSON (data/translations-st01-st04.json)
         └──► Persistência via CLI: node scripts/translate-card-effects.mjs --apply
```

### 2.2 Guarda-Rails e Validação Automática
- Se o texto em inglês possuía `【Deploy】` e o texto traduzido não possui exatamente `【Deploy】` (ex: traduziu como "【Implantar】"), o validador **rejeita** a tradução e emite alerta.
- O Willen ou o revisor humano pode revisar o JSON intermediário antes de rodar o `--apply`.

---

## 3. RAG para Treinamento e Auditoria de Regras do Motor

Para a criação contínua de EffectSpecs de cartas inéditas:
1. **Indexação do Motor Existente**:
   - As 32 cartas de ST01 e ST02 já cobrem todas as keywords e 27+ padrões de gatilho/ação em `src/modules/simulator/content/`.
2. **Recuperador de Primitivas**:
   - Ao receber uma carta nova, o RAG busca no código-fonte do motor exemplos de cartas que realizam ações similares (ex: "olhar o topo do deck" ➔ encontra `peekAndReorderDeck` em `engine/effectSpec.ts`).
   - Isso garante que a IA utilize o vocabulário oficial da DSL do simulador em vez de inventar novas propriedades fora do padrão.

---

## 4. MCP (Model Context Protocol) para Agentes Ativos

### 4.1 Por que usar MCPs de Desenvolvimento?
Ao trabalhar com múltiplos agentes de IA no terminal (Claude Code):
- Fornecer arquivos inteiros de 100KB consome rapidamente a janela de contexto.
- Um servidor MCP permite que o agente faça chamadas atômicas como `search_cards`, `inspect_ruling` e `run_test`.

### 4.2 Servidor MCP Local (`scripts/mcp-gundam-engine.mjs`)
Ferramentas expostas via stdio para Claude Code ou qualquer cliente MCP:
- `gundam_get_card(code)`: Retorna os campos estruturados de `CardModel` e `CardDef`.
- `gundam_search_glossary(term)`: Consulta rápida a termos do `docs/17`.
- `gundam_verify_engine(deckCode)`: Executa a suíte de testes do deck (`st01`, `st02`, `st03`, `st04`) e devolve diagnóstico sintético de falhas.

---

## 5. Roteiro de Execução

- [ ] Desenvolver `scripts/translate-card-effects.mjs` com parser e validação de tokens.
- [ ] Executar lote para ST01, ST02, ST03 e ST04, exportando para `data/translations-st01-04.json`.
- [ ] Revisão humana do arquivo JSON.
- [ ] Executar `node scripts/translate-card-effects.mjs --apply`.
- [ ] Habilitar exibição no `CardInspectorModal.tsx` e `CardInspectorPanel.tsx`.
- [ ] Validar no frontend a troca fluida de idioma / exibição em pt-BR.
