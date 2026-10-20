// Utilitário de validação e cálculo de força de senha
// Padrão de segurança: mínimo 8 caracteres, maiúsculas, minúsculas, números e caracteres especiais.
// Textos no idioma do site (tr do núcleo de idioma: lê o idioma atual na hora da chamada).
import { tr } from "@/i18n/siteLanguageCore";

export interface PasswordRequirement {
  id: "length" | "upper" | "lower" | "number" | "special";
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  isStrong: boolean;
  requirements: PasswordRequirement[];
}

export const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  const p = password || "";
  if (p.length < 8) {
    return { valid: false, error: tr("A senha precisa ter pelo menos 8 caracteres.", "Password must be at least 8 characters.") };
  }
  if (!/[A-Z]/.test(p)) {
    return { valid: false, error: tr("A senha precisa conter pelo menos uma letra maiúscula (A-Z).", "Password must contain at least one uppercase letter (A-Z).") };
  }
  if (!/[a-z]/.test(p)) {
    return { valid: false, error: tr("A senha precisa conter pelo menos uma letra minúscula (a-z).", "Password must contain at least one lowercase letter (a-z).") };
  }
  if (!/[0-9]/.test(p)) {
    return { valid: false, error: tr("A senha precisa conter pelo menos um número (0-9).", "Password must contain at least one number (0-9).") };
  }
  if (!SPECIAL_CHARS_REGEX.test(p)) {
    return { valid: false, error: tr("A senha precisa conter pelo menos um caractere especial (!@#$%).", "Password must contain at least one special character (!@#$%).") };
  }
  return { valid: true };
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const p = password || "";
  const hasMinLength = p.length >= 8;
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasNumber = /[0-9]/.test(p);
  const hasSpecial = SPECIAL_CHARS_REGEX.test(p);

  const requirements: PasswordRequirement[] = [
    { id: "length", label: tr("Mínimo de 8 caracteres", "At least 8 characters"), met: hasMinLength },
    { id: "upper", label: tr("Letra maiúscula (A-Z)", "Uppercase letter (A-Z)"), met: hasUpper },
    { id: "lower", label: tr("Letra minúscula (a-z)", "Lowercase letter (a-z)"), met: hasLower },
    { id: "number", label: tr("Número (0-9)", "Number (0-9)"), met: hasNumber },
    { id: "special", label: tr("Caractere especial (!@#$...)", "Special character (!@#$...)"), met: hasSpecial },
  ];

  const metCount = requirements.filter((r) => r.met).length;

  let score: 0 | 1 | 2 | 3 | 4;
  let label: PasswordStrength["label"];
  let color: string;

  if (p.length === 0) {
    score = 0;
    label = tr("Muito fraca", "Very weak");
    color = "bg-slate-600";
  } else if (!hasMinLength || metCount <= 2) {
    score = 1;
    label = tr("Fraca", "Weak");
    color = "bg-red-500";
  } else if (metCount === 3) {
    score = 2;
    label = tr("Média", "Fair");
    color = "bg-amber-500";
  } else if (metCount === 4) {
    score = 3;
    label = tr("Boa", "Good");
    color = "bg-blue-400";
  } else {
    score = 4;
    label = tr("Forte", "Strong");
    color = "bg-emerald-400";
  }

  const isStrong = metCount === 5;

  return { score, label, color, isStrong, requirements };
}
