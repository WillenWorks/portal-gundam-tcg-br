// Utilitário de validação e cálculo de força de senha
// Padrão de segurança: mínimo 8 caracteres, maiúsculas, minúsculas, números e caracteres especiais.

export interface PasswordRequirement {
  id: "length" | "upper" | "lower" | "number" | "special";
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Muito fraca" | "Fraca" | "Média" | "Boa" | "Forte";
  color: string;
  isStrong: boolean;
  requirements: PasswordRequirement[];
}

export const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  const p = password || "";
  if (p.length < 8) {
    return { valid: false, error: "A senha precisa ter pelo menos 8 caracteres." };
  }
  if (!/[A-Z]/.test(p)) {
    return { valid: false, error: "A senha precisa conter pelo menos uma letra maiúscula (A-Z)." };
  }
  if (!/[a-z]/.test(p)) {
    return { valid: false, error: "A senha precisa conter pelo menos uma letra minúscula (a-z)." };
  }
  if (!/[0-9]/.test(p)) {
    return { valid: false, error: "A senha precisa conter pelo menos um número (0-9)." };
  }
  if (!SPECIAL_CHARS_REGEX.test(p)) {
    return { valid: false, error: "A senha precisa conter pelo menos um caractere especial (!@#$%)." };
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
    { id: "length", label: "Mínimo de 8 caracteres", met: hasMinLength },
    { id: "upper", label: "Letra maiúscula (A-Z)", met: hasUpper },
    { id: "lower", label: "Letra minúscula (a-z)", met: hasLower },
    { id: "number", label: "Número (0-9)", met: hasNumber },
    { id: "special", label: "Caractere especial (!@#$...)", met: hasSpecial },
  ];

  const metCount = requirements.filter((r) => r.met).length;

  let score: 0 | 1 | 2 | 3 | 4;
  let label: PasswordStrength["label"];
  let color: string;

  if (p.length === 0) {
    score = 0;
    label = "Muito fraca";
    color = "bg-slate-600";
  } else if (!hasMinLength || metCount <= 2) {
    score = 1;
    label = "Fraca";
    color = "bg-red-500";
  } else if (metCount === 3) {
    score = 2;
    label = "Média";
    color = "bg-amber-500";
  } else if (metCount === 4) {
    score = 3;
    label = "Boa";
    color = "bg-blue-400";
  } else {
    score = 4;
    label = "Forte";
    color = "bg-emerald-400";
  }

  const isStrong = metCount === 5;

  return { score, label, color, isStrong, requirements };
}
