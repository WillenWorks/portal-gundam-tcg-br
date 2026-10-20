import { Link } from "wouter";
import { usePageMeta } from "@/lib/pageMeta";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSiteLanguage } from "@/i18n/siteLanguage";

export default function NotFound() {
  const { tr } = useSiteLanguage();
  usePageMeta({ title: tr("Página não encontrada", "Page not found"), noindex: true });
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="panel-cut w-full max-w-xl rounded-none border-white/10 bg-slate-950/80 text-white">
        <CardContent className="p-8 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{tr("Erro 404", "Error 404")}</p>
          <h1 className="mt-4 font-heading text-6xl uppercase leading-none">{tr("Página não encontrada", "Page not found")}</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {tr("O endereço não existe ou mudou de lugar. Volte para o início ou procure a carta no catálogo.", "This address doesn't exist or has moved. Go back home or look for the card in the catalog.")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/">{tr("Início", "Home")}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/cards">{tr("Catálogo de cartas", "Card catalog")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
