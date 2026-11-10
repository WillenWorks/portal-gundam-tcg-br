/* Texto da página "Sobre" (/sobre). Uma fonte só para as duas leituras da página: o React (AboutPage.tsx)
 * e o HTML que o servidor entrega antes do JavaScript (server/htmlContent.ts → aboutBody), que é o que o
 * robô do Google e do AdSense leem. Mudou aqui, muda nos dois. */

export const ABOUT_UPDATED = "10 de novembro de 2026";
export const ABOUT_CONTACT = "admin@anaheimhub.com";

export type AboutSection = {
  title: string;
  paragraphs?: string[];
  items?: Array<{ label?: string; text: string; href?: string }>;
};

export const ABOUT_TITLE = "Sobre o Anaheim Hub";
export const ABOUT_LEAD =
  "O Anaheim Hub é um portal brasileiro e independente sobre Gundam Card Game: catálogo de cartas, deckbuilder, torneios, metagame, regras e simulador, em português. Toda a consulta é aberta, sem precisar de conta.";

export const ABOUT_SECTIONS: AboutSection[] = [
  {
    title: "Por que o site existe",
    paragraphs: [
      "Quando o Gundam Card Game chegou ao Brasil, a informação sobre o jogo estava espalhada: lista de cartas num lugar, regras só em inglês, resultados de torneio em grupos de mensagem. O Anaheim Hub nasceu para juntar isso num lugar só e explicar o jogo para quem joga em português.",
      "O site é feito por jogadores. Cada ferramenta começou como uma necessidade real da mesa: montar um deck que respeite as regras, saber o que está ganhando torneios, tirar uma dúvida de timing sem ler cem páginas de regulamento.",
    ],
  },
  {
    title: "O que você encontra aqui",
    items: [
      { label: "Catálogo de cartas", text: "todas as coleções lançadas, com efeito em português e o texto original, dados de nível, custo, AP e HP, impressões e as regras ligadas a cada carta.", href: "/cards" },
      { label: "Deckbuilder", text: "monta e valida o deck pelas regras oficiais, mostra a curva de custo, a distribuição de cores e a chance de abrir com as cartas que você precisa.", href: "/deckbuilder" },
      { label: "Torneios", text: "classificação, campanha de cada jogador, arquétipos e listas de deck de eventos do Brasil e do mundo.", href: "/torneios" },
      { label: "Metagame", text: "cartas e cores mais usadas por temporada, calculadas só com decks registrados em resultado de torneio, nunca com listas soltas que podem ser editadas depois.", href: "/stats" },
      { label: "Regras e rulings", text: "glossário de palavras-chave e esclarecimentos de regras, com a seção correspondente das regras oficiais.", href: "/rules" },
      { label: "Artigos", text: "guias, análises de metagame e novidades do jogo.", href: "/articles" },
      { label: "Simulador", text: "para testar decks em partidas contra o computador ou contra outros jogadores (pede uma conta gratuita).", href: "/simulador" },
    ],
  },
  {
    title: "De onde vêm os dados",
    items: [
      { label: "Cartas", text: "conferidas com a lista oficial de cartas e a lista de restrições publicadas pela Bandai." },
      { label: "Regras", text: "baseadas nas Comprehensive Rules e no FAQ oficiais. As explicações em português são escritas pela equipe do site, não traduzidas palavra por palavra; nomes de cartas e de palavras-chave ficam em inglês, como no jogo." },
      { label: "Torneios", text: "vêm da DigiLab, da Egman Events e de resultados enviados por organizadores. Cada torneio leva o crédito e o link da fonte." },
    ],
    paragraphs: ["Achou um erro numa carta, numa regra ou num resultado? Escreva para o e-mail abaixo: a correção costuma entrar no mesmo dia."],
  },
  {
    title: "Quem mantém o site",
    paragraphs: [
      "O Anaheim Hub é desenvolvido e mantido de forma independente pela WillenWorks, no Brasil, com a ajuda de jogadores que testam as ferramentas e mandam correções.",
      "Os custos de servidor e de domínio são cobertos por anúncios e por links de afiliado de lojas de cartas. Todo link de afiliado é identificado como publicidade. Navegar e consultar qualquer página é gratuito e não exige conta; a conta gratuita serve para salvar decks e jogar no simulador.",
    ],
  },
  {
    title: "Aviso sobre marcas",
    paragraphs: [
      "O Anaheim Hub não é afiliado, patrocinado nem endossado pela Bandai, Bandai Namco, Sunrise ou Sotsu. Gundam, Gundam Card Game e os nomes, ilustrações e textos das cartas pertencem aos seus titulares e aparecem aqui para fins informativos e de apoio à comunidade.",
    ],
  },
];
