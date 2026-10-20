import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { AuthFormCard, errorMessage, tokenFromUrl } from "@/components/auth/AuthFormCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useSiteLanguage } from "@/i18n/siteLanguage";

export default function VerifyEmailPage() {
  const { tr } = useSiteLanguage();
  const { isAuthenticated, refreshMe } = useAuth();
  const [state, setState] = useState<"checking" | "ok" | "error">("checking");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // o token é de uso único: em StrictMode o efeito roda duas vezes, a segunda daria "já usado"
    if (started.current) return;
    started.current = true;
    const token = tokenFromUrl();
    if (!token) {
      setState("error");
      setMessage(tr("Este endereço não traz o código de confirmação. Abra o link direto do e-mail.", "This address has no confirmation code. Open the link straight from the email."));
      return;
    }
    api
      .verifyEmail(token)
      .then(async (res) => {
        setState("ok");
        setMessage(res?.message ?? tr("E-mail confirmado. Obrigado!", "Email confirmed. Thanks!"));
        // Sincroniza o usuário em cache na sessão local caso já esteja logado
        try {
          await refreshMe();
        } catch {
          // não logado ou token expirado na sessão
        }
      })
      .catch((err) => {
        setState("error");
        setMessage(errorMessage(err, tr("Não foi possível confirmar o e-mail.", "Couldn't confirm the email.")));
      });
  }, [refreshMe]);

  const resend = async () => {
    setResending(true);
    setResendError(null);
    setResendSuccess(null);
    try {
      const res = await api.resendVerificationEmail();
      const msg = res?.message ?? tr("Enviamos um novo link.", "We sent a new link.");
      setMessage(msg);
      setResendSuccess(msg);
    } catch (err) {
      setMessage(errorMessage(err, tr("Não foi possível reenviar agora.", "Couldn't resend right now.")));
    } finally {
      setResending(false);
    }
  };

  const submitPublicResend = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return setResendError("Informe o seu e-mail.");
    setResending(true);
    setResendError(null);
    setResendSuccess(null);
    try {
      const res = await api.requestVerificationEmail(emailInput.trim());
      setResendSuccess(res?.message ?? tr("Se houver uma conta pendente com este e-mail, enviamos um novo link.", "If there's a pending account with this email, we sent a new link."));
    } catch (err) {
      setResendError(errorMessage(err, tr("Não foi possível reenviar agora. Tente mais tarde.", "Couldn't resend right now. Try again later.")));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthFormCard eyebrow={tr("Sua conta", "Your account")} title={tr("Confirmação de e-mail", "Email confirmation")}>
      {state === "checking" ? (
        <p className="flex items-center gap-3 text-sm text-slate-300 light:text-slate-600" role="status">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden /> {tr("Confirmando...", "Confirming...")}
        </p>
      ) : (
        <div className="space-y-4" role="status">
          <p className="flex items-start gap-3 text-sm leading-7 text-slate-300 light:text-slate-600">
            {state === "ok" ? <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary" aria-hidden /> : <XCircle className="mt-1 size-5 shrink-0 text-red-400" aria-hidden />}
            {message}
          </p>

          {state === "error" ? (
            <div className="rounded border border-white/10 bg-slate-900/50 p-4 text-xs leading-6 text-slate-300">
              <p className="font-semibold text-amber-300">{tr("O link de confirmação tem validade de 48 horas.", "The confirmation link is valid for 48 hours.")}</p>
              <p className="mt-1 text-slate-400">{tr("Se o link expirou ou já foi utilizado, você pode solicitar um novo link abaixo:", "If the link expired or was already used, you can request a new one below:")}</p>

              {isAuthenticated ? (
                <div className="mt-3">
                  <Button type="button" variant="outline" onClick={resend} disabled={resending} className="rounded-none text-xs uppercase tracking-[0.14em]">
                    {resending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
                    {tr("Reenviar novo link para minha conta", "Resend a new link to my account")}
                  </Button>
                </div>
              ) : (
                <form onSubmit={submitPublicResend} className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder={tr("Seu e-mail cadastrado", "Your registered email")}
                      className="field-shell max-w-xs"
                      disabled={resending}
                      autoComplete="email"
                    />
                    <Button type="submit" disabled={resending} className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
                      {resending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      {tr("Reenviar link", "Resend link")}
                    </Button>
                  </div>
                  {resendError ? <p className="text-xs text-red-400">{resendError}</p> : null}
                  {resendSuccess ? <p className="text-xs text-emerald-400">{resendSuccess}</p> : null}
                </form>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button asChild className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
              <Link href={isAuthenticated ? "/profile" : "/login"}>{isAuthenticated ? tr("Ir para o perfil", "Go to profile") : tr("Ir para o Login", "Go to sign in")}</Link>
            </Button>
          </div>
        </div>
      )}
    </AuthFormCard>
  );
}
