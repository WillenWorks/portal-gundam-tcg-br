/* Design system reminder: Hangar Tático Neo-Militar — layout assimétrico, painéis de comando, estética de hangar e ênfase em utilidade competitiva. */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  ChartColumnBig,
  Database,
  FileText,
  Globe,
  Layers3,
  Shield,
  Sparkles,
  Swords,
  Clapperboard,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { AppTopNav } from "@/components/layout/AppTopNav";

interface HomeProps {
  targetSection?: string;
}

const modules = [
  {
    icon: FileText,
    title: "Regras em pt-BR + original lado a lado",
    description:
      "Guia de regras, FAQ, rulings e exemplos práticos para reduzir a barreira do inglês sem esconder a fonte oficial.",
  },
  {
    icon: Layers3,
    title: "Deckbuilder com validação e leitura real",
    description:
      "Montagem dentro das regras, filtros por cartas, estatísticas de curva, densidade, custo e visão compartilhável do deck.",
  },
  {
    icon: ChartColumnBig,
    title: "Meta, torneios e uso por carta",
    description:
      "Cadastro de eventos, standings, decklists e dashboards para identificar cores, arquétipos, staples e conversão em top cut.",
  },
  {
    icon: Clapperboard,
    title: "Conteúdo + canal + comunidade",
    description:
      "Notícias, previews, reviews, vídeos e cobertura conectados ao mesmo portal, em vez de tudo ficar espalhado.",
  },
];

const pillars = [
  {
    code: "01",
    title: "Portal de referência nacional",
    text: "Um lugar só para aprender o jogo, consultar cartas, acompanhar meta e consumir conteúdo com cara profissional.",
  },
  {
    code: "02",
    title: "Uma base que não para de crescer",
    text: "O portal está em desenvolvimento contínuo — catálogo, deckbuilder e torneios evoluem juntos, e cada atualização soma sem derrubar o que você já usa.",
  },
  {
    code: "03",
    title: "Tecnologia a favor de quem joga",
    text: "IA aplicada em tradução cuidada, busca que entende contexto e curadoria de conteúdo mais rápida — pra você gastar menos tempo procurando e mais tempo jogando.",
  },
];

const roadmap = [
  "Portal no ar com navegação completa",
  "Catálogo de cartas, deckbuilder, FAQ e torneios",
  "Catálogo oficial completo: série, traduções e relações entre cartas mapeadas",
  "Deckbuilder com estatísticas de curva e consistência",
  "Analytics de torneios e conteúdo editorial",
  "Simulador de partidas e novos recursos avançados",
];

const aiUseCases = [
  "Tradução assistida de regras e efeitos, sempre com revisão humana antes de publicar",
  "Resumo das mudanças entre versões oficiais das regras, pra você não perder nada",
  "FAQ com exemplos reais de jogada em pt-BR, não só tradução literal do termo",
  "Assistente de deckbuilding com leitura de curva de custo e consistência",
  "Busca que entende contexto — sinônimo, apelido de carta ou termo em inglês acham a carta certa",
  "Curadoria de relações entre cartas (piloto, upgrade, arquétipo) mais rápida e mais completa",
];

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="max-w-3xl space-y-4">
      <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary">
        {eyebrow}
      </Badge>
      <div className="space-y-3">
        <h2 className="heading-portal text-4xl uppercase leading-none md:text-5xl">{title}</h2>
        <p className="text-soft max-w-2xl text-sm leading-7 md:text-base">{description}</p>
      </div>
    </div>
  );
}

export default function Home({ targetSection }: HomeProps) {
  const { register, isAuthenticated, user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (targetSection) {
      document.getElementById(targetSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [targetSection]);

  const submitRegister = async () => {
    await register({ displayName, email, password });
    setPassword("");
  };

  return (
    <div className="relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid-tech opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-20" />

      <AppTopNav />

      <main id="topo">
        <section className="relative isolate overflow-hidden">
          <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1760px] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-20">
            <div className="relative z-10 space-y-8">
              <div className="space-y-5">
                <Badge className="rounded-none border border-accent/50 bg-accent/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-accent">
                  Base tática da comunidade BR
                </Badge>
                <h1 className="title-glow heading-portal max-w-4xl text-6xl uppercase leading-[0.88] md:text-7xl xl:text-8xl">
                  Portal brasileiro para <span className="text-primary">jogar</span>, <span className="text-accent">estudar</span> e <span className="text-red-400">analisar</span> o Gundam TCG.
                </h1>
                <p className="text-soft max-w-2xl text-base leading-8 md:text-lg">
                  Um ecossistema unificado para regras em pt-BR, deckbuilder com estatísticas, cobertura competitiva
                  e conteúdo com vídeo — tudo num só lugar, sem precisar garimpar em cinco fóruns diferentes.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" className="rounded-none bg-primary px-8 text-primary-foreground hover:bg-primary/90">
                  <Link href="/decks">Ver decks públicos <ArrowRight className="ml-2 size-4" /></Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-none border-white/20 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"
                >
                  <Link href="/stats">Ver estatísticas públicas</Link>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["Core", "Regras + cartas + FAQ"],
                  ["Build", "Deckbuilder com validação"],
                  ["Intel", "Torneios, meta e IA"],
                ].map(([label, value]) => (
                  <div key={label} className="panel-cut surface-panel p-4 backdrop-blur-sm">
                    <p className="text-muted-portal text-xs uppercase tracking-[0.25em]">{label}</p>
                    <p className="heading-portal mt-3 text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative lg:pl-6">
              <div className="panel-cut hero-surface relative overflow-hidden border border-primary/30 p-5">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
                <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <p className="text-muted-portal text-xs uppercase tracking-[0.28em]">Combat Operations Board</p>
                    <h3 className="heading-portal mt-2 text-3xl uppercase">Frentes em operação</h3>
                  </div>
                  <Shield className="size-8 text-primary" />
                </div>

                <div className="grid gap-4">
                  {[
                    ["Database", "Catálogo completo, sempre atualizado e com backup regular"],
                    ["Editorial", "Notícias, previews, reviews e embeds de YouTube"],
                    ["Rules", "Original + tradução + exemplos práticos de jogada"],
                    ["Analytics", "Presença por cor, uso por carta, top cut e curva"],
                  ].map(([title, text], index) => (
                    <div key={title} className="panel-cut surface-strong p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-muted-portal text-[0.7rem] uppercase tracking-[0.24em]">Módulo {String(index + 1).padStart(2, "0")}</p>
                          <p className="heading-portal mt-2 text-lg font-semibold">{title}</p>
                        </div>
                        <div className="h-2 w-20 bg-slate-800">
                          <div
                            className="h-2 bg-gradient-to-r from-primary via-cyan-300 to-accent"
                            style={{ width: `${58 + index * 9}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-soft mt-3 text-sm leading-7">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="visao" className="relative mx-auto max-w-[1760px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <SectionHeading
              eyebrow="Missão"
              title="Um portal de uso constante, não só uma vitrine"
              description="A ideia é reduzir a fricção do jogador brasileiro e criar recorrência: consultar uma ruling, montar um deck, analisar o meta, ver um vídeo e voltar no dia seguinte para comparar o próximo evento."
            />

            <div className="grid gap-4 md:grid-cols-3">
              {pillars.map((pillar) => (
                <Card key={pillar.code} className="panel-cut rounded-none surface-panel backdrop-blur-xl">
                  <CardContent className="p-6">
                    <p className="text-sm uppercase tracking-[0.28em] text-primary">Setor {pillar.code}</p>
                    <h3 className="mt-5 text-3xl uppercase leading-none">{pillar.title}</h3>
                    <p className="text-soft mt-4 text-sm leading-7">{pillar.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="modulos" className="mx-auto max-w-[1760px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="flex flex-col gap-10">
            <SectionHeading
              eyebrow="Módulos"
              title="A fundação do ecossistema"
              description="Cada frente do portal já tem seu espaço: aprendizado, deckbuilding, competitivo e conteúdo editorial — com mais recursos chegando a cada atualização."
            />

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <Card key={module.title} className="panel-cut rounded-none surface-panel nav-hover-soft transition duration-300 hover:-translate-y-1 hover:border-primary/40">
                    <CardContent className="p-6">
                      <div className="flex size-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
                        <Icon className="size-7" />
                      </div>
                      <h3 className="mt-6 text-3xl uppercase leading-none">{module.title}</h3>
                      <p className="text-soft mt-4 text-sm leading-7">{module.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section id="arquitetura" className="mx-auto max-w-[1760px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionHeading
              eyebrow="Confiabilidade"
              title="Uma base pensada pra não te deixar na mão"
              description="Cara profissional com processo por trás: cada atualização é testada antes de ir pro ar, o catálogo tem cópia de segurança regular, e toda curadoria de dado passa por revisão antes de virar informação confirmada no site."
            />

            <div className="grid gap-4">
              {[
                { icon: Database, label: "Dados", text: "Catálogo com histórico de mudanças e backup regular — nada some de uma hora pra outra." },
                { icon: Globe, label: "Experiência", text: "Interface rápida, com a mesma qualidade em celular, tablet ou computador." },
                { icon: BrainCircuit, label: "Inteligência", text: "Tradução, resumo de novidades e busca inteligente — sempre com revisão humana antes de publicar." },
                { icon: Swords, label: "Evolução", text: "A mesma base já sustenta deckbuilder e torneios, e vai sustentar o simulador de partidas quando chegar." },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="panel-cut grid gap-4 surface-panel p-5 md:grid-cols-[72px_1fr]">
                    <div className="flex size-[72px] items-center justify-center border surface-strong text-primary">
                      <Icon className="size-8" />
                    </div>
                    <div>
                      <p className="text-muted-portal text-xs uppercase tracking-[0.26em]">{item.label}</p>
                      <p className="heading-portal mt-2 text-2xl uppercase">{item.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="ia" className="relative overflow-hidden border-y border-white/10 bg-slate-950/60 light:bg-slate-100/80">
          <div className="mx-auto max-w-[1760px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <SectionHeading
                eyebrow="Curadoria com IA"
                title="IA a serviço de quem joga"
                description="A IA aqui não é enfeite: ela ajuda a manter regras e cartas traduzidas com mais precisão, conteúdo publicado mais rápido e busca que realmente entende o que você quer encontrar."
              />

              <div className="grid gap-4 md:grid-cols-2">
                {aiUseCases.map((useCase, index) => (
                  <div key={useCase} className={cn("panel-cut border p-5 nav-hover-soft", index % 2 === 0 ? "border-primary/30 bg-primary/8 light:bg-primary/10" : "surface-panel")}>
                    <div className="flex items-center gap-3">
                      {index % 2 === 0 ? <Bot className="size-5 text-primary" /> : <Sparkles className="size-5 text-accent" />}
                      <p className="text-muted-portal text-xs uppercase tracking-[0.26em]">Fluxo IA {String(index + 1).padStart(2, "0")}</p>
                    </div>
                    <p className="heading-portal mt-4 text-lg leading-7">{useCase}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="roadmap" className="mx-auto max-w-[1760px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <SectionHeading
              eyebrow="Roadmap"
              title="Execução em fases, sem perder a ambição"
              description="A ideia não é tentar construir tudo de uma vez. É montar uma fundação que já pareça produto profissional e ir adicionando camadas sem quebrar o que vier antes."
            />

            <div className="space-y-4">
              {roadmap.map((item, index) => (
                <div key={item} className="panel-cut grid gap-4 surface-panel p-5 md:grid-cols-[88px_1fr] md:items-center">
                  <div className="border border-accent/40 bg-accent/10 px-4 py-6 text-center">
                    <p className="font-heading text-4xl leading-none text-accent">{String(index + 1).padStart(2, "0")}</p>
                  </div>
                  <p className="heading-portal text-xl uppercase">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cadastro" className="mx-auto max-w-[1760px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="panel-cut hero-surface border border-primary/30 p-8 lg:p-10">
              <p className="text-xs uppercase tracking-[0.26em] text-primary">Cadastro público</p>
              <h2 className="heading-portal mt-3 text-5xl uppercase leading-none">Crie sua conta e comece agora.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                Cadastro rápido, sem enrolação. Você cria a conta, cai direto no seu perfil e já pode começar a salvar decks e publicar links pra compartilhar suas listas.
              </p>
              {isAuthenticated ? (
                <div className="mt-6 panel-cut surface-panel p-5">
                  <p className="text-soft text-sm leading-7">Sessão ativa como <span className="text-white">{user?.displayName}</span>.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"><Link href="/profile">Abrir meu perfil</Link></Button>
                    <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"><Link href="/deckbuilder">Criar deck</Link></Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nome de exibição" className="field-shell md:col-span-2" />
                  <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Seu melhor email" className="field-shell" />
                  <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Criar senha" className="field-shell" />
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <Button className="rounded-none bg-accent text-accent-foreground hover:bg-accent/90" onClick={submitRegister}>Criar conta agora</Button>
                    <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"><Link href="/decks">Explorar antes</Link></Button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4">
              {[
                ["Perfil público", "Username único, bio editável e vitrine de decks publicados."],
                ["Compartilhar decks", "Gere um link público pra divulgar sua lista — quem só quer ver não precisa nem criar conta."],
                ["Fluxo simples", "Crie a conta, ajuste seu perfil e publique direto pelo deckbuilder."],
              ].map(([title, text], index) => (
                <Card key={title} className={cn("panel-cut rounded-none border", index === 0 ? "border-primary/30 bg-primary/8 light:bg-primary/10" : "surface-panel")}>
                  <CardContent className="p-6">
                    <p className="text-muted-portal text-xs uppercase tracking-[0.24em]">Acesso {String(index + 1).padStart(2, "0")}</p>
                    <h3 className="mt-3 text-3xl uppercase leading-none">{title}</h3>
                    <p className="text-soft mt-4 text-sm leading-7">{text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1760px] px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="panel-cut hero-surface border border-primary/30 p-8 lg:p-10">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_auto] lg:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-primary">Já dá pra jogar</p>
                <h2 className="heading-portal mt-3 text-5xl uppercase leading-none">Catálogo, regras e deckbuilder de pé pra você usar hoje.</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                  Enquanto novas frentes chegam — analytics de torneio, conteúdo em vídeo, simulador de partidas — o essencial já está pronto: consulte cartas, monte seu deck e acompanhe as regras em pt-BR sem sair do portal.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button asChild className="rounded-none bg-accent text-accent-foreground hover:bg-accent/90">
                  <Link href="/decks">Ver decks públicos</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">
                  <Link href="/sets">Explorar coleções</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950/70 light:border-slate-300/80 light:bg-white/82">
        <div className="mx-auto flex max-w-[1760px] flex-col gap-6 px-4 py-8 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 dark:text-slate-400 light:text-slate-600">
          <div>
            <p className="heading-portal font-heading text-xl uppercase tracking-[0.16em]">Portal Gundam TCG BR</p>
            <p className="mt-2 max-w-2xl leading-7">
              Projeto de comunidade voltado ao público brasileiro. Regras, nomes e materiais oficiais devem sempre manter referência clara às fontes originais.
            </p>
          </div>
          <div className="min-w-[280px]">
            <Separator className="mb-4 bg-white/10 lg:hidden" />
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Feito pela comunidade</p>
            <p className="heading-portal mt-2">Catálogo oficial · Regras em pt-BR · Deckbuilder</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
