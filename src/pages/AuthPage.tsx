/* Auth pública v9.1 — login/cadastro com verificações completas de piloto:
 * nome completo, nome de usuário único, formato de e-mail, e-mail repetido (confirmação),
 * senha forte com PasswordStrengthMeter e reCAPTCHA Enterprise. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, LogIn, UserPlus, XCircle } from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { RequestLoadingOverlay } from "@/components/layout/RequestLoadingOverlay";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { evaluatePasswordStrength, validatePasswordStrength } from "@/lib/passwordStrength";
import { executeRecaptcha } from "@/lib/recaptcha";
import { useSiteLanguage } from "@/i18n/siteLanguage";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

function getInitialMode() {
  if (typeof window === "undefined") return "login" as const;
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "register" ? ("register" as const) : ("login" as const);
}

export default function AuthPage() {
  const { tr } = useSiteLanguage();
  const { login, register, loginWithGoogle, isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">(() => getInitialMode());

  // Campos do formulário
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(import.meta.env.DEV ? "pilot@gundambr.local" : "");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState(import.meta.env.DEV ? "pilot123" : "");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Estados de carregamento e feedback
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verificações assíncronas de disponibilidade
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const eyebrow = mode === "login" ? tr("Entrar", "Sign in") : tr(tr("Criar conta", "Create account"), "Create account");
  const title = eyebrow;
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  // Cálculos reativos
  const cleanName = displayName.trim();
  const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
  const cleanEmail = email.trim().toLowerCase();
  const cleanConfirmEmail = confirmEmail.trim().toLowerCase();

  const isEmailFormatValid = !cleanEmail || EMAIL_REGEX.test(cleanEmail);
  const isUsernameFormatValid = !cleanUsername || USERNAME_REGEX.test(cleanUsername);
  const emailsMatch = !confirmEmail || cleanEmail === cleanConfirmEmail;
  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);

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
              const msg = err?.message || tr("Erro ao entrar com Google.", "Google sign-in failed.");
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

  // Checar disponibilidade do e-mail ao sair do campo
  const handleEmailBlur = async () => {
    if (mode !== "register" || !cleanEmail || !EMAIL_REGEX.test(cleanEmail)) return;
    setEmailStatus("checking");
    try {
      const res = await api.checkAvailability({ email: cleanEmail });
      setEmailStatus(res.emailAvailable ? "available" : "taken");
    } catch {
      setEmailStatus("idle");
    }
  };

  // Checar disponibilidade do username ao sair do campo
  const handleUsernameBlur = async () => {
    if (mode !== "register" || !cleanUsername || !USERNAME_REGEX.test(cleanUsername)) return;
    setUsernameStatus("checking");
    try {
      const res = await api.checkAvailability({ username: cleanUsername });
      setUsernameStatus(res.usernameAvailable ? "available" : "taken");
    } catch {
      setUsernameStatus("idle");
    }
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (mode === "login") {
      if (!cleanEmail || !password.trim()) {
        const msg = tr("Por favor, preencha email e senha.", "Please enter your email and password.");
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      setLoading(true);
      try {
        const recaptchaToken = await executeRecaptcha("LOGIN").catch(() => null);
        await login(cleanEmail, password, recaptchaToken || undefined);
      } catch (err: any) {
        const msg = err?.message || tr("Credenciais incorretas ou falha no servidor.", "Wrong credentials or server error.");
        setErrorMessage(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Validações completas do modo Cadastro
    if (!cleanName || cleanName.length < 3) {
      const msg = tr("Informe seu nome completo (mínimo de 3 caracteres).", "Enter your full name (at least 3 characters).");
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!cleanUsername || !USERNAME_REGEX.test(cleanUsername)) {
      const msg = tr("Nome de usuário deve ter entre 3 e 30 caracteres (letras, números, _ ou -).", "Username must be 3 to 30 characters (letters, numbers, _ or -).");
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      const msg = tr("Por favor, informe um endereço de e-mail válido.", "Please enter a valid email address.");
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (cleanEmail !== cleanConfirmEmail) {
      const msg = tr("Os e-mails informados não coincidem. Verifique a confirmação.", "The emails don't match. Check the confirmation.");
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    const passValidation = validatePasswordStrength(password);
    if (!passValidation.valid) {
      const msg = passValidation.error || tr("A senha não atende aos requisitos de segurança.", "The password doesn't meet the security requirements.");
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = tr("As senhas informadas não coincidem.", "The passwords don't match.");
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const recaptchaToken = await executeRecaptcha("REGISTER").catch(() => null);
      await register({
        displayName: cleanName,
        username: cleanUsername,
        email: cleanEmail,
        password,
        recaptchaToken: recaptchaToken || undefined,
      });
      toast.success(tr(`Conta criada com sucesso! Enviamos um link de confirmação para ${cleanEmail}.`, `Account created! We sent a confirmation link to ${cleanEmail}.`));
    } catch (err: any) {
      const msg = err?.message || tr("Falha ao criar conta.", "Couldn't create the account.");
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const isRegisterValid =
    mode === "register" &&
    cleanName.length >= 3 &&
    USERNAME_REGEX.test(cleanUsername) &&
    usernameStatus !== "taken" &&
    EMAIL_REGEX.test(cleanEmail) &&
    emailStatus !== "taken" &&
    cleanEmail === cleanConfirmEmail &&
    passwordStrength.isStrong &&
    password === confirmPassword &&
    Boolean(confirmPassword);

  return (
    <PublicShell
      breadcrumbs={[{ label: mode === "login" ? tr("Login", "Sign in") : "Cadastro" }]}
      title={title}
      description={tr("Entre no AnaheimHub para gerenciar seus decks e coleções e jogar no simulador.", "Sign in to AnaheimHub to manage your decks and collections and play in the simulator.")}
    >
      <RequestLoadingOverlay
        visible={loading}
        label={mode === "login" ? tr("Entrando...", "Signing in...") : tr("Criando conta...", "Creating account...")}
        sublabel={tr("Só um instante", "Just a moment")}
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-5 p-6 lg:p-8">
            <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">
              {eyebrow}
            </Badge>

            <div>
              <h2 className="mt-4 font-heading text-4xl uppercase leading-none md:text-5xl">{title}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                {mode === "login"
                  ? tr("Informe seus dados de acesso para carregar sua coleção, decks salvos e histórico de combate.", "Enter your sign-in details to load your collection, saved decks and match history.")
                  : tr("Crie sua conta gratuitamente e comece a montar listas competitivas e disputar partidas online.", "Create a free account and start building competitive lists and playing online matches.")}
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
                {tr("Login", "Sign in")}
              </Button>
              <Button
                type="button"
                variant={mode === "register" ? "default" : "outline"}
                className="rounded-none text-xs uppercase tracking-[0.14em]"
                onClick={() => { setMode("register"); setErrorMessage(null); }}
                disabled={loading}
              >
                <UserPlus className="mr-1.5 size-3.5" />
                {tr("Criar conta", "Create account")}
              </Button>
            </div>

            {/* Alerta de erro de resposta do servidor ou validação */}
            {errorMessage ? (
              <div className="panel-cut flex items-start gap-3 border border-red-500/50 bg-red-950/50 p-4 text-red-200" role="alert">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
                <div className="text-sm leading-6">
                  <p className="font-semibold text-red-300">{tr("Não foi possível prosseguir:", "Couldn't continue:")}</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            ) : null}

            <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
              {mode === "register" ? (
                <>
                  {/* Nome Completo */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 light:text-slate-600">{tr("Nome completo", "Full name")}</label>
                    <Input
                      value={displayName}
                      onChange={(event) => { setDisplayName(event.target.value); setErrorMessage(null); }}
                      placeholder="Ex: Amuro Ray"
                      className="field-shell"
                      disabled={loading}
                      autoComplete="name"
                      aria-label={tr("Nome completo", "Full name")}
                    />
                    {displayName && displayName.trim().length < 3 ? (
                      <p className="text-[0.7rem] text-amber-400">{tr("Mínimo de 3 caracteres.", "At least 3 characters.")}</p>
                    ) : null}
                  </div>

                  {/* Nome de Usuário */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 light:text-slate-600">{tr("Nome de usuário (@)", "Username (@)")}</label>
                    <div className="relative">
                      <Input
                        value={username}
                        onChange={(event) => {
                          const val = event.target.value.replace(/\s+/g, "").toLowerCase();
                          setUsername(val);
                          setUsernameStatus("idle");
                          setErrorMessage(null);
                        }}
                        onBlur={handleUsernameBlur}
                        placeholder="Ex: amuro_ray"
                        className="field-shell"
                        disabled={loading}
                        autoComplete="username"
                        aria-label={tr("Nome de usuário", "Username")}
                      />
                      {usernameStatus === "checking" ? (
                        <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-primary" />
                      ) : null}
                    </div>
                    {username && !isUsernameFormatValid ? (
                      <p className="text-[0.7rem] text-red-400">{tr("3 a 30 caracteres (letras, números, _ ou -).", "3 to 30 characters (letters, numbers, _ or -).")}</p>
                    ) : usernameStatus === "taken" ? (
                      <p className="flex items-center gap-1 text-[0.7rem] text-red-400">
                        <XCircle className="size-3" /> {tr("Nome de usuário já em uso.", "Username already taken.")}
                      </p>
                    ) : usernameStatus === "available" ? (
                      <p className="flex items-center gap-1 text-[0.7rem] text-emerald-400">
                        <CheckCircle2 className="size-3" /> {tr("Nome de usuário disponível!", "Username available!")}
                      </p>
                    ) : (
                      <p className="text-[0.7rem] text-slate-500">Seu perfil: /u/{cleanUsername || "usuario"}</p>
                    )}
                  </div>

                  {/* E-mail */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 light:text-slate-600">{tr("E-mail", "Email")}</label>
                    <div className="relative">
                      <Input
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setEmailStatus("idle");
                          setErrorMessage(null);
                        }}
                        onBlur={handleEmailBlur}
                        placeholder="seu@email.com"
                        className="field-shell"
                        type="email"
                        disabled={loading}
                        autoComplete="email"
                        aria-label={tr("E-mail", "Email")}
                      />
                      {emailStatus === "checking" ? (
                        <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-primary" />
                      ) : null}
                    </div>
                    {email && !isEmailFormatValid ? (
                      <p className="text-[0.7rem] text-red-400">{tr("Formato de e-mail inválido.", "Invalid email format.")}</p>
                    ) : emailStatus === "taken" ? (
                      <p className="flex items-center gap-1 text-[0.7rem] text-red-400">
                        <XCircle className="size-3" /> {tr("E-mail já cadastrado.", "Email already registered.")}{" "}
                        <button
                          type="button"
                          onClick={() => { setMode("login"); setErrorMessage(null); }}
                          className="underline hover:text-primary"
                        >
                          {tr("Fazer login?", "Sign in?")}
                        </button>
                      </p>
                    ) : emailStatus === "available" ? (
                      <p className="flex items-center gap-1 text-[0.7rem] text-emerald-400">
                        <CheckCircle2 className="size-3" /> {tr("E-mail disponível!", "Email available!")}
                      </p>
                    ) : null}
                  </div>

                  {/* Confirmar E-mail */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 light:text-slate-600">{tr("Confirmar e-mail", "Confirm email")}</label>
                    <Input
                      value={confirmEmail}
                      onChange={(event) => { setConfirmEmail(event.target.value); setErrorMessage(null); }}
                      placeholder="Repita o seu e-mail"
                      className="field-shell"
                      type="email"
                      disabled={loading}
                      autoComplete="email"
                      aria-label={tr("Confirmar e-mail", "Confirm email")}
                    />
                    {confirmEmail && !emailsMatch ? (
                      <p className="text-[0.7rem] text-amber-400">{tr("Os e-mails não coincidem.", "The emails don't match.")}</p>
                    ) : confirmEmail && emailsMatch ? (
                      <p className="flex items-center gap-1 text-[0.7rem] text-emerald-400">
                        <CheckCircle2 className="size-3" /> {tr("E-mails conferem.", "Emails match.")}
                      </p>
                    ) : null}
                  </div>

                  {/* Senha */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 light:text-slate-600">{tr("Senha", "Password")}</label>
                    <Input
                      value={password}
                      onChange={(event) => { setPassword(event.target.value); setErrorMessage(null); }}
                      type="password"
                      placeholder={tr("Crie uma senha forte", "Create a strong password")}
                      className="field-shell"
                      disabled={loading}
                      autoComplete="new-password"
                      aria-label={tr("Senha", "Password")}
                    />
                  </div>

                  {/* Confirmar Senha */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 light:text-slate-600">{tr("Confirmar senha", "Confirm password")}</label>
                    <Input
                      value={confirmPassword}
                      onChange={(event) => { setConfirmPassword(event.target.value); setErrorMessage(null); }}
                      type="password"
                      placeholder="Repita a senha"
                      className="field-shell"
                      disabled={loading}
                      autoComplete="new-password"
                      aria-label={tr("Confirmar senha", "Confirm password")}
                    />
                    {confirmPassword && !passwordsMatch ? (
                      <p className="text-[0.7rem] text-amber-400">{tr("As senhas não coincidem.", "The passwords don't match.")}</p>
                    ) : confirmPassword && passwordsMatch ? (
                      <p className="flex items-center gap-1 text-[0.7rem] text-emerald-400">
                        <CheckCircle2 className="size-3" /> {tr("Senhas conferem.", "Passwords match.")}
                      </p>
                    ) : null}
                  </div>

                  {/* Medidor de força de senha */}
                  {password ? (
                    <div className="rounded border border-white/10 bg-slate-900/40 p-3 light:bg-slate-100/70 md:col-span-2">
                      <PasswordStrengthMeter strength={passwordStrength} />
                    </div>
                  ) : null}

                  {/* Termos e Política */}
                  <div className="text-xs leading-5 text-slate-400 light:text-slate-600 md:col-span-2">
                    {tr("Ao criar sua conta, você concorda com os", "By creating an account you agree to the")}{" "}
                    <a href="/termos/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {tr("Termos de Uso", "Terms of Use")}
                    </a>{" "}
                    {tr("e a", "and the")}{" "}
                    <a href="/privacidade/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {tr("Política de Privacidade", "Privacy Policy")}
                    </a>{" "}
                    {tr("do AnaheimHub.", "of AnaheimHub.")}
                  </div>
                </>
              ) : (
                <>
                  {/* Modo Login */}
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-xs text-slate-400 light:text-slate-600">{tr("E-mail", "Email")}</label>
                    <Input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={tr("Seu email", "Your email")}
                      className="field-shell"
                      type="email"
                      disabled={loading}
                      autoComplete="email"
                      aria-label={tr("E-mail", "Email")}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-xs text-slate-400 light:text-slate-600">{tr("Senha", "Password")}</label>
                    <Input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      placeholder={tr("Sua senha", "Your password")}
                      className="field-shell"
                      disabled={loading}
                      autoComplete="current-password"
                      aria-label={tr("Senha", "Password")}
                    />
                  </div>
                  <Link href="/recuperar-senha" className="text-xs text-primary hover:underline md:col-span-2">
                    {tr("Esqueci minha senha", "Forgot my password")}
                  </Link>
                </>
              )}

              <div className="flex flex-wrap gap-3 pt-2 md:col-span-2">
                <Button
                  type="submit"
                  className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  disabled={loading || (mode === "register" && !isRegisterValid)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {tr("Processando...", "Processing...")}
                    </>
                  ) : mode === "login" ? (
                    tr("Entrar no painel", "Sign in")
                  ) : (
                    tr("Criar conta e entrar", "Create account and sign in")
                  )}
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.14em] text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"
                >
                  <Link href="/decks">{tr("Explorar decks públicos", "Browse public decks")}</Link>
                </Button>
              </div>
            </form>

            {GOOGLE_CLIENT_ID ? (
              <div className="space-y-3 border-t border-white/10 pt-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tr("ou entre com", "or sign in with")}</p>
                <div ref={googleButtonRef} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{tr("Recursos de Piloto", "Player features")}</p>
              <h3 className="mt-3 font-heading text-3xl uppercase">{tr("Tudo em um só lugar", "Everything in one place")}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                {tr("Salve suas listas, acompanhe a curva de custos com validação oficial em tempo real, organize suas cartas na pasta virtual e enfrente adversários na arena.", "Save your lists, follow your cost curve with real-time official validation, organize your cards in a virtual binder and face opponents in the arena.")}
              </p>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{tr("Acesso Seguro", "Secure access")}</p>
              {isAuthenticated ? (
                <>
                  <h3 className="mt-3 font-heading text-3xl uppercase">{tr("Você já está autenticado", "You're already signed in")}</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                    Sessão ativa como <span className="font-semibold text-primary">{user?.displayName}</span> (@{user?.username}).
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
                      <Link href="/profile">{tr("Abrir perfil", "Open profile")}</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mt-3 font-heading text-3xl uppercase">{tr("Padrão AnaheimHub", "The AnaheimHub way")}</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                    {tr("Cadastre-se com email e senha ou utilize sua conta Google. Suas credenciais são criptografadas com salting, e o login social utiliza OAuth 2.0 seguro.", "Sign up with email and password or use your Google account. Passwords are stored salted and hashed, and social sign-in uses secure OAuth 2.0.")}
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
