import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// 1. Carrega dados de scrape e traduções
const scraped = JSON.parse(readFileSync('data/scraped-official-faqs.json', 'utf8'));

// Carrega dicionário da Parte 1
const part1Path = 'C:/Users/uriuj/.gemini/antigravity-cli/brain/9193b691-8720-4631-b92a-0c1dfbad9d49/scratch/translations-part1.mjs';
const { GENERAL_FAQ_PT_BY_ID, EXACT_ANSWERS_PT } = await import(`file:///${part1Path.replace(/\\/g, '/')}`);

console.log(`[sync-faq] Scraped FAQs: ${scraped.length}`);
console.log(`[sync-faq] Dicionário Geral: ${Object.keys(GENERAL_FAQ_PT_BY_ID).length} entradas`);
console.log(`[sync-faq] Respostas de Cartas: ${Object.keys(EXACT_ANSWERS_PT).length} respostas únicas`);

// Normaliza dicionário de respostas de cartas
const normAnswers = new Map();
for (const [k, v] of Object.entries(EXACT_ANSWERS_PT)) {
  normAnswers.set(k.replace(/\r\n/g, '\n').trim(), v.trim());
}

// Respostas adicionais que tinham pequenas variações
const EXTRA_ANSWERS_PT = {
  "Yes, you can. As long as their card numbers are different, you can include four copies of each different card in your deck, even if their card names are the same.":
    "Sim, você pode. Desde que os números das cartas sejam diferentes, você pode incluir quatro cópias de cada carta diferente no seu deck, mesmo que tenham o mesmo nome.",
  "Yes, AP and HP are added and the 【Attack】 effect can activate. If fulfilled, link requirements enable the Unit to attack immediately on the turn it is deployed. They do not prevent the addition of values and activation of effects when they are not fulfilled.":
    "Sim, AP e HP são adicionados e o efeito 【Attack】 pode ativar. Se cumpridos, os requisitos de link permitem que a Unidade ataque imediatamente no turno em que for colocada em campo. Eles não impedem a adição de valores nem a ativação de efeitos caso não sejam cumpridos.",
  "It means you determine the Lv. of this Unit paired with a Pilot, then choose a Unit whose Lv. is equal to or less than that Lv.\nExample: If this Unit paired with a Pilot is Lv.6, choose an enemy Unit whose Lv. is 6 or lower.":
    "Significa que você determina o Lv. desta Unidade pareada com um Piloto e, em seguida, escolhe uma Unidade cujo Lv. seja igual ou menor que esse Lv.\nExemplo: Se esta Unidade pareada com um Piloto for Lv.6, escolha uma Unidade inimiga cujo Lv. seja 6 ou menor.",
  "It describes effects with the white <> icon, such as  and .":
    "Descreve efeitos identificados com o ícone branco <>, como <High-Maneuver> e <Blocker>.",
  "Yes, it gains  and .":
    "Sim, ganha <High-Maneuver> e <Blocker>.",
  "Yes, it can, because  is effect damage.":
    "Sim, pode, porque é dano de efeito.",
  "No, it does not activate, because  is effect damage.":
    "Não, não ativa, porque é dano de efeito.",
  "No, it's  cannot be activated.":
    "Não, a habilidade não pode ser ativada.",
  "It can activate the effect, but it can't gain any additional  effects.":
    "Pode ativar o efeito, mas não pode ganhar nenhum efeito adicional."
};

for (const [k, v] of Object.entries(EXTRA_ANSWERS_PT)) {
  normAnswers.set(k.replace(/\r\n/g, '\n').trim(), v.trim());
}

// 2. Mapeamento das 117 Regras Gerais para rulings-batch-07.json
const generals = scraped.filter(f => !f.cardCode);
const batch07 = [];

function mapPhase(category, title) {
  switch (title) {
    case 'Preparing to Play': return 'preparing_to_play';
    case 'Start Phase': return 'start_phase';
    case 'Draw Phase': return 'draw_phase';
    case 'Resource Phase': return 'resource_phase';
    case 'Main Phase: Playing Cards': return 'main_phase';
    case 'Main Phase: Activating Card Effects': return 'main_phase';
    case 'Main Phase: Unit Attacks': return 'battle_phase';
    case 'Fundamental Terminology': return 'terminology';
    case 'Repair':
    case 'Breach':
    case 'Support':
    case 'Blocker':
    case 'First Strike':
    case 'High-Maneuver':
    case 'Suppression':
    case 'Deploy':
    case 'Attack':
    case 'Destroyed':
    case 'Activate':
    case 'When Paired':
    case 'During Pair':
    case 'Once per Turn':
    case 'Burst':
      return 'keywords';
    default:
      return 'general';
  }
}

function mapKeyword(title) {
  const keywords = [
    'Repair', 'Breach', 'Support', 'Blocker', 'First Strike',
    'High-Maneuver', 'Suppression', 'Deploy', 'Attack', 'Destroyed',
    'Activate', 'When Paired', 'During Pair', 'Once per Turn', 'Burst'
  ];
  return keywords.includes(title) ? title : null;
}

function toIsoDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

for (const g of generals) {
  const trans = GENERAL_FAQ_PT_BY_ID[g.id];
  const qPt = trans?.q || g.question;
  const aPt = trans?.a || g.answer;
  const phase = mapPhase(g.category, g.title);
  const kw = mapKeyword(g.title);

  batch07.push({
    sourceType: "OFFICIAL_FAQ",
    title: g.title,
    relatedPhase: phase,
    relatedKeyword: kw,
    originalUrl: g.sourceUrl,
    officialUpdatedAt: toIsoDate(g.date),
    questionEn: g.question,
    answerEn: g.answer,
    questionPt: qPt,
    answerPt: aPt
  });
}

writeFileSync('data/rulings-batch-07.json', JSON.stringify(batch07, null, 2) + '\n', 'utf8');
console.log(`[sync-faq] Gravado data/rulings-batch-07.json com ${batch07.length} rulings gerais.`);

// 3. Tradução das Perguntas das Cartas via Gemini
const cardFaqs = scraped.filter(f => f.cardCode);
const uniqueQ = [...new Set(cardFaqs.map(f => f.question))];
console.log(`[sync-faq] Perguntas de cartas únicas a traduzir: ${uniqueQ.length}`);

// Carrega chave Gemini
const env = readFileSync('.env', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1] : null;

// Cache de traduções para perguntas
const cacheFile = 'data/faq-question-translations-cache.json';
const questionCache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};

const missingQuestions = uniqueQ.filter(q => !questionCache[q]);
console.log(`[sync-faq] Perguntas já em cache: ${Object.keys(questionCache).length}, Faltando traduzir: ${missingQuestions.length}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function translateBatchWithGemini(questions) {
  const prompt = `Você é um tradutor especialista oficial do Gundam Card Game para Português do Brasil (PT-BR).
Traduza com máxima precisão cada pergunta oficial em inglês para PT-BR.
REGRAS ESSENCIAIS DE TRADUÇÃO DO JOGO (docs/17-glossario-traducao.md):
- NÃO traduza nomes de keywords ou tipos mecânicos: mantenha 【Deploy】, 【Attack】, 【When Paired】, 【During Pair】, 【During Link】, 【Activate･Main】, 【Activate･Action】, 【Burst】, <Blocker>, <High-Maneuver>, <Breach>, <First Strike>, <Repair>, <Support>, <Suppression>, Unit, Pilot, Base, Command, Shield, Trash, Resource, Level (Lv.), Cost, HP, AP exatamente como no jogo.
- "deploy" (verbo): "colocar em campo" ou "fazer Deploy".
- "pair" (verbo): "parear" ou "fazer Pair".
- "link": "fazer Link".
- "battle area": "área de batalha".
- "resource deck": "deck de recursos".
- "shield section / shield area": "seção de escudos / área de escudos".
- "active / standby": "ativo / em espera".
- "trash": "trash" (ou "área de descarte/trash").

Retorne APENAS um objeto JSON com a chave "translations", onde o valor é um array de strings com as traduções na MESMA ordem das perguntas recebidas:
{
  "translations": [ "pergunta 1 em pt-br", "pergunta 2 em pt-br" ]
}`;

  const models = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${prompt}\n\nPerguntas a traduzir:\n${JSON.stringify(questions, null, 2)}` }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1
          }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[sync-faq] Modelo ${model} retornou ${res.status}: ${errText.slice(0, 100)}. Tentando próximo...`);
        await sleep(1000);
        continue;
      }

      const json = await res.json();
      const text = json.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(text);
      const list = parsed.translations || parsed;
      if (Array.isArray(list) && list.length === questions.length) {
        return list;
      }
    } catch (e) {
      console.warn(`[sync-faq] Falha com ${model}: ${e.message}`);
      await sleep(1000);
    }
  }

  throw new Error('Todos os modelos falharam para o lote.');
}

if (missingQuestions.length > 0 && apiKey) {
  const BATCH_SIZE = 25;
  for (let i = 0; i < missingQuestions.length; i += BATCH_SIZE) {
    const chunk = missingQuestions.slice(i, i + BATCH_SIZE);
    console.log(`[sync-faq] Traduzindo lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missingQuestions.length / BATCH_SIZE)} (${chunk.length} perguntas)...`);
    try {
      const translations = await translateBatchWithGemini(chunk);
      chunk.forEach((q, idx) => {
        questionCache[q] = translations[idx];
      });
      writeFileSync(cacheFile, JSON.stringify(questionCache, null, 2) + '\n', 'utf8');
      await sleep(800);
    } catch (err) {
      console.error(`[sync-faq] Erro ao traduzir lote ${i}:`, err.message);
    }
  }
}

// 4. Monta data/gcg-official-faq.json agrupado por carta
const faqByCard = {};

for (const f of cardFaqs) {
  const cleanAns = f.answer.replace(/\r\n/g, '\n').trim();
  const ansPt = normAnswers.get(cleanAns) || null;
  const qPt = questionCache[f.question] || null;

  if (!faqByCard[f.cardCode]) {
    faqByCard[f.cardCode] = [];
  }

  faqByCard[f.cardCode].push({
    id: f.id,
    date: f.date,
    question: f.question,
    answer: f.answer,
    questionPt: qPt,
    answerPt: ansPt
  });
}

// Ordena as chaves alfabeticamente
const sortedCardFaq = Object.fromEntries(
  Object.entries(faqByCard).sort(([a], [b]) => a.localeCompare(b))
);

writeFileSync('data/gcg-official-faq.json', JSON.stringify(sortedCardFaq, null, 2) + '\n', 'utf8');
console.log(`[sync-faq] Sucesso! data/gcg-official-faq.json atualizado com ${Object.keys(sortedCardFaq).length} cartas e ${cardFaqs.length} FAQs no total.`);
