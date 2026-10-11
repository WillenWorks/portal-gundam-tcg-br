import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthFormCard, errorMessage, tokenFromUrl } from "@/components/auth/AuthFormCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

const MIN_LENGTH = 8;

export default function ResetPasswordPage() {
  const [token] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_LENGTH) return setError(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`);
    if (password !== confirm) return setError("As duas senhas não são iguais.");
    setLoading(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, "Não foi possível redefinir a senha. Peça um novo link."));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthFormCard eyebrow="Recuperar acesso" title="Link incompleto">
        <p className="text-sm leading-7 text-slate-300 light:text-slate-600">Este endereço não traz o código de redefinição. Abra o link direto do e-mail ou peça um novo.</p>
        <Link href="/recuperar-senha" className="text-sm text-primary hover:underline">Pedir um novo link</Link>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard eyebrow="Recuperar acesso" title="Criar nova senha">
      {done ? (
        <div className="space-y-4" role="status">
          <p className="flex items-start gap-3 text-sm leading-7 text-slate-300 light:text-slate-600">
            <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
            Senha redefinida. Já pode entrar com a nova senha.
          </p>
          <Button asChild className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={`Nova senha (mínimo ${MIN_LENGTH} caracteres)`} className="field-shell" autoComplete="new-password" disabled={loading} aria-label="Nova senha" />
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" placeholder="Repita a nova senha" className="field-shell" autoComplete="new-password" disabled={loading} aria-label="Repita a nova senha" />
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error} {/link/i.test(error) ? <Link href="/recuperar-senha" className="text-primary hover:underline">Pedir um novo link</Link> : null}
            </p>
          ) : null}
          <Button type="submit" disabled={loading} className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Salvar nova senha
          </Button>
        </form>
      )}
    </AuthFormCard>
  );
}
