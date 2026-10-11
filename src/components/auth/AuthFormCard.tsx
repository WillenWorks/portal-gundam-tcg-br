import type { ReactNode } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

/** Moldura das telas de conta (recuperar senha, redefinir senha, confirmar e-mail). */
export function AuthFormCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <PublicShell>
      <section className="mx-auto w-full max-w-xl px-4 py-10 md:py-16">
        <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
          <CardContent className="space-y-5 p-6 md:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 light:text-slate-500">{eyebrow}</p>
              <h1 className="mt-3 font-heading text-3xl uppercase md:text-4xl">{title}</h1>
            </div>
            {children}
          </CardContent>
        </Card>
      </section>
    </PublicShell>
  );
}

/** Lê ?token= da URL (os links dos e-mails). */
export function tokenFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
