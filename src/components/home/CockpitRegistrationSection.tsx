import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Lock,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Swords,
  User,
  UserCheck,
  Zap,
} from "lucide-react";

import cockpitImg from "@/assets/home/gundam_cockpit_interior.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function CockpitRegistrationSection() {
  const { user, isAuthenticated, register, loginWithGoogle } = useAuth();
  const [, navigate] = useLocation();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  // Inicializa o Google Identity Services para cadastro/login social
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || isAuthenticated) return;
    const scriptId = "google-identity-services";

    const initialize = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleButtonRef.current) return;

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          setLoading(true);
          setErrorMessage(null);
          loginWithGoogle(response.credential)
            .then(() => {
              toast.success("Login com Google realizado com sucesso!");
            })
            .catch((err: any) => {
              const msg = err?.message || "Erro na autenticação social Google.";
              setErrorMessage(msg);
              toast.error(msg);
            })
            .finally(() => setLoading(false));
        },
      });

      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: 280,
        locale: "pt-BR",
        text: "signup_with",
      });
    };

    if (document.getElementById(scriptId)) {
      initialize();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    document.head.appendChild(script);
  }, [isAuthenticated, loginWithGoogle]);

  // Cálculo de Força da Senha
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    if (password.length < 6) {
      return { score: 1, label: "Senha Fraca (mínimo 6 caracteres)", color: "text-red-400 bg-red-500" };
    }
    const hasNumbers = /\d/.test(password);
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if (password.length >= 8 && hasNumbers && hasLetters && hasSpecial) {
      return { score: 3, label: "Senha Forte e Segura", color: "text-emerald-400 bg-emerald-500" };
    }
    if (password.length >= 6 && hasNumbers && hasLetters) {
      return { score: 2, label: "Senha Razoável", color: "text-amber-400 bg-amber-500" };
    }
    return { score: 1, label: "Senha Fraca (adicione números ou símbolos)", color: "text-red-400 bg-red-500" };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = displayName.trim();
    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    // Validações de campos obrigatórios
    if (!cleanName) {
      const msg = "Por favor, informe seu nome de piloto.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      const msg = "Por favor, informe um endereço de email válido.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!cleanPass || cleanPass.length < 6) {
      const msg = "A senha deve conter no mínimo 6 caracteres.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      await register({
        displayName: cleanName,
        email: cleanEmail,
        password: cleanPass,
      });
      toast.success(`Credenciais ativadas! Bem-vindo à cabine, ${cleanName}.`);
    } catch (err: any) {
      const rawMsg = err?.message || "";
      let friendlyMsg = "Falha ao registrar conta de piloto.";

      if (rawMsg.toLowerCase().includes("já cadastrado") || rawMsg.toLowerCase().includes("already") || rawMsg.includes("409")) {
        friendlyMsg = "Este email já possui uma conta de piloto cadastrada no sistema. Tente fazer login.";
      } else if (rawMsg) {
        friendlyMsg = rawMsg;
      }

      setErrorMessage(friendlyMsg);
      toast.error(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="cockpit-registro" className="relative border-t border-white/10 bg-slate-950 py-12 sm:py-20 overflow-hidden">
      {/* Background tático com padrão grid sutil */}
      <div className="pointer-events-none absolute inset-0 bg-grid-tech opacity-30" />
      <div className="pointer-events-none absolute -right-20 top-1/2 size-96 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-slate-950/90 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] xl:grid-cols-[1.2fr_0.8fr]">
            {/* LADO ESQUERDO: IMAGEM CINEMATOGRÁFICA DA CABINE DO GUNDAM */}
            <div className="relative min-h-[380px] sm:min-h-[460px] lg:min-h-full overflow-hidden bg-slate-950 group">
              <img
                src={cockpitImg}
                alt="Cabine vazia de Mobile Suit Gundam esperando por piloto"
                className="size-full object-cover object-center transition-transform duration-1000 group-hover:scale-105"
              />

              {/* Overlays graduais para imersão e legibilidade */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-950/90 hidden lg:block" />

              {/* Elementos HUD Táticos sobrepostos na Cabine */}
              <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 z-10 pointer-events-none">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-black/60 border border-cyan-400/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300 backdrop-blur-md">
                    SISTEMA OPERACIONAL EFGF // HUD ATIVO
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 font-mono text-[10px] text-emerald-400 backdrop-blur-md">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                    CABINE DISPONÍVEL
                  </span>
                </div>

                <div className="space-y-2 max-w-md">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-amber-400 animate-pulse" />
                    <span className="font-mono text-xs uppercase tracking-widest text-amber-400 font-bold">
                      Assento de Combate Desocupado
                    </span>
                  </div>
                  <h3 className="font-heading text-2xl sm:text-3xl uppercase text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                    O Mobile Suit aguarda suas ordens
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] leading-relaxed">
                    Acesse telemetria de combate, construa decks com validação oficial e teste sua linha de manobra em duelos solo ou contra outros pilotos.
                  </p>
                </div>
              </div>
            </div>

            {/* LADO DIREITO: FORMULÁRIO DE CADASTRO OU STATUS DO PILOTO LOGADO */}
            <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10 border-t lg:border-t-0 lg:border-l border-white/10 bg-slate-950/80">
              {isAuthenticated && user ? (
                /* Estado quando já autenticado */
                <div className="space-y-6 my-auto py-6">
                  <div className="space-y-2">
                    <Badge className="rounded-none border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                      Sessão Ativa
                    </Badge>
                    <h2 className="heading-portal font-heading text-3xl uppercase text-white">
                      Piloto conectado aos controles
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Você já está registrado e operando na cabine da Anaheim HUB com o perfil{" "}
                      <span className="text-cyan-300 font-semibold">{user.displayName}</span> ({user.email}).
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                        <UserCheck className="size-5" />
                      </div>
                      <div>
                        <p className="text-xs font-mono uppercase text-slate-400">Credencial de Hangar</p>
                        <p className="font-heading text-lg text-white uppercase">{user.displayName}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button asChild className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground text-xs uppercase tracking-[0.16em] font-semibold px-6">
                      <Link href="/simulador">
                        <Swords className="mr-2 size-4" />
                        Entrar no Simulador
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.16em] text-white hover:bg-white/10">
                      <Link href="/deckbuilder">
                        Hangar de Decks <ArrowRight className="ml-2 size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                /* Formulário de Cadastro Funcional */
                <div className="space-y-5">
                  <div>
                    <Badge className="rounded-none border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
                      Alistamento no Hangar
                    </Badge>
                    <h2 className="heading-portal font-heading text-3xl sm:text-4xl uppercase mt-2 text-white">
                      Cadastre-se aqui e pilote
                    </h2>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
                      Crie sua conta gratuitamente para salvar decks ilimitados, testar no simulador e competir na comunidade.
                    </p>
                  </div>

                  {/* Banner de Erro em Tela se houver falha ou conta existente */}
                  {errorMessage && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-950/40 p-3.5 text-xs text-red-200">
                      <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">Atenção no alistamento:</p>
                        <p className="mt-0.5 text-red-300">{errorMessage}</p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Campo Nome de Piloto */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <User className="size-3.5 text-primary" /> Nome de Piloto
                      </label>
                      <Input
                        type="text"
                        value={displayName}
                        onChange={(e) => {
                          setDisplayName(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Ex: Amuro_Ray ou ComandanteZaku"
                        className="rounded-lg border-white/15 bg-slate-900/90 text-white placeholder:text-slate-500 focus:border-cyan-400 h-10"
                        required
                      />
                    </div>

                    {/* Campo Email */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Mail className="size-3.5 text-primary" /> Seu Melhor Email
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="piloto@anaheim.local"
                        className="rounded-lg border-white/15 bg-slate-900/90 text-white placeholder:text-slate-500 focus:border-cyan-400 h-10"
                        required
                      />
                    </div>

                    {/* Campo Senha com Indicador de Força */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Lock className="size-3.5 text-primary" /> Senha de Acesso
                        </label>
                        {password && (
                          <span className={cn("font-mono text-[10px] font-semibold", passwordStrength.color.split(" ")[0])}>
                            {passwordStrength.label}
                          </span>
                        )}
                      </div>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Mínimo de 6 caracteres"
                        className="rounded-lg border-white/15 bg-slate-900/90 text-white placeholder:text-slate-500 focus:border-cyan-400 h-10"
                        required
                      />

                      {/* Barra Visual de Força da Senha */}
                      {password && (
                        <div className="grid grid-cols-3 gap-1 pt-1">
                          <div className={cn("h-1 rounded-full", passwordStrength.score >= 1 ? passwordStrength.color.split(" ")[1] : "bg-white/10")} />
                          <div className={cn("h-1 rounded-full", passwordStrength.score >= 2 ? passwordStrength.color.split(" ")[1] : "bg-white/10")} />
                          <div className={cn("h-1 rounded-full", passwordStrength.score >= 3 ? passwordStrength.color.split(" ")[1] : "bg-white/10")} />
                        </div>
                      )}
                    </div>

                    {/* Botão de Envio do Formulário */}
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-none bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs uppercase tracking-[0.18em] h-11 shadow-lg shadow-primary/25 mt-2"
                    >
                      {loading ? "Registrando Piloto..." : "Assumir a Cabine (Criar Conta)"}
                    </Button>
                  </form>

                  {/* Divisor para Opção Social */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-slate-950 px-3 text-slate-500 font-mono text-[10px]">
                        Ou acesse via login social
                      </span>
                    </div>
                  </div>

                  {/* Container para o Botão do Google Identity Services */}
                  <div className="flex flex-col items-center justify-center pt-1">
                    <div ref={googleButtonRef} className="min-h-[40px] flex items-center justify-center" />
                  </div>

                  {/* Atalho para quem já tem conta */}
                  <p className="text-center text-xs text-slate-400 pt-2 border-t border-white/5">
                    Já possui registro militar?{" "}
                    <Link href="/auth?mode=login" className="text-primary hover:underline font-semibold">
                      Faça login no Hangar
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
