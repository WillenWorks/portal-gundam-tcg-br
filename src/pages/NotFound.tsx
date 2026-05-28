import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="panel-cut w-full max-w-xl rounded-none border-white/10 bg-slate-950/80 text-white">
        <CardContent className="p-8 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Erro de rota</p>
          <h1 className="mt-4 font-heading text-6xl uppercase leading-none">Setor não encontrado</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            A rota pedida não existe neste build. Volte para a landing pública ou entre no portal interno.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/">Landing</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/login">Login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
