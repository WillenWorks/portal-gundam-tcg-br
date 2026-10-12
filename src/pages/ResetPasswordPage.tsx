import { useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthFormCard, errorMessage, tokenFromUrl } from "@/components/auth/AuthFormCard";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evaluatePasswordStrength, validatePasswordStrength } from "@/lib/passwordStrength";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const [token] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const passwordsMatch = !confirm || password === confirm;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
      return setError(validation.error || "A senha não atende aos requisitos de segurança.");
    }
    if (password !== confirm) {
      return setError("As duas senhas não são iguais.");
    }
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
            Senha redefinida com sucesso. Já pode entrar com a nova credencial.
          </p>
          <Button asChild className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label className="text-xs text-slate-400 light:text-slate-600">Nova senha</label>
            <Input
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              type="password"
              placeholder="Digite sua nova senha"
              className="field-shell"
              autoComplete="new-password"
              disabled={loading}
              aria-label="Nova senha"
            />
          </div>

          {password ? (
            <div className="rounded border border-white/10 bg-slate-900/40 p-3 light:bg-slate-100/70">
              <PasswordStrengthMeter strength={strength} />
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-xs text-slate-400 light:text-slate-600">Confirmar nova senha</label>
            <Input
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (error) setError(null);
              }}
              type="password"
              placeholder="Repita a nova senha"
              className="field-shell"
              autoComplete="new-password"
              disabled={loading}
              aria-label="Repita a nova senha"
            />
            {confirm && !passwordsMatch ? (
              <p className="pt-1 text-xs text-amber-400">As senhas digitadas não são iguais.</p>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error} {/link/i.test(error) ? <Link href="/recuperar-senha" className="text-primary hover:underline">Pedir um novo link</Link> : null}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={loading || !strength.isStrong || !passwordsMatch || !confirm}
            className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Salvar nova senha
          </Button>
        </form>
      )}
    </AuthFormCard>
  );
}
