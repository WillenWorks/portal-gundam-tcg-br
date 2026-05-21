import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { rulesService } from "@/services/portal-service";

export default function RulesPage() {
  const items = rulesService.list();

  return (
    <PortalShell>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Knowledge base</p>
            <h2 className="mt-2 font-heading text-4xl uppercase">Regras, FAQ e explicações em pt-BR</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              Aqui já existe a separação por categoria, fonte e assunto. Quando a camada de IA entrar com revisão humana,
              esse módulo pode oferecer busca contextual, exemplos de jogada e comparação entre original e tradução.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{item.category}</Badge>
                  <Badge variant="outline" className="rounded-none border-white/20 text-slate-300">{item.source}</Badge>
                  {item.relatedKeyword ? (
                    <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{item.relatedKeyword}</Badge>
                  ) : null}
                </div>
                <h3 className="mt-4 font-heading text-3xl uppercase leading-none">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{item.summaryPt}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">Fonte-base: {item.originalRef}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
