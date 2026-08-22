/* Auth pública v8.1 — login/cadastro no site sem sidebar privada. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

// Só definida em ambientes com o Google OAuth configurado (ver docs/15-deploy-e-login-google.md)
// — sem isso, o botão simplesmente não aparece, não quebra nada pra quem não configurou ainda.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

function getInitialMode() {
  if (typeof window === "undefined") return "login" as const;
  // Lê da URL real (?mode=register), não do hash -- ver src/lib/hashLocationWithQuery.ts.
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "register" ? "register" as const : "login" as const;
}

export default function AuthPage() {
  const { login, register, loginWithGoogle, isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">(() => getInitialMode());
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(import.meta.env.DEV ? "pilot@gundambr.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "pilot123" : "");
  const eyebrow = useMemo(() => (mode === "login" ? "Acesso ao painel" : "Cadastro público"), [mode]);
  const title = useMemo(() => (mode === "login" ? "Entrar" : "Criar conta"), [mode]);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  // Carrega o script do Google Identity Services só quando necessário — condicional a
  // ter client ID configurado e o usuário ainda não estar logado. Renderiza o botão
  // oficial do Google no div de referência (googleButtonRef) via API deles.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || isAuthenticated) return;
    const scriptId = "google-identity-services";
    const initialize = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleButtonRef.current) return;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          loginWithGoogle(response.credential).catch((err: any) => toast.error(err?.message || "Erro ao entrar com Google."));
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
  }, [isAuthenticated]);

  // Assim que autentica (login normal ou Google), cai direto na Minha Área -- antes
  // ficava parado na propria tela de login sem redirecionamento nenhum.
  useEffect(() => {
    if (isAuthenticated) navigate("/portal", { replace: true });
  }, [isAuthenticated, navigate]);

  const submit = async () => {
    if (mode === "login") {
      await login(email, password);
      return;
    }
    await register({ displayName, email, password });
  };

  return (
    <PublicShell breadcrumbs={[{ label: "Login" }]} title="Login" description="Tela pública de autenticação. A sidebar só existe depois do login, dentro do painel privado.">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-5 p-6 lg:p-8">
            <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">{eyebrow}</Badge>
            <div>
              <h2 className="mt-4 font-heading text-5xl uppercase leading-none">{title}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">O acesso ao painel acontece a partir desta tela pública. Depois de autenticado, o usuário entra no dashboard com menu lateral próprio.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant={mode === "login" ? "default" : "outline"} className="rounded-none" onClick={() => setMode("login")}>Login</Button>
              <Button type="button" variant={mode === "register" ? "default" : "outline"} className="rounded-none" onClick={() => setMode("register")}>Criar conta</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {mode === "register" ? <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nome de exibição" className="field-shell md:col-span-2" /> : null}
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Seu email" className="field-shell" />
              <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Sua senha" className="field-shell" />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={submit}>{mode === "login" ? "Entrar no painel" : "Criar conta e entrar"}</Button>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"><Link href="/decks">Explorar o site antes</Link></Button>
            </div>

            {GOOGLE_CLIENT_ID ? (
              <div className="space-y-3 border-t border-white/10 pt-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">ou</p>
                <div ref={googleButtonRef} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Fluxo correto</p>
              <h3 className="mt-3 font-heading text-3xl uppercase">Site público separado do painel</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">Home, decks, database, eventos e rulings ficam no site. Dashboard e admin ficam atrás do login e recebem layout próprio.</p>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Sessão atual</p>
              {isAuthenticated ? (
                <>
                  <h3 className="mt-3 font-heading text-3xl uppercase">Você já está autenticado</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">Sessão ativa como <span className="font-semibold dark:text-white light:text-slate-900">{user?.displayName}</span>.</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"><Link href="/profile">Abrir perfil</Link></Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mt-3 font-heading text-3xl uppercase">Entrada única para o dashboard</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">Sem sidebar deslogada, sem mistura de shell pública com shell privada.</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
