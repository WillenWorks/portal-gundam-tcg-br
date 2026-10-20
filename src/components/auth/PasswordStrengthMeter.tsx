import { useMemo } from "react";
import { Check, Circle } from "lucide-react";
import { evaluatePasswordStrength, type PasswordStrength } from "@/lib/passwordStrength";
import { cn } from "@/lib/utils";
import { useSiteLanguage } from "@/i18n/siteLanguage";

interface PasswordStrengthMeterProps {
  password?: string;
  strength?: PasswordStrength;
  className?: string;
  showRequirements?: boolean;
}

export function PasswordStrengthMeter({
  password = "",
  strength: providedStrength,
  className,
  showRequirements = true,
}: PasswordStrengthMeterProps) {
  const { tr } = useSiteLanguage();
  const strength = useMemo(() => {
    return providedStrength ?? evaluatePasswordStrength(password);
  }, [providedStrength, password]);

  if (!password && !providedStrength) return null;

  return (
    <div className={cn("space-y-2 pt-1", className)} aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 light:text-slate-500">{tr("Força da senha", "Password strength")}</span>
        <span
          className={cn(
            "font-semibold transition-colors",
            strength.score === 4 && "text-emerald-400",
            strength.score === 3 && "text-blue-400",
            strength.score === 2 && "text-amber-400",
            strength.score <= 1 && "text-red-400"
          )}
        >
          {strength.label}
        </span>
      </div>

      <div className="flex gap-1.5 h-1.5 w-full">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={cn(
              "h-full flex-1 rounded-none transition-all duration-300",
              step <= strength.score ? strength.color : "bg-slate-700/60 light:bg-slate-300"
            )}
          />
        ))}
      </div>

      {showRequirements && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs">
          {strength.requirements.map((req) => (
            <li
              key={req.id}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                req.met ? "text-emerald-400 font-medium" : "text-slate-400 light:text-slate-500"
              )}
            >
              {req.met ? (
                <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden />
              ) : (
                <Circle className="size-2.5 shrink-0 text-slate-500 light:text-slate-400" aria-hidden />
              )}
              <span>{req.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
