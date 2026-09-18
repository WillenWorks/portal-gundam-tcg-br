/* Hub Zero Terminal & Chatbot Tático — Central de Inteligência ZERO SYSTEM (docs/54, docs/55)
 * Acessível em /zero
 * Design: Computador Central do Wing Zero / Hangar Tático Anaheim Electronics
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  Send,
  Sparkles,
  Zap,
  Shield,
  Target,
  RefreshCw,
  Radio,
  BookOpen,
  Sword,
  Bot,
  Layers,
  Terminal,
  Cpu,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Flame,
} from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, type PilotPersonaId, type ZeroChatMessageResponse } from "@/lib/api";

interface ChatMessage {
  id: string;
  sender: "user" | "zero";
  persona?: PilotPersonaId;
  text: string;
  timestamp: string;
  provider?: string;
  references?: string[];
}

const PERSONA_DETAILS: Record<
  PilotPersonaId,
  {
    id: PilotPersonaId;
    name: string;
    callsign: string;
    title: string;
    faction: string;
    description: string;
    accentColor: string;
    bgHover: string;
    badgeCls: string;
    borderCls: string;
    avatarLetter: string;
    starterPrompt: string;
  }
> = {
  adaptive: {
    id: "adaptive",
    name: "Zero Core Adaptativo",
    callsign: "SYSTEM-ZERO",
    title: "IA Neural Central Híbrida",
    faction: "ANAHEIM ELECTRONICS",
    description: "Alterna automaticamente entre perfis táticos de acordo com a situação de campo e telemetria do metagame.",
    accentColor: "text-cyan-400",
    bgHover: "hover:border-cyan-500/50 hover:bg-cyan-950/20",
    badgeCls: "border-cyan-500/40 bg-cyan-950/40 text-cyan-300",
    borderCls: "border-cyan-500/40",
    avatarLetter: "Z",
    starterPrompt: "Zero System ativado. Aguardando diretrizes táticas, análise de metagame ou dúvidas de regras.",
  },
  amuro: {
    id: "amuro",
    name: "Amuro Ray",
    callsign: "WHITE-DEVIL",
    title: "Ás da Federação Terrestre",
    faction: "E.F.S.F. (Londo Bell)",
    description: "Especialista em controle defensivo de recursos, posicionamento de Blockers e viradas calculadas.",
    accentColor: "text-blue-400",
    bgHover: "hover:border-blue-500/50 hover:bg-blue-950/20",
    badgeCls: "border-blue-500/40 bg-blue-950/40 text-blue-300",
    borderCls: "border-blue-500/40",
    avatarLetter: "A",
    starterPrompt: "Amuro Ray pronto. Mantenha a cabeça fria: o segredo para vencer é não queimar recursos no início!",
  },
  char: {
    id: "char",
    name: "Char Aznable",
    callsign: "RED-COMET",
    title: "Comandante das Forças de Zeon",
    faction: "ZEON / NEO ZEON",
    description: "Especialista em velocidade extrema, decks agressivos (Rush/Aggro) e pressão direta nos escudos.",
    accentColor: "text-red-400",
    bgHover: "hover:border-red-500/50 hover:bg-red-950/20",
    badgeCls: "border-red-500/40 bg-red-950/40 text-red-300",
    borderCls: "border-red-500/40",
    avatarLetter: "C",
    starterPrompt: "Três vezes mais rápido! Não dê tempo para o oponente respirar. Qual é a estratégia de investida?",
  },
  heero: {
    id: "heero",
    name: "Heero Yuy",
    callsign: "WING-ZERO-01",
    title: "Piloto do Wing Gundam Zero",
    faction: "COLONIES / OPERATION METEOR",
    description: "Cálculo matemático puro de trocas no combate, aniquilação de unidades exauridas e determinação de letal.",
    accentColor: "text-emerald-400",
    bgHover: "hover:border-emerald-500/50 hover:bg-emerald-950/20",
    badgeCls: "border-emerald-500/40 bg-emerald-950/40 text-emerald-300",
    borderCls: "border-emerald-500/40",
    avatarLetter: "H",
    starterPrompt: "Missão aceita. Analisando probabilidades de destruição e linhas de letal. Apresente seus parâmetros.",
  },
  analyst: {
    id: "analyst",
    name: "Analista Tático OZ",
    callsign: "ANAHEIM-INTEL",
    title: "Engenheiro de Rulings & Regras",
    faction: "ANAHEIM / OZ HEADQUARTERS",
    description: "Enciclopédia de regras oficiais Bandai, resolução do timing de 【Burst】, legalidade de alvos e metagame regional.",
    accentColor: "text-amber-400",
    bgHover: "hover:border-amber-500/50 hover:bg-amber-950/20",
    badgeCls: "border-amber-500/40 bg-amber-950/40 text-amber-300",
    borderCls: "border-amber-500/40",
    avatarLetter: "OZ",
    starterPrompt: "Terminal de Rulings conectado à base de dados oficial. Como posso esclarecer o texto ou resolução de efeitos?",
  },
};

const SUGGESTED_QUESTIONS = [
  "Como responder a um ataque quando tenho uma unidade com Blocker?",
  "Qual a sequência exata de ativação de efeitos 【Burst】 no escudo?",
  "Como counterar estratégias Rush da Zeon jogando com deck Azul?",
  "Qual a proporção recomendada de Unidades, Pilotos e Comandos num deck?",
  "Como funciona a prioridade e timing da habilidade Link de Piloto?",
  "Como funciona o Sideboard no formato competitivo Bo3?",
];

export default function ZeroTerminalPage() {
  const [activePersona, setActivePersona] = useState<PilotPersonaId>("adaptive");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "msg-welcome",
      sender: "zero",
      persona: "adaptive",
      text: PERSONA_CONFIGS_FALLBACK("adaptive"),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      provider: "deterministic",
      references: ["Manual Oficial Bandai GCG", "Glossário Tático Anaheim"],
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  function PERSONA_CONFIGS_FALLBACK(p: PilotPersonaId) {
    return PERSONA_DETAILS[p]?.starterPrompt || "Zero System conectado.";
  }

  // Scroll suave ao final da conversa
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSelectPersona = (p: PilotPersonaId) => {
    setActivePersona(p);
    setMessages((prev) => [
      ...prev,
      {
        id: `persona-switch-${Date.now()}`,
        sender: "zero",
        persona: p,
        text: PERSONA_DETAILS[p].starterPrompt,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        provider: "deterministic",
      },
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);

    try {
      const response: ZeroChatMessageResponse = await api.sendZeroChatMessage(text, activePersona);
      const zeroMsg: ChatMessage = {
        id: `zero-${Date.now()}`,
        sender: "zero",
        persona: response.persona || activePersona,
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        provider: response.provider,
        references: response.references,
      };
      setMessages((prev) => [...prev, zeroMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `zero-err-${Date.now()}`,
          sender: "zero",
          persona: activePersona,
          text: "Telemetria momentaneamente instável. Por favor, reenvie a instrução tática.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          provider: "deterministic",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const activeMeta = PERSONA_DETAILS[activePersona];

  return (
    <PublicShell>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Banner Hero Estilo Computador Central Wing Zero */}
        <div className="relative overflow-hidden border border-cyan-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 p-6 md:p-8 panel-cut shadow-2xl">
          {/* Efeito sutil de scanline CRT */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 border border-cyan-400/50 bg-cyan-950/60 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-widest text-cyan-300 panel-cut">
                  <Cpu className="size-3.5 text-cyan-400" />
                  CENTRAL ZERO TERMINAL
                </span>
                <span className="inline-flex items-center gap-1 border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-[11px] font-mono text-emerald-300">
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  STATUS: OPERACIONAL
                </span>
                <span className="inline-flex items-center gap-1 border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-400">
                  RAG INDEX: v2.0
                </span>
              </div>

              <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white">
                ZERO SYSTEM <span className="text-cyan-400">INTELLIGENCE</span>
              </h1>
              <p className="text-sm md:text-base text-slate-300 max-w-2xl leading-relaxed">
                Terminal de inteligência tática, análise probabilística de metagame e assistência conversacional de
                regras oficiais com as 4 Personas icônicas de Mobile Suit Gundam.
              </p>
            </div>

            {/* Ações Rápidas de Navegação Tática */}
            <div className="flex flex-wrap gap-2 md:flex-col shrink-0">
              <Link href="/simulador">
                <Button className="w-full justify-start rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-heading uppercase tracking-wider text-xs h-9">
                  <Sword className="mr-2 size-4" />
                  Arena Simulador
                </Button>
              </Link>
              <Link href="/deckbuilder">
                <Button
                  variant="outline"
                  className="w-full justify-start rounded-none border-cyan-500/40 bg-slate-950/60 text-cyan-300 hover:bg-cyan-500/20 font-heading uppercase tracking-wider text-xs h-9"
                >
                  <BrainCircuit className="mr-2 size-4 text-cyan-400" />
                  Hangar Deckbuilder
                </Button>
              </Link>
              <Link href="/rules">
                <Button
                  variant="outline"
                  className="w-full justify-start rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 font-heading uppercase tracking-wider text-xs h-9"
                >
                  <BookOpen className="mr-2 size-4 text-slate-300" />
                  Glossário de Regras
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Seletor de Personas Táticas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Radio className="size-4 text-cyan-400" />
              Seletor de Personas Táticas
            </h2>
            <span className="text-xs font-mono text-cyan-400/80">Canal Ativo: {activeMeta.callsign}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(["adaptive", "amuro", "char", "heero", "analyst"] as PilotPersonaId[]).map((pid) => {
              const meta = PERSONA_DETAILS[pid];
              const isSelected = activePersona === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => handleSelectPersona(pid)}
                  data-testid={`zero-persona-btn-${pid}`}
                  className={`p-3 text-left border transition-all panel-cut flex flex-col justify-between ${
                    isSelected
                      ? `border-cyan-400 bg-cyan-950/40 shadow-md shadow-cyan-500/20 ${meta.borderCls}`
                      : `border-white/10 bg-slate-900/60 text-slate-400 ${meta.bgHover}`
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-mono font-bold tracking-widest ${meta.accentColor}`}>
                        {meta.callsign}
                      </span>
                      <span className={`size-2 rounded-full ${isSelected ? "bg-cyan-400 animate-pulse" : "bg-slate-700"}`} />
                    </div>
                    <p className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                      {meta.name}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">
                      {meta.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {meta.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-slate-500">
                    <span>{meta.faction}</span>
                    <ChevronRight className={`size-3 ${isSelected ? "text-cyan-400" : ""}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grade Central: Chatbot Tático + Diagnósticos de Telemetria */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Console de Chat em Tempo Real */}
          <div className="lg:col-span-8 flex flex-col h-[650px] border border-cyan-500/30 bg-slate-950/95 panel-cut overflow-hidden shadow-2xl">
            {/* Header do Chat */}
            <div className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-900/80 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`size-8 rounded-none border flex items-center justify-center font-heading font-black text-sm bg-slate-950 ${activeMeta.borderCls} ${activeMeta.accentColor}`}
                >
                  {activeMeta.avatarLetter}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-heading text-sm font-bold uppercase tracking-wide text-white`}>
                      {activeMeta.name}
                    </span>
                    <Badge variant="outline" className={`text-[9px] font-mono px-1.5 py-0 ${activeMeta.badgeCls}`}>
                      {activeMeta.callsign}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">{activeMeta.faction}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 h-7"
                  onClick={() =>
                    setMessages([
                      {
                        id: `reset-${Date.now()}`,
                        sender: "zero",
                        persona: activePersona,
                        text: PERSONA_DETAILS[activePersona].starterPrompt,
                        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        provider: "deterministic",
                      },
                    ])
                  }
                >
                  <RefreshCw className="size-3 mr-1" />
                  Limpar Canal
                </Button>
              </div>
            </div>

            {/* Feed de Mensagens */}
            <div
              data-testid="zero-chat-feed"
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/50"
            >
              {messages.map((msg) => {
                const isZero = msg.sender === "zero";
                const pMeta = msg.persona ? PERSONA_DETAILS[msg.persona] : activeMeta;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isZero ? "items-start" : "items-end"}`}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1 text-[10px] font-mono text-slate-500">
                      <span>{isZero ? `${pMeta?.name || "Zero System"} · ${pMeta?.callsign || "CORE"}` : "Você (Piloto)"}</span>
                      <span>·</span>
                      <span>{msg.timestamp}</span>
                      {msg.provider && (
                        <span className="uppercase text-[9px] text-cyan-400/80">[{msg.provider}]</span>
                      )}
                    </div>

                    <div
                      className={`max-w-[85%] p-3.5 text-xs sm:text-sm leading-relaxed panel-cut ${
                        isZero
                          ? `border bg-slate-900/90 text-slate-200 border-cyan-500/30 ${pMeta?.borderCls || ""}`
                          : "border border-primary/40 bg-primary/20 text-white font-medium shadow-md shadow-primary/10"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>

                      {/* Fontes de RAG / Rulings consultadas */}
                      {msg.references && msg.references.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <span className="text-cyan-400 font-bold uppercase tracking-wider">Fontes:</span>
                          {msg.references.map((ref, idx) => (
                            <span key={idx} className="border border-white/10 bg-white/5 px-1.5 py-0.5 rounded-none">
                              {ref}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {/* Indicador de Digitação / Pensamento da IA */}
              {loading && (
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 p-2 bg-cyan-950/20 border border-cyan-500/20 panel-cut max-w-xs">
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Consultando rede neural & rulings...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chips de Perguntas Rápidas */}
            <div className="border-t border-cyan-500/20 bg-slate-900/60 p-2.5 overflow-x-auto custom-scrollbar flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0 flex items-center gap-1">
                <Sparkles className="size-3 text-cyan-400" />
                Dúvidas Frequentes:
              </span>
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  disabled={loading}
                  className="shrink-0 text-[11px] px-2.5 py-1 border border-white/10 bg-slate-950/80 text-slate-300 hover:border-cyan-400/50 hover:text-white hover:bg-cyan-950/30 transition-all panel-cut"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Barra de Entrada Tática */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="flex items-center gap-2 border-t border-cyan-500/20 bg-slate-950 p-3"
            >
              <Input
                data-testid="zero-chat-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Pergunte sobre regras, combate ou metagame para ${activeMeta.name}...`}
                disabled={loading}
                className="rounded-none border-white/15 bg-slate-900/80 text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-0 text-xs sm:text-sm h-10"
              />
              <Button
                type="submit"
                data-testid="zero-chat-send"
                disabled={loading || !inputValue.trim()}
                className="rounded-none bg-cyan-600 hover:bg-cyan-500 text-white font-heading font-bold uppercase tracking-wider h-10 px-4 shrink-0 shadow-md shadow-cyan-600/30"
              >
                <Send className="size-4 mr-1.5" />
                Enviar
              </Button>
            </form>
          </div>

          {/* Painel Lateral: Telemetria do Sistema & Diretrizes */}
          <div className="lg:col-span-4 space-y-4">
            {/* Status do Computador Central */}
            <div className="border border-white/10 bg-slate-950/90 p-4 panel-cut space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Terminal className="size-4 text-cyan-400" />
                  Telemetria Anaheim
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">ONLINE</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Motor de Regras:</span>
                  <span className="font-mono font-bold text-white">GCG v1.20 (Oficial)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Coleções Mapeadas:</span>
                  <span className="font-mono text-cyan-400 font-bold">GD01, GD02, ST01–ST06</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Formato Competitivo:</span>
                  <span className="font-mono text-white">Bo1 & Bo3 (Sideboard)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Latência Neural:</span>
                  <span className="font-mono text-emerald-400">14ms</span>
                </div>
              </div>
            </div>

            {/* Destaque da Persona Ativa */}
            <div className={`border p-4 panel-cut space-y-2.5 bg-slate-900/70 ${activeMeta.borderCls}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-heading font-bold uppercase tracking-wider ${activeMeta.accentColor}`}>
                  Diretriz Ativa: {activeMeta.name}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-white/20 pl-2.5">
                &ldquo;{activeMeta.description}&rdquo;
              </p>
              <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 space-y-1">
                <p>
                  <strong>Foco de Matchup:</strong>{" "}
                  {activePersona === "amuro"
                    ? "Contenção de Aggro e Midrange"
                    : activePersona === "char"
                      ? "Ataque rápido e quebra de bases"
                      : activePersona === "heero"
                        ? "Otimização de letal e remoção"
                        : activePersona === "analyst"
                          ? "Resolução estrita de regras e timing"
                          : "Equilíbrio geral adaptativo"}
                </p>
              </div>
            </div>

            {/* Links Rápidos do Ecossistema */}
            <div className="border border-white/10 bg-slate-900/50 p-4 panel-cut space-y-2">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-slate-400">
                Atalhos do Zero System
              </span>

              <div className="space-y-1 pt-1">
                <Link
                  href="/simulador"
                  className="flex items-center justify-between p-2 text-xs border border-white/5 bg-slate-950/60 text-slate-300 hover:border-cyan-500/40 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sword className="size-3.5 text-cyan-400" />
                    Zero Coach na Arena
                  </span>
                  <ChevronRight className="size-3 text-slate-500" />
                </Link>

                <Link
                  href="/deckbuilder"
                  className="flex items-center justify-between p-2 text-xs border border-white/5 bg-slate-950/60 text-slate-300 hover:border-cyan-500/40 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <BrainCircuit className="size-3.5 text-cyan-400" />
                    Zero Copilot no Deckbuilder
                  </span>
                  <ChevronRight className="size-3 text-slate-500" />
                </Link>

                <Link
                  href="/stats"
                  className="flex items-center justify-between p-2 text-xs border border-white/5 bg-slate-950/60 text-slate-300 hover:border-cyan-500/40 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Zap className="size-3.5 text-amber-400" />
                    Zero Foresight (Metagame)
                  </span>
                  <ChevronRight className="size-3 text-slate-500" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
