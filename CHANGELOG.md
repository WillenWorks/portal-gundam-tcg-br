# Changelog

Novidades, correções e o que vem por aí no **Portal Gundam TCG BR** — pra você
acompanhar sem precisar ler código. Atualizado a cada versão relevante.

Versionamento [semver](https://semver.org/lang/pt-BR/) (`MAJOR.MINOR.PATCH`).
Enquanto estivermos na faixa `0.x`, o projeto ainda está fechando o escopo do
primeiro grande lançamento (`v1.0.0`) — esperem ajustes e coisa nova toda semana.

---

## [Não lançado] — rumo ao v1.0.0

### Em validação (o que falta pro v1.0.0)
- **Simulador remoto entre 2 jogadores reais** — motor, persistência e
  reconexão já prontos, faltando só a rodada de teste com contas de verdade
  em máquinas/redes diferentes.

### No radar
- Analytics competitivos mais profundos (meta por temporada/arquétipo, uso por
  carta) — Fase 2 do produto.
- Perfis públicos, decks favoritos/compartilháveis — Fase 3.
- IA oponente e ranking no simulador — Fase 4.
- `【Pilot】[X]` como pré-requisito de jogar carta, ponte deckbuilder → simulador.

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
