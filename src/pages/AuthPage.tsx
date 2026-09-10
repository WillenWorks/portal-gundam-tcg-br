/* Auth pública v9.0 (Versão 1.2.0) — login/cadastro com feedback visual imediato,
 * overlay de carregamento e tratamento explícito de respostas de erro da API. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AlertCircle, Loader2, LogIn, UserPlus } from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { RequestLoadingOverlay } from "@/components/layout/RequestLoadingOverlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

function getInitialMode() {
  if (typeof window === "undefined") return "login" as const;
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "register" ? ("register" as const) : ("login" as const);
}

export default function AuthPage() {
  const { login, register, loginWithGoogle, isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">(() => getInitialMode());
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(import.meta.env.DEV ? "pilot@gundambr.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "pilot123" : "");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const eyebrow = useMemo(() => (mode === "login" ? "Acesso ao Hangar" : "Alistamento de Piloto"), [mode]);
  const title = useMemo(() => (mode === "login" ? "Entrar" : "Criar conta"), [mode]);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

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
            .catch((err: any) => {
              const msg = err?.message || "Erro ao entrar com Google.";
              setErrorMessage(msg);
              toast.error(msg);
            })
            .finally(() => setLoading(false));
        },
      });
      google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", width: 320, locale: "pt-BR" });
    };
    if (document.getElementById(scriptId)) { initialize(); return; }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    document.head.appendChild(script);
  }, [isAuthenticated, loginWithGoogle]);

  useEffect(() => {
    if (isAuthenticated) navigate("/portal", { replace: true });
  }, [isAuthenticated, navigate]);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      const msg = "Por favor, preencha email e senha.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (mode === "register" && !displayName.trim()) {
      const msg = "Por favor, informe seu nome de exibição.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(cleanEmail, cleanPassword);
      } else {
        await register({ displayName: displayName.trim(), email: cleanEmail, password: cleanPassword });
      }
    } catch (err: any) {
      const msg = err?.message || (mode === "login" ? "Credenciais incorretas ou falha no servidor." : "Falha ao criar conta.");
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell
      breadcrumbs={[{ label: "Login" }]}
      title={title}
      description="Acesse o hangar do Asticassia Hub para gerenciar seus decks, coleções e disputar partidas."
    >
      <RequestLoadingOverlay
        visible={loading}
        label={mode === "login" ? "Autenticando piloto..." : "Criando credenciais de piloto..."}
        sublabel="Conectando à base Asticassia"
      />

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-5 p-6 lg:p-8">
            <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">
              {eyebrow}
            </Badge>

            <div>
              <h2 className="mt-4 font-heading text-5xl uppercase leading-none">{title}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                {mode === "login"
                  ? "Informe seus dados de acesso para carregar sua coleção, decks salvos e histórico de combate."
                  : "Crie sua conta gratuitamente e comece a montar listas competitivas e disputar partidas online."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant={mode === "login" ? "default" : "outline"}
                className="rounded-none text-xs uppercase tracking-[0.14em]"
                onClick={() => { setMode("login"); setErrorMessage(null); }}
                disabled={loading}
              >
                <LogIn className="mr-1.5 size-3.5" />
                Login
              </Button>
              <Button
                type="button"
                variant={mode === "register" ? "default" : "outline"}
                className="rounded-none text-xs uppercase tracking-[0.14em]"
                onClick={() => { setMode("register"); setErrorMessage(null); }}
                disabled={loading}
              >
                <UserPlus className="mr-1.5 size-3.5" />
                Criar conta
              </Button>
            </div>

            {/* Alerta de erro de resposta do servidor */}
            {errorMessage ? (
              <div className="panel-cut flex items-start gap-3 border border-red-500/50 bg-red-950/50 p-4 text-red-200">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
                <div className="text-sm leading-6">
                  <p className="font-semibold text-red-300">Não foi possível prosseguir:</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            ) : null}

            <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
              {mode === "register" ? (
                <Input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Nome de exibição / Piloto"
                  className="field-shell md:col-span-2"
                  disabled={loading}
                  autoComplete="name"
                />
              ) : null}
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Seu email"
                className="field-shell"
                type="email"
                disabled={loading}
                autoComplete="email"
              />
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Sua senha"
                className="field-shell"
                disabled={loading}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />

              <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
                <Button
                  type="submit"
                  className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Processando...
                    </>
                  ) : mode === "login" ? (
                    "Entrar no painel"
                  ) : (
                    "Criar conta e entrar"
                  )}
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.14em] text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"
                >
                  <Link href="/decks">Explorar decks públicos</Link>
                </Button>
              </div>
            </form>

            {GOOGLE_CLIENT_ID ? (
              <div className="space-y-3 border-t border-white/10 pt-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">ou entre com</p>
                <div ref={googleButtonRef} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Recursos de Piloto</p>
              <h3 className="mt-3 font-heading text-3xl uppercase">Tudo em um só lugar</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                Salve suas listas, acompanhe a curva de custos com validação oficial em tempo real, organize suas cartas na pasta virtual e enfrente adversários na arena.
              </p>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Sessão atual</p>
              {isAuthenticated ? (
                <>
                  <h3 className="mt-3 font-heading text-3xl uppercase">Você já está autenticado</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                    Sessão ativa como <span className="font-semibold text-primary">{user?.displayName}</span>.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
                      <Link href="/profile">Abrir perfil</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mt-3 font-heading text-3xl uppercase">Acesso Seguro</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                    Cadastre-se com email e senha ou utilize sua conta Google. Suas credenciais e decks ficam sincronizados em nuvem.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
