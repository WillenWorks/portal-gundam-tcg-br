import { useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthFormCard, errorMessage, tokenFromUrl } from "@/components/auth/AuthFormCard";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evaluatePasswordStrength, validatePasswordStrength } from "@/lib/passwordStrength";
import { api } from "@/lib/api";
import { useSiteLanguage } from "@/i18n/siteLanguage";

export default function ResetPasswordPage() {
  const { tr } = useSiteLanguage();
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
      return setError(validation.error || tr("A senha não atende aos requisitos de segurança.", "The password doesn't meet the security requirements."));
    }
    if (password !== confirm) {
      return setError(tr("As duas senhas não são iguais.", "The two passwords don't match."));
    }
    setLoading(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, tr("Não foi possível redefinir a senha. Peça um novo link.", "Couldn't reset the password. Request a new link.")));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthFormCard eyebrow={tr("Recuperar acesso", "Recover access")} title={tr("Link incompleto", "Incomplete link")}>
        <p className="text-sm leading-7 text-slate-300 light:text-slate-600">{tr("Este endereço não traz o código de redefinição. Abra o link direto do e-mail ou peça um novo.", "This address has no reset code. Open the link straight from the email or request a new one.")}</p>
        <Link href="/recuperar-senha" className="text-sm text-primary hover:underline">{tr("Pedir um novo link", "Request a new link")}</Link>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard eyebrow={tr("Recuperar acesso", "Recover access")} title={tr("Criar nova senha", "Create a new password")}>
      {done ? (
        <div className="space-y-4" role="status">
          <p className="flex items-start gap-3 text-sm leading-7 text-slate-300 light:text-slate-600">
            <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
            {tr("Senha redefinida com sucesso. Já pode entrar com a nova credencial.", "Password reset. You can sign in with the new password.")}
          </p>
          <Button asChild className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90">
            <Link href="/login">{tr("Ir para o login", "Go to sign in")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label className="text-xs text-slate-400 light:text-slate-600">{tr("Nova senha", "New password")}</label>
            <Input
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              type="password"
              placeholder={tr("Digite sua nova senha", "Type your new password")}
              className="field-shell"
              autoComplete="new-password"
              disabled={loading}
              aria-label={tr("Nova senha", "New password")}
            />
          </div>

          {password ? (
            <div className="rounded border border-white/10 bg-slate-900/40 p-3 light:bg-slate-100/70">
              <PasswordStrengthMeter strength={strength} />
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-xs text-slate-400 light:text-slate-600">{tr("Confirmar nova senha", "Confirm new password")}</label>
            <Input
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (error) setError(null);
              }}
              type="password"
              placeholder={tr("Repita a nova senha", "Repeat the new password")}
              className="field-shell"
              autoComplete="new-password"
              disabled={loading}
              aria-label={tr("Repita a nova senha", "Repeat the new password")}
            />
            {confirm && !passwordsMatch ? (
              <p className="pt-1 text-xs text-amber-400">{tr("As senhas digitadas não são iguais.", "The passwords don't match.")}</p>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error} {/link/i.test(error) ? <Link href="/recuperar-senha" className="text-primary hover:underline">{tr("Pedir um novo link", "Request a new link")}</Link> : null}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={loading || !strength.isStrong || !passwordsMatch || !confirm}
            className="rounded-none bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {tr("Salvar nova senha", "Save new password")}
          </Button>
        </form>
      )}
    </AuthFormCard>
  );
}
