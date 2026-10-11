import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AuthFormCard, errorMessage, tokenFromUrl } from "@/components/auth/AuthFormCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function VerifyEmailPage() {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<"checking" | "ok" | "error">("checking");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
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
    try {
      const res = await api.resendVerificationEmail();
      setMessage(res?.message ?? "Enviamos um novo link.");
    } catch (err) {
      setMessage(errorMessage(err, "Não foi possível reenviar agora."));
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
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
              <Link href={isAuthenticated ? "/profile" : "/login"}>{isAuthenticated ? "Ir para o perfil" : "Entrar"}</Link>
            </Button>
            {state === "error" && isAuthenticated ? (
              <Button type="button" variant="outline" onClick={resend} disabled={resending} className="rounded-none text-xs uppercase tracking-[0.14em]">
                {resending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Enviar novo link
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </AuthFormCard>
  );
}
