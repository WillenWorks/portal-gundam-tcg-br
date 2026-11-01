---
title: "Simulador em beta: GD06 Stardust Trails completo e o que vem por aí no Veda System"
slug: simulador-beta-gd06-stardust-trails-veda
postType: NEWS
excerpt: "As 130 cartas do GD06 já estão no simulador do Anaheim Hub, que segue em beta aberto com 1.086 cartas jogáveis em 21 coleções. Veja o que mudou, como ajudar a testar e o que está previsto no Veda System para a temporada nova."
cover: 2026-11-simulador-beta-gd06.jpg
---

O **GD06 — Stardust Trails** chegou às lojas em 30 de outubro, e o simulador do Anaheim Hub já está pronto para ele: **as 130 cartas da coleção estão implementadas**, com os efeitos escritos a partir do texto oficial e das rulings do FAQ do GD06.

Antes de tudo, um aviso importante: **o simulador continua em beta**. Ele já roda partidas completas, mas ainda pode ter efeitos com comportamento diferente do jogo físico, travas pontuais na tela e ajustes de equilíbrio do bot. Se algo parecer errado, conte pra gente: é assim que ele melhora.

## O que tem no simulador hoje

- **1.086 cartas jogáveis** em **21 coleções**: ST01 a ST14, GD01 a GD06 e EB01.
- **Treino contra o Zero System**, o bot do Anaheim Hub, que monta as jogadas a partir dos núcleos de arquétipo do meta competitivo.
- **Arena multiplayer** para jogar contra outros pilotos.
- **Decks de teste do GD06** prontos para usar: **Verde/Roxo** e **Vermelho/Branco**.
- **Sons e animações** guiados pelo próprio motor do jogo, com ritmo de resolução ajustável.

## GD06 no motor: o que foi preciso construir

O Stardust Trails trouxe mecânicas que o motor ainda não tinha. Alguns destaques:

- **Novas reações**: "quando esta Unit é atacada", "quando ativa 〈Blocker〉" e "quando uma Unit (Neo Zeon) destrói uma carta inimiga com dano", contando Unit, Base ou escudo.
- **Camada de dano**: o **ZZ Gundam** soma +1 ao dano das cartas (AEUG) em Units inimigas, o **Anavel Gato** reduz em 2 o dano de batalha vindo de inimigas de nível igual ou menor e o **Duo Maxwell** protege as Bases contra Units de nível igual ou menor.
- **Custos que mudam**: o **Legend Gundam** fica mais barato a partir do trash, e **Mashymre Cello** e **Corin Nander** custam menos ao parear com a Unit certa.
- **Tokens novos**: Turn X Arms/Legs, Sazabi, Nu Gundam, Calibarn, Aerial Rebuild e a Base **Axis**.
- **Escolhas na hora**: o **Infinite Variations** deixa escolher até N alvos, contados no momento em que a carta resolve.

Cada carta tem testes próprios, e as partidas de referência do motor são conferidas a cada atualização, para que a chegada do GD06 não mude o comportamento das coleções anteriores.

## Como ajudar no beta

Achou um efeito estranho, uma tela travada ou uma decisão que não fez sentido? Durante a partida, use o botão **Reportar Problema no Simulador**. O relatório guarda o estado completo da partida, o que permite reproduzir exatamente o que aconteceu, e você recebe um código (como `BUG-A1B2C3`) para acompanhar a correção.

## O que vem por aí no Veda System

O **Veda System** é a área de resultados de torneios do Anaheim Hub: reports, decklists, jogadores e arquétipos. Para a temporada nova, o previsto é:

- **Temporada GD06 aberta**: desde 30 de outubro, os torneios contam para o GD06, e a temporada GD05 fica fechada para consulta.
- **Coleta diária** dos resultados, incluindo a API oficial do DigiLab, com torneios do mundo todo.
- **Análises migrando para o GD06**: por enquanto, as telas de arquétipos e estatísticas continuam abrindo no GD05. Assim que o GD06 juntar listas suficientes, elas passam a abrir na temporada nova.
- **Zero System atualizado com o meta**: os núcleos de arquétipo que o bot usa são recalculados a partir dos resultados coletados, então o treino acompanha o que está sendo jogado.

## Bora jogar

Monte seu deck com as cartas do GD06, chame o Zero System para um treino ou desafie alguém na arena multiplayer. E, se algo sair do esperado, reporte: cada relato ajuda a tirar o simulador do beta mais rápido.

👉 [Abrir o simulador](/simulador) · [Ver os torneios no Veda System](/torneios)
