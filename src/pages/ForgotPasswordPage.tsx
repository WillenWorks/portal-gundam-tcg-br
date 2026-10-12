import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Loader2, MailCheck } from "lucide-react";
import { AuthFormCard, errorMessage } from "@/components/auth/AuthFormCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return setError("Informe o e-mail da sua conta.");
    setLoading(true);
    setError(null);
    try {
      const res = await api.forgotPassword(email.trim());
      setSentMessage(res?.message ?? "Se houver uma conta com este e-mail, enviamos um link para redefinir a senha.");
    } catch (err) {
      setError(errorMessage(err, "Não foi possível enviar agora. Tente de novo em alguns minutos."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFormCard eyebrow="Recuperar acesso" title="Esqueci minha senha">
      {sentMessage ? (
        <div className="space-y-4" role="status">
          <p className="flex items-start gap-3 text-sm leading-7 text-slate-300 light:text-slate-600">
            <MailCheck className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
            {sentMessage} Confira também a caixa de spam. O link vale por 1 hora.
          </p>
          <Link href="/login" className="text-sm text-primary hover:underline">Voltar para o login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-sm leading-7 text-slate-300 light:text-slate-600">
            Informe o e-mail da sua conta. Se ele estiver cadastrado, você recebe um link para criar uma nova senha.
          </p>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Seu e-mail"
            className="field-shell"
            autoComplete="email"
            disabled={loading}
            aria-label="E-mail"
          />
          {error ? <p className="text-sm text-red-400" role="alert">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={loading} className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Enviar link
            </Button>
            <Link href="/login" className="text-sm text-primary hover:underline">Voltar para o login</Link>
          </div>
        </form>
      )}
    </AuthFormCard>
  );
}
