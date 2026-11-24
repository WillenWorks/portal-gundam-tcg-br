import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ExternalLink, LogIn, MessageCircleQuestion, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { api, ApiError, type RulesAskResponse, type RulesSource } from "@/lib/api";

const MAX_QUESTION = 400;

/** "[1]" no texto da resposta vira link para a fonte */
function AnswerText({ text, sources }: { text: string; sources: RulesSource[] }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="text-sm leading-7">
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        const source = m ? sources.find((s) => s.n === Number(m[1])) : undefined;
        if (!source) return <span key={i}>{part}</span>;
        return (
          <Link key={i} href={source.href} className="mx-0.5 align-super text-[0.7rem] font-semibold text-primary hover:underline" title={source.title}>
            [{source.n}]
          </Link>
        );
      })}
    </p>
  );
}

function SourceList({ sources, highlight }: { sources: RulesSource[]; highlight?: number[] }) {
  const { tr } = useSiteLanguage();
  const kindLabel = (s: RulesSource) =>
    s.kind === "card_faq"
      ? tr("FAQ da carta", "Card FAQ")
      : s.kind === "card_text"
        ? tr("Texto da carta", "Card text")
        : s.kind === "keyword"
          ? tr("Glossário", "Glossary")
          : tr("Regra", "Ruling");
  return (
    <ol className="space-y-2">
      {sources.map((s) => (
        <li key={s.id} className={`flex flex-wrap items-baseline gap-2 text-xs ${highlight && !highlight.includes(s.n) ? "opacity-60" : ""}`}>
          <span className="font-semibold text-primary">[{s.n}]</span>
          <Badge variant="outline" className="rounded-none px-1.5 py-0 text-[0.65rem]">
            {kindLabel(s)}
          </Badge>
          <Link href={s.href} className="hover:underline">
            {s.question}
          </Link>
          {s.autoTranslated ? <span className="text-muted-portal">({tr("tradução automática", "machine translation")})</span> : null}
          {s.officialUrl ? (
            <a href={s.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-muted-portal hover:underline">
              {tr("oficial", "official")} <ExternalLink className="size-3" />
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function RulesAssistantBox() {
  const { tr } = useSiteLanguage();
  const { isAuthenticated } = useAuth();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RulesAskResponse | null>(null);
  const [limitSources, setLimitSources] = useState<{ message: string; sources: RulesSource[] } | null>(null);
  const [feedback, setFeedback] = useState<1 | -1 | null>(null);

  async function ask(event: FormEvent) {
    event.preventDefault();
    const q = question.trim();
    if (q.length < 3 || loading) return;
    setLoading(true);
    setResult(null);
    setLimitSources(null);
    setFeedback(null);
    try {
      setResult(await api.askRules(q));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        // sem cota: mostra os trechos mais próximos (a busca não gasta cota)
        const { sources } = await api.searchRules(q).catch(() => ({ sources: [] as RulesSource[] }));
        setLimitSources({ message: err.message, sources });
      } else {
        toast.error(err instanceof Error ? err.message : tr("Não deu para perguntar agora.", "Couldn't ask right now."));
      }
    } finally {
      setLoading(false);
    }
  }

  async function rate(value: 1 | -1) {
    if (!result || feedback) return;
    setFeedback(value);
    try {
      await api.rateRulesAnswer(result.id, value);
      toast.success(value === 1 ? tr("Valeu pelo retorno!", "Thanks for the feedback!") : tr("Anotado: vamos revisar essa resposta.", "Noted: we'll review this answer."));
    } catch {
      setFeedback(null);
    }
  }

  return (
    <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="size-5 text-primary" />
          <h2 className="font-heading text-xl uppercase">{tr("Pergunte em português", "Ask a rules question")}</h2>
          <Badge variant="outline" className="rounded-none border-primary/40 text-[0.65rem] text-primary">
            beta
          </Badge>
        </div>
        <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION))}
            placeholder={tr("Ex.: meu Blocker descansado pode bloquear?", "E.g.: can my rested Blocker block?")}
            aria-label={tr("Pergunta sobre as regras", "Rules question")}
            disabled={!isAuthenticated || loading}
          />
          {isAuthenticated ? (
            <Button type="submit" disabled={loading || question.trim().length < 3} className="rounded-none">
              {loading ? tr("Consultando…", "Searching…") : tr("Perguntar", "Ask")}
            </Button>
          ) : (
            <Button asChild variant="outline" className="rounded-none">
              <Link href="/login">
                <LogIn className="mr-1.5 size-4" />
                {tr("Entre para perguntar", "Sign in to ask")}
              </Link>
            </Button>
          )}
        </form>

        {result ? (
          <div className="space-y-3 border-l-2 border-primary/50 pl-4">
            {result.notFound ? (
              <p className="text-sm text-muted-portal">
                {result.assistantAvailable
                  ? tr("Não encontrei isso nas regras do portal. Estes são os trechos mais próximos:", "I couldn't find this in the portal's rules. These are the closest entries:")
                  : tr("O assistente está fora do ar; estes são os trechos mais próximos:", "The assistant is offline; these are the closest entries:")}
              </p>
            ) : (
              <AnswerText text={result.answer} sources={result.sources} />
            )}
            <SourceList sources={result.notFound ? result.sources.slice(0, 5) : result.sources} highlight={result.notFound ? undefined : result.cited} />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-portal">
              {!result.notFound ? (
                <span>{tr("Resposta gerada a partir das regras e do FAQ oficiais; na dúvida, vale o texto oficial.", "Answer generated from the official rules and FAQ; when in doubt, the official text prevails.")}</span>
              ) : null}
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => rate(1)} disabled={feedback !== null} aria-label={tr("Resposta útil", "Helpful answer")} className={`p-1 ${feedback === 1 ? "text-primary" : "hover:text-primary"}`}>
                  <ThumbsUp className="size-4" />
                </button>
                <button type="button" onClick={() => rate(-1)} disabled={feedback !== null} aria-label={tr("Resposta errada ou incompleta", "Wrong or incomplete answer")} className={`p-1 ${feedback === -1 ? "text-destructive" : "hover:text-destructive"}`}>
                  <ThumbsDown className="size-4" />
                </button>
              </span>
              <span>{tr(`${result.remainingToday} perguntas restantes hoje`, `${result.remainingToday} questions left today`)}</span>
            </div>
          </div>
        ) : null}

        {limitSources ? (
          <div className="space-y-3 border-l-2 border-amber-400/60 pl-4">
            <p className="text-sm text-muted-portal">{limitSources.message}</p>
            <SourceList sources={limitSources.sources} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
