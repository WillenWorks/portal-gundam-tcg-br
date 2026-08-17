# Glossário de tradução (ago/2026)

Regra fixada com o Willen: **keyword em si nunca traduz** (Deploy, Burst, Repair,
Breach etc. ficam exatamente como no card em inglês, sempre). Só a **explicação
mecânica** — o que a keyword faz de verdade na partida — é traduzida pra
português. Motivo: jogadores usam os termos em inglês pra se comunicar em torneio
e ler carta importada; traduzir o termo criaria dois vocabulários pro mesmo jogo.
O que falta pro jogador novo não é o nome da keyword, é entender o que ela faz.

Fonte: regras abrangentes oficiais em inglês (`gundam-gcg.com/en/pdf/
comprehensiverules_en.pdf`, v1.8.0). **Não é tradução literal do PDF** — é
explicação original em português do mesmo mecanismo, pra não reproduzir o texto
protegido por direito autoral da Bandai palavra por palavra. A regra do jogo em
si (o que acontece mecanicamente) não é protegida por direito autoral, só a
redação específica da Bandai é — por isso a explicação é redigida do zero.

## Keywords de efeito (7 — Comprehensive Rules, seção 13)

Mantém o nome em inglês sempre. Detecção automática já existe em
`prisma/extract-keyword-effects.mjs`.

| Keyword (fica em inglês) | Explicação mecânica em português |
|---|---|
| **Repair X** | No fim do seu turno, essa Unit recupera X pontos de HP. Não cura instantaneamente durante a partida — só no fechamento do turno de quem controla a carta. |
| **Breach X** | Quando o ataque dessa Unit destrói uma Unit inimiga, causa X de dano direto ao topo da área de escudo do oponente (a Base, se tiver, senão o escudo mais no topo). É dano extra, além da batalha em si. |
| **Support X** | Descansando essa Unit durante sua fase principal, você dá AP+X pra 1 outra Unit aliada só durante aquele turno. Não empilha do zero a cada uso — se a Unit já tem Support de outra fonte, o valor soma no efeito existente, não duplica. |
| **Blocker** | Quando o oponente declara ataque, você pode descansar essa Unit pra mudar o alvo do ataque pra ela. Protege outra Unit sua trocando quem recebe o dano. |
| **First Strike** | Durante uma batalha, essa Unit causa dano ANTES da Unit inimiga. Se o dano dela já for suficiente pra destruir o alvo, o inimigo pode nem chegar a causar dano de volta. |
| **High-Maneuver** | Essa Unit não pode ser bloqueada. Ataques dela sempre acertam o alvo original escolhido, mesmo que o oponente tenha Blocker disponível. |
| **Suppression** | Quando o dano de batalha dessa Unit atinge o escudo do oponente, atinge os 2 primeiros escudos ao mesmo tempo, não só 1. |

## Keywords de gatilho (quando o efeito ativa — não o que ele faz)

Mesma regra: nome fica em inglês, só a explicação traduz. Detecção automática
(conservadora, ver comentário no script) já existe no mesmo arquivo.

| Keyword (fica em inglês) | Explicação mecânica em português |
|---|---|
| **Deploy** | O efeito ativa no momento em que a carta entra em jogo (é colocada na mesa), automaticamente — não precisa de ação extra do jogador pra disparar. |
| **Burst** | Efeito que ativa quando a carta é revelada como escudo destruído em batalha, em vez de simplesmente ir pro descarte — dá um bônus extra além de perder o escudo. |
| **Once per Turn** | Limite de uso — esse efeito só pode ser ativado 1 vez por turno, mesmo que a condição pra ativar aconteça de novo no mesmo turno. |
| **During Link** | O efeito só existe enquanto essa Unit está "linkada" (pareada) com outra carta específica — se o link acabar, o efeito para de valer. |
| **During Pair** | Igual ao During Link, mas pro mecanismo de par (Pilot pareado com Unit). |
| **When Paired** | Dispara no exato momento em que o pareamento acontece (não durante todo o tempo pareado, só no instante da ação de parear). |
| **Activate** | Efeito de ativação manual — o jogador escolhe usar, geralmente pagando um custo ou descansando a carta, não acontece sozinho. |

## Próximos passos com esse documento

1. Willen revisa a explicação das 7 keywords de efeito acima — se estiver
   correto mecanicamente, essas são as primeiras a virar diagrama de Ruling.
2. Depois de aprovado, aplico como registro real no banco (campo `answerPt` do
   `Ruling`, com `relatedKeyword` apontando pro nome em inglês da keyword).
3. Esse mesmo glossário vira a referência de consistência pra tradução de texto
   de efeito de carta (`effectPt`) — quando uma carta menciona "Repair 2" no
   texto, a tradução do RESTANTE do efeito segue esse vocabulário, "Repair"
   nunca vira "Reparo" ou similar.
