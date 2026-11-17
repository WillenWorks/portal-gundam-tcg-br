/* Tags de reconhecimento de uma conta (catálogo em src/lib/supporters.ts; o admin dá na aba Apoiadores). */
import { cn } from "@/lib/utils";
import { userTagInfo } from "@/lib/supporters";
import { useSiteLanguage } from "@/i18n/siteLanguage";

const TONES: Record<string, string> = {
  primary: "border-primary/50 bg-primary/10 text-primary",
  emerald: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300 light:text-emerald-700",
  amber: "border-amber-400/50 bg-amber-400/10 text-amber-300 light:text-amber-700",
  violet: "border-violet-400/50 bg-violet-400/10 text-violet-300 light:text-violet-700",
  pink: "border-pink-400/50 bg-pink-400/10 text-pink-300 light:text-pink-700",
  sky: "border-sky-400/50 bg-sky-400/10 text-sky-300 light:text-sky-700",
  yellow: "border-yellow-400/50 bg-yellow-400/10 text-yellow-300 light:text-yellow-700",
  red: "border-red-400/50 bg-red-400/10 text-red-300 light:text-red-700",
};

export function UserTagChips({ tags, className }: { tags?: string[] | null; className?: string }) {
  const { tr } = useSiteLanguage();
  const known = (tags ?? []).map(userTagInfo).filter((t) => t !== null);
  if (!known.length) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {known.map((t) => (
        <span key={t.key} className={cn("inline-flex h-6 items-center border px-2 font-mono text-[10px] uppercase tracking-[0.12em]", TONES[t.tone] ?? TONES.primary)}>
          {tr(t.label, t.labelEn)}
        </span>
      ))}
    </span>
  );
}
