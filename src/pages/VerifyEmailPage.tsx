import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { AuthFormCard, errorMessage, tokenFromUrl } from "@/components/auth/AuthFormCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function VerifyEmailPage() {
  const { isAuthenticated } = useAuth();
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
      setMessage("Este endereço não traz o código de confirmação. Abra o link direto do e-mail.");
      return;
    }
    api
      .verifyEmail(token)
      .then((res) => {
        setState("ok");
        setMessage(res?.message ?? "E-mail confirmado. Obrigado!");
      })
      .catch((err) => {
        setState("error");
        setMessage(errorMessage(err, "Não foi possível confirmar o e-mail."));
      });
  }, []);

  const resend = async () => {
    setResending(true);
    setResendError(null);
    setResendSuccess(null);
    try {
      const res = await api.resendVerificationEmail();
      const msg = res?.message ?? "Enviamos um novo link.";
      setMessage(msg);
      setResendSuccess(msg);
    } catch (err) {
      setMessage(errorMessage(err, "Não foi possível reenviar agora."));
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
      setResendSuccess(res?.message ?? "Se houver uma conta pendente com este e-mail, enviamos um novo link.");
    } catch (err) {
      setResendError(errorMessage(err, "Não foi possível reenviar agora. Tente mais tarde."));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthFormCard eyebrow="Sua conta" title="Confirmação de e-mail">
      {state === "checking" ? (
        <p className="flex items-center gap-3 text-sm text-slate-300 light:text-slate-600" role="status">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden /> Confirmando...
        </p>
      ) : (
        <div className="space-y-4" role="status">
          <p className="flex items-start gap-3 text-sm leading-7 text-slate-300 light:text-slate-600">
            {state === "ok" ? <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary" aria-hidden /> : <XCircle className="mt-1 size-5 shrink-0 text-red-400" aria-hidden />}
            {message}
          </p>

          {state === "error" ? (
            <div className="rounded border border-white/10 bg-slate-900/50 p-4 text-xs leading-6 text-slate-300">
              <p className="font-semibold text-amber-300">O link de confirmação tem validade de 48 horas.</p>
              <p className="mt-1 text-slate-400">Se o link expirou ou já foi utilizado, você pode solicitar um novo link abaixo:</p>

              {isAuthenticated ? (
                <div className="mt-3">
                  <Button type="button" variant="outline" onClick={resend} disabled={resending} className="rounded-none text-xs uppercase tracking-[0.14em]">
                    {resending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
                    Reenviar novo link para minha conta
                  </Button>
                </div>
              ) : (
                <form onSubmit={submitPublicResend} className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="Seu e-mail cadastrado"
                      className="field-shell max-w-xs"
                      disabled={resending}
                      autoComplete="email"
                    />
                    <Button type="submit" disabled={resending} className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
                      {resending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      Reenviar link
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
              <Link href={isAuthenticated ? "/profile" : "/login"}>{isAuthenticated ? "Ir para o perfil" : "Ir para o Login"}</Link>
            </Button>
          </div>
        </div>
      )}
    </AuthFormCard>
  );
}
